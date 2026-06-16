// @ts-nocheck
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/useAuth";
import { HeroMetric, MetricCard, PageHero, Panel, Pill, ProgressBar } from "@/components/game-ui";

type CommunityStats = {
  totalUsers: number;
  totalXP: number;
  totalCO2kg: number;
  totalMissions: number;
  totalTreesPlanted: number;
  source: string;
  cachedAt: string;
};

const TREE_MILESTONES = [
  { type: "level", value: 5, trees: 1, label: "Reach Level 5" },
  { type: "level", value: 10, trees: 5, label: "Reach Level 10" },
  { type: "carbon", value: 10, trees: 1, label: "Offset 10 kg CO₂" },
  { type: "carbon", value: 50, trees: 3, label: "Offset 50 kg CO₂" },
  { type: "missions", value: 50, trees: 1, label: "Complete 50 missions" },
  { type: "missions", value: 100, trees: 2, label: "Complete 100 missions" }
];

function MilestoneRow({
  milestone,
  profile
}: {
  milestone: (typeof TREE_MILESTONES)[number];
  profile: Record<string, unknown> | null;
}) {
  if (!profile) return null;

  const claimed = Boolean(profile?.[`milestone_${milestone.type}_${milestone.value}`]);
  const current =
    milestone.type === "level"
      ? Number(profile?.level ?? 1)
      : milestone.type === "carbon"
      ? Number(profile?.carbonReduced ?? 0)
      : Number(profile?.missionsCompleted ?? 0);

  const progress = Math.min(100, Math.round((current / milestone.value) * 100));

  return (
    <div className="grid grid-cols-[1fr_80px_72px] items-center gap-4 border-b border-[#edf1e8] bg-[#fffefa] px-5 py-4 last:border-0 hover:bg-[#f7f9f2]">
      <div>
        <p className="text-sm font-extrabold text-forest-950">{milestone.label}</p>
        <div className="mt-1.5">
          <ProgressBar value={progress} color={claimed ? "#2f6b46" : "#9fb78c"} />
        </div>
        <p className="mt-1 text-xs font-semibold text-forest-700/50">
          {claimed
            ? "Completed"
            : `${current.toLocaleString()} / ${milestone.value.toLocaleString()}`}
        </p>
      </div>
      <div className="text-center">
        <span className="text-lg">🌳</span>
        <p className="text-xs font-extrabold text-forest-800">×{milestone.trees}</p>
      </div>
      <div className="text-right">
        {claimed ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-extrabold text-emerald-700">
            ✓ Done
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-[#f4f7ef] px-2.5 py-1 text-[10px] font-extrabold text-forest-600">
            {progress}%
          </span>
        )}
      </div>
    </div>
  );
}

