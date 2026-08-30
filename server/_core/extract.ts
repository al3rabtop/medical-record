import type { Express, Request, Response } from "express";
import { authenticateRequest } from "./auth";

/**
 * Extracts lab results from an uploaded report image/PDF.
 * The file is processed in memory and never written to disk or stored.
 * Returns structured data for the user to review before saving.
 */

const SYSTEM_PROMPT = `أنت مساعد لاستخراج نتائج التحاليل المخبرية من صور وملفات التقارير الطبية.

مهمتك: اقرأ التقرير واستخرج البيانات بدقة تامة. لا تخمّن أبداً.

أعد JSON فقط بدون أي نص إضافي وبدون علامات markdown، بهذا الشكل:
{
  "examDate": "YYYY-MM-DD أو null",
  "facility": "اسم المختبر/المستشفى أو null",
  "physician": "اسم الطبيب أو null",
  "results": [
    {
      "label": "اسم الفحص بالعربية",
      "labelOriginal": "الاسم كما ظهر في التقرير",
      "category": "التصنيف: الدم | الكلى | الكبد | الدهون | السكر | الغدة الدرقية | الفيتامينات والمعادن | الحديد والالتهاب | البول | البروتينات | تخثر الدم | الكيمياء الحيوية | أخرى",
      "value": "القيمة كما ظهرت",
      "numericValue": رقم أو null,
      "unit": "الوحدة أو null",
      "referenceRange": "المدى المرجعي أو null",
      "confidence": "high أو low"
    }
  ]
}

قواعد مهمة:
- إذا كانت أي قيمة غير واضحة أو مشكوك فيها، ضع "confidence": "low" ولا تخمّن الرقم.
- إذا لم تجد تاريخ الفحص، ضع null. لا تخترع تاريخاً.
- استخرج كل الفحوصات الموجودة في التقرير.
- لا تحسب أو تستنتج قيماً غير مكتوبة صراحة.`;

type ExtractedResult = {
  label: string;
  labelOriginal?: string;
  category: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  confidence: "high" | "low";
};

export function registerExtractRoute(app: Express) {
  app.post("/api/reports/extract", async (req: Request, res: Response) => {
    const user = await authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "يجب تسجيل الدخول" });
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

    const isPdf = mediaType === "application/pdf";
    const allowedImages = ["image/jpeg", "image/png", "image/webp", "image/gif"];
    if (!isPdf && !allowedImages.includes(mediaType)) {
      res.status(400).json({ error: "صيغة غير مدعومة. استخدم صورة أو PDF." });
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
          max_tokens: 4000,
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
      const text = (data.content ?? [])
        .map((b: any) => (b.type === "text" ? b.text : ""))
        .join("")
        .trim();

      const cleaned = text.replace(/```json/g, "").replace(/```/g, "").trim();

      let parsed: {
        examDate: string | null;
        facility: string | null;
        physician: string | null;
        results: ExtractedResult[];
      };

      try {
        parsed = JSON.parse(cleaned);
      } catch {
        console.error("[extract] Failed to parse model output:", cleaned.slice(0, 500));
        res.status(502).json({ error: "تعذّر قراءة نتائج التقرير. جرّب صورة أوضح." });
        return;
      }

      if (!Array.isArray(parsed.results) || parsed.results.length === 0) {
        res.status(422).json({
          error: "لم يتم العثور على نتائج تحاليل في هذا الملف. تأكد من وضوح الصورة.",
        });
        return;
      }

      res.json({
        examDate: parsed.examDate ?? null,
        facility: parsed.facility ?? null,
        physician: parsed.physician ?? null,
        results: parsed.results,
      });
    } catch (err) {
      console.error("[extract] Unexpected error:", err);
      res.status(500).json({ error: "حدث خطأ أثناء تحليل التقرير." });
    }
  });
}
