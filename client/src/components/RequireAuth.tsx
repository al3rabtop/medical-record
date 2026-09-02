import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export function RequireAuth({ children }: { children: ReactNode }) {
  const [, navigate] = useLocation();
  const me = trpc.auth.me.useQuery();

  useEffect(() => {
    if (!me.isLoading && !me.data) {
      navigate("/login");
    }
  }, [me.isLoading, me.data, navigate]);

  if (me.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-teal-800" />
      </div>
    );
  }

  if (!me.data) {
    return null;
  }

  return <>{children}</>;
}
