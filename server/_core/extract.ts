import type { Express, Request, Response } from "express";
import { authenticateRequest } from "./auth";

/**
 * Extracts lab results from an uploaded report image/PDF.
 * The file is processed in memory and never written to disk or stored.
 * Returns structured data for the user to review before saving.
 */

const SYSTEM_PROMPT = `أنت مساعد لاستخراج نتائج التحاليل المخبرية من صور وملفات التقارير الطبية.

مهمتك: اقرأ التقرير واستخرج البيانات بدقة تامة. لا تخمّن أبداً.

بعض التقارير ليست أرقاماً بل نصوص وصفية (أشعة، خزعات، تقارير أطباء). في هذه الحالة:
- اضبط "reportKind" على "narrative"
- اترك "results" فارغة
- املأ "summaryAr" بملخص عربي مبسّط في ٢-٤ جمل يفهمه شخص غير طبيب
- املأ "clinicalText" بنص التقرير الطبي كما ورد بالإنجليزية (الانطباع والنتائج الأساسية)

أما تقارير التحاليل الرقمية فاضبط "reportKind" على "labs" واملأ "results".

أعد JSON فقط بدون أي نص إضافي وبدون علامات markdown، بهذا الشكل:
{
  "reportKind": "labs أو narrative",
  "reportType": "نوع التقرير بالعربية: تحاليل مختبرية | أشعة | خزعة | تقرير طبيب",
  "summaryAr": "ملخص عربي مبسّط للتقارير الوصفية، أو null",
  "clinicalText": "النص الطبي الأصلي للتقارير الوصفية، أو null",
  "examDate": "YYYY-MM-DD أو null",
  "facility": "اسم المختبر/المستشفى أو null",
  "physician": "اسم الطبيب أو null",
  "results": [
    {
      "label": "اسم الفحص بالعربية",
      "category": "التصنيف: الدم | الكلى | الكبد | الدهون | السكر | الغدة الدرقية | الفيتامينات والمعادن | الحديد والالتهاب | البول | البروتينات | تخثر الدم | الكيمياء الحيوية | أخرى",
      "value": "القيمة كما ظهرت",
      "numericValue": رقم أو null,
      "unit": "الوحدة أو null",
      "referenceRange": "المدى المرجعي أو null",
      "abbr": "الاسم العلمي/الإنجليزي المختصر للفحص كما يعرفه الأطباء، مثال: Ferritin أو Hemoglobin (Hb)",
      "about": "شرح مبسّط بالعربية في جملة قصيرة جداً (١٠ كلمات كحد أقصى)",
      "confidence": "high أو low"
    }
  ]
}

قواعد مهمة:
- إذا كانت أي قيمة غير واضحة أو مشكوك فيها، ضع "confidence": "low" ولا تخمّن الرقم.
- إذا لم تجد تاريخ الفحص، ضع null. لا تخترع تاريخاً.
- استخرج كل الفحوصات الموجودة في التقرير.
- لا تحسب أو تستنتج قيماً غير مكتوبة صراحة.`;

/** Upload guards: bound worst-case cost and latency per extraction. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_PDF_PAGES = 15;

/** Counts PDF pages from base64 without a parser dependency. */
function countPdfPages(base64Data: string): number {
  try {
    const buf = Buffer.from(base64Data, "base64");
    const text = buf.toString("latin1");
    const counts = text.match(/\/Type\s*\/Page[^s]/g);
    if (counts && counts.length > 0) return counts.length;
    const fromCount = text.match(/\/Count\s+(\d+)/);
    return fromCount ? Number(fromCount[1]) : 0;
  } catch {
    return 0;
  }
}

type ExtractedResult = {
  label: string;
  labelOriginal?: string;
  category: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  abbr?: string | null;
  about?: string | null;
  confidence: "high" | "low";
};

/** Pulls complete `results` objects out of a JSON string that was cut off mid-write. */
function salvageResults(raw: string): ExtractedResult[] {
  const start = raw.indexOf('"results"');
  if (start === -1) return [];
  const arrayStart = raw.indexOf("[", start);
  if (arrayStart === -1) return [];

  const out: ExtractedResult[] = [];
  let depth = 0;
  let objStart = -1;

  for (let i = arrayStart; i < raw.length; i++) {
    const ch = raw[i];
    if (ch === "{") {
      if (depth === 0) objStart = i;
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0 && objStart !== -1) {
        try {
          out.push(JSON.parse(raw.slice(objStart, i + 1)));
        } catch {
          // Skip anything that still does not parse cleanly.
        }
        objStart = -1;
      }
    }
  }
  return out;
}

function matchField(raw: string, field: string): string | null {
  const m = raw.match(new RegExp(`"${field}"\\s*:\\s*"([^"]*)"`));
  return m ? m[1] : null;
}

