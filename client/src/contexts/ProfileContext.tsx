import { trpc } from "@/lib/trpc";
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

type Ctx = {
  profileId: number | null;
  setProfileId: (id: number) => void;
  profiles: Array<{
    id: number;
    name: string;
    relation: string | null;
    birthYear: number | null;
    isPrimary: boolean;
    visitCount: number;
  }>;
  activeProfile: Ctx["profiles"][number] | null;
  isLoading: boolean;
};

const ProfileContext = createContext<Ctx | null>(null);
const KEY = "activeProfileId";

export function ProfileProvider({ children }: { children: ReactNode }) {
  const list = trpc.profiles.list.useQuery();
  const [profileId, setProfileIdState] = useState<number | null>(() => {
    if (typeof window === "undefined") return null;
    const v = window.localStorage.getItem(KEY);
    return v ? Number(v) : null;
  });

  const profiles = list.data ?? [];

  // Fall back to the first profile whenever the stored one is gone or unset.
  useEffect(() => {
    if (profiles.length === 0) return;
    const valid = profiles.some(p => p.id === profileId);
    if (!valid) {
      const next = profiles[0].id;
      setProfileIdState(next);
      if (typeof window !== "undefined") window.localStorage.setItem(KEY, String(next));
    }
  }, [profiles, profileId]);

  const setProfileId = (id: number) => {
    setProfileIdState(id);
    if (typeof window !== "undefined") window.localStorage.setItem(KEY, String(id));
  };

  const value = useMemo<Ctx>(
    () => ({
      profileId,
      setProfileId,
      profiles,
      activeProfile: profiles.find(p => p.id === profileId) ?? null,
      isLoading: list.isLoading,
    }),
    [profileId, profiles, list.isLoading]
  );

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
}

export function useProfile() {
  const ctx = useContext(ProfileContext);
  if (!ctx) throw new Error("useProfile must be used inside ProfileProvider");
  return ctx;
}
