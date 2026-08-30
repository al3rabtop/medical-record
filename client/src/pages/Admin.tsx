import { PortalShell } from "@/components/PortalShell";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import {
  Activity,
  ArrowRight,
  ClipboardList,
  Eye,
  FileText,
  ShieldAlert,
  Users,
} from "lucide-react";
import { useState } from "react";

function fmt(d: string | Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("ar", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function Admin() {
  const overview = trpc.admin.overview.useQuery();
  const accessLog = trpc.admin.accessLog.useQuery();
  const [viewingUserId, setViewingUserId] = useState<number | null>(null);

  const userRecords = trpc.admin.userRecords.useQuery(
    { userId: viewingUserId ?? 0 },
    { enabled: viewingUserId !== null }
  );

  if (overview.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (overview.error || !overview.data) return <PortalShell><PortalError /></PortalShell>;

  const { totals, users } = overview.data;

  if (viewingUserId !== null) {
    return (
      <PortalShell>
        <div className="container py-8">
          <button
            onClick={() => setViewingUserId(null)}
            className="mb-5 flex items-center gap-2 text-sm font-bold text-teal-800 hover:underline"
          >
            <ArrowRight className="h-4 w-4" />
            رجوع للوحة الإدارة
          </button>

          {userRecords.isLoading && <PortalLoading />}
          {userRecords.error && (
            <div className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
              {userRecords.error.message}
            </div>
          )}

          {userRecords.data && (
            <>
              <div className="mb-5 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <p>
                  أنت تطّلع على سجل طبي يخص{" "}
                  <span className="font-extrabold">
                    {userRecords.data.target.patientName ?? userRecords.data.target.email}
                  </span>
                  . تم تسجيل هذا الاطّلاع في سجل التدقيق.
                </p>
              </div>

              <h1 className="mb-1 text-xl font-extrabold text-teal-950">
                {userRecords.data.target.patientName ?? "—"}
              </h1>
              <p className="mb-6 text-sm text-slate-500" dir="ltr">
                {userRecords.data.target.email}
              </p>

              <div className="mb-6 grid gap-3 sm:grid-cols-3">
                <StatBox
                  Icon={FileText}
                  label="عدد الزيارات"
                  value={userRecords.data.dashboard.visits.length}
                />
                <StatBox
                  Icon={Activity}
                  label="عدد المؤشرات"
                  value={userRecords.data.dashboard.cards.length}
                />
                <StatBox
                  Icon={ClipboardList}
                  label="يحتاج متابعة"
                  value={userRecords.data.dashboard.followUp.length}
                />
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                <table className="w-full text-sm">
                  <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
                    <tr>
                      <th className="p-3 text-right font-bold">الفحص</th>
                      <th className="p-3 text-right font-bold">القيمة</th>
                      <th className="p-3 text-right font-bold">المدى المرجعي</th>
                      <th className="p-3 text-right font-bold">التاريخ</th>
                      <th className="p-3 text-right font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody>
                    {userRecords.data.dashboard.cards.map(c => (
                      <tr key={c.code} className="border-b border-slate-100">
                        <td className="p-3 font-bold text-slate-800">{c.label}</td>
                        <td className="p-3" dir="ltr">{c.value} {c.unit ?? ""}</td>
                        <td className="p-3 text-slate-500" dir="ltr">{c.referenceRange ?? "—"}</td>
                        <td className="p-3 text-slate-500" dir="ltr">{c.examDate}</td>
                        <td className="p-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${c.status === "follow_up" ? "bg-amber-50 text-amber-800" : c.status === "reassuring" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-600"}`}>
                            {c.status === "follow_up" ? "يحتاج متابعة" : c.status === "reassuring" ? "مطمئن" : "غير متوفر"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {userRecords.data.dashboard.cards.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-slate-500">
                          لا توجد نتائج مسجلة لهذا الحساب.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      </PortalShell>
    );
  }

  return (
    <PortalShell>
      <div className="container py-8">
        <h1 className="mb-1 text-2xl font-extrabold text-teal-950">لوحة الإدارة</h1>
        <p className="mb-6 text-sm text-slate-500">
          نظرة عامة على الحسابات والنشاط. الاطّلاع على أي سجل طبي يُسجَّل في سجل التدقيق.
        </p>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <StatBox Icon={Users} label="عدد الحسابات" value={totals.users} />
          <StatBox Icon={FileText} label="إجمالي الزيارات" value={totals.visits} />
          <StatBox Icon={Activity} label="إجمالي النتائج" value={totals.results} />
        </div>

        <h2 className="mb-3 text-lg font-extrabold text-slate-900">الحسابات</h2>
        <div className="mb-10 overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-3 text-right font-bold">اسم المريض</th>
                <th className="p-3 text-right font-bold">البريد</th>
                <th className="p-3 text-right font-bold">سنة الميلاد</th>
                <th className="p-3 text-right font-bold">الزيارات</th>
                <th className="p-3 text-right font-bold">النتائج</th>
                <th className="p-3 text-right font-bold">التسجيل</th>
                <th className="p-3 text-right font-bold">آخر دخول</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-3 font-bold text-slate-800">
                    {u.patientName ?? "—"}
                    {u.role === "admin" && (
                      <span className="mr-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">
                        مدير
                      </span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600" dir="ltr">{u.email}</td>
                  <td className="p-3 text-slate-500" dir="ltr">{u.birthYear ?? "—"}</td>
                  <td className="p-3 font-bold text-slate-700">{u.visitCount}</td>
                  <td className="p-3 font-bold text-slate-700">{u.resultCount}</td>
                  <td className="p-3 text-slate-500">{fmt(u.createdAt)}</td>
                  <td className="p-3 text-slate-500">{fmt(u.lastSignedIn)}</td>
                  <td className="p-3">
                    <button
                      onClick={() => setViewingUserId(u.id)}
                      className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600 transition hover:border-teal-300 hover:text-teal-800"
                    >
                      <Eye className="h-3.5 w-3.5" />
                      عرض السجل
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h2 className="mb-1 text-lg font-extrabold text-slate-900">سجل التدقيق</h2>
        <p className="mb-3 text-sm text-slate-500">
          كل مرة يُفتح فيها سجل حساب آخر تُسجَّل هنا.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-3 text-right font-bold">المدير</th>
                <th className="p-3 text-right font-bold">الحساب المعروض</th>
                <th className="p-3 text-right font-bold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {(accessLog.data ?? []).map(l => (
                <tr key={l.id} className="border-b border-slate-100">
                  <td className="p-3 text-slate-700" dir="ltr">{l.adminEmail}</td>
                  <td className="p-3 text-slate-700" dir="ltr">{l.targetEmail}</td>
                  <td className="p-3 text-slate-500">
                    {new Date(l.createdAt).toLocaleString("ar")}
                  </td>
                </tr>
              ))}
              {(accessLog.data ?? []).length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-slate-500">
                    لا توجد عمليات اطّلاع مسجّلة.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}

function StatBox({
  Icon,
  label,
  value,
}: {
  Icon: typeof Users;
  label: string;
  value: number;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <p className="flex items-center gap-1.5 text-xs font-bold text-slate-500">
        <Icon className="h-3.5 w-3.5 text-teal-700" />
        {label}
      </p>
      <p className="mt-2 text-3xl font-extrabold text-slate-950">{value}</p>
    </div>
  );
}
