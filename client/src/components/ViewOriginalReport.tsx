import { trpc } from "@/lib/trpc";
import { FileText, Loader2 } from "lucide-react";

/**
 * Opens the stored (compressed) original report in a new tab, via an
 * authenticated backend route. Never calls the AI — this only reads what
 * was already stored at upload time.
 */
export function ViewOriginalReport({ visitId }: { visitId: number }) {
  const docs = trpc.medical.visitDocuments.useQuery({ visitId });

  if (docs.isLoading) {
    return (
      <span className="inline-flex items-center gap-2 px-1 py-2 text-xs font-bold text-slate-400">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        جارٍ التحقق من الملف الأصلي…
      </span>
    );
  }

  if (!docs.data || docs.data.length === 0) return null;

  return (
    <>
      {docs.data.map((doc, i) => (
        <a
          key={doc.id}
          href={`/api/documents/${doc.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
        >
          <FileText className="h-4 w-4" />
          {docs.data.length > 1 ? `عرض التقرير الأصلي (${i + 1})` : "عرض التقرير الأصلي"}
        </a>
      ))}
    </>
  );
}
