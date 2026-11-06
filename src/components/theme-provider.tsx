import { ScriptOnce } from "@tanstack/react-router";
import { useEffect, useSyncExternalStore } from "react";
import type { ReactNode } from "react";
import { z } from "zod";

const storageKey = "theme";

export const ThemeSchema = z.enum(["light", "dark", "system"]);

export type Theme = z.infer<typeof ThemeSchema>;

const themeScript = `(function(){var t=localStorage.getItem("${storageKey}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"})();`;

const listeners = new Set<() => void>();

function getTheme(): Theme {
  return ThemeSchema.catch("system").parse(localStorage.getItem(storageKey));
}

function applyTheme() {
  const theme = getTheme();

  const dark =
    theme === "dark" ||
    (theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches);

  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.style.colorScheme = dark ? "dark" : "light";
}

function setTheme(theme: Theme) {
  localStorage.setItem(storageKey, theme);
  applyTheme();

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  return () => listeners.delete(listener);
}

export function useTheme() {
  const theme = useSyncExternalStore<Theme>(
    subscribe,
    getTheme,
    () => "system"
  );

  return { theme, setTheme };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", applyTheme);

    return () => media.removeEventListener("change", applyTheme);
  }, []);

  return (
    <>
      <ScriptOnce>{themeScript}</ScriptOnce>
      {children}
    </>
  );
}
