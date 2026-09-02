import type { Express, Request, Response } from "express";
import { authenticateRequest } from "./auth";
import { findDocumentByHash, hashFileContent } from "../documents";

/**
 * Extracts lab results from an uploaded report image/PDF.
 * The file is processed in memory and never written to disk or stored.
 * Returns structured data for the user to review before saving.
 */

const SYSTEM_PROMPT = `أنت مساعد لاستخراج نتائج التحاليل المخبرية من صور وملفات التقارير الطبية.

مهمتك: اقرأ التقرير واستخرج البيانات بدقة تامة عبر استدعاء الأداة المتاحة. لا تخمّن أبداً.

بعض التقارير ليست أرقاماً بل نصوص وصفية (أشعة، خزعات، تقارير أطباء). في هذه الحالة:
- اضبط "reportKind" على "narrative"
- اترك "results" مصفوفة فارغة
- املأ "summaryAr" بملخص عربي مبسّط في ٢-٤ جمل يفهمه شخص غير طبيب
- املأ "clinicalText" بنص التقرير الطبي كما ورد بالإنجليزية (الانطباع والنتائج الأساسية)

أما تقارير التحاليل الرقمية فاضبط "reportKind" على "labs" واملأ "results".

قواعد مهمة جداً بخصوص دقة استخراج كل قيمة:
- التزم بمطابقة كل قيمة مع اسم الفحص الصحيح في نفس الصف من الجدول. لا تخلط بين عمود القيمة وعمود المدى المرجعي أو الوحدة، ولا مع صف آخر مجاور (فوق أو تحت) حتى لو تشابهت الأرقام.
- إذا كانت أي قيمة غير واضحة أو مشكوك فيها، ضع "confidence": "low" ولا تخمّن الرقم.
- إذا لم تجد تاريخ الفحص، اجعله null. لا تخترع تاريخاً.
- استخرج كل الفحوصات الموجودة في التقرير مهما كان عددها — لا يوجد حد أقصى لعدد الفحوصات، وحذف أي فحص موجود فعلياً في التقرير غير مقبول.
- لا تحسب أو تستنتج قيماً غير مكتوبة صراحة في التقرير.
- اكتب اسم كل فحص كما هو مطبوع تماماً في التقرير. لا تُعمّم أو تُبسّط اسم فحص إلى اسم فحص آخر أكثر شيوعاً يبدو مشابهاً له — مثال: لا تكتب "Leukocyte Esterase" (فحص كيميائي بشريط الغمس، نتيجته عادة Negative/Trace/1+/2+/3+) باسم "WBC" (فحص مجهري بالعد المباشر، نتيجته رقم أو مدى مثل 0-1)، فهما فحصان مختلفان تماماً حتى لو كانا في نفس تقرير تحليل البول.
- إذا كان الفحص التفريقي لكريات الدم البيضاء (Neutrophils/Lymphocytes/Monocytes/Eosinophils/Basophils) يظهر في التقرير بعمودين منفصلين (نسبة مئوية % عمود، وعدد مطلق x10³/µL أو x10⁹/L عمود آخر) لنفس اسم الفحص، فأنشئ لكل عمود سطراً منفصلاً في "results"، واكتب في "label" ما يوضح النوع صراحة (أضف "%" أو "Percent" لعمود النسبة، و"Absolute" أو "#" لعمود العدد المطلق) — لا تكتفِ بوضع الفرق في حقل "unit" فقط، لأن الفرق يجب أن يظهر في اسم الفحص نفسه.
- إذا كان التقرير تحليل بول (Urinalysis) وأحد صفوفه مكتوب باسم عام مثل "WBC" أو "RBC" دون كلمة "Urine" أو "بول"، أضف الإشارة صراحة في "label" (مثل "WBC (Urine)") حتى لا يُخلط بفحص الدم المقابل له.
- ابحث في ترويسة التقرير عن رقم الزيارة/الملف لدى المستشفى (Visit Number / Encounter Number / MRN)، إن وُجد، واملأ حقلي "hospitalVisitNumber" و"patientIdentifier". إن لم يوجد أي منهما اجعله null — لا تخترع رقماً.`;

