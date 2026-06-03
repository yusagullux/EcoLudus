// @ts-nocheck
"use client";

import { useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { PageHero, Panel, Pill } from "@/components/game-ui";

const badgeList = [
  { level: 1, name: "Cat", mark: "CT" },
  { level: 2, name: "Fox", mark: "FX" },
  { level: 3, name: "Rabbit", mark: "RB" },
  { level: 4, name: "Deer", mark: "DR" },
  { level: 5, name: "Wolf", mark: "WF" },
  { level: 6, name: "Bear", mark: "BR" },
  { level: 7, name: "Eagle", mark: "EA" },
  { level: 8, name: "Tiger", mark: "TG" },
  { level: 9, name: "Lion", mark: "LN" }
];

function getBadge(level: number) {
  return badgeList[Math.min(Math.max(level, 1), 9) - 1];
}

const mockUsers = [
  { id: "u1", displayName: "EcoWarrior", xp: 8420, level: 7 },
  { id: "u2", displayName: "GreenHunter", xp: 5230, level: 6 },
  { id: "u3", displayName: "NatureKeeper", xp: 3190, level: 5 },
  { id: "u4", displayName: "ForestWalker", xp: 2040, level: 4 },
  { id: "u5", displayName: "LeafGuard", xp: 1250, level: 3 },
  { id: "u6", displayName: "MossStep", xp: 740, level: 2 },
  { id: "u7", displayName: "TreeSapling", xp: 320, level: 1 }
];

const medalLabel = ["1st", "2nd", "3rd"];
const medalColors = ["#9a6b1f", "#5d6f7a", "#8a4f25"];

export default function LeaderboardPage() {
  const { user } = useAuth();
  const [users] = useState(mockUsers);
  const sorted = [...users].sort((a, b) => b.xp - a.xp);
  const podium = [sorted[1], sorted[0], sorted[2]];
  const podiumRank = [2, 1, 3];

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Global rankings" title="Leaderboard" description="Top EcoLudus players ranked by XP earned." />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {podium.map((player, index) => {
          if (!player) return <div key={index} />;
          const rank = podiumRank[index];
          const badge = getBadge(player.level);
          const isGold = rank === 1;
          return (
            <article
              key={player.id}
              className={`flex flex-col items-center gap-3 rounded-[22px] border p-5 text-center shadow-[0_18px_48px_rgba(26,45,29,0.07)] transition hover:-translate-y-0.5 ${
                isGold ? "border-[#e6d3a6] bg-[#fbf4df] sm:-mt-3 sm:pb-7 sm:pt-7" : "border-[#dfe7d7] bg-[#fffefa]"
              }`}
            >
              <span className="font-serif text-3xl font-extrabold" style={{ color: medalColors[rank - 1] }}>{medalLabel[rank - 1]}</span>
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white font-serif text-xl font-extrabold text-forest-800 shadow-sm">{badge.mark}</span>
              <div>
                <p className="font-serif text-lg font-extrabold leading-snug text-forest-950">{player.displayName}</p>
                <p className="text-xs font-semibold text-forest-700/58">{badge.name}, Lvl {player.level}</p>
              </div>
              <p className="font-serif text-xl font-extrabold" style={{ color: medalColors[rank - 1] }}>{player.xp.toLocaleString()} XP</p>
            </article>
          );
        })}
      </div>

      <Panel eyebrow="Full list" title="Rankings" action={<Pill>{sorted.length} players</Pill>} className="overflow-hidden">
        <div className="-mx-5 -my-5 overflow-x-auto sm:-mx-6 sm:-my-6">
          <div className="min-w-[620px]">
            <div className="grid grid-cols-[64px_1fr_110px_140px] items-center gap-4 border-b border-[#e7ecdf] bg-[#f4f7ef] px-5 py-3">
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">#</span>
              <span className="text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Player</span>
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">Level</span>
              <span className="text-right text-[10px] font-extrabold uppercase tracking-[0.16em] text-forest-700/54">XP</span>
            </div>

            {sorted.map((player, index) => {
              const rank = index + 1;
              const badge = getBadge(player.level);
              const isCurrentUser = user && player.id === user.uid;
              const isTop3 = rank <= 3;
              return (
                <div
                  key={player.id}
                  className={`grid grid-cols-[64px_1fr_110px_140px] items-center gap-4 border-b border-[#edf1e8] px-5 py-4 last:border-0 transition hover:bg-[#f7f9f2] ${isCurrentUser ? "bg-[#eef5ea]" : "bg-[#fffefa]"}`}
                >
                  <div className="text-center font-serif text-xl font-extrabold" style={{ color: isTop3 ? medalColors[rank - 1] : "#8fa083" }}>{rank}</div>
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#f4f7ef] text-xs font-extrabold text-forest-800">{badge.mark}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-extrabold text-forest-950">{player.displayName}{isCurrentUser ? " (You)" : ""}</p>
                      <p className="text-xs font-semibold text-forest-700/56">{badge.name} Badge</p>
                    </div>
                  </div>
                  <div className="text-right"><Pill>Lv {player.level}</Pill></div>
                  <div className="text-right">
                    <p className="font-serif text-lg font-extrabold text-forest-800">{player.xp.toLocaleString()}</p>
                    <p className="text-[10px] font-bold text-forest-700/48">XP</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </Panel>
    </div>
  );
}
