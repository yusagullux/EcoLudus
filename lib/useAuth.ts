// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthChange, getUserProfile } from "@/public/js/auth.js";

export function useAuth() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  const refreshProfile = async (uid: string) => {
    try {
      const profileRes = await getUserProfile(uid);
      if (profileRes.success) {
        setProfile(profileRes.data);
      }
    } catch (err) {
      console.error("Error refreshing profile:", err);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthChange(async (currentUser) => {
      if (!currentUser) {
        setUser(null);
        setProfile(null);
        if (typeof window !== "undefined") {
          const path = window.location.pathname;
          if (path !== "/landing" && path !== "/login" && path !== "/signup") {
            router.push("/login");
          }
        }
        setLoading(false);
      } else {
        setUser(currentUser);
        await refreshProfile(currentUser.uid);
        setLoading(false);
      }
    });

    return () => {
      if (typeof unsubscribe === "function") {
        unsubscribe();
      }
    };
  }, [router]);

  return {
    user,
    profile,
    setProfile,
    refreshProfile: () => user && refreshProfile(user.uid),
    loading
  };
}