const EXTRACTION_TOOL_NAME = "record_medical_report";

const RESULT_CATEGORIES = [
  "الدم", "الكلى", "الكبد", "الدهون", "السكر", "الغدة الدرقية",
  "الفيتامينات والمعادن", "الحديد والالتهاب", "البول", "البروتينات",
  "تخثر الدم", "الكيمياء الحيوية", "أخرى",
];

const nullableString = { anyOf: [{ type: "string" }, { type: "null" }] } as const;
const nullableNumber = { anyOf: [{ type: "number" }, { type: "null" }] } as const;

/**
 * Forces the model to return arguments matching this exact schema instead
 * of hoping a prompt instruction produces clean JSON text. This is the
 * "response format" / "JSON schema" enforcement mechanism: a call that
 * doesn't match the schema simply doesn't happen — there is no markdown
 * fence to strip, no free-text preamble to trim, and no regex "salvage" of
 * a malformed response, because the API only returns a tool_use block once
 * the arguments validate.
 */
const EXTRACTION_TOOL = {
  name: EXTRACTION_TOOL_NAME,
  description: "Records the structured extraction of one medical report.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: [
      "reportKind", "reportType", "summaryAr", "clinicalText",
      "examDate", "facility", "physician",
      "hospitalVisitNumber", "patientIdentifier", "results",
    ],
    properties: {
      reportKind: { type: "string", enum: ["labs", "narrative"] },
      reportType: nullableString,
      summaryAr: nullableString,
      clinicalText: nullableString,
      examDate: nullableString,
      facility: nullableString,
      physician: nullableString,
      /** The HOSPITAL's own visit/encounter number as printed on the report, not an app-internal id. */
      hospitalVisitNumber: nullableString,
      /** A patient identifier (e.g. MRN) as printed on the report, used only as a cross-patient safety check. */
      patientIdentifier: nullableString,
      results: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "category", "value", "numericValue", "unit", "referenceRange", "abbr", "about", "confidence"],
          properties: {
            label: { type: "string" },
            category: { type: "string", enum: RESULT_CATEGORIES },
            value: { type: "string" },
            numericValue: nullableNumber,
            unit: nullableString,
            referenceRange: nullableString,
            abbr: nullableString,
            about: nullableString,
            confidence: { type: "string", enum: ["high", "low"] },
          },
        },
      },
    },
  },
};

/** Upload guards: bound worst-case cost and latency per extraction. */
const MAX_UPLOAD_BYTES = 12 * 1024 * 1024;
const MAX_PDF_PAGES = 15;
/**
 * Generous enough for a 100+ test report (each result is a handful of short
 * fields), while non-streaming to keep the plain-fetch call simple. If a
 * report genuinely needs more than this, stop_reason will be "max_tokens"
 * and the request is treated as a hard failure below — never as a valid
 * partial report — so the user is told to split it rather than silently
 * losing the tail of the results.
 */
const MAX_OUTPUT_TOKENS = 24000;

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
  category: string;
  value: string;
  numericValue: number | null;
  unit: string | null;
  referenceRange: string | null;
  abbr: string | null;
  about: string | null;
  confidence: "high" | "low";
};

