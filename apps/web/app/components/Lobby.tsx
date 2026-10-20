"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TimeControl } from "./Game";
import { Shell } from "./Shell";
import { DIFFICULTIES, type Difficulty } from "@repo/shared/sudoku";

// [minutes, increment seconds]
const PRESETS: { name: string; controls: [number, number][] }[] = [
  { name: "Blitz", controls: [[3, 0], [3, 2], [5, 3]] },
  { name: "Rapid", controls: [[10, 0], [10, 5], [15, 10]] },
  { name: "Classical", controls: [[30, 0], [30, 20], [60, 30]] },
];

interface LobbyProps {
  username: string;
  connected: boolean;
  onCreateRoom: (timeControl: TimeControl | null) => void;
  onCreateSudoku: (difficulty: Difficulty) => void;
  onJoinRoom: (gameId: string) => void;
  onLogout: () => void;
  error: string | null;
}

export function Lobby({
  username,
  connected,
  onCreateRoom,
  onCreateSudoku,
  onJoinRoom,
  onLogout,
  error,
}: LobbyProps) {
  const [joinId, setJoinId] = useState("");
  const [mode, setMode] = useState<"chess" | "sudoku">("chess");
  const [difficulty, setDifficulty] = useState<Difficulty>("easy");
  const [picked, setPicked] = useState<string>("10+0");
  const [customMinutes, setCustomMinutes] = useState("20");
  const [customIncrement, setCustomIncrement] = useState("5");

  const untimed = picked === "unlimited";
  const [minutes, increment] =
    picked === "custom" || untimed
      ? [Number(customMinutes), Number(customIncrement)]
      : picked.split("+").map(Number);
  const validTime =
    untimed ||
    (Number.isInteger(minutes) &&
      Number.isInteger(increment) &&
      minutes! >= 1 &&
      minutes! <= 180 &&
      increment! >= 0 &&
      increment! <= 60);

  const summary = untimed ? "No clock" : validTime ? `${minutes}+${increment}` : "";

  // Accept either a raw code or a full invite link
  const joinCode = (() => {
    const v = joinId.trim();
    try {
      return new URL(v).searchParams.get("join") ?? v;
    } catch {
      return v;
    }
  })();

  return (
    <Shell username={username} connected={connected} onLogout={onLogout}>
      <div role="tablist" className="mb-5 grid grid-cols-2 rounded-lg border border-border bg-card/60 p-1">
        {(["chess", "sudoku"] as const).map((m) => (
          <button
            key={m}
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={`rounded-md py-2 text-sm font-medium capitalize transition-colors ${
              mode === m ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {m === "chess" ? "♟ Chess" : "▦ Sudoku"}
          </button>
        ))}
      </div>

      {mode === "sudoku" ? (
        <div className="space-y-4">
          <div>
            <h1 className="font-heading mb-1 text-2xl font-semibold tracking-tight">Sudoku race</h1>
            <p className="text-sm text-muted-foreground">
              Same board, two players. Correct numbers claim the square; most squares wins. 3 mistakes and you&apos;re out.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {DIFFICULTIES.map((d) => (
              <Tile key={d} active={difficulty === d} onClick={() => setDifficulty(d)}>
                <span className="font-semibold capitalize">{d}</span>
              </Tile>
            ))}
          </div>
          <Button
            onClick={() => onCreateSudoku(difficulty)}
            disabled={!connected}
            className="glow-amber h-13 w-full text-base font-semibold capitalize"
            size="lg"
          >
            {connected ? `Create sudoku · ${difficulty}` : "Connecting…"}
          </Button>
        </div>
      ) : (
      <>
      <h1 className="font-heading mb-1 text-2xl font-semibold tracking-tight">New game</h1>
      <p className="mb-5 text-sm text-muted-foreground">Pick a time control, then invite a friend.</p>

      <div className="space-y-4">
        {PRESETS.map((group) => (
          <section key={group.name}>
            <h2 className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
              {group.name}
            </h2>
            <div className="grid grid-cols-3 gap-2">
              {group.controls.map(([m, inc]) => {
                const key = `${m}+${inc}`;
                return (
                  <Tile key={key} active={picked === key} onClick={() => setPicked(key)}>
                    <span className="font-mono text-lg font-semibold">{key}</span>
                  </Tile>
                );
              })}
            </div>
          </section>
        ))}

        <section>
          <h2 className="mb-1.5 text-xs font-medium tracking-wider text-muted-foreground uppercase">
            Other
          </h2>
          <div className="grid grid-cols-2 gap-2">
            <Tile active={untimed} onClick={() => setPicked("unlimited")}>
              <span className="text-lg font-semibold">∞</span>
              <span className="text-xs text-muted-foreground">No clock</span>
            </Tile>
            <Tile active={picked === "custom"} onClick={() => setPicked("custom")}>
              <span className="text-lg font-semibold">⚙</span>
              <span className="text-xs text-muted-foreground">Custom</span>
            </Tile>
          </div>

          {picked === "custom" && (
            <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-card/60 p-3 animate-in fade-in slide-in-from-top-1">
              <Input
                type="number"
                inputMode="numeric"
                min={1}
                max={180}
                aria-label="Minutes per side"
                value={customMinutes}
                onChange={(e) => setCustomMinutes(e.target.value)}
                className="h-10 w-20 bg-background/50 text-center font-mono text-base"
              />
              <span className="text-sm text-muted-foreground">min +</span>
              <Input
                type="number"
                inputMode="numeric"
                min={0}
                max={60}
                aria-label="Increment in seconds"
                value={customIncrement}
                onChange={(e) => setCustomIncrement(e.target.value)}
                className="h-10 w-20 bg-background/50 text-center font-mono text-base"
              />
              <span className="text-sm text-muted-foreground">sec</span>
            </div>
          )}
          {picked === "custom" && !validTime && (
            <p className="mt-1.5 text-xs text-destructive">1–180 minutes, 0–60 second increment.</p>
          )}
        </section>

        <Button
          onClick={() =>
            onCreateRoom(
              untimed ? null : { initial: minutes! * 60_000, increment: increment! * 1000 },
            )
          }
          disabled={!connected || !validTime}
          className="glow-amber h-13 w-full text-base font-semibold"
          size="lg"
        >
          {connected ? `Create game${summary ? ` · ${summary}` : ""}` : "Connecting…"}
        </Button>
      </div>
      </>
      )}

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs tracking-widest text-muted-foreground uppercase">or join</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (joinCode) onJoinRoom(joinCode);
        }}
      >
        <Input
          type="text"
          placeholder="Paste code or invite link"
          autoCapitalize="none"
          autoCorrect="off"
          value={joinId}
          onChange={(e) => setJoinId(e.target.value)}
          className="h-12 flex-1 bg-card/60 font-mono text-base sm:text-sm"
        />
        <Button
          type="submit"
          disabled={!connected || !joinCode}
          variant="secondary"
          className="h-12 px-6"
          size="lg"
        >
          Join
        </Button>
      </form>
      {error && (
        <p role="alert" className="mt-2 text-sm text-destructive">
          {error}
        </p>
      )}
    </Shell>
  );
}

function Tile({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`flex h-16 flex-col items-center justify-center rounded-lg border transition-all active:scale-[0.97] ${
        active
          ? "border-primary bg-primary/10 text-foreground ring-1 ring-primary"
          : "border-border bg-card/60 text-foreground/80 hover:border-primary/50 hover:bg-card"
      }`}
    >
      {children}
    </button>
  );
}
