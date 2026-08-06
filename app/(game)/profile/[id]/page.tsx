"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel } from "@/components/game-ui";
import { PageSkeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
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
    return <PageSkeleton metricCount={6} panels={[{ rows: 2 }, { rows: 6 }, { rows: 4 }]} heroChips={3} />;
  }

  if (status === "error" || !profile) {
    return (
      <div className="flex flex-col gap-5">
        <PageHero eyebrow="Profile" title="Profile not found" description="This explorer may not exist or is unavailable." />
        <Panel>
          <EmptyState
            variant="plain"
            icon="🌿"
            title="We couldn't load this profile."
            action={<Link href="/leaderboard" className="font-bold underline">Back to leaderboard</Link>}
          />
        </Panel>
      </div>
    );
  }

  const isOwner = Boolean(user?.uid) && user?.uid === id;
  return <PublicProfileView profile={profile} isOwner={isOwner} />;
}