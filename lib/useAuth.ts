"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";

type AuthUser = {
  uid: string;
  email: string;
  displayName: string;
};

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [profile, setProfile] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = useCallback(async (uid: string) => {
    try {
      const res = await fetch("/api/firestore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ op: "getDoc", path: ["users", uid] })
      });
      if (res.ok) {
        const payload = await res.json();
        if (payload.data) {
          setProfile(payload.data);
        }
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const res = await fetch("/api/auth/me", {
          credentials: "include",
          cache: "no-store"
        });
        const payload = await res.json().catch(() => ({}));

        if (cancelled) return;

        if (payload.user) {
          const currentUser: AuthUser = {
            uid: payload.user.uid,
            email: payload.user.email,
            displayName: payload.user.displayName
          };
          setUser(currentUser);
          await refreshProfile(currentUser.uid);
        } else {
          setUser(null);
          setProfile(null);
          if (typeof window !== "undefined") {
            const path = window.location.pathname;
            if (path !== "/landing" && path !== "/login" && path !== "/signup") {
              router.push("/login");
            }
          }
        }
      } catch (err) {
        console.error("Auth bootstrap error:", err);
        if (!cancelled) {
          setUser(null);
          setProfile(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, [router, refreshProfile]);

  return {
    user,
    profile,
    setProfile,
    refreshProfile: () => user && refreshProfile(user.uid),
    loading
  };
}
