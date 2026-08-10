"use client";

import { useAuth } from "@/lib/useAuth";
import { PublicProfileView, type PublicProfile } from "@/components/public-profile";
import { StaggerContainer, StaggerItem } from "@/lib/animations";

export default function ProfilePage() {
  const { user, profile } = useAuth();

  const publicProfile: PublicProfile = {
    id: String(user?.uid ?? ""),
    displayName: String(profile?.displayName || user?.email?.split("@")[0] || "Eco Explorer"),
    profileImage: typeof profile?.profileImage === "string" ? (profile.profileImage as string) : null,
    xp: Number(profile?.xp ?? 0),
    level: Number(profile?.level ?? 1),
    ecoPoints: Number(profile?.ecoPoints ?? 0),
    missionsCompleted: Number(profile?.missionsCompleted ?? 0),
    carbonReduced: Number(profile?.carbonReduced ?? 0),
    currentStreak: Number(profile?.currentStreak ?? 0),
    longestStreak: Number(profile?.longestStreak ?? 0),
    lastLoginDate: String(profile?.lastLoginDate ?? "Not tracked yet"),
    completedQuests: Array.isArray(profile?.completedQuests) ? (profile.completedQuests as string[]) : [],
    plants: Array.isArray(profile?.plants) ? profile.plants : []
  };

  return (
    <StaggerContainer className="flex flex-col gap-5" as="div">
      <StaggerItem as="div">
        <PublicProfileView profile={publicProfile} isOwner={true} />
      </StaggerItem>
    </StaggerContainer>
  );
}