"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel } from "@/components/game-ui";
import { PublicProfileView, type PublicProfile } from "@/components/public-profile";

export default function PublicProfilePage() {
  const params = useParams();
  const id = String(params?.id ?? "");
  const { user } = useAuth();
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [status, setStatus] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    async function load() {
      try {
        const res = await fetch(`/api/users/${id}`, { credentials: "include" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (!res.ok || !data?.profile) {
          setStatus("error");
          return;
        }
        setProfile(data.profile as PublicProfile);
        setStatus("ok");
      } catch {
        if (!cancelled) setStatus("error");
      }
    }
    load();
    return () => { cancelled = true; };
  }, [id]);

  if (status === "loading") {
    return (
      <Panel>
        <div className="p-8 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Loading profile…</div>
      </Panel>
    );
  }

  if (status === "error" || !profile) {
    return (
      <div className="flex flex-col gap-5">
        <PageHero eyebrow="Profile" title="Profile not found" description="This explorer may not exist or is unavailable." />
        <Panel>
          <div className="flex flex-col items-center gap-3 p-8 text-center">
            <span className="text-4xl">🌿</span>
            <p className="text-sm font-bold" style={{ color: "var(--text-muted)" }}>We couldn't load this profile.</p>
            <Link href="/leaderboard" className="font-bold underline">Back to leaderboard</Link>
          </div>
        </Panel>
      </div>
    );
  }

  const isOwner = Boolean(user?.uid) && user?.uid === id;
  return <PublicProfileView profile={profile} isOwner={isOwner} />;
}