import { Check, ChevronDown, Copy, Lightbulb } from "lucide-react";
import { useState } from "react";

/**
 * Turns an upload failure into an actionable path: the user takes their
 * original report to any AI assistant with this prompt, and gets back a
 * clean one-page summary that this app can read easily and cheaply.
 */
const HELPER_PROMPT = `حوّل تقرير التحاليل الطبية المرفق إلى جدول واحد بسيط ومنظم.

المطلوب:
- جدول واحد فقط، بثلاثة أعمدة بهذا الترتيب: اسم الفحص | النتيجة | المدى المرجعي
- اكتب اسم الفحص بالإنجليزية كما ورد في التقرير الأصلي تماماً
- انسخ كل قيمة ووحدتها كما هي حرفياً، بدون تقريب أو تحويل أو إعادة حساب
- انسخ المدى المرجعي كما ورد في هذا التقرير بالذات (المدى يختلف بين المختبرات)
- أدرج كل الفحوصات الموجودة، ولا تحذف أي فحص
- إذا كانت أي قيمة غير واضحة، اكتب بجانبها [غير واضح] بدلاً من تخمينها

اكتب فوق الجدول هذه المعلومات إن وُجدت في التقرير:
- تاريخ سحب العينة
- اسم المختبر أو المستشفى
- اسم الطبيب

مهم جداً:
- لا تضف أي تفسير أو تشخيص أو رأي طبي
- لا تضف أي فحص غير موجود في التقرير الأصلي
- لا تغيّر أي رقم أو وحدة قياس

بعد الجدول، صدّر الناتج كملف PDF من صفحة واحدة أو صفحتين.`;

export function UploadTroubleshooting() {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(HELPER_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the prompt stays visible to select manually.
    }
  };

  return (
    <div className="mt-6 rounded-2xl border border-slate-200 bg-white">
      <button
        onClick={() => setOpen(o => !o)}
        className="flex w-full items-center justify-between gap-3 px-5 py-4 text-right"
      >
        <span className="flex items-center gap-2 text-sm font-extrabold text-slate-800">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          تعذّر رفع التقرير؟ جرّب هذا الحل
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="border-t border-slate-100 px-5 py-4">
          <p className="text-sm font-bold text-slate-700">الأسباب الشائعة:</p>
          <ul className="mt-2 space-y-1.5 text-sm leading-6 text-slate-600">
            <li>• التقرير أكبر من ١٥ صفحة أو حجمه يتجاوز ١٢ ميجابايت</li>
            <li>• الصورة غير واضحة أو الإضاءة ضعيفة</li>
            <li>• التقرير يحتوي رسوماً بيانية كثيرة تجعل قراءته أبطأ وأصعب</li>
          </ul>

          <p className="mt-4 text-sm leading-6 text-slate-700">
            الحل: افتح أي مساعد ذكي (مثل ChatGPT أو Gemini أو Claude)، ارفع له تقريرك
            الأصلي، وألصق له النص التالي. سيعطيك ملخصاً بصفحة واحدة ترفعه هنا بسهولة.
          </p>

          <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap text-xs leading-6 text-slate-700">
              {HELPER_PROMPT}
            </pre>
          </div>

          <button
            onClick={copy}
            className="mt-3 flex items-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900"
          >
            {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copied ? "تم النسخ" : "نسخ النص"}
          </button>

          <p className="mt-4 rounded-xl bg-amber-50 px-4 py-3 text-xs leading-6 text-amber-900">
            <span className="font-extrabold">قبل الحفظ:</span> راجع الأرقام في الملخص
            مقابل تقريرك الأصلي. المساعدات الذكية قد تخطئ في النسخ، والخطأ هنا يدخل سجلك
            الطبي.
          </p>
        </div>
      )}
    </div>
  );
}
