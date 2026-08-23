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
// Performance (Phase 4b): single round-trip for user identity + full profile
// by querying /api/auth/me instead of chaining a store getDoc call.

type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};

const SESSION_KEY = "/api/auth/me";

async function fetchSession(): Promise<{ user: AuthUser | null; profile: Record<string, unknown> | null }> {
  // Profile data changes after purchases, quest rewards, care actions, and
  // garden actions. Keep the session read out of the browser/Next fetch cache
  // so a navigation never restores a stale empty inventory.
  const res = await fetch(SESSION_KEY, { credentials: "include", cache: "no-store" });
  if (!res.ok) return { user: null, profile: null };
  const payload = await res.json().catch(() => ({}));
  return { 
    user: (payload as any).user ?? null,
    profile: (payload as any).profile ?? null
  };
}

export function useAuth() {
  const router = useRouter();

  // Single shared SWR key across every mounted game page/layout. Dedupes
  // simultaneous mounts, caches across navigations, revalidates on focus.
  const { data, isLoading, mutate: mutateSession } = useSWR(SESSION_KEY, fetchSession, {
    revalidateOnFocus: true,
    dedupingInterval: 30_000
  });
  
  const user = data?.user ?? null;
  const profile = data?.profile ?? null;

  // Redirect unauthenticated visitors away from game routes once the session
  // settles. Also persists/clears the "remember me" localStorage mirror.
  useEffect(() => {
    if (isLoading) return;
    if (user) {
      if (getRememberedSession()) saveRememberedSession(user);
      return;
    }
    clearRememberedSession();
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      if (path !== "/" && path !== "/login" && path !== "/signup") {
        router.push("/login");
      }
    }
  }, [user, isLoading, router]);

  return {
    user,
    profile,
    setProfile: (next: Record<string, unknown> | null) => {
      if (user) {
        // Optimistic cache update without triggering a revalidation
        void mutateSession({ user, profile: next }, false);
      }
    },
    refreshProfile: (): Promise<void> => {
      return mutateSession().then(() => {});
    },
    loading: isLoading && !data
  };
}
