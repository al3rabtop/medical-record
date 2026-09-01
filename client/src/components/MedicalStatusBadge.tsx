import React from "react";
import type { MedicalStatus } from "@shared/medical";
import { Check, CircleAlert, Minus } from "lucide-react";
import { useLocale } from "@/contexts/LocaleContext";

const styleMap: Record<MedicalStatus, { className: string; Icon: typeof Check }> = {
  reassuring: { className: "border-emerald-200 bg-emerald-50 text-emerald-800", Icon: Check },
  follow_up: { className: "border-amber-200 bg-amber-50 text-amber-800", Icon: CircleAlert },
  unavailable: { className: "border-slate-200 bg-slate-50 text-slate-600", Icon: Minus },
};

export function MedicalStatusBadge({ status }: { status: MedicalStatus }) {
  const { t } = useLocale();
  const { className, Icon } = styleMap[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${className}`}>
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {t.status[status]}
    </span>
  );
}
