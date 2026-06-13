"use client";

import { useEffect, useState } from "react";

interface Plant {
  id: string;
  stage: "seed" | "sprout" | "flower";
  x: number;
  y: number;
  color: string;
}

const PLANT_COLORS = [
  "#7cb082", // Sage green
  "#6b9e7f", // Muted teal
  "#a4b494", // Celadon
  "#8fb89f", // Seafoam
  "#98d98e", // Light green
];

function PlantStage({ stage, color }: { stage: string; color: string }) {
  switch (stage) {
    case "seed":
      return (
        <svg width="32" height="32" viewBox="0 0 32 32" className="drop-shadow-sm">
          {/* Soil */}
          <ellipse cx="16" cy="24" rx="12" ry="4" fill={color} opacity="0.3" />
          {/* Seed */}
          <circle cx="16" cy="20" r="3" fill={color} />
        </svg>
      );
    case "sprout":
      return (
        <svg width="32" height="40" viewBox="0 0 32 40" className="drop-shadow-md">
          {/* Soil */}
          <ellipse cx="16" cy="36" rx="12" ry="3" fill={color} opacity="0.2" />
          {/* Stem */}
          <path d="M 16 30 Q 14 20, 16 10" stroke={color} strokeWidth="2" fill="none" />
          {/* Left leaf */}
          <ellipse cx="10" cy="18" rx="4" ry="6" fill={color} opacity="0.7" transform="rotate(-30 10 18)" />
          {/* Right leaf */}
          <ellipse cx="22" cy="18" rx="4" ry="6" fill={color} opacity="0.7" transform="rotate(30 22 18)" />
        </svg>
      );
    case "flower":
      return (
        <svg width="40" height="48" viewBox="0 0 40 48" className="drop-shadow-lg">
          {/* Soil */}
          <ellipse cx="20" cy="44" rx="14" ry="3" fill={color} opacity="0.15" />
          {/* Stem */}
          <path d="M 20 38 Q 18 25, 20 12" stroke={color} strokeWidth="2.5" fill="none" />
          {/* Leaves */}
          <ellipse cx="12" cy="25" rx="5" ry="7" fill={color} opacity="0.6" transform="rotate(-35 12 25)" />
          <ellipse cx="28" cy="25" rx="5" ry="7" fill={color} opacity="0.6" transform="rotate(35 28 25)" />
          {/* Flower petals */}
          <circle cx="20" cy="5" r="3.5" fill={color} opacity="0.9" />
          <circle cx="28" cy="9" r="3.5" fill={color} opacity="0.85" transform="rotate(60 20 8)" />
          <circle cx="28" cy="17" r="3.5" fill={color} opacity="0.85" transform="rotate(120 20 12)" />
          <circle cx="20" cy="21" r="3.5" fill={color} opacity="0.85" />
          <circle cx="12" cy="17" r="3.5" fill={color} opacity="0.85" transform="rotate(-120 20 12)" />
          <circle cx="12" cy="9" r="3.5" fill={color} opacity="0.85" transform="rotate(-60 20 8)" />
          {/* Flower center */}
          <circle cx="20" cy="12" r="2.5" fill="#d8ead0" />
        </svg>
      );
    default:
      return null;
  }
}

export function GardenPreview() {
  const [plants, setPlants] = useState<Plant[]>([]);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    // Initialize garden with random plants
    const initialPlants: Plant[] = Array.from({ length: 9 }, (_, i) => ({
      id: `plant-${i}`,
      stage: (["seed", "sprout", "flower"] as const)[Math.floor(Math.random() * 3)],
      x: (i % 3) * 30 + 10 + Math.random() * 8,
      y: Math.floor(i / 3) * 40 + 10 + Math.random() * 8,
      color: PLANT_COLORS[Math.floor(Math.random() * PLANT_COLORS.length)],
    }));
    setPlants(initialPlants);
  }, []);

  const growPlant = (id: string) => {
    setPlants((prev) =>
      prev.map((plant) => {
        if (plant.id === id) {
          const stages = ["seed", "sprout", "flower"] as const;
          const currentIndex = stages.indexOf(plant.stage);
          return {
            ...plant,
            stage: stages[(currentIndex + 1) % stages.length],
          };
        }
        return plant;
      })
    );
  };

  return (
    <div className="rounded-[2rem] border border-forest-900/10 bg-white/70 p-8 shadow-[0_24px_50px_rgba(16,33,20,0.08)]">
      <div className="mb-6">
        <h3 className="font-serif text-2xl text-forest-950">Your virtual garden</h3>
        <p className="mt-2 text-sm text-forest-900/70">Click plants to grow them • Real garden, hand-drawn</p>
      </div>

      <div className="relative mx-auto max-w-xl rounded-2xl border-2 border-dashed border-forest-900/15 bg-[linear-gradient(180deg,#eff3e8_0%,#dce7d5_100%)] p-8">
        {/* Garden background decorations */}
        <svg
          className="pointer-events-none absolute inset-0 opacity-30"
          width="100%"
          height="100%"
          viewBox="0 0 400 300"
          preserveAspectRatio="none"
        >
          <defs>
            <pattern id="soil" patternUnits="userSpaceOnUse" width="40" height="40">
              <circle cx="5" cy="5" r="1.5" fill="#a89968" opacity="0.3" />
              <circle cx="25" cy="15" r="1" fill="#a89968" opacity="0.2" />
              <circle cx="35" cy="30" r="1.5" fill="#a89968" opacity="0.25" />
            </pattern>
          </defs>
          <rect width="400" height="300" fill="url(#soil)" />
        </svg>

        {/* Plants grid */}
        <div className="relative grid h-80 grid-cols-3 gap-6">
          {plants.map((plant) => (
            <div
              key={plant.id}
              className="flex cursor-pointer items-center justify-center transition-transform hover:scale-110 active:scale-95"
              onClick={() => growPlant(plant.id)}
              onMouseEnter={() => setHoveredId(plant.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <div
                className={`flex flex-col items-center rounded-xl transition-all ${
                  hoveredId === plant.id ? "bg-white/50 p-2" : ""
                }`}
              >
                <PlantStage stage={plant.stage} color={plant.color} />
                <div className="mt-2 text-xs text-forest-900/50 capitalize">
                  {plant.stage}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="text-xs text-forest-900/60">
          <span className="font-semibold text-forest-900">{plants.filter((p) => p.stage === "flower").length}</span>{" "}
          in bloom • 
          <span className="ml-2 font-semibold text-forest-900">{plants.filter((p) => p.stage === "seed").length}</span>{" "}
          sprouting soon
        </div>
        <button
          onClick={() =>
            setPlants((prev) =>
              prev.map((p) => ({
                ...p,
                stage: "seed",
              }))
            )
          }
          className="text-xs font-medium text-forest-700 hover:text-forest-900 underline"
        >
          Reset garden
        </button>
      </div>
    </div>
  );
}
