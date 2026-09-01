import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { FileText, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

const FILE_TYPE_LABELS: Record<string, string> = {
  "application/pdf": "PDF",
  "image/jpeg": "JPG",
  "image/jpg": "JPG",
  "image/png": "PNG",
  "image/webp": "WebP",
  "image/gif": "GIF",
  "image/heic": "HEIC",
  "image/heif": "HEIF",
};

function fileTypeLabel(mimeType: string) {
  return FILE_TYPE_LABELS[mimeType] ?? mimeType.split("/")[1]?.toUpperCase() ?? "ملف";
}

const documentDateFormatter = new Intl.DateTimeFormat("ar-SA-u-ca-gregory", {
  year: "numeric",
  month: "long",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

function formatDocumentDate(date: Date) {
  return documentDateFormatter.format(date);
}

/**
 * Opens the stored (compressed) original report in a new tab, via an
 * authenticated backend route. Never calls the AI — this only reads what
 * was already stored at upload time.
 *
 * Accepts every visit id behind the document set being viewed — a single
 * visit can have more than one stored document (e.g. a re-upload merged
 * into it), and a test indicator's history can span many visits, each with
 * its own upload. Either way, with more than one document this shows a
 * picker instead of guessing which one the user wants.
 */
export function ViewOriginalReport({ visitIds }: { visitIds: number[] }) {
  const docs = trpc.medical.visitDocuments.useQuery(
    { visitIds },
    { enabled: visitIds.length > 0 }
  );
  const [pickerOpen, setPickerOpen] = useState(false);

  if (docs.isLoading) {
    return (
      <span className="inline-flex items-center gap-2 px-1 py-2 text-xs font-bold text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        جارٍ التحقق من الملف الأصلي…
      </span>
    );
  }

  if (!docs.data || docs.data.length === 0) return null;

  if (docs.data.length === 1) {
    return (
      <a
        href={`/api/documents/${docs.data[0].id}`}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
      >
        <FileText className="h-4 w-4" />
        عرض التقرير الأصلي
      </a>
    );
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setPickerOpen(true)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
      >
        <FileText className="h-4 w-4" />
        عرض التقرير الأصلي ({docs.data.length} ملفات)
      </button>
      <Dialog open={pickerOpen} onOpenChange={setPickerOpen}>
        <DialogContent dir="rtl" className="border-slate-200 bg-[#fbfcfb] sm:max-w-md">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-extrabold text-slate-950">اختر ملفاً لعرضه</DialogTitle>
            <DialogDescription className="text-sm text-slate-600">
              يحتوي هذا السجل على {docs.data.length} ملفات تقارير أصلية.
            </DialogDescription>
          </DialogHeader>
          <div className="flex max-h-[60vh] flex-col gap-2 overflow-y-auto">
            {docs.data.map((doc, i) => (
              <div
                key={doc.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-50 text-teal-800">
                    <FileText className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-extrabold text-slate-900">
                      {doc.originalName || `الملف ${i + 1}`}
                    </p>
                    <p className="mt-0.5 flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <span>{formatDocumentDate(doc.createdAt)}</span>
                      <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-extrabold text-slate-600">
                        {fileTypeLabel(doc.mimeType)}
                      </span>
                    </p>
                  </div>
                </div>
                <a
                  href={`/api/documents/${doc.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setPickerOpen(false)}
                  className="shrink-0 rounded-lg bg-teal-800 px-3 py-2 text-xs font-extrabold text-white transition hover:bg-teal-900"
                >
                  عرض
                </a>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
