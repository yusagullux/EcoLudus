// @ts-nocheck
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { useAuth } from "@/lib/useAuth";
import {
  HeroMetric, MetricCard, PageHero, Panel, Pill,
  primaryButton, secondaryButton
} from "@/components/game-ui";
import { calculateLevel } from "@/lib/level-system";

type StopType = "park" | "recycling" | "community_garden" | "repair_cafe" | "bike_station" | "nature_trail";

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

const TYPE_META: Record<StopType, { icon: string; symbol: string; color: string; tint: string; label: string }> = {
  park:             { icon: "\u{1F333}", symbol: "Tree", color: "#2f6b46", tint: "#e7f3ea", label: "Park" },
  recycling:        { icon: "\u267B\uFE0F", symbol: "Cycle", color: "#237482", tint: "#e3f2f4", label: "Recycling Point" },
  community_garden: { icon: "\u{1F331}", symbol: "Seed", color: "#4c7a3b", tint: "#edf5e7", label: "Community Garden" },
  repair_cafe:      { icon: "\u{1F527}", symbol: "Fix", color: "#9a6b1f", tint: "#f8efd8", label: "Repair Cafe" },
  bike_station:     { icon: "\u{1F6B2}", symbol: "Bike", color: "#2f5f86", tint: "#e4eef7", label: "Bike Station" },
  nature_trail:     { icon: "\u{1F97E}", symbol: "Trail", color: "#62508f", tint: "#ece8f6", label: "Nature Trail" }
};

const CHECKIN_RADIUS_M = 100;
const DEFAULT_CENTER: [number, number] = [59.437, 24.745];

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

function distanceLabel(dist: number | null): string | null {
  if (dist === null) return null;
  return dist < 1000 ? `${Math.round(dist)}m away` : `${(dist / 1000).toFixed(1)}km away`;
}

