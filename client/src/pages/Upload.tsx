import { PortalShell } from "@/components/PortalShell";
import { trpc } from "@/lib/trpc";
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  Loader2,
  Trash2,
  Upload as UploadIcon,
} from "lucide-react";
import { useRef, useState } from "react";
import { useLocation } from "wouter";

type Row = {
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

const CATEGORIES = [
  "الدم", "الكلى", "الكبد", "الدهون", "السكر", "الغدة الدرقية",
  "الفيتامينات والمعادن", "الحديد والالتهاب", "البول", "البروتينات",
  "تخثر الدم", "الكيمياء الحيوية", "أخرى",
];

export default function Upload() {
  const [, navigate] = useLocation();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const utils = trpc.useUtils();

  const [stage, setStage] = useState<"pick" | "loading" | "review">("pick");
  const [error, setError] = useState<string | null>(null);
  const [examDate, setExamDate] = useState("");
  const [facility, setFacility] = useState("");
  const [physician, setPhysician] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [truncated, setTruncated] = useState(false);
  const [dup, setDup] = useState<null | {
    status: "new" | "exact_duplicate" | "partial";
    visitId: number | null;
    examDate: string;
    existingCount: number;
    newLabels: string[];
    identicalLabels: string[];
    changed: Array<{ label: string; oldValue: string; newValue: string }>;
  }>(null);
  const [reportKind, setReportKind] = useState<"labs" | "narrative">("labs");
  const [reportType, setReportType] = useState<string | null>(null);
  const [summaryAr, setSummaryAr] = useState("");
  const [clinicalText, setClinicalText] = useState("");

  const checkDup = trpc.medical.checkDuplicate.useMutation({ onError: e => setError(e.message) });
  const mergeReport = trpc.medical.mergeReport.useMutation({
    onSuccess: async () => {
      await utils.medical.invalidate();
      navigate("/labs");
    },
    onError: e => setError(e.message),
  });

  const saveReport = trpc.medical.saveReport.useMutation({
    onSuccess: async () => {
      await utils.medical.invalidate();
      navigate("/labs");
    },
    onError: e => setError(e.message),
  });

  async function handleFile(file: File) {
    setError(null);
    setStage("loading");
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result).split(",")[1]);
        reader.onerror = () => reject(new Error("read failed"));
        reader.readAsDataURL(file);
      });

      const res = await fetch("/api/reports/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileData: base64, mediaType: file.type }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? "تعذّر تحليل التقرير");
        setStage("pick");
        return;
      }

      setTruncated(Boolean(data.truncated));
      setReportKind(data.reportKind === "narrative" ? "narrative" : "labs");
      setReportType(data.reportType ?? null);
      setSummaryAr(data.summaryAr ?? "");
      setClinicalText(data.clinicalText ?? "");
      setExamDate(data.examDate ?? "");
      setFacility(data.facility ?? "");
      setPhysician(data.physician ?? "");
      setRows(
        (data.results as Row[]).map(r => ({
          ...r,
          category: CATEGORIES.includes(r.category) ? r.category : "أخرى",
        }))
      );
      setStage("review");
    } catch {
      setError("تعذّر قراءة الملف");
      setStage("pick");
    }
  }

  function updateRow(i: number, patch: Partial<Row>) {
    setRows(prev => prev.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  }

  async function handleSave() {
    setError(null);
    if (!examDate) {
      setError("يرجى إدخال تاريخ الفحص");
      return;
    }
    if (reportKind === "labs") {
      const invalid = rows.find(r => !r.label.trim() || !r.value.trim());
      if (invalid) {
        setError("يرجى تعبئة اسم الفحص والقيمة لكل صف، أو حذف الصفوف الناقصة");
        return;
      }
    }
    if (reportKind === "labs") {
      const check = await checkDup.mutateAsync({
        examDate,
        results: rows.map(r => ({ label: r.label.trim(), value: r.value.trim() })),
      });
      if (check.status !== "new") {
        setDup(check);
        return;
      }
    }

    doSave();
  }

  function doSave() {
    saveReport.mutate({
      examDate,
      facility: facility.trim() || null,
      physician: physician.trim() || null,
      reportType,
      summaryAr: summaryAr.trim() || null,
      clinicalText: clinicalText.trim() || null,
      results: rows.map(r => ({
        label: r.label.trim(),
        category: r.category,
        value: r.value.trim(),
        numericValue: r.numericValue,
        unit: r.unit?.trim() || null,
        referenceRange: r.referenceRange?.trim() || null,
        abbr: r.abbr,
        about: r.about,
      })),
    });
  }

  function payloadFor(labels: string[]) {
    const wanted = new Set(labels.map(l => l.trim().toLowerCase()));
    return rows
      .filter(r => wanted.has(r.label.trim().toLowerCase()))
      .map(r => ({
        label: r.label.trim(),
        category: r.category,
        value: r.value.trim(),
        numericValue: r.numericValue,
        unit: r.unit?.trim() || null,
        referenceRange: r.referenceRange?.trim() || null,
        abbr: r.abbr,
        about: r.about,
      }));
  }

  const lowConfidenceCount = rows.filter(r => r.confidence === "low").length;

  return (
    <PortalShell>
      <div className="container py-8">
        <h1 className="mb-1 text-2xl font-extrabold text-teal-950">رفع تقرير طبي</h1>
        <p className="mb-6 text-sm text-slate-500">
          ارفع صورة أو ملف PDF للتقرير، وسيتم استخراج النتائج لمراجعتها قبل الحفظ.
          لا يتم حفظ الملف نفسه.
        </p>

        {error && (
          <div className="mb-5 flex items-start gap-2 rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {stage === "pick" && (
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
            />
            <button
              onClick={() => fileRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-sm font-bold text-slate-700 transition hover:border-teal-700 hover:text-teal-800"
            >
              <UploadIcon className="h-5 w-5" />
              اختر ملفاً من الجهاز
            </button>
            <button
              onClick={() => cameraRef.current?.click()}
              className="flex flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white px-6 py-10 text-sm font-bold text-slate-700 transition hover:border-teal-700 hover:text-teal-800"
            >
              <Camera className="h-5 w-5" />
              التقاط صورة بالكاميرا
            </button>
          </div>
        )}

        {stage === "loading" && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white py-16">
            <Loader2 className="h-7 w-7 animate-spin text-teal-800" />
            <p className="text-sm font-bold text-slate-600">جارٍ قراءة التقرير…</p>
          </div>
        )}

        {stage === "review" && (
          <div className="flex flex-col gap-5">
            {dup && (
              <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-5">
                <p className="text-base font-extrabold text-amber-900">
                  {dup.status === "exact_duplicate"
                    ? "هذا التقرير مرفوع مسبقاً"
                    : "يوجد تقرير بنفس التاريخ"}
                </p>
                <p className="mt-1 text-sm leading-6 text-amber-800">
                  لديك سجل بتاريخ <span className="font-bold" dir="ltr">{dup.examDate}</span> يحتوي
                  على {dup.existingCount} فحصاً.
                  {dup.status === "exact_duplicate"
                    ? " وجميع الفحوصات في هذا الملف موجودة فيه بنفس القيم."
                    : ""}
                </p>

                {dup.newLabels.length > 0 && (
                  <div className="mt-4 rounded-xl bg-white p-3">
                    <p className="text-sm font-bold text-emerald-800">
                      {dup.newLabels.length} فحص جديد غير موجود في السجل:
                    </p>
                    <p className="mt-1 text-xs leading-6 text-slate-600">{dup.newLabels.join("، ")}</p>
                  </div>
                )}

                {dup.changed.length > 0 && (
                  <div className="mt-3 rounded-xl bg-white p-3">
                    <p className="text-sm font-bold text-amber-800">
                      {dup.changed.length} فحص موجود بقيمة مختلفة:
                    </p>
                    <ul className="mt-2 space-y-1 text-xs text-slate-600">
                      {dup.changed.map(c => (
                        <li key={c.label}>
                          <span className="font-bold text-slate-800">{c.label}</span>:{" "}
                          <span dir="ltr">{c.oldValue}</span> ← <span dir="ltr" className="font-bold">{c.newValue}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {dup.identicalLabels.length > 0 && (
                  <p className="mt-3 text-xs text-amber-700">
                    {dup.identicalLabels.length} فحص موجود بنفس القيمة وسيتم تجاهله.
                  </p>
                )}

                <div className="mt-4 flex flex-wrap gap-2">
                  {dup.newLabels.length > 0 && dup.visitId && (
                    <button
                      onClick={() => mergeReport.mutate({
                        visitId: dup.visitId!,
                        updateChanged: false,
                        results: payloadFor(dup.newLabels),
                      })}
                      disabled={mergeReport.isPending}
                      className="flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {mergeReport.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                      أضف الفحوصات الجديدة فقط ({dup.newLabels.length})
                    </button>
                  )}

                  {dup.changed.length > 0 && dup.visitId && (
                    <button
                      onClick={() => mergeReport.mutate({
                        visitId: dup.visitId!,
                        updateChanged: true,
                        results: payloadFor([...dup.newLabels, ...dup.changed.map(c => c.label)]),
                      })}
                      disabled={mergeReport.isPending}
                      className="rounded-xl border border-amber-400 bg-white px-4 py-2.5 text-sm font-bold text-amber-800 transition hover:bg-amber-100 disabled:opacity-60"
                    >
                      حدّث القيم المختلفة أيضاً
                    </button>
                  )}

                  <button
                    onClick={() => { setDup(null); setStage("pick"); setRows([]); }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600"
                  >
                    إلغاء
                  </button>

                  {dup.status === "partial" && (
                    <button
                      onClick={() => { setDup(null); doSave(); }}
                      className="rounded-xl px-3 py-2.5 text-xs font-bold text-slate-500 underline"
                    >
                      احفظه كسجل منفصل
                    </button>
                  )}
                </div>
              </div>
            )}

            {truncated && (
              <div className="flex items-start gap-2 rounded-xl bg-orange-50 px-4 py-3 text-sm font-bold text-orange-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                التقرير طويل وقد لا تكون كل الفحوصات ظاهرة أدناه. راجع القائمة، ثم ارفع بقية الصفحات في تقرير منفصل.
              </div>
            )}
            {lowConfidenceCount > 0 && (
              <div className="flex items-start gap-2 rounded-xl bg-amber-50 px-4 py-3 text-sm font-bold text-amber-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                {lowConfidenceCount} قيمة غير واضحة — المحدّدة بالأصفر تحتاج مراجعتك.
              </div>
            )}

            <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 sm:grid-cols-3">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">تاريخ الفحص *</label>
                <input
                  type="date"
                  value={examDate}
                  onChange={e => setExamDate(e.target.value)}
                  className={`rounded-xl border px-3 py-2 text-sm outline-none focus:border-teal-700 ${examDate ? "border-slate-200" : "border-amber-400 bg-amber-50"}`}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">المختبر / المستشفى</label>
                <input
                  value={facility}
                  onChange={e => setFacility(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-700"
                  placeholder="اختياري"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-700">الطبيب</label>
                <input
                  value={physician}
                  onChange={e => setPhysician(e.target.value)}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-700"
                  placeholder="اختياري"
                />
              </div>
            </div>

            {reportKind === "narrative" && (
              <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-5">
                <p className="text-sm font-extrabold text-slate-900">
                  {reportType ?? "تقرير وصفي"} — راجع النص قبل الحفظ
                </p>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">ملخص مبسّط بالعربية</span>
                  <textarea value={summaryAr} onChange={e => setSummaryAr(e.target.value)} rows={4}
                    className="rounded-xl border border-slate-200 px-3 py-2 text-sm leading-6 outline-none focus:border-teal-700" />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-bold text-slate-700">النص الطبي الأصلي (للطبيب)</span>
                  <textarea value={clinicalText} onChange={e => setClinicalText(e.target.value)} rows={6} dir="ltr"
                    className="rounded-xl border border-slate-200 px-3 py-2 text-xs leading-5 outline-none focus:border-teal-700" />
                </label>
              </div>
            )}

            {reportKind === "labs" && <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
              <table className="w-full text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                  <tr>
                    <th className="p-3 text-right font-bold">الفحص</th>
                    <th className="p-3 text-right font-bold">التصنيف</th>
                    <th className="p-3 text-right font-bold">القيمة</th>
                    <th className="p-3 text-right font-bold">الوحدة</th>
                    <th className="p-3 text-right font-bold">المدى المرجعي</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => {
                    const low = r.confidence === "low";
                    return (
                      <tr key={i} className={`border-b border-slate-100 ${low ? "bg-amber-50/60" : ""}`}>
                        <td className="p-2">
                          <input
                            value={r.label}
                            onChange={e => updateRow(i, { label: e.target.value })}
                            className="w-full min-w-32 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                          />
                        </td>
                        <td className="p-2">
                          <select
                            value={r.category}
                            onChange={e => updateRow(i, { category: e.target.value })}
                            className="w-full min-w-28 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                          >
                            {CATEGORIES.map(c => (
                              <option key={c} value={c}>{c}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <input
                            value={r.value}
                            onChange={e => {
                              const v = e.target.value;
                              const n = Number(v.replace(",", "."));
                              updateRow(i, {
                                value: v,
                                numericValue: v.trim() && !Number.isNaN(n) ? n : null,
                              });
                            }}
                            className={`w-full min-w-20 rounded-lg border px-2 py-1.5 text-sm outline-none focus:border-teal-700 ${low || !r.value.trim() ? "border-amber-400" : "border-slate-200"}`}
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={r.unit ?? ""}
                            onChange={e => updateRow(i, { unit: e.target.value })}
                            className="w-full min-w-16 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2">
                          <input
                            value={r.referenceRange ?? ""}
                            onChange={e => updateRow(i, { referenceRange: e.target.value })}
                            className="w-full min-w-24 rounded-lg border border-slate-200 px-2 py-1.5 text-sm outline-none focus:border-teal-700"
                            placeholder="مثال: 13-150"
                            dir="ltr"
                          />
                        </td>
                        <td className="p-2">
                          <button
                            onClick={() => setRows(prev => prev.filter((_, idx) => idx !== i))}
                            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-red-50 hover:text-red-600"
                            title="حذف الصف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>}

            <div className="flex flex-wrap gap-3">
              <button
                onClick={handleSave}
                disabled={saveReport.isPending || (reportKind === "labs" && rows.length === 0)}
                className="flex items-center gap-2 rounded-xl bg-teal-800 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-60"
              >
                {saveReport.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {reportKind === "narrative" ? "حفظ التقرير" : `حفظ النتائج (${rows.length})`}
              </button>
              <button
                onClick={() => {
                  setStage("pick");
                  setRows([]);
                  setError(null);
                  setTruncated(false);
                }}
                className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-bold text-slate-600 transition hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>

            <p className="text-xs text-slate-500">
              راجع القيم جيداً قبل الحفظ. الحالة (مطمئن / يحتاج متابعة) تُحسب تلقائياً من المدى المرجعي.
            </p>
          </div>
        )}
      </div>
    </PortalShell>
  );
}
