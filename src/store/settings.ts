import { create } from "zustand";
import { persist } from "zustand/middleware";

export type Lang = "zh" | "en";
export type ThemeMode = "light" | "dark" | "auto";

interface SettingsState {
  lang: Lang;
  themeMode: ThemeMode;
  setLang: (l: Lang) => void;
  setThemeMode: (m: ThemeMode) => void;
}

function getSystemPrefersDark(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export const useSettings = create<SettingsState>()(
  persist(
    (set) => ({
      lang: "zh",
      themeMode: "light",
      setLang: (lang) => set({ lang }),
      setThemeMode: (themeMode) => set({ themeMode }),
    }),
    { name: "s1ui-settings" },
  ),
);

/** Returns the effective theme (resolves "auto" to light/dark). */
export function useEffectiveTheme(): "light" | "dark" {
  const mode = useSettings((s) => s.themeMode);
  if (mode === "auto") return getSystemPrefersDark() ? "dark" : "light";
  return mode;
}