function latestCheckin(checkins: CheckinRecord[], stopId: string): CheckinRecord | undefined {
  return [...checkins].reverse().find(c => c.stopId === stopId);
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

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
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const [leafletReady, setLeafletReady] = useState(false);

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const userMarkerRef = useRef<any>(null);

  const checkins: CheckinRecord[] = Array.isArray(profile?.ecoMapCheckins) ? profile.ecoMapCheckins as CheckinRecord[] : [];
  const uniqueVisited = new Set(checkins.map(c => c.stopId)).size;
  const showToast = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3500); };

  const locate = useCallback(() => {
    if (!navigator.geolocation) { setGeoError("Geolocation is not supported by this browser."); return; }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLat(pos.coords.latitude); setUserLng(pos.coords.longitude); setLocating(false); },
      err => { setGeoError(`Location unavailable: ${err.message}`); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 }
    );
  }, []);

  useEffect(() => { locate(); }, [locate]);

  useEffect(() => {
    if (!leafletReady || !mapContainerRef.current || mapInstanceRef.current) return;
    const L = (window as any).L;
    if (!L) return;

    const map = L.map(mapContainerRef.current, { zoomControl: false, scrollWheelZoom: true })
      .setView(DEFAULT_CENTER, 13);

    L.control.zoom({ position: "bottomleft" }).addTo(map);
    L.control.scale({ imperial: false, position: "bottomleft" }).addTo(map);
    L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 20
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapInstanceRef.current = map;
  }, [leafletReady]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    stops.forEach(stop => {
      const meta = TYPE_META[stop.type] ?? TYPE_META.park;
      const lastCI = latestCheckin(checkins, stop.id);
      const onCD = lastCI ? isOnCooldown(lastCI, stop.cooldownHours) : false;
      const visited = !!lastCI;
      const dist = userLat !== null && userLng !== null ? distM(userLat, userLng, stop.lat, stop.lng) : null;
      const distStr = distanceLabel(dist);
      const tooFar = dist === null || dist > CHECKIN_RADIUS_M;
      const statusStr = onCD ? "On cooldown" : visited ? "Ready again" : "Photo check-in ready";
      const markerColor = onCD || tooFar ? "#737373" : meta.color;

      const icon = L.divIcon({
        className: "",
        html: `
          <div style="position:relative;width:46px;height:54px;">
            <div style="
              display:flex;align-items:center;justify-content:center;
              width:42px;height:42px;border-radius:50% 50% 50% 12px;
              transform:rotate(-45deg);transform-origin:center;
              background:${markerColor};border:3px solid #fff;
              box-shadow:0 10px 22px rgba(26,39,35,0.24),0 2px 6px rgba(0,0,0,0.24);
            ">
              <span style="
                transform:rotate(45deg);display:flex;align-items:center;justify-content:center;
                width:26px;height:26px;border-radius:999px;background:rgba(255,255,255,0.92);
                color:${markerColor};font-size:9px;font-weight:900;line-height:1;text-transform:uppercase;
              ">${meta.symbol}</span>
            </div>
            ${visited ? `<div style="position:absolute;right:-2px;top:-2px;width:17px;height:17px;border-radius:50%;background:#f5b942;border:2px solid #fff;color:#513600;font-size:10px;font-weight:900;text-align:center;line-height:13px;">&check;</div>` : ""}
          </div>`,
        iconSize: [46, 54],
        iconAnchor: [21, 50],
        popupAnchor: [0, -48]
      });

      const marker = L.marker([stop.lat, stop.lng], { icon });
      marker.bindPopup(`
        <div style="min-width:220px;font-family:Inter,system-ui,sans-serif;">
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
            <span style="display:inline-flex;align-items:center;justify-content:center;width:26px;height:26px;border-radius:9px;background:${meta.tint};color:${meta.color};font-size:14px;">${meta.icon}</span>
            <div>
              <div style="font-size:13px;font-weight:900;color:#15251d;">${escapeHtml(stop.name)}</div>
              <div style="font-size:10px;font-weight:800;color:${meta.color};text-transform:uppercase;letter-spacing:.08em;">${meta.label}</div>
            </div>
          </div>
          <div style="font-size:11px;line-height:1.4;color:#4f5f58;margin-bottom:8px;">${escapeHtml(stop.description)}</div>
          <div style="display:flex;flex-wrap:wrap;gap:5px;margin-bottom:8px;">
            <span style="border-radius:999px;background:#eef7ec;padding:4px 7px;font-size:10px;font-weight:900;color:#2f6b46;">+${stop.xpReward} XP</span>
            <span style="border-radius:999px;background:#e8f4f6;padding:4px 7px;font-size:10px;font-weight:900;color:#237482;">+${stop.ecoReward} Eco</span>
            ${distStr ? `<span style="border-radius:999px;background:#f4f0e8;padding:4px 7px;font-size:10px;font-weight:900;color:#6e5524;">${distStr}</span>` : ""}
          </div>
          <div style="font-size:11px;font-weight:800;color:${onCD || tooFar ? "#9a6b1f" : meta.color};margin-bottom:9px;">${dist !== null && dist > CHECKIN_RADIUS_M ? `Move ${Math.round(dist - CHECKIN_RADIUS_M)}m closer` : statusStr}</div>
          <button
            onclick="window.__ecoCheckin('${stop.id}')"
            style="display:block;width:100%;padding:8px;border:none;border-radius:10px;background:${onCD || tooFar ? "#c8c8c8" : meta.color};color:#fff;font-size:11px;font-weight:900;cursor:${onCD || tooFar ? "not-allowed" : "pointer"};"
            ${onCD || tooFar ? "disabled" : ""}
          >${onCD ? "On Cooldown" : dist === null ? "Enable Location" : dist > CHECKIN_RADIUS_M ? "Too Far" : "Check In"}</button>
        </div>
      `);
      markersLayerRef.current.addLayer(marker);
    });

    if (stops.length > 0 && userLat === null) {
      const group = L.featureGroup(markersLayerRef.current.getLayers());
      mapInstanceRef.current.fitBounds(group.getBounds().pad(0.18), { maxZoom: 13 });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, checkins, leafletReady, userLat, userLng]);

  useEffect(() => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || userLat === null || userLng === null) return;

    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userLat, userLng]);
    } else {
      const youIcon = L.divIcon({
        className: "",
        html: `<div style="position:relative;width:28px;height:28px;">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(37,99,235,0.18);animation:pulse 1.8s ease-out infinite;"></div>
          <div style="position:absolute;left:6px;top:6px;width:16px;height:16px;border-radius:50%;background:#2563eb;border:3px solid #fff;box-shadow:0 4px 12px rgba(37,99,235,0.35);"></div>
        </div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      userMarkerRef.current = L.marker([userLat, userLng], { icon: youIcon, zIndexOffset: 1000 })
        .addTo(mapInstanceRef.current)
        .bindTooltip("You are here", { permanent: false });
    }
    mapInstanceRef.current.setView([userLat, userLng], 14);
  }, [userLat, userLng, leafletReady]);

  useEffect(() => {
    (window as any).__ecoCheckin = (stopId: string) => {
      const stop = stops.find(s => s.id === stopId);
      if (stop) openCheckin(stop);
    };
    return () => { delete (window as any).__ecoCheckin; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stops, userLat, userLng]);

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
      } catch (e: any) {
        setStopsError(e.message ?? "Failed to load stops.");
      } finally {
        setLoadingStops(false);
      }
    })();
  }, [userLat, userLng]);

  const focusStop = (stop: EcoStop) => {
    if (!mapInstanceRef.current) return;
    mapInstanceRef.current.setView([stop.lat, stop.lng], 16, { animate: true });
  };

  const focusAllStops = () => {
    const L = (window as any).L;
    if (!L || !mapInstanceRef.current || !markersLayerRef.current) return;
    const layers = markersLayerRef.current.getLayers();
    if (!layers.length) return;
    mapInstanceRef.current.fitBounds(L.featureGroup(layers).getBounds().pad(0.18), { maxZoom: 14 });
  };

  const openCheckin = (stop: EcoStop) => {
    const d = userLat !== null && userLng !== null ? distM(userLat, userLng, stop.lat, stop.lng) : null;
    if (d === null) {
      setSubmitError("Enable location before checking in.");
      locate();
      return;
    }
    if (d > CHECKIN_RADIUS_M) {
      setSubmitError(`Move within ${CHECKIN_RADIUS_M}m of this EcoStop before checking in.`);
      focusStop(stop);
      return;
    }
    setSelectedStop(stop);
    setPhotoFile(null);
    setPhotoPreview(null);
    setSubmitError(null);
  };

  const submitCheckin = async () => {
    if (!selectedStop || !user?.uid || !profile || submitting || isProcessing.current) return;
    if (userLat === null || userLng === null) { setSubmitError("Enable location before checking in."); return; }
    const currentDistance = distM(userLat, userLng, selectedStop.lat, selectedStop.lng);
    if (currentDistance > CHECKIN_RADIUS_M) { setSubmitError(`Move within ${CHECKIN_RADIUS_M}m of this EcoStop before checking in.`); return; }
    if (!photoFile) { setSubmitError("Please attach a photo for AI verification."); return; }

    setSubmitting(true);
    setSubmitError(null);
    isProcessing.current = true;
    try {
      const photoProof = await new Promise<string>((res, rej) => {
        const r = new FileReader();
        r.onload = () => typeof r.result === "string" ? res(r.result) : rej(new Error("read failed"));
        r.onerror = () => rej(r.error);
        r.readAsDataURL(photoFile);
      });
      const body: Record<string, unknown> = {
        stopId: selectedStop.id,
        lat: userLat,
        lng: userLng,
        photoProof,
        mimeType: photoFile.type
      };

      const resp = await fetch("/api/ecostops", { method: "POST", headers: { "Content-Type": "application/json" }, credentials: "include", body: JSON.stringify(body) });
      const data = await resp.json();
      if (!resp.ok || !data.success) throw new Error(data?.error?.message ?? "Check-in failed.");

      const nextCheckins = [...checkins, { stopId: selectedStop.id, checkedInAt: new Date().toISOString() }];
      const nextXp = Number(profile.xp ?? 0) + (data.xpAwarded ?? selectedStop.xpReward);
      const updates = {
        ecoMapCheckins: nextCheckins,
        xp: nextXp,
        level: calculateLevel(nextXp),
        ecoPoints: Number(profile.ecoPoints ?? 0) + (data.ecoAwarded ?? selectedStop.ecoReward)
      };
      if (typeof setProfile === "function") setProfile({ ...profile, ...updates });
      showToast(`Checked in at ${selectedStop.name}! +${data.xpAwarded ?? selectedStop.xpReward} XP, +${data.ecoAwarded ?? selectedStop.ecoReward} Eco`);
      setSelectedStop(null);
      setPhotoFile(null);
      setPhotoPreview(null);
    } catch (e: any) {
      setSubmitError(e.message ?? "Unexpected error.");
    } finally {
      setSubmitting(false);
      isProcessing.current = false;
    }
  };

  const withMeta = stops.map(s => {
    const lastCI = latestCheckin(checkins, s.id);
    const onCD = lastCI ? isOnCooldown(lastCI, s.cooldownHours) : false;
    const d = userLat !== null && userLng !== null ? distM(userLat, userLng, s.lat, s.lng) : null;
    return {
      ...s,
      meta: TYPE_META[s.type] ?? TYPE_META.park,
      onCooldown: onCD,
      cooldownStr: lastCI ? cooldownLabel(lastCI, s.cooldownHours) : null,
      dist: d,
      distLabel: distanceLabel(d),
      inRange: d !== null && d <= CHECKIN_RADIUS_M,
      visited: !!lastCI
    };
  }).sort((a, b) => (a.dist ?? Infinity) - (b.dist ?? Infinity));

  return (
    <div className="flex flex-col gap-5">
      <PageHero eyebrow="Explore your city" title="EcoMap" description="Walk to EcoStops, check in within 100m, and use photo proof to earn XP.">
        <div className="flex flex-wrap gap-3">
          <HeroMetric label="Stops Visited" value={uniqueVisited} />
          <HeroMetric label="Total Check-ins" value={checkins.length} />
          <HeroMetric label="In Range" value={withMeta.filter(s => s.inRange).length} />
        </div>
      </PageHero>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Stops Visited" value={uniqueVisited} accent="#2f6b46" />
        <MetricCard label="Check-ins" value={checkins.length} accent="#237482" />
        <MetricCard label="In Range Now" value={withMeta.filter(s => s.inRange).length} accent="#9a6b1f" />
        <MetricCard label="Ready Nearby" value={withMeta.filter(s => s.inRange && !s.onCooldown).length} accent="#2f5f86" />
      </div>

      <Panel
        eyebrow="Live map"
        title="EcoStops Near You"
        action={<button type="button" onClick={focusAllStops} className={secondaryButton}>Fit Stops</button>}
      >
        <Script
          src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
          strategy="afterInteractive"
          onLoad={() => setLeafletReady(true)}
        />
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />

        <style jsx global>{`
          @keyframes pulse {
            0% { transform: scale(.7); opacity: .9; }
            100% { transform: scale(1.45); opacity: 0; }
          }
          .leaflet-popup-content-wrapper {
            border-radius: 16px;
            box-shadow: 0 18px 46px rgba(25, 39, 32, .22);
          }
          .leaflet-popup-content {
            margin: 14px;
          }
        `}</style>

        <div className="relative overflow-hidden rounded-2xl border" style={{ height: 460, borderColor: "var(--border-subtle)" }}>
          <div ref={mapContainerRef} style={{ height: "100%", width: "100%", borderRadius: "16px", zIndex: 0 }} />

          {userLat === null && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-4 rounded-2xl bg-black/45 px-5 text-center backdrop-blur-[2px]">
              <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/95 text-3xl">{TYPE_META.park.icon}</span>
              <p className="text-sm font-semibold text-white">
                {locating ? "Finding your location..." : geoError ?? "Enable location to see nearby EcoStops"}
              </p>
              {!locating && (
                <button onClick={locate} className={primaryButton}>
                  {geoError ? "Retry" : "Enable Location"}
                </button>
              )}
            </div>
          )}

          <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-2">
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-sm" style={{ color: "var(--text-primary)" }}>
              CARTO Voyager
            </span>
            <span className="rounded-full bg-white/95 px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-[0.12em] shadow-sm" style={{ color: "var(--text-muted)" }}>
              100m check-in radius
            </span>
          </div>

          <div className="pointer-events-none absolute bottom-3 right-3 z-10 grid max-w-[230px] grid-cols-2 gap-1.5 rounded-2xl bg-white/95 p-2 text-[10px] font-bold shadow-lg">
            {Object.entries(TYPE_META).map(([type, meta]) => (
              <div key={type} className="flex items-center gap-1.5 rounded-xl px-1.5 py-1" style={{ background: meta.tint }}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-lg text-[11px]" style={{ background: meta.color, color: "#fff" }}>{meta.icon}</span>
                <span className="truncate" style={{ color: meta.color }}>{meta.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
            {userLat !== null ? `Location: ${userLat.toFixed(5)}, ${userLng!.toFixed(5)}` : "Location not acquired"}
          </p>
          <button onClick={locate} disabled={locating} className={secondaryButton}>
            {locating ? "Locating..." : "Refresh Location"}
          </button>
        </div>
        {geoError && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
            {geoError}. Enable location to check in within 100m.
          </div>
        )}
        {submitError && !selectedStop && (
          <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs font-semibold text-amber-700">
            {submitError}
          </div>
        )}
      </Panel>

      <Panel eyebrow="All stops" title="EcoStop Directory" action={<Pill>{stops.length} stops</Pill>}>
        {loadingStops ? (
          <p className="py-8 text-center text-sm font-semibold" style={{ color: "var(--text-muted)" }}>Loading EcoStops...</p>
        ) : stopsError ? (
          <p className="py-8 text-center text-sm font-semibold text-rose-600">{stopsError}</p>
        ) : stops.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl text-3xl" style={{ background: TYPE_META.park.tint }}>{TYPE_META.park.icon}</span>
            <p className="text-sm font-bold" style={{ color: "var(--text-primary)" }}>No EcoStops near you yet</p>
            <p className="text-xs" style={{ color: "var(--text-muted)" }}>New stops are added regularly by the community.</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {withMeta.map(stop => {
              const needsLocation = stop.dist === null;
              const tooFar = stop.dist !== null && stop.dist > CHECKIN_RADIUS_M;
              const disabled = stop.onCooldown || tooFar;
              return (
                <div key={stop.id} className="flex items-start gap-3 rounded-2xl border p-3" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-panel-alt)" }}>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xl" style={{ background: stop.meta.tint, color: stop.meta.color }}>
                    {stop.meta.icon}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-serif text-sm font-bold" style={{ color: "var(--text-primary)" }}>{stop.name}</p>
                      <Pill>{stop.meta.label}</Pill>
                      {stop.inRange && <Pill active>In range</Pill>}
                      {stop.visited && !stop.onCooldown && <Pill active>Ready</Pill>}
                      {stop.onCooldown && <Pill>Cooldown</Pill>}
                      {tooFar && <Pill>Too far</Pill>}
                    </div>
                    <p className="mt-1 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{stop.description}</p>
                    <div className="mt-2 flex flex-wrap gap-2 text-[10px] font-bold" style={{ color: "var(--text-muted)" }}>
                      <span>+{stop.xpReward} XP</span>
                      <span>+{stop.ecoReward} Eco</span>
                      {stop.distLabel && <span>{stop.distLabel}</span>}
                      {tooFar && <span className="text-amber-600">Move {Math.round(stop.dist! - CHECKIN_RADIUS_M)}m closer</span>}
                      {needsLocation && <span className="text-amber-600">Location needed</span>}
                      {stop.onCooldown && <span className="text-amber-600">Ready in {stop.cooldownStr}</span>}
                    </div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button type="button" onClick={() => focusStop(stop)} className={secondaryButton}>Show on Map</button>
                      <button
                        type="button"
                        onClick={() => needsLocation ? locate() : openCheckin(stop)}
                        disabled={disabled}
                        className={disabled ? secondaryButton : primaryButton}
                        style={disabled ? { opacity: 0.5 } : undefined}
                      >
                        {stop.onCooldown ? "Cooldown" : needsLocation ? "Enable Location" : tooFar ? "Too Far" : "Check In"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      {selectedStop && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6 backdrop-blur-sm">
          <div className="relative w-full max-w-lg overflow-y-auto rounded-[24px] border p-6 shadow-[0_24px_70px_rgba(0,0,0,0.25)]" style={{ maxHeight: "90vh", borderColor: "var(--border-default)", background: "var(--bg-panel)" }}>
            <button onClick={() => setSelectedStop(null)} aria-label="Close" className="absolute right-5 top-5 flex h-8 w-8 items-center justify-center rounded-full text-lg font-bold transition" style={{ background: "var(--bg-panel-alt)", color: "var(--text-primary)" }}>x</button>
            <div className="mb-4 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-2xl" style={{ background: TYPE_META[selectedStop.type]?.tint }}>{TYPE_META[selectedStop.type]?.icon}</span>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.18em]" style={{ color: "var(--text-muted)" }}>Photo Check-in</p>
                <h3 className="font-serif text-xl font-bold" style={{ color: "var(--text-primary)" }}>{selectedStop.name}</h3>
                <p className="text-xs" style={{ color: "var(--text-muted)" }}>Within 100m | +{selectedStop.xpReward} XP | +{selectedStop.ecoReward} EcoPoints</p>
              </div>
            </div>
            <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-semibold text-emerald-700">
              Take or upload a photo from this EcoStop. The photo is checked automatically before rewards are awarded.
            </div>
            <div className="mb-4 flex flex-col gap-3">
              <label className="block text-[11px] font-extrabold uppercase tracking-[0.14em]" style={{ color: "var(--text-muted)" }}>Photo proof *</label>
              <div className="flex gap-2">
                <button type="button" onClick={() => document.getElementById("ecostop-cam")?.click()} className="flex-1 rounded-xl border py-3 text-xs font-bold" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}>Camera</button>
                <button type="button" onClick={() => document.getElementById("ecostop-gal")?.click()} className="flex-1 rounded-xl border py-3 text-xs font-bold" style={{ borderColor: "var(--border-default)", color: "var(--text-primary)", background: "var(--bg-panel-alt)" }}>Gallery</button>
                {photoFile && <button type="button" onClick={() => { setPhotoFile(null); setPhotoPreview(null); }} className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-bold text-rose-700">Clear</button>}
              </div>
              <input id="ecostop-cam" type="file" accept="image/*" capture="environment" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setPhotoFile(f); const r = new FileReader(); r.onload = () => setPhotoPreview(r.result as string); r.readAsDataURL(f); }} />
              <input id="ecostop-gal" type="file" accept="image/*" className="sr-only" onChange={e => { const f = e.target.files?.[0]; if (!f) return; setPhotoFile(f); const r = new FileReader(); r.onload = () => setPhotoPreview(r.result as string); r.readAsDataURL(f); }} />
              {photoPreview && <img src={photoPreview} alt="Preview" className="mx-auto max-h-44 rounded-xl object-cover" />}
            </div>
            {submitError && <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">{submitError}</div>}
            <div className="flex gap-3">
              <button onClick={submitCheckin} disabled={submitting || !photoFile} className={`flex-1 ${primaryButton}`}>
                {submitting
                  ? <span className="flex items-center justify-center gap-2"><span className="h-4 w-4 animate-spin rounded-full border-2 border-cream-100/40 border-t-cream-100" />Checking photo...</span>
                  : "Submit Photo Check-in"}
              </button>
              <button onClick={() => setSelectedStop(null)} className={secondaryButton}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-extrabold shadow-xl" style={{ background: "var(--bg-sidebar)", color: "var(--text-sidebar)" }}>
          {toast}
        </div>
      )}
    </div>
  );
}
