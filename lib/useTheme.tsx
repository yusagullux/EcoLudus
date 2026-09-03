"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, useCallback, type ReactNode } from "react";

export type Theme = "light" | "dark" | "liquid" | "dawn" | "bloom" | "aurora";

const STORAGE_KEY = "ecoludus.theme";
const DEFAULT_THEME: Theme = "light";

// How long the broad CSS transition class stays on <html> after a theme change.
// Must match --theme-fade-duration in app/globals.css.
const TRANSITION_MS = 450;

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {}
});

function applyTheme(t: Theme) {
  document.documentElement.setAttribute("data-theme", t);
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

let swapTimeout: number | undefined;

/**
 * Cross-fade to a new theme. Prefers the View Transitions API, which fades the
 * whole page as a single composited snapshot pair — this is the only way the
 * gradient `background-image` surfaces fade too (they can't be interpolated by
 * per-element CSS transitions). Falls back to the `theme-transitioning` class
 * (per-property color fades) where the API is unavailable, and to an instant
 * swap for reduced-motion users.
 */
function applyThemeAnimated(t: Theme) {
  const html = document.documentElement;
  if (prefersReducedMotion()) {
    applyTheme(t);
    return;
  }

  if (typeof document.startViewTransition === "function") {
    // Freeze per-element transitions during the swap so the new snapshot
    // captures final colors instead of mid-fade ones (no double animation).
    html.classList.add("theme-swapping");
    document.startViewTransition(() => {
      applyTheme(t);
    }).finished.finally(() => {
      html.classList.remove("theme-swapping");
    });
    return;
  }

  // Legacy fallback: flip the attribute, then briefly enable the broad
  // per-property CSS transition class.
  applyTheme(t);
  html.classList.add("theme-transitioning");
  if (swapTimeout) window.clearTimeout(swapTimeout);
  swapTimeout = window.setTimeout(() => {
    html.classList.remove("theme-transitioning");
    swapTimeout = undefined;
  }, TRANSITION_MS);
}

function getStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
    if (stored && ["light", "dark", "liquid", "dawn", "bloom", "aurora"].includes(stored)) {
      return stored;
    }
  } catch {
    // ignore — private browsing or restricted context
  }
  return DEFAULT_THEME;
}

const listeners = new Set<() => void>();
function emitThemeChange() {
  listeners.forEach((l) => l());
}

function subscribeTheme(callback: () => void) {
  listeners.add(callback);

  // Keep in sync when the same theme is changed from another tab.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    // Smoothly transition in this tab too, then notify React to update state.
    const stored = getStoredTheme();
    if (stored !== document.documentElement.getAttribute("data-theme")) {
      applyThemeAnimated(stored);
    }
    emitThemeChange();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    listeners.delete(callback);
    window.removeEventListener("storage", onStorage);
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Sync the persisted theme without calling setState inside an effect. This
  // avoids the cascading-render lint warning and keeps the initial render
  // consistent with the server snapshot (DEFAULT_THEME), then hydrates to the
  // stored value on the client without a mismatch.
  const theme = useSyncExternalStore(
    subscribeTheme,
    getStoredTheme,
    () => DEFAULT_THEME
  );

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    applyThemeAnimated(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
    emitThemeChange();
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
