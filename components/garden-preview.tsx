"use client";

import { useState } from "react";

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

function createInitialPlants(): Plant[] {
  // Deterministic layout so server and client render identical HTML during
  // hydration. Positions/stages are hand-picked to look varied without using
  // Math.random(), which would differ between SSR and the browser.
  return [
    { id: "plant-0", stage: "seed",   x: 14, y: 14, color: "#7cb082" },
    { id: "plant-1", stage: "flower", x: 46, y: 16, color: "#6b9e7f" },
    { id: "plant-2", stage: "sprout", x: 78, y: 12, color: "#a4b494" },
    { id: "plant-3", stage: "sprout", x: 12, y: 54, color: "#8fb89f" },
    { id: "plant-4", stage: "seed",   x: 48, y: 52, color: "#98d98e" },
    { id: "plant-5", stage: "flower", x: 80, y: 56, color: "#7cb082" },
    { id: "plant-6", stage: "flower", x: 16, y: 94, color: "#a4b494" },
    { id: "plant-7", stage: "seed",   x: 50, y: 90, color: "#8fb89f" },
    { id: "plant-8", stage: "sprout", x: 76, y: 92, color: "#6b9e7f" }
  ];
}

export function GardenPreview() {
  const [plants, setPlants] = useState<Plant[]>(createInitialPlants);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
    <div className="mk-surface rounded-[2rem] p-8 shadow-[var(--shadow-lift)] sm:p-10">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <p className="mk-c-muted text-xs font-bold uppercase tracking-[0.2em]">Interactive preview</p>
          <h3 className="mk-c-primary mt-2 font-serif text-3xl">Your virtual garden</h3>
          <p className="mk-c-secondary mt-2 text-sm">Click plants to grow them — hand-drawn, live in the browser.</p>
        </div>
      </div>

      <div className="mk-bg-alt relative mx-auto max-w-xl rounded-2xl border-2 border-dashed p-8" style={{ borderColor: "color-mix(in srgb, var(--border-default) 50%, transparent)" }}>
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
        <div className="relative grid h-80 grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-6">
          {plants.map((plant) => (
            <button
              type="button"
              key={plant.id}
              className="flex cursor-pointer items-center justify-center rounded-2xl bg-transparent p-0 transition-transform hover:scale-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--text-accent)]"
              onClick={() => growPlant(plant.id)}
              onMouseEnter={() => setHoveredId(plant.id)}
              onMouseLeave={() => setHoveredId(null)}
              aria-label={`Grow plant ${plant.id}`}
            >
              <div
                className={`flex flex-col items-center rounded-xl transition-all ${
                  hoveredId === plant.id ? "p-2" : ""
                }`}
                style={hoveredId === plant.id ? { background: "color-mix(in srgb, var(--bg-panel) 60%, transparent)" } : undefined}
              >
                <PlantStage stage={plant.stage} color={plant.color} />
                <div className="mk-c-muted mt-2 text-xs capitalize">
                  {plant.stage}
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 flex items-center justify-between">
        <div className="mk-c-muted text-xs">
          <span className="mk-c-primary font-semibold">{plants.filter((p) => p.stage === "flower").length}</span>{" "}
          in bloom •
          <span className="mk-c-primary ml-2 font-semibold">{plants.filter((p) => p.stage === "seed").length}</span>{" "}
          sprouting soon
        </div>
        <button
          type="button"
          onClick={() =>
            setPlants((prev) =>
              prev.map((p) => ({
                ...p,
                stage: "seed",
              }))
            )
          }
          className="mk-c-accent text-xs font-medium underline hover:opacity-80"
        >
          Reset garden
        </button>
      </div>
    </div>
  );
}
