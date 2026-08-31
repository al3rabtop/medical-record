import { useProfile } from "@/contexts/ProfileContext";
import { Check, ChevronDown, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";

export function ProfileSwitcher() {
  const { profiles, activeProfile, setProfileId } = useProfile();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  if (profiles.length === 0) return null;

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 transition hover:border-teal-300"
      >
        <Users className="h-4 w-4 text-teal-700" />
        <span className="max-w-32 truncate">{activeProfile?.name ?? "اختر ملفاً"}</span>
        <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
      </button>

      {open && (
        <div className="absolute left-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
          <p className="border-b border-slate-100 px-4 py-2.5 text-[11px] font-bold text-slate-500">
            الملفات الصحية
          </p>
          {profiles.map(p => (
            <button
              key={p.id}
              onClick={() => {
                setProfileId(p.id);
                setOpen(false);
              }}
              className={`flex w-full items-center justify-between gap-2 px-4 py-2.5 text-right transition hover:bg-teal-50 ${
                p.id === activeProfile?.id ? "bg-teal-50/60" : ""
              }`}
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-bold text-slate-800">{p.name}</span>
                <span className="block text-[11px] text-slate-500">
                  {p.relation ?? "—"}
                  {p.birthYear ? ` · ${p.birthYear}` : ""} · {p.visitCount} تقرير
                </span>
              </span>
              {p.id === activeProfile?.id && <Check className="h-4 w-4 shrink-0 text-teal-700" />}
            </button>
          ))}
          <Link
            href="/profiles"
            onClick={() => setOpen(false)}
            className="block border-t border-slate-100 px-4 py-2.5 text-sm font-bold text-teal-800 hover:bg-slate-50"
          >
            إدارة الملفات
          </Link>
        </div>
      )}
    </div>
  );
}