export function registerExtractRoute(app: Express) {
  app.post("/api/reports/extract", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
      return;
    }

    if (!user.canUpload) {
      res.status(403).json({ error: "تم إيقاف رفع التقارير لهذا الحساب." });
      return;
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      res.status(500).json({
        error: "خدمة الاستخراج غير مفعّلة. يلزم إضافة ANTHROPIC_API_KEY.",
      });
      return;
    }

    const { fileData, mediaType } = (req.body ?? {}) as {
      fileData?: string;
      mediaType?: string;
    };

    if (!fileData || !mediaType) {
      res.status(400).json({ error: "لم يتم استلام الملف" });
      return;
    }

    // Base64 inflates by ~33%. Two hard limits keep both cost and latency bounded:
    // total upload size, and PDF page count (pages dominate input-token cost).
    const approxBytes = Math.floor((fileData.length * 3) / 4);
    if (approxBytes > MAX_UPLOAD_BYTES) {
      res.status(413).json({
        error: `حجم الملف كبير جداً (الحد ${Math.round(MAX_UPLOAD_BYTES / 1024 / 1024)} ميجابايت). صدّر التقرير بجودة أقل أو ارفعه على أجزاء.`,
      });
      return;
    }

    const isPdf = mediaType === "application/pdf";

    if (isPdf) {
      const pages = countPdfPages(fileData);
      if (pages > MAX_PDF_PAGES) {
        res.status(413).json({
          error: `التقرير ${pages} صفحة، والحد الأقصى ${MAX_PDF_PAGES} صفحة. ارفعه على أجزاء أو استخرج صفحات النتائج فقط.`,
        });
        return;
      }
    }
    const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!isPdf && !allowedImages.includes(mediaType)) {
      // Name the common wrong choices explicitly — a user who exported an
      // Excel or Word file needs to know what to do, not just that it failed.
      const spreadsheetOrDoc =
        /spreadsheet|excel|csv|wordprocessing|msword|officedocument/.test(mediaType);
      res.status(400).json({
        error: spreadsheetOrDoc
          ? "ملفات Excel وWord وCSV غير مدعومة. صدّر التقرير كملف PDF أو صورة (JPG أو PNG) وأعد المحاولة."
          : "صيغة غير مدعومة. ارفع ملف PDF أو صورة (JPG أو PNG).",
      });
      return;
    }

    try {
      const content = [
        isPdf
          ? {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: fileData },
            }
          : {
              type: "image",
              source: { type: "base64", media_type: mediaType, data: fileData },
            },
        { type: "text", text: "استخرج نتائج التحاليل من هذا التقرير." },
      ];

      const response = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": apiKey,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: "claude-haiku-4-5-20251001",
          max_tokens: 8000,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[extract] Anthropic API error:", response.status, errText);
        res.status(502).json({ error: "تعذّر تحليل التقرير. حاول مرة أخرى." });
        return;
      }

      const data = await response.json();
      const truncated = data.stop_reason === "max_tokens";
      const text = (data.content ?? [])
        .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

      let parsed: {
        reportKind?: string;
        reportType?: string | null;
        summaryAr?: string | null;
        clinicalText?: string | null;
        examDate: string | null;
        facility: string | null;
        physician: string | null;
        results: ExtractedResult[];
      };

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        // A truncated response still contains complete result objects before the
        // cut-off; recover those rather than discarding the whole extraction.
        const salvaged = salvageResults(cleaned);
        if (salvaged.length > 0) {
          console.warn(`[extract] Recovered ${salvaged.length} results from truncated output.`);
          parsed = {
            examDate: matchField(cleaned, "examDate"),
            facility: matchField(cleaned, "facility"),
            physician: matchField(cleaned, "physician"),
            results: salvaged,
          };
        } else {
          console.error("[extract] Unparseable output:", cleaned.slice(0, 400));
          res.status(502).json({
            error: truncated
              ? "التقرير كبير جداً وتعذّر استخراجه كاملاً. جرّب رفعه على أجزاء."
              : "تعذّر قراءة نتائج التقرير. تأكد من وضوح الملف.",
          });
          return;
        }
      }

      const isNarrative =
        parsed.reportKind === "narrative" ||
        (!Array.isArray(parsed.results) || parsed.results.length === 0) &&
          Boolean(parsed.summaryAr || parsed.clinicalText);

      if (!isNarrative && (!Array.isArray(parsed.results) || parsed.results.length === 0)) {
        res.status(422).json({
          error: "لم يتم العثور على نتائج في هذا الملف. تأكد من وضوح الصورة.",
        });
        return;
      }

      res.json({
        examDate: parsed.examDate ?? null,
        facility: parsed.facility ?? null,
        physician: parsed.physician ?? null,
        results: Array.isArray(parsed.results) ? parsed.results : [],
        reportKind: isNarrative ? "narrative" : "labs",
        reportType: parsed.reportType ?? null,
        summaryAr: parsed.summaryAr ?? null,
        clinicalText: parsed.clinicalText ?? null,
        truncated,
      });
    } catch (err) {
      console.error("[extract] Unexpected error:", err);
      res.status(500).json({ error: "حدث خطأ أثناء تحليل التقرير." });
    }
  });
}
