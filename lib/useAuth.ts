"use client";

import { useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useRouter } from "next/navigation";
import {
  clearRememberedSession,
  getRememberedSession,
  saveRememberedSession
} from "@/lib/auth-persistence";

// Auth + profile bootstrap, backed by SWR.
//
// Performance (Phase 4a): the old hook did two sequential round-trips
// (`/api/auth/me` then `/api/store` getDoc) on EVERY page mount with
// `cache: "no-store"`, then re-fetched the whole profile after every mutation.
// Navigating between game pages re-ran the full waterfall each time. SWR gives
// a single shared cache keyed on the session + profile: simultaneous mounts
// (layout + page) dedupe to one request, navigations reuse the cached data and
// revalidate on focus instead of refetching, and mutations call `mutate()` to
// refresh only the profile key.
//
// The return shape ({ user, profile, setProfile, refreshProfile, loading }) is
// unchanged so the many page call sites don't need edits: `setProfile(v)` is an
// optimistic cache write (no revalidate); `refreshProfile()` is a revalidation.

type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};

const SESSION_KEY = "/api/auth/me";
const profileKey = (uid: string) => ["profile", uid] as const;

async function fetchSession(): Promise<{ user: AuthUser | null }> {
  const res = await fetch(SESSION_KEY, { credentials: "include" });
  if (!res.ok) return { user: null };
  const payload = await res.json().catch(() => ({}));
  return { user: (payload as { user?: AuthUser | null }).user ?? null };
}

async function fetchProfile(uid: string): Promise<Record<string, unknown> | null> {
  const res = await fetch("/api/store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ op: "getDoc", path: ["users", uid] })
  });
  if (!res.ok) throw new Error("profile fetch failed");
  const payload = await res.json().catch(() => ({}));
  return ((payload as { data?: Record<string, unknown> }).data ?? null);
}

export function useAuth() {
  const router = useRouter();

  // Session — one shared SWR key across every mounted game page/layout. Dedupes
  // simultaneous mounts, caches across navigations, revalidates on focus.
  const { data: session, isLoading: sessionLoading } = useSWR(SESSION_KEY, fetchSession, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000
  });
  const user = session?.user ?? null;

  // Profile — dependent on the session uid. Null key while there's no user, so
  // SWR won't fetch until the session resolves. Shares the same cache/dedupe.
  const {
    data: profile,
    isLoading: profileLoading
  } = useSWR(user ? profileKey(user.uid) : null, () => fetchProfile(user!.uid), {
    revalidateOnFocus: true,
    dedupingInterval: 15_000
  });

  // Redirect unauthenticated visitors away from game routes once the session
  // settles. Also persists/clears the "remember me" localStorage mirror.
  useEffect(() => {
    if (sessionLoading) return;
    if (user) {
      if (getRememberedSession()) saveRememberedSession(user);
      return;
    }
    clearRememberedSession();
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/landing" && path !== "/login" && path !== "/signup") {
        router.push("/login");
      }
    }
  }, [user, sessionLoading, router]);

  // "loading" is true only during the first bootstrap (session + profile). Later
  // background revalidations don't flip it, so navigation feels instant.
  const loading = sessionLoading || (user ? profileLoading && !profile : false);

  return {
    user,
    profile: profile ?? null,
    setProfile: (next: Record<string, unknown> | null) => {
      if (user) {
        // Optimistic cache update without triggering a revalidation — pages
        // follow up with refreshProfile() to get the authoritative server state.
        void mutate(profileKey(user.uid), next, { revalidate: false });
      }
    },
    refreshProfile: (): Promise<void> => {
      if (!user) return Promise.resolve();
      return mutate(profileKey(user.uid)) as Promise<void>;
    },
    loading
  };
}