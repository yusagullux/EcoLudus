// @ts-nocheck
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/useAuth";
import {
  HeroMetric, MetricCard, PageHero, Panel, Pill,
  primaryButton, secondaryButton, inputClass
} from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

// ── Types ─────────────────────────────────────────────────────────────────────
type StopType = "park" | "recycling" | "community_garden" | "repair_cafe" | "bike_station" | "nature_trail";
type ProofType = "text" | "photo";

type EcoStop = {
  id: string;
  name: string;
  type: StopType;
  lat: number;
  lng: number;
  xpReward: number;
  ecoReward: number;
  cooldownHours: number;
  description: string;
};

type CheckinRecord = { stopId: string; checkedInAt: string };

// ── Helpers ───────────────────────────────────────────────────────────────────
const TYPE_META: Record<StopType, { icon: string; color: string; label: string }> = {
  park:             { icon: "🌳", color: "#2f6b46", label: "Park" },
  recycling:        { icon: "♻️",  color: "#237482", label: "Recycling Point" },
  community_garden: { icon: "🌱", color: "#4c7a3b", label: "Community Garden" },
  repair_cafe:      { icon: "🔧", color: "#9a6b1f", label: "Repair Café" },
  bike_station:     { icon: "🚲", color: "#2f5f86", label: "Bike Station" },
  nature_trail:     { icon: "🥾", color: "#62508f", label: "Nature Trail" }
};

const CHECKIN_RADIUS_M = 150;

function distM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function isOnCooldown(r: CheckinRecord, h: number): boolean {
  return Date.now() - new Date(r.checkedInAt).getTime() < h * 3_600_000;
}

function cooldownLabel(r: CheckinRecord, h: number): string {
  const rem = h * 3_600_000 - (Date.now() - new Date(r.checkedInAt).getTime());
  if (rem <= 0) return "Ready";
  return `${Math.floor(rem / 3_600_000)}h ${Math.floor((rem % 3_600_000) / 60_000)}m`;
}

