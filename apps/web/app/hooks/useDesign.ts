"use client";
import { useSyncExternalStore } from "react";

export const DESIGNS = ["obsidian", "paper", "midnight"] as const;
export type Design = (typeof DESIGNS)[number];

const listeners = new Set<() => void>();

function current(): Design {
  const d = document.documentElement.dataset.design as Design | undefined;
  return d && DESIGNS.includes(d) ? d : "obsidian";
}

export function setDesign(design: Design) {
  const root = document.documentElement;
  root.dataset.design = design;
  root.classList.toggle("dark", design !== "paper");
  try {
    localStorage.setItem("chess_design", design);
  } catch {
    // storage blocked: the choice just won't persist
  }
  listeners.forEach((l) => l());
}

/** The active design experiment (set on <html data-design>) */
export function useDesign(): Design {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    current,
    () => "obsidian",
  );
}
