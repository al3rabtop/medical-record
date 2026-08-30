import { PortalShell } from "@/components/PortalShell";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import { Activity, FileText, Users } from "lucide-react";

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

  if (overview.isLoading) return <PortalShell><PortalLoading /></PortalShell>;
  if (overview.error || !overview.data) return <PortalShell><PortalError /></PortalShell>;

  const { totals, users } = overview.data;

  return (
    <PortalShell>
      <div className="container py-8">
        <h1 className="mb-1 text-2xl font-extrabold text-teal-950">لوحة الإحصائيات</h1>
        <p className="mb-6 text-sm text-slate-500">
          نظرة عامة على الحسابات والنشاط. لا تتضمّن هذه اللوحة أي نتائج طبية — السجل الطبي لكل حساب يبقى خاصاً بصاحبه.
        </p>

        <div className="mb-8 grid gap-3 sm:grid-cols-3">
          <StatBox Icon={Users} label="عدد الحسابات" value={totals.users} />
          <StatBox Icon={FileText} label="إجمالي التقارير" value={totals.visits} />
          <StatBox Icon={Activity} label="إجمالي النتائج" value={totals.results} />
        </div>

        <h2 className="mb-3 text-lg font-extrabold text-slate-900">الحسابات</h2>
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs text-slate-600">
              <tr>
                <th className="p-3 text-right font-bold">اسم المريض</th>
                <th className="p-3 text-right font-bold">البريد</th>
                <th className="p-3 text-right font-bold">سنة الميلاد</th>
                <th className="p-3 text-right font-bold">التقارير</th>
                <th className="p-3 text-right font-bold">النتائج</th>
                <th className="p-3 text-right font-bold">التسجيل</th>
                <th className="p-3 text-right font-bold">آخر دخول</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-b border-slate-100">
                  <td className="p-3 font-bold text-slate-800">
                    {u.patientName ?? "—"}
                    {u.role === "admin" && (
                      <span className="mr-2 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] font-bold text-teal-800">مدير</span>
                    )}
                  </td>
                  <td className="p-3 text-slate-600" dir="ltr">{u.email}</td>
                  <td className="p-3 text-slate-500" dir="ltr">{u.birthYear ?? "—"}</td>
                  <td className="p-3 font-bold text-slate-700">{u.visitCount}</td>
                  <td className="p-3 font-bold text-slate-700">{u.resultCount}</td>
                  <td className="p-3 text-slate-500">{fmt(u.createdAt)}</td>
                  <td className="p-3 text-slate-500">{fmt(u.lastSignedIn)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </PortalShell>
  );
}

function StatBox({ Icon, label, value }: { Icon: typeof Users; label: string; value: number }) {
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