type ExtractedReport = {
  reportKind: "labs" | "narrative";
  reportType: string | null;
  summaryAr: string | null;
  clinicalText: string | null;
  examDate: string | null;
  facility: string | null;
  physician: string | null;
  hospitalVisitNumber: string | null;
  patientIdentifier: string | null;
  results: ExtractedResult[];
};

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

    // Exact-duplicate short-circuit: hash the RAW bytes before ever calling
    // the AI. If this exact file was already stored against a visit this
    // user owns, there is nothing new to extract — re-parsing would only
    // spend money and (since the model is not perfectly deterministic)
    // risk producing a slightly different reading of the same file, which
    // would look like a false "changed value" for no real reason.
    const rawBuffer = Buffer.from(fileData, "base64");
    const contentHash = hashFileContent(rawBuffer);
    try {
      const existing = await findDocumentByHash(user.id, contentHash);
      if (existing) {
        res.json({
          exactDuplicate: true,
          existingVisitId: existing.visitId,
          existingDocumentId: existing.documentId,
          contentHash,
        });
        return;
      }
    } catch (err) {
      // A lookup failure must never block a legitimate upload — fall through
      // to normal extraction, same as if no duplicate had been found.
      console.error("[extract] Duplicate-hash lookup failed:", err);
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
        { type: "text", text: "استخرج نتائج التحاليل من هذا التقرير عبر استدعاء الأداة المتاحة." },
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
          max_tokens: MAX_OUTPUT_TOKENS,
          // Deterministic extraction: the same report should read the same
          // way every time, so a re-upload of the same file is recognized
          // by its content, not treated as suspiciously "different" purely
          // because the model sampled a different token somewhere.
          temperature: 0,
          system: SYSTEM_PROMPT,
          messages: [{ role: "user", content }],
          tools: [EXTRACTION_TOOL],
          tool_choice: { type: "tool", name: EXTRACTION_TOOL_NAME },
        }),
      });

      if (!response.ok) {
        const errText = await response.text();
        console.error("[extract] Anthropic API error:", response.status, errText);
        res.status(502).json({ error: "تعذّر تحليل التقرير. حاول مرة أخرى." });
        return;
      }

      const data = await response.json();

      // A response cut off mid-generation cannot be trusted: if it was cut
      // off while still writing the tool call, the arguments are incomplete
      // JSON; even in the rare case they happen to parse, there is no way to
      // know whether the model was cut off after finishing (safe) or with
      // more results still to come (data loss). Never treat this as a
      // partial-but-usable report — the user must split the upload instead.
      if (data.stop_reason === "max_tokens") {
        console.warn("[extract] Truncated at max_tokens — treating as a hard failure, not a partial report.");
        res.status(502).json({
          error: "التقرير كبير جداً وتعذّر استخراجه كاملاً. جرّب رفعه على أجزاء.",
        });
        return;
      }

      const toolUse = (data.content ?? []).find(
        (b: any) => b.type === "tool_use" && b.name === EXTRACTION_TOOL_NAME
      );

      if (!toolUse || typeof toolUse.input !== "object" || toolUse.input === null) {
        console.error("[extract] No valid tool_use block in response:", JSON.stringify(data).slice(0, 400));
        res.status(502).json({
          error: "تعذّر قراءة نتائج التقرير. تأكد من وضوح الملف.",
        });
        return;
      }

      const parsed = toolUse.input as ExtractedReport;

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
        hospitalVisitNumber: parsed.hospitalVisitNumber ?? null,
        patientIdentifier: parsed.patientIdentifier ?? null,
        // A narrative report (radiology/pathology/physician) must never carry
        // stored results — getMedicalDashboardForUser uses "this visit has at
        // least one result" as a structural signal to classify it as
        // laboratory (see classifyMedicalRecord), overriding keyword
        // matching. If the AI ever populated `results` alongside
        // reportKind:"narrative" (a combined document, or a slip in the
        // extraction prompt), that visit would silently disappear from its
        // real portal (e.g. Radiology) and reappear as a lab result. Forcing
        // it empty here makes the "narrative reports carry no results"
        // contract a hard invariant instead of a prompt-only convention.
        results: isNarrative ? [] : Array.isArray(parsed.results) ? parsed.results : [],
        reportKind: isNarrative ? "narrative" : "labs",
        reportType: parsed.reportType ?? null,
        summaryAr: parsed.summaryAr ?? null,
        clinicalText: parsed.clinicalText ?? null,
        contentHash,
      });
    } catch (err) {
      console.error("[extract] Unexpected error:", err);
      res.status(500).json({ error: "حدث خطأ أثناء تحليل التقرير." });
    }
  });
}
