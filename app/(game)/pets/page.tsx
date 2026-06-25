// @ts-nocheck
"use client";

import { useMemo, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import { updateUserProfile } from "@/public/js/auth.js";
import { HeroMetric, PageHero, Panel, Pill, ProgressBar, primaryButton, secondaryButton, rarityStyle, rarityBorder, type Rarity } from "@/components/game-ui";

function getPetImage(pet: any) {
  if (pet?.image) return pet.image;
  return `/images/pets/${String(pet?.name || "cat").toLowerCase()}.png`;
}

export default function PetsPage() {
  const { user, profile, setProfile } = useAuth();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [hearts, setHearts] = useState<Array<{ id: number; dx: string; dy: string }>>([]);
  const [toast, setToast] = useState("");
  const pets = Array.isArray(profile?.animals) ? profile.animals : [];
  const activePetId = profile?.activePet || pets.find((pet) => pet.active)?.id || pets[0]?.id || null;

  const selectedPet = useMemo(() => {
    return pets.find((pet) => pet.id === (selectedId || activePetId)) || pets[0] || null;
  }, [pets, selectedId, activePetId]);

  const showToast = (message: string) => {
    setToast(message);
    setTimeout(() => setToast(""), 3000);
  };

  const selectActivePet = async (pet: any) => {
    if (!user?.uid || !profile) return;
    const nextPets = pets.map((entry) => ({ ...entry, active: entry.id === pet.id }));
    const updates = { animals: nextPets, activePet: pet.id };
    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Could not choose that companion.");
      return;
    }
    setSelectedId(pet.id);
    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }
    showToast(`${pet.name} is traveling with you now.`);
  };

  const petCompanion = async () => {
    if (!user?.uid || !profile || !selectedPet) return;
    const nextPets = pets.map((pet) => {
      if (pet.id !== selectedPet.id) return pet;
      const happiness = Math.min(100, Number(pet.happiness ?? 50) + 5);
      return {
        ...pet,
        happiness,
        petsGiven: Number(pet.petsGiven ?? 0) + 1,
        lastPettedAt: new Date().toISOString()
      };
    });
    const updates = { animals: nextPets };

    const burst = Array.from({ length: 12 }).map((_, index) => ({
      id: Date.now() + index,
      dx: `${Math.round((Math.random() - 0.5) * 160)}px`,
      dy: `${Math.round(-80 - Math.random() * 110)}px`
    }));
    setHearts((current) => [...current, ...burst]);
    setTimeout(() => {
      setHearts((current) => current.filter((heart) => !burst.some((item) => item.id === heart.id)));
    }, 1100);

    const result = await updateUserProfile(user.uid, updates);
    if (!result.success) {
      showToast("Petting did not save. Please try again.");
      return;
    }
    if (typeof setProfile === "function") {
      setProfile({ ...profile, ...updates });
    }
  };

  const totalPets = pets.reduce((sum, pet) => sum + Number(pet.count ?? 1), 0);
  const avgHappiness = pets.length
    ? Math.round(pets.reduce((sum, pet) => sum + Number(pet.happiness ?? 50), 0) / pets.length)
    : 0;
  const selectedHappiness = Number(selectedPet?.happiness ?? 50);
  const selectedPetsGiven = Number(selectedPet?.petsGiven ?? 0);

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Companion care" title="Pets" description="Choose your active companion, pet them, and keep their happiness climbing.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Pets" value={totalPets} />
          <HeroMetric label="Happy" value={`${avgHappiness}%`} />
          <HeroMetric label="Active" value={selectedPet?.name || "-"} />
        </div>
      </PageHero>

      {!selectedPet ? (
        <Panel>
          <div className="rounded-2xl border border-dashed p-10 text-center" style={{ borderColor: "var(--border-default)", color: "var(--text-muted)" }}>
            <p className="font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>No companions yet</p>
            <p className="mt-1 text-sm">Hatch eggs from your collection to unlock pets.</p>
          </div>
        </Panel>
      ) : (
        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <Panel eyebrow="Active companion" title={selectedPet.name} action={<Pill active>{selectedPet.rarity || "common"}</Pill>}>
            <div className="flex flex-col items-center gap-5 text-center">
              <button
                type="button"
                onClick={petCompanion}
                className="relative flex aspect-square w-full max-w-[360px] items-center justify-center overflow-hidden rounded-[28px] border transition active:scale-[0.98]"
                style={{
                  borderColor: rarityBorder[selectedPet.rarity as Rarity] ?? "var(--border-default)",
                  background: `radial-gradient(circle at 50% 35%, ${(rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "#2f6b46")}22, transparent 58%), var(--bg-panel-alt)`
                }}
              >
                <img src={getPetImage(selectedPet)} alt={selectedPet.name} className="h-full w-full object-contain p-8 drop-shadow-[0_18px_28px_rgba(0,0,0,0.18)]" />
                {hearts.map((heart) => (
                  <span
                    key={heart.id}
                    className="pointer-events-none absolute left-1/2 top-1/2 text-3xl text-rose-500 animate-heart-pop"
                    style={{ "--dx": heart.dx, "--dy": heart.dy } as any}
                  >
                    &hearts;
                  </span>
                ))}
              </button>

              <div className="w-full max-w-md">
                <div className="mb-2 flex items-center justify-between text-xs font-bold" style={{ color: "var(--text-muted)" }}>
                  <span>Happiness</span>
                  <span>{selectedHappiness}%</span>
                </div>
                <ProgressBar value={selectedHappiness} color={rarityStyle[selectedPet.rarity as Rarity]?.accent ?? "#2f6b46"} />
              </div>

              <div className="flex flex-wrap justify-center gap-3">
                <button type="button" onClick={petCompanion} className={primaryButton}>
                  Pet Companion
                </button>
                <button type="button" onClick={() => selectActivePet(selectedPet)} disabled={selectedPet.active || activePetId === selectedPet.id} className={secondaryButton}>
                  {selectedPet.active || activePetId === selectedPet.id ? "Active Pet" : "Make Active"}
                </button>
              </div>

              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>
                Petted {selectedPetsGiven.toLocaleString()} time{selectedPetsGiven === 1 ? "" : "s"}.
              </p>
            </div>
          </Panel>

          <Panel eyebrow="Companion stats" title="Care Notes">
            <div className="flex flex-col gap-3">
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Mood</p>
                <p className="mt-1 font-serif text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {selectedHappiness >= 80 ? "Radiant" : selectedHappiness >= 55 ? "Content" : "Needs care"}
                </p>
              </div>
              <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border-default)", background: "var(--bg-panel-alt)" }}>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Last petted</p>
                <p className="mt-1 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                  {selectedPet.lastPettedAt ? new Date(selectedPet.lastPettedAt).toLocaleString() : "Not yet"}
                </p>
              </div>
            </div>
          </Panel>
        </div>
      )}

      <Panel eyebrow="Inventory" title="Choose a Pet">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {pets.map((pet) => {
            const isSelected = selectedPet?.id === pet.id;
            const isActive = pet.active || activePetId === pet.id;
            return (
              <button
                key={pet.id}
                type="button"
                onClick={() => setSelectedId(pet.id)}
                className="group overflow-hidden rounded-[20px] border text-left transition hover:-translate-y-1"
                style={{
                  borderColor: isSelected ? rarityStyle[pet.rarity as Rarity]?.accent ?? "var(--border-default)" : rarityBorder[pet.rarity as Rarity] ?? "var(--border-default)",
                  background: "var(--bg-card)"
                }}
              >
                <span className="relative block aspect-square overflow-hidden" style={{ background: `${rarityStyle[pet.rarity as Rarity]?.accent ?? "#2f6b46"}12` }}>
                  <img src={getPetImage(pet)} alt={pet.name} className="h-full w-full object-contain p-5 transition group-hover:scale-110" />
                  {isActive && <span className="absolute left-2 top-2 rounded-full bg-[#fbf4df] px-2 py-0.5 text-[9px] font-extrabold uppercase text-[#76511a]">Active</span>}
                </span>
                <span className="block p-3">
                  <span className="block truncate font-serif text-sm font-extrabold" style={{ color: "var(--text-primary)" }}>{pet.name}</span>
                  <span className="mt-2 block">
                    <ProgressBar value={Number(pet.happiness ?? 50)} color={rarityStyle[pet.rarity as Rarity]?.accent ?? "#2f6b46"} />
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </Panel>

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