// ── Component ─────────────────────────────────────────────────────────────────
export default function EcoMapPage() {
  const { user, profile, setProfile } = useAuth();
  const isProcessing = useRef(false);

  const [stops, setStops] = useState<EcoStop[]>([]);
  const [loadingStops, setLoadingStops] = useState(true);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);
  const [selectedStop, setSelectedStop] = useState<EcoStop | null>(null);
  const [proofType, setProofType] = useState<ProofType>("text");
  const [textProof, setTextProof] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState("");

  const checkins: CheckinRecord[] = Array.isArray(profile?.ecoMapCheckins) ? profile.ecoMapCheckins as CheckinRecord[] : [];
  const uniqueVisited = new Set(checkins.map(c => c.stopId)).size;
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setGeoError("Geolocation not supported."); return; }
    setLocating(true); setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocating(false); },
      err => { setGeoError(`Location unavailable: ${err.message}`); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  useEffect(() => {
    (async () => {
      setLoadingStops(true);
      try {
        const p = new URLSearchParams();
        if (userLat !== null) p.set("lat", String(userLat));
        if (userLng !== null) p.set("lng", String(userLng));
        const res = await fetch(`/api/ecostops?${p}`, { credentials: "include" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        setStops((await res.json()).stops ?? []);
      } catch (e: any) { setStopsError(e.message ?? "Failed to load stops."); }
      finally { setLoadingStops(false); }
    })();
  }, [userLat, userLng]);

  const openCheckin = (stop: EcoStop) => {
    setSelectedStop(stop); setProofType("text"); setTextProof("");
    setPhotoFile(null); setPhotoPreview(null); setSubmitError(null);
  };

  const submitCheckin = async () => {
    if (!selectedStop || !user?.uid || !profile || submitting || isProcessing.current) return;
    if (proofType === "text" && textProof.trim().length < 8) { setSubmitError("Min 8 characters."); return; }
    if (proofType === "photo" && !photoFile) { setSubmitError("Please attach a photo."); return; }
    setSubmitting(true); setSubmitError(null); isProcessing.current = true;
    try {
      const body: Record<string, unknown> = { stopId: selectedStop.id };
      if (proofType === "text") {
        body.textProof = textProof.trim();
      } else if (photoFile) {
        body.photoProof = await new Promise<string>((res, rej) => {
          const r = new FileReader();
          r.onload = () => typeof r.result === "string" ? res(r.result) : rej(new Error("read failed"));
          r.onerror = () => rej(r.error);
          r.readAsDataURL(photoFile!);
        });
        body.mimeType = photoFile.type;
      }
      const resp = await fetch("/api/ecostops", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data?.error?.message ?? "Check-in failed.");
      const nextCheckins = [...checkins, { stopId: selectedStop.id, checkedInAt: new Date().toISOString() }];
      const nextXp = Number(profile.xp ?? 0) + (data.xpAwarded ?? selectedStop.xpReward);
      const updates = { ecoMapCheckins: nextCheckins, xp: nextXp, level: calculateLevel(nextXp), ecoPoints: Number(profile.ecoPoints ?? 0) + (data.ecoAwarded ?? selectedStop.ecoReward) };
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
      showToast(`✓ ${selectedStop.name}! +${data.xpAwarded ?? selectedStop.xpReward} XP, +${data.ecoAwarded ?? selectedStop.ecoReward} Eco`);
      setSelectedStop(null); setTextProof(""); setPhotoFile(null); setPhotoPreview(null);
    } catch (e: any) { setSubmitError(e.message ?? "Unexpected error."); }
    finally { setSubmitting(false); isProcessing.current = false; }
  };

  const withMeta = stops.map(s => {
    const lastCI = [...checkins].reverse().find(c => c.stopId === s.id);
    const onCD = lastCI ? isOnCooldown(lastCI, s.cooldownHours) : false;
    const d = userLat !== null && userLng !== null ? distM(userLat, userLng, s.lat, s.lng) : null;
    return { ...s, meta: TYPE_META[s.type] ?? TYPE_META.park, onCooldown: onCD, cooldownStr: lastCI ? cooldownLabel(lastCI, s.cooldownHours) : null, dist: d, inRange: d !== null && d <= CHECKIN_RADIUS_M, visited: !!lastCI };
  }).sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Explore your city" title="EcoMap" description="Walk to EcoStops — real-world eco locations near you. Check in, prove your visit, and earn XP.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Stops Visited" value={uniqueVisited} />
          <HeroMetric label="Total Check-ins" value={checkins.length} />
          <HeroMetric label="In Range" value={withMeta.filter(s => s.inRange).length} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Stops Visited"  value={uniqueVisited}                                     accent="#2f6b46" />
        <MetricCard label="Check-ins"       value={checkins.length}                                   accent="#237482" />
        <MetricCard label="In Range Now"    value={withMeta.filter(s => s.inRange).length}            accent="#9a6b1f" />
        <MetricCard label="Ready to Visit"  value={withMeta.filter(s => !s.onCooldown).length}       accent="#2f5f86" />
      </div>

      <Panel eyebrow="Live map" title="Your Location">
        <div className="relative overflow-hidden rounded-2xl" style={{ height: 360 }}>
          {userLat !== null ? (
            <iframe title="EcoMap" className="h-full w-full rounded-2xl border-0"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${userLng! - 0.012},${userLat - 0.008},${userLng! + 0.012},${userLat + 0.008}&layer=mapnik&marker=${userLat},${userLng}`}
              allowFullScreen loading="lazy" />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-4 rounded-2xl" style={{ background: "var(--bg-panel-alt)" }}>
              <span className="text-5xl">🗺️</span>
              <p className="text-sm font-semibold" style={{ color: "var(--text-muted)" }}>{locating ? "Finding your location…" : geoError ?? "Enable location to see the map"}</p>
              {!locating && <button onClick={locate} className={primaryButton}>{geoError ? "Retry" : "Enable Location"}</button>}
            </div>
          )}
          {userLat !== null && withMeta.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-wrap gap-1.5 p-3">
              {withMeta.slice(0, 5).map(s => (
                <span key={s.id} className="rounded-full px-2 py-1 text-[10px] font-extrabold shadow" style={{ background: s.meta.color, color: "#fff" }}>
                  {s.meta.icon} {s.name.length > 14 ? s.name.slice(0, 14) + "…" : s.name}{s.dist !== null ? ` · ${s.dist < 1000 ? `${Math.round(s.dist)}m` : `${(s.dist / 1000).toFixed(1)}km`}` : ""}
                </span>
              ))}
            </div>
          )}
        </div>
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {userLat !== null ? `${userLat.toFixed(5)}, ${userLng!.toFixed(5)}` : "Location not acquired"}
          </p>
          <button onClick={locate} disabled={locating} className={secondaryButton}>{locating ? "Locating…" : "Refresh"}</button>
        </div>
        {geoError && <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">{geoError} — Browse stops below and check in anyway.</div>}
      </Panel>

      <Panel eyebrow="All stops" title="EcoStop Directory" action={<Pill>{stops.length} stops</Pill>}>
        {loadingStops ? (
          <p className="py-8 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Loading EcoStops…</p>
        ) : stopsError ? (
          <p className="py-8 text-center text-sm font-semibold text-rose-600">{stopsError}</p>
        ) : stops.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="text-4xl">🌍</span>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No EcoStops near you yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>New stops are added regularly by the community.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y" style={{ borderColor: "var(--border-subtle)" }}>
            {withMeta.map(stop => (
              <div key={stop.id} className="flex items-start gap-4 py-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl" style={{ background: `${stop.meta.color}18` }}>
                  {stop.meta.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-serif text-sm font-bold" style={{ color: "var(--text-primary)" }}>{stop.name}</p>
                    <Pill>{stop.meta.label}</Pill>
                    {stop.inRange && <Pill active>In range</Pill>}
                    {stop.visited && !stop.onCooldown && <Pill active>Ready</Pill>}
                  </div>
                  <p className="mt-0.5 text-xs" style={{ color: "var(--text-muted)" }}>{stop.description}</p>
                  <div className="mt-1.5 flex flex-wrap gap-2 text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                    <span>+{stop.xpReward} XP</span><span>+{stop.ecoReward} Eco</span>
                    {stop.dist !== null && <span>{stop.dist < 1000 ? `${Math.round(stop.dist)}m away` : `${(stop.dist / 1000).toFixed(1)}km away`}</span>}
                    {stop.onCooldown && <span className="text-amber-600">Cooldown: {stop.cooldownStr}</span>}
                  </div>
                </div>
                <button type="button" onClick={() => openCheckin(stop)} disabled={stop.onCooldown}
                  className={stop.onCooldown ? secondaryButton : primaryButton}
                  style={stop.onCooldown ? { opacity: 0.5 } : undefined}>
                  {stop.onCooldown ? "Cooldown" : "Check In"}
                </button>
              </div>
            ))}
          </div>
        )}
      </Panel>

      {/* ── Check-in modal ── */}
      {selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-y-auto rounded-[24px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)]"
            style={{ maxHeight: "90vh", borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
            <button onClick={() => setSelectedStop(null)} aria-label="Close"
              className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition"
              style={{ background: "var(--bg-panel-alt)", color: "var(--text-primary)" }}>×</button>
            <div className="mb-4 flex items-center gap-3">
              <span className="text-3xl">{TYPE_META[selectedStop.type]?.icon}</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>EcoStop Check-in</p>
                <h3 className="font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>{selectedStop.name}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>+{selectedStop.xpReward} XP · +{selectedStop.ecoReward} EcoPoints · 24h cooldown</p>
              </div>
            </div>
            {userLat !== null && distM(userLat, userLng!, selectedStop.lat, selectedStop.lng) > CHECKIN_RADIUS_M && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
                ⚠️ You appear to be {Math.round(distM(userLat, userLng!, selectedStop.lat, selectedStop.lng))}m away (limit: {CHECKIN_RADIUS_M}m). Move closer or provide strong proof.
              </div>
            )}
            <div className="mb-4 flex rounded-xl p-1" style={{ background: "var(--bg-panel-alt)" }}>
              {(["text", "photo"] as ProofType[]).map(t => (
                <button key={t} type="button" onClick={() => { setProofType(t); setSubmitError(null); }}
                  className="min-h-11 flex-1 rounded-lg py-2 text-center text-xs font-extrabold uppercase tracking-wider transition"
                  style={proofType === t ? { background: "var(--bg-panel)", color: "var(--text-primary)" } : { color: "var(--text-muted)" }}>
                  {t === "text" ? "✏️ Text Proof" : "📷 Photo Proof"}
                </button>
              ))}
            </div>
            {proofType === "text" ? (
              <div className="mb-4">
                <label className="mb-1.5 block text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Describe your visit *</label>
                <textarea value={textProof} onChange={e => setTextProof(e.target.value)}
                  placeholder={`e.g. I visited ${selectedStop.name} and recycled…`} rows={4} className={`${inputClass} resize-none`} />
                <p className={`mt-1 text-right text-[10px] font-bold ${textProof.trim().length >= 8 ? "" : "text-rose-500"}`}
                  style={textProof.trim().length >= 8 ? { color: "var(--text-accent,#43653f)" } : undefined}>
                  {textProof.trim().length}/8 min
                </p>
              </div>
            ) : (
              <div className="mb-4 flex flex-col gap-3">
                <label className="block text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Photo proof *</label>
                <div className="flex gap-2">
                  <button type="button" onClick={() => document.getElementById("ecostop-cam")?.click()}
                    className="flex-1 rounded-xl border py-3 text-xs font-bold"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}>📸 Camera</button>
                  <button type="button" onClick={() => document.getElementById("ecostop-gal")?.click()}
                    className="flex-1 rounded-xl border py-3 text-xs font-bold"
                    style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}>🖼️ Gallery</button>
                  {photoFile && <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                    className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">Clear</button>}
                </div>
                <input id="ecostop-cam" type="file" accept="image/*" capture="environment" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (!f) return; setPhotoFile(f); const r = new FileReader(); r.onload = () => setPhotoPreview(r.result as string); r.readAsDataURL(f); }} />
                <input id="ecostop-gal" type="file" accept="image/*" className="sr-only"
                  onChange={e => { const f = e.target.files?.[0]; if (!f) return; setPhotoFile(f); const r = new FileReader(); r.onload = () => setPhotoPreview(r.result as string); r.readAsDataURL(f); }} />
                {photoPreview && <img src={photoPreview} alt="Preview" className="mx-auto max-h-40 rounded-xl object-cover" />}
              </div>
            )}
            {submitError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{submitError}</div>}
            <div className="flex gap-3">
              <button onClick={submitCheckin}
                disabled={submitting || (proofType === "text" && textProof.trim().length < 8) || (proofType === "photo" && !photoFile)}
                className={`flex-1 ${primaryButton}`}>
                {submitting
                  ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />Verifying…</span>
                  : "Submit Check-in"}
              </button>
              <button onClick={() => setSelectedStop(null)} className={secondaryButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl"
          style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