export default function ImpactPage() {
  const { profile } = useAuth();
  const [community, setCommunity] = useState<CommunityStats | null>(null);
  const [loadingCommunity, setLoadingCommunity] = useState(true);

  useEffect(() => {
    async function loadCommunity() {
      try {
        const res = await fetch("/api/stats/community-aggregate");
        if (res.ok) {
          const data = await res.json();
          setCommunity(data);
        }
      } catch (err) {
        console.error("Failed to load community stats:", err);
      } finally {
        setLoadingCommunity(false);
      }
    }
    loadCommunity();
  }, []);

  const xp = Number(profile?.xp ?? 0);
  const level = Number(profile?.level ?? 1);
  const carbonReduced = Number(profile?.carbonReduced ?? 0);
  const missionsCompleted = Number(profile?.missionsCompleted ?? 0);
  const treesPlanted = Number(profile?.treesPlanted ?? 0);
  const notifications: any[] = Array.isArray(profile?.notifications) ? (profile.notifications as any[]) : [];
  const unreadNotifications = notifications.filter((n) => !n.read);

  const totalClaimed = TREE_MILESTONES.filter((m) =>
    Boolean(profile?.[`milestone_${m.type}_${m.value}`])
  ).length;

  const nextMilestone = TREE_MILESTONES.find(
    (m) => !Boolean(profile?.[`milestone_${m.type}_${m.value}`])
  );

  return (
    <div className="flex flex-col gap-5">
      <PageHero
        eyebrow="Your real-world footprint"
        title="Impact Dashboard"
        description="Every quest completed has a real impact. Here's yours — and the community's."
      >
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="CO₂ saved" value={`${carbonReduced.toFixed(1)} kg`} />
          <HeroMetric label="Trees planted" value={treesPlanted} />
          <HeroMetric label="Missions done" value={missionsCompleted} />
        </div>
      </PageHero>

      {/* Personal stats */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="CO₂ Reduced" value={`${carbonReduced.toFixed(1)} kg`} accent="#237482" />
        <MetricCard label="Trees Planted" value={treesPlanted} accent="#2f6b46" />
        <MetricCard label="Missions Done" value={missionsCompleted} accent="#62508f" />
        <MetricCard label="XP Earned" value={xp.toLocaleString()} accent="#9a6b1f" />
      </div>

      {/* Tree milestones */}
      <Panel
        eyebrow="Real-world rewards"
        title="Tree Planting Milestones"
        action={
          <Pill active={totalClaimed > 0}>
            {totalClaimed}/{TREE_MILESTONES.length} claimed
          </Pill>
        }
      >
        {nextMilestone && (
          <div className="mb-4 rounded-xl border border-[#d6e8c2] bg-[#f0f8e8] px-4 py-3">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-600">
              Next milestone
            </p>
            <p className="mt-0.5 text-sm font-extrabold text-forest-950">
              🌳 {nextMilestone.label} → plants {nextMilestone.trees} tree
              {nextMilestone.trees > 1 ? "s" : ""}
            </p>
          </div>
        )}
        <div className="-mx-5 -mt-5 overflow-hidden sm:-mx-6 sm:-mt-6">
          {TREE_MILESTONES.map((milestone) => (
            <MilestoneRow
              key={`${milestone.type}_${milestone.value}`}
              milestone={milestone}
              profile={profile}
            />
          ))}
        </div>
      </Panel>

      {/* Notifications */}
      {notifications.length > 0 && (
        <Panel
          eyebrow="Eco activity"
          title="Notifications"
          action={
            unreadNotifications.length > 0 ? (
              <Pill active>{unreadNotifications.length} new</Pill>
            ) : undefined
          }
        >
          <div className="-mx-5 -mt-5 divide-y divide-[#e7ecdf] sm:-mx-6 sm:-mt-6">
            {notifications.slice(0, 10).map((notification: any) => (
              <div key={notification.id} className={`flex items-start gap-3 px-5 py-4 sm:px-6 ${!notification.read ? "bg-[#f0f8e8]" : ""}`}>
                <span className="mt-0.5 text-lg">{notification.type === "tree_planted" ? "🌳" : "🔔"}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-extrabold text-forest-950">{notification.title}</p>
                  <p className="mt-0.5 text-xs font-semibold text-forest-700/60">{notification.message}</p>
                  <p className="mt-1 text-[10px] font-bold text-forest-700/40">
                    {new Date(notification.createdAt).toLocaleDateString()}
                  </p>
                </div>
                {!notification.read && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500 mt-2" />
                )}
              </div>
            ))}
          </div>
        </Panel>
      )}

      {/* Community stats */}
      <Panel
        eyebrow="Global community"
        title="Community Impact"
        action={
          community ? (
            <span className="text-[10px] font-bold text-forest-700/50">
              {community.source === "stale-cache" ? "Cached" : "Live"}
            </span>
          ) : undefined
        }
      >
        {loadingCommunity ? (
          <div className="py-8 text-center text-sm font-semibold text-forest-700/50">
            Loading community stats...
          </div>
        ) : community ? (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              { label: "Total Members", value: community.totalUsers.toLocaleString(), icon: "👥" },
              {
                label: "Missions Completed",
                value: community.totalMissions.toLocaleString(),
                icon: "✅"
              },
              {
                label: "CO₂ Offset",
                value: `${community.totalCO2kg.toFixed(1)} kg`,
                icon: "🌿"
              },
              {
                label: "Trees Planted",
                value: community.totalTreesPlanted.toLocaleString(),
                icon: "🌳"
              },
              {
                label: "Total XP",
                value: community.totalXP.toLocaleString(),
                icon: "⭐"
              },
              {
                label: "Last updated",
                value: community.cachedAt
                  ? new Date(community.cachedAt).toLocaleTimeString()
                  : "—",
                icon: "🕒"
              }
            ].map(({ label, value, icon }) => (
              <div key={label} className="rounded-2xl bg-[#f4f7ef] p-4">
                <p className="text-lg">{icon}</p>
                <p className="mt-2 text-sm font-extrabold text-forest-950">{value}</p>
                <p className="mt-0.5 text-[11px] font-semibold text-forest-700/56">{label}</p>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-sm font-semibold text-forest-700/50">
            Community stats unavailable.
          </div>
        )}
      </Panel>

      {/* How trees are planted */}
      <Panel eyebrow="Partners" title="How Trees Are Planted">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            {
              icon: "🏆",
              title: "Hit a milestone",
              desc: "Reach XP levels, carbon targets, or mission counts to unlock tree planting."
            },
            {
              icon: "🌱",
              title: "Ecologi plants the tree",
              desc: "EcoLudus uses the Ecologi API to plant real trees in certified reforestation projects."
            },
            {
              icon: "📊",
              title: "Track your forest",
              desc: "Your trees counter grows here on your Impact Dashboard in real time."
            }
          ].map(({ icon, title, desc }) => (
            <div key={title} className="rounded-2xl bg-[#f4f7ef] p-4">
              <p className="text-2xl">{icon}</p>
              <p className="mt-2 text-sm font-extrabold text-forest-950">{title}</p>
              <p className="mt-1 text-xs leading-relaxed text-forest-700/62">{desc}</p>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
