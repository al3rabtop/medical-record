import { PortalShell } from "@/components/PortalShell";
import { PortalError, PortalLoading } from "@/components/PortalState";
import { trpc } from "@/lib/trpc";
import { Activity, Clock, FileText, Users } from "lucide-react";
import { AdminUserRow, type AdminUser } from "@/components/AdminUserRow";

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
  const me = trpc.auth.me.useQuery();

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

        {totals.pending > 0 && (
          <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
            <Clock className="h-4 w-4 shrink-0" />
            {totals.pending} حساب بانتظار التفعيل — تجده في أعلى القائمة.
          </div>
        )}

        <div className="mb-8 grid gap-3 sm:grid-cols-4">
          <StatBox Icon={Users} label="عدد الحسابات" value={totals.users} />
          <StatBox Icon={Clock} label="قيد المراجعة" value={totals.pending} />
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
                <th className="p-3 text-right font-bold">آخر دخول</th>
                <th className="p-3 text-right font-bold">الحالة</th>
                <th className="p-3 text-right font-bold">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <AdminUserRow
                  key={u.id}
                  user={u as unknown as AdminUser}
                  isSelf={me.data?.id === u.id}
                />
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
