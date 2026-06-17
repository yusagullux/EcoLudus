"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import React from "react";

export type Theme = "light" | "dark" | "liquid";

const STORAGE_KEY = "ecoludus.theme";
const DEFAULT_THEME: Theme = "light";

type ThemeContextValue = {
  theme: Theme;
  setTheme: (t: Theme) => void;
};

const ThemeContext = createContext<ThemeContextValue>({
  theme: DEFAULT_THEME,
  setTheme: () => {}
});

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(DEFAULT_THEME);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stored && ["light", "dark", "liquid"].includes(stored)) {
        setThemeState(stored);
        document.documentElement.setAttribute("data-theme", stored);
      }
    } catch {}
  }, []);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {}
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  // Apply data-theme whenever it changes
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  return React.createElement(
    ThemeContext.Provider,
    { value: { theme, setTheme } },
    children
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
