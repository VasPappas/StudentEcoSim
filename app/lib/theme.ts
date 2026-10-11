import { useEffect, useState } from "react";

export type Theme = "light" | "dark";

const KEY = "studentecosim.theme";

function stored(): Theme | null {
  try {
    const value = window.localStorage.getItem(KEY);
    return value === "light" || value === "dark" ? value : null;
  } catch {
    return null;
  }
}

function system(): Theme {
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/** Follows the device setting until the person picks a side; the pick is remembered. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(() => stored() ?? system());
  const [chosen, setChosen] = useState<boolean>(() => stored() !== null);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    if (chosen) return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const follow = () => setTheme(media.matches ? "dark" : "light");
    media.addEventListener("change", follow);
    return () => media.removeEventListener("change", follow);
  }, [chosen]);

  const toggle = () => {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    setChosen(true);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Private windows may refuse storage; the choice still holds for this visit.
    }
  };
  return [theme, toggle];
}
