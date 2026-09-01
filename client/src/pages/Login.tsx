import { HeartPulse, Loader2 } from "lucide-react";
import { useState } from "react";
import { useLocation } from "wouter";
import { useLocale } from "@/contexts/LocaleContext";
import { LocaleThemeSwitcher } from "@/components/LocaleThemeSwitcher";

export default function Login() {
  const [, navigate] = useLocation();
  const { t, dir } = useLocale();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [patientName, setPatientName] = useState("");
  const [birthYear, setBirthYear] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          mode === "signup"
            ? { email, password, patientName, birthYear: Number(birthYear) }
            : { email, password }
        ),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? t.login.genericError);
        return;
      }
      if (data.pending) {
        setNotice(data.message);
        setMode("login");
        setPassword("");
        return;
      }
      navigate("/");
      window.location.reload();
    } catch {
      setError(t.login.connectionError);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className="relative flex min-h-screen items-center justify-center bg-[#f7f9f7] px-4"
      dir={dir}
    >
      <div className="absolute top-4 end-4"><LocaleThemeSwitcher /></div>
      <div className="w-full max-w-sm rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <div className="mb-6 flex flex-col items-center gap-3 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-teal-800 text-white">
            <HeartPulse className="h-6 w-6" />
          </span>
          <h1 className="text-xl font-extrabold text-teal-950">{t.app.name}</h1>
          <p className="text-sm text-slate-500">
            {mode === "login" ? t.login.loginSubtitle : t.login.signupSubtitle}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {mode === "signup" && (
            <>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">{t.login.patientName}</label>
                <input
                  type="text"
                  required
                  minLength={2}
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                  placeholder={t.login.fullNamePlaceholder}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-bold text-slate-700">{t.login.birthYear}</label>
                <input
                  type="number"
                  required
                  min={1900}
                  max={new Date().getFullYear()}
                  value={birthYear}
                  onChange={e => setBirthYear(e.target.value)}
                  className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
                  placeholder="1965"
                  dir="ltr"
                />
              </div>
            </>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">{t.login.email}</label>
            <input
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
              placeholder="name@example.com"
              dir="ltr"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-bold text-slate-700">{t.login.password}</label>
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/20"
              placeholder="••••••••"
              dir="ltr"
            />
          </div>

          {notice && (
            <p className="rounded-xl bg-emerald-50 px-3 py-3 text-sm font-bold leading-6 text-emerald-800">
              {notice}
            </p>
          )}

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="mt-2 flex items-center justify-center gap-2 rounded-xl bg-teal-800 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-900 disabled:opacity-60"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            {mode === "login" ? t.login.signIn : t.login.createAccount}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === "login" ? "signup" : "login");
            setError(null);
            setNotice(null);
          }}
          className="mt-5 w-full text-center text-sm font-bold text-teal-800 hover:underline"
        >
          {mode === "login" ? t.login.noAccount : t.login.haveAccount}
        </button>
      </div>
    </div>
  );
}
