"use client";

import { createContext, useContext, useEffect, useSyncExternalStore, useCallback, type ReactNode } from "react";

export type Theme = "light" | "dark" | "liquid" | "dawn" | "bloom" | "aurora";

const STORAGE_KEY = "ecoludus.theme";
const DEFAULT_THEME: Theme = "light";

// How long the broad CSS transition class stays on <html> after a theme change.
const TRANSITION_MS = 520;

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

let transitionTimeout: number | undefined;

function enableThemeTransition() {
  if (typeof window === "undefined") return;
  // Respect reduced-motion preferences: don't force a long cross-fade.
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const html = document.documentElement;
  html.classList.add("theme-transitioning");
  if (transitionTimeout) window.clearTimeout(transitionTimeout);
  transitionTimeout = window.setTimeout(() => {
    html.classList.remove("theme-transitioning");
    transitionTimeout = undefined;
  }, TRANSITION_MS);
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
    enableThemeTransition();
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
    applyTheme(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // ignore
    }
    enableThemeTransition();
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
