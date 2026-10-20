"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Shell } from "./Shell";

export interface SudokuState {
  gameId: string;
  status: "waiting" | "active" | "completed";
  difficulty: string;
  puzzle: string;
  /** puzzle plus claimed cells */
  board: string;
  owners: (string | null)[];
  players: string[];
  mistakes: Record<string, number>;
  maxMistakes: number;
  winner: string | null;
  endReason: "solved" | "mistakes" | null;
  elapsedMs: number;
  /** Local Date.now() when this state arrived, for the timer */
  receivedAt: number;
}

interface SudokuProps {
  game: SudokuState;
  username: string;
  connected: boolean;
  /** Last wrong guess from the server, flashed red on the board */
  wrong: { index: number; value: number; at: number } | null;
  onPlace: (index: number, value: number) => void;
  onBackToLobby: () => void;
  onLogout: () => void;
}

const initial = (name: string) => name.charAt(0).toUpperCase();
const sameUnit = (a: number, b: number) =>
  Math.floor(a / 9) === Math.floor(b / 9) ||
  a % 9 === b % 9 ||
  (Math.floor(a / 27) === Math.floor(b / 27) && Math.floor((a % 9) / 3) === Math.floor((b % 9) / 3));

export function Sudoku({ game, username, connected, wrong, onPlace, onBackToLobby, onLogout }: SudokuProps) {
  const [selected, setSelected] = useState<number | null>(null);
  const opponent = game.players.find((p) => p !== username) ?? null;
  const over = game.status === "completed";

  const givens = [...game.puzzle].map(Number);
  const digits = [...game.board].map(Number);
  const digitAt = (i: number) => digits[i] ?? 0;

  const place = (value: number) => {
    if (selected === null || over || digitAt(selected) !== 0) return;
    onPlace(selected, value);
  };

  // Re-render once a wrong-guess flash has expired
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!wrong) return;
    const t = setTimeout(() => setTick((n) => n + 1), 1200);
    return () => clearTimeout(t);
  }, [wrong]);

  // Keyboard: digits to place, arrows to move
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[1-9]$/.test(e.key)) return place(Number(e.key));
      const moves: Record<string, number> = { ArrowUp: -9, ArrowDown: 9, ArrowLeft: -1, ArrowRight: 1 };
      if (e.key in moves) {
        e.preventDefault();
        setSelected((s) => Math.min(80, Math.max(0, (s ?? 40) + moves[e.key]!)));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const selectedDigit = selected !== null ? digitAt(selected) : 0;
  const score = (p: string | null) => (p ? game.owners.filter((o) => o === p).length : 0);
  const remaining = (d: number) => 9 - digits.filter((v) => v === d).length;

  const ending = over
    ? {
        title: game.winner === null ? "Draw" : game.winner === username ? "You won" : "You lost",
        detail:
          game.endReason === "mistakes"
            ? `${game.winner === username ? opponent : "You"} made ${game.maxMistakes} mistakes`
            : `${score(username)} – ${score(opponent)} cells`,
      }
    : null;

  return (
    <Shell wide username={username} connected={connected} onLogout={onLogout}>
      <div className="mx-auto flex w-full flex-1 flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:pt-2">
        <div className="w-full max-w-[560px] space-y-3 lg:w-[min(calc(100dvh-10rem),620px)] lg:max-w-none">
          {/* Scoreboard */}
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
            <PlayerScore name={username} you score={score(username)} mistakes={game.mistakes[username] ?? 0} max={game.maxMistakes} />
            <div className="text-center">
              <Timer game={game} />
              <div className="text-xs text-muted-foreground capitalize">{game.difficulty}</div>
            </div>
            <PlayerScore
              name={opponent ?? "Opponent"}
              score={score(opponent)}
              mistakes={opponent ? (game.mistakes[opponent] ?? 0) : 0}
              max={game.maxMistakes}
              alignRight
            />
          </div>

          {/* Board */}
          <div className="glow-amber relative">
            <div className="grid aspect-square grid-cols-9 overflow-hidden rounded-lg border-2 border-foreground/70 bg-card select-none">
              {Array.from({ length: 81 }, (_, i) => {
                const r = Math.floor(i / 9), c = i % 9;
                const digit = digitAt(i);
                const owner = game.owners[i];
                const given = givens[i] !== 0;
                const isWrong = wrong && wrong.index === i && Date.now() - wrong.at < 1200;
                const isSel = selected === i;
                const related = selected !== null && sameUnit(selected, i);
                const sameDigit = selectedDigit !== 0 && digit === selectedDigit;
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => setSelected(i)}
                    aria-label={`Row ${r + 1} column ${c + 1}${digit ? `, ${digit}` : ", empty"}`}
                    className={[
                      "relative flex items-center justify-center font-heading text-[min(6.5vw,2rem)] leading-none transition-colors",
                      c % 3 === 2 && c < 8 ? "border-r-2 border-r-foreground/70" : c < 8 ? "border-r border-r-border" : "",
                      r % 3 === 2 && r < 8 ? "border-b-2 border-b-foreground/70" : r < 8 ? "border-b border-b-border" : "",
                      isWrong
                        ? "bg-red-500/25"
                        : isSel
                          ? "bg-primary/30"
                          : sameDigit
                            ? "bg-primary/20"
                            : related
                              ? "bg-primary/[0.07]"
                              : "",
                    ].join(" ")}
                  >
                    {isWrong ? (
                      <span className="text-red-500 animate-in zoom-in-50">{wrong!.value}</span>
                    ) : digit ? (
                      <span
                        className={
                          given
                            ? "text-foreground"
                            : owner === username
                              ? "font-semibold text-primary"
                              : "font-semibold text-rose-500"
                        }
                      >
                        {digit}
                      </span>
                    ) : null}
                    {owner && (
                      <span
                        className={`absolute top-0.5 left-1 text-[min(2.4vw,0.7rem)] font-bold ${
                          owner === username ? "text-primary" : "text-rose-500"
                        }`}
                      >
                        {initial(owner)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {ending && (
              <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-black/35 animate-in fade-in duration-500">
                <div className="rounded-xl border border-white/15 bg-black/75 px-7 py-5 text-center text-white shadow-2xl backdrop-blur-md animate-in zoom-in-90">
                  <p className="font-heading text-3xl font-bold">{ending.title}</p>
                  <p className="mt-1 text-sm text-white/75">{ending.detail}</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Number pad */}
        <aside className="w-full max-w-[560px] space-y-3 lg:w-72">
          <div className="grid grid-cols-9 gap-1.5 lg:grid-cols-3 lg:gap-2">
            {Array.from({ length: 9 }, (_, k) => k + 1).map((d) => {
              const left = remaining(d);
              return (
                <button
                  key={d}
                  type="button"
                  disabled={over || left <= 0}
                  onClick={() => place(d)}
                  className="flex aspect-[3/4] flex-col items-center justify-center rounded-lg bg-secondary text-primary transition-all hover:bg-accent active:scale-95 disabled:opacity-30 lg:aspect-square"
                >
                  <span className="font-heading text-2xl leading-none lg:text-4xl">{d}</span>
                  <span className="mt-0.5 text-[10px] text-muted-foreground lg:text-xs">{left}</span>
                </button>
              );
            })}
          </div>
          <p className="text-center text-xs text-muted-foreground">
            Tap a square, then a number. Correct numbers claim the square with your initial.
          </p>
          {over && (
            <Button onClick={onBackToLobby} className="h-12 w-full text-base font-semibold" size="lg">
              Back to lobby
            </Button>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function PlayerScore({
  name,
  you,
  score,
  mistakes,
  max,
  alignRight,
}: {
  name: string;
  you?: boolean;
  score: number;
  mistakes: number;
  max: number;
  alignRight?: boolean;
}) {
  return (
    <div className={`min-w-0 ${alignRight ? "text-right" : ""}`}>
      <div className={`flex items-center gap-1.5 ${alignRight ? "justify-end" : ""}`}>
        <span
          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-xs font-bold text-white ${
            you ? "bg-primary text-primary-foreground" : "bg-rose-500"
          }`}
        >
          {initial(name)}
        </span>
        <span className="truncate text-sm font-medium">{you ? "You" : name}</span>
      </div>
      <div className={`mt-0.5 flex items-baseline gap-2 ${alignRight ? "justify-end" : ""}`}>
        <span className="font-mono text-xl font-semibold tabular-nums">{score}</span>
        <span className={`text-xs ${mistakes ? "text-red-500" : "text-muted-foreground"}`}>
          {mistakes}/{max} mistakes
        </span>
      </div>
    </div>
  );
}

function Timer({ game }: { game: SudokuState }) {
  const [now, setNow] = useState(() => Date.now());
  const running = game.status === "active";
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);
  const ms = game.elapsedMs + (running ? Math.max(0, now - game.receivedAt) : 0);
  const s = Math.floor(ms / 1000);
  return (
    <div className="font-mono text-lg tabular-nums">
      {String(Math.floor(s / 60)).padStart(2, "0")}:{String(s % 60).padStart(2, "0")}
    </div>
  );
}
