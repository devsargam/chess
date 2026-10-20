"use client";
import { Button } from "@/components/ui/button";
import { DESIGNS, setDesign, useDesign } from "../hooks/useDesign";

interface ShellProps {
  children: React.ReactNode;
  username?: string | null;
  connected?: boolean;
  onLogout?: () => void;
  /** Game screen wants the full width; forms stay narrow */
  wide?: boolean;
}

export function Shell({ children, username, connected, onLogout, wide }: ShellProps) {
  return (
    <div className="flex min-h-dvh flex-col">
      {/* Ambient background glow */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/5 blur-[140px]" />
      </div>

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl text-amber select-none">♛</span>
          <span className="font-heading text-lg font-semibold tracking-tight">Chess</span>
          {connected !== undefined && (
            <span
              title={connected ? "Connected" : "Reconnecting…"}
              className={`ml-1 inline-block h-2 w-2 rounded-full ${
                connected ? "bg-emerald-500" : "animate-pulse-amber bg-amber"
              }`}
            />
          )}
        </div>
        <div className="flex items-center gap-2">
          <DesignSwitcher />
          {username && (
            <>
              <span className="hidden max-w-32 truncate font-mono text-xs text-muted-foreground sm:inline">
                {username}
              </span>
              <Button variant="ghost" size="xs" onClick={onLogout} className="text-muted-foreground">
                Logout
              </Button>
            </>
          )}
        </div>
      </header>

      <main
        className={`relative z-10 mx-auto flex w-full flex-1 flex-col px-4 pb-6 sm:px-6 ${
          wide ? "max-w-6xl" : "max-w-md justify-center"
        }`}
      >
        {children}
      </main>
    </div>
  );
}

const SWATCHES: Record<string, string> = {
  obsidian: "oklch(0.78 0.12 75)",
  paper: "oklch(0.45 0.1 150)",
  midnight: "oklch(0.72 0.17 295)",
};

/** Experiment: try each visual design live */
function DesignSwitcher() {
  const design = useDesign();
  return (
    <div
      role="radiogroup"
      aria-label="Design"
      className="flex items-center rounded-full border border-border bg-card/70 p-0.5 text-xs backdrop-blur-sm"
    >
      {DESIGNS.map((d) => (
        <button
          key={d}
          role="radio"
          aria-checked={design === d}
          aria-label={d}
          title={d}
          onClick={() => setDesign(d)}
          className={`rounded-full px-2.5 py-1 capitalize transition-colors ${
            design === d
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span
            className="inline-block h-3 w-3 rounded-full border border-white/20 align-middle sm:hidden"
            style={{ background: SWATCHES[d] }}
          />
          <span className="hidden sm:inline">{d}</span>
        </button>
      ))}
    </div>
  );
}
