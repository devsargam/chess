"use client";
import { useState, useMemo, useEffect, useRef } from "react";
import { Chess } from "chess.js";
import { ChessiroCanvas, type BoardTheme, type Dests, type Square } from "chessiro-canvas";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Shell } from "./Shell";
import { useDesign, type Design } from "../hooks/useDesign";

/** Milliseconds */
export interface TimeControl {
  initial: number;
  increment: number;
}

/** Time left (ms) for each side as of `receivedAt` (local Date.now()) */
export interface Clocks {
  white: number;
  black: number;
  receivedAt: number;
}

type Color = "white" | "black";

interface GameProps {
  username: string;
  opponent: string | null;
  connected: boolean;
  fen: string;
  playerColor: Color;
  currentTurn: Color;
  moveHistory: string[];
  lastMove: { from: string; to: string } | null;
  clocks: Clocks | null;
  takebackRequest: boolean;
  gameOver: { winner: string | null; reason: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  onResign: () => void;
  onRequestTakeback: () => void;
  onRespondTakeback: (accepted: boolean) => void;
  onBackToLobby: () => void;
  onLogout: () => void;
}

const CHECK_GRADIENT =
  "radial-gradient(circle, oklch(0.62 0.24 25 / 95%) 0%, oklch(0.55 0.22 25 / 60%) 40%, transparent 75%)";

// Board colors per design experiment. Must be hex: the canvas can't read
// CSS variables and only applies its own alpha to hex highlight colors.
const BOARDS: Record<Design, { theme: BoardTheme; accent: string }> = {
  obsidian: {
    theme: {
      id: "obsidian-amber",
      name: "Obsidian Amber",
      darkSquare: "#7A6652",
      lightSquare: "#C8B898",
      lastMoveHighlight: "#E2B254",
      selectedPiece: "#E2B254",
    },
    accent: "oklch(0.78 0.12 75",
  },
  paper: {
    theme: {
      id: "paper-green",
      name: "Paper Green",
      darkSquare: "#769656",
      lightSquare: "#EEEED2",
      lastMoveHighlight: "#F6F669",
      selectedPiece: "#F6F669",
    },
    accent: "oklch(0.35 0.08 150",
  },
  midnight: {
    theme: {
      id: "midnight-violet",
      name: "Midnight Violet",
      darkSquare: "#5B56A3",
      lightSquare: "#CFCBF2",
      lastMoveHighlight: "#48D6F0",
      selectedPiece: "#B482FF",
    },
    accent: "oklch(0.82 0.13 200",
  },
};

const END_REASONS: Record<string, string> = {
  checkmate: "Checkmate",
  timeout: "Time out",
  resign: "Resignation",
  stalemate: "Stalemate",
  draw: "Draw",
};

export function Game({
  username,
  opponent,
  connected,
  fen,
  playerColor,
  currentTurn,
  moveHistory,
  lastMove,
  clocks,
  takebackRequest,
  gameOver,
  onMove,
  onResign,
  onRequestTakeback,
  onRespondTakeback,
  onBackToLobby,
  onLogout,
}: GameProps) {
  const design = useDesign();
  const board = BOARDS[design];
  const isMyTurn = currentTurn === playerColor && !gameOver;
  const opponentColor: Color = playerColor === "white" ? "black" : "white";
  const firedConfetti = useRef(false);
  const stripRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [confirmResign, setConfirmResign] = useState(false);

  // Keep the latest move in view (scroll the list, not the page)
  useEffect(() => {
    stripRef.current?.scrollTo({ left: stripRef.current.scrollWidth, behavior: "smooth" });
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [moveHistory.length]);

  useEffect(() => {
    if (!confirmResign) return;
    const t = setTimeout(() => setConfirmResign(false), 3000);
    return () => clearTimeout(t);
  }, [confirmResign]);

  useEffect(() => {
    if (gameOver?.winner === username && !firedConfetti.current) {
      firedConfetti.current = true;
      const end = Date.now() + 2500;
      const frame = () => {
        confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.7 } });
        confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.7 } });
        if (Date.now() < end) requestAnimationFrame(frame);
      };
      frame();
    }
    if (!gameOver) firedConfetti.current = false;
  }, [gameOver, username]);

  const chess = useMemo(() => new Chess(fen), [fen]);

  // Build legal move destinations map for chessiro-canvas
  const dests = useMemo<Dests>(() => {
    if (!isMyTurn) return new Map();
    const map = new Map<Square, Square[]>();
    const moves = chess.moves({ verbose: true });
    for (const move of moves) {
      const from = move.from as Square;
      const to = move.to as Square;
      const current = map.get(from);
      if (current) current.push(to);
      else map.set(from, [to]);
    }
    return map;
  }, [chess, isMyTurn]);

  const turnChar = chess.turn();
  const inCheck = chess.inCheck();
  // King square of the side in check (stays lit on checkmate)
  const checkSquare = useMemo(() => {
    if (!inCheck) return null;
    const king = chess
      .board()
      .flat()
      .find((p) => p?.type === "k" && p.color === turnChar);
    return king?.square ?? null;
  }, [chess, inCheck, turnChar]);

  const ending = gameOver
    ? {
        title: END_REASONS[gameOver.reason] ?? gameOver.reason,
        outcome:
          gameOver.winner === null
            ? "Draw"
            : gameOver.winner === username
              ? "You won"
              : "You lost",
      }
    : null;
  const movableColor = isMyTurn ? turnChar : undefined;

  const chessiroLastMove = useMemo(
    () => (lastMove ? { from: lastMove.from as Square, to: lastMove.to as Square } : undefined),
    [lastMove],
  );

  const pairs = Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => ({
    n: i + 1,
    white: moveHistory[i * 2]!,
    black: moveHistory[i * 2 + 1],
  }));
  const lastIndex = moveHistory.length - 1;

  const status = gameOver
    ? `${ending!.title} · ${ending!.outcome}`
    : inCheck
      ? isMyTurn
        ? "You're in check!"
        : "Check!"
      : isMyTurn
        ? "Your move"
        : "Opponent is thinking…";

  return (
    <Shell wide username={username} connected={connected} onLogout={onLogout}>
      <div className="flex flex-1 flex-col items-center gap-4 lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:pt-2">
        {/* Board column */}
        <div className="w-full max-w-[560px] space-y-2 lg:w-[min(calc(100dvh-11rem),680px)] lg:max-w-none">
          <PlayerBar
            name={opponent ?? "Opponent"}
            color={opponentColor}
            clocks={clocks}
            active={!gameOver && currentTurn === opponentColor}
            inCheck={!gameOver && inCheck && currentTurn === opponentColor}
          />

          <div className="glow-amber relative overflow-hidden rounded-lg">
            <ChessiroCanvas
              position={fen}
              orientation={playerColor}
              interactive={!gameOver}
              turnColor={turnChar}
              movableColor={movableColor}
              dests={dests}
              lastMove={chessiroLastMove}
              check={checkSquare}
              theme={board.theme}
              promotionVisuals={{
                backdropColor: "rgba(0, 0, 0, 0.7)",
                panelColor: "oklch(0.15 0.005 60 / 98%)",
                panelBorderColor: "oklch(0.78 0.12 75 / 25%)",
                panelShadow: "0 8px 32px rgba(0, 0, 0, 0.5)",
                panelRadius: "12px",
                titleColor: "oklch(0.93 0.01 80)",
                optionBackground: "oklch(0.22 0.01 60)",
                optionBorderColor: "oklch(0.78 0.12 75 / 15%)",
                optionRadius: "8px",
              }}
              squareVisuals={{
                legalDot: `${board.accent} / 45%)`,
                legalDotOutline: "oklch(0.93 0.01 80 / 60%)",
                legalCaptureRing: `${board.accent} / 55%)`,
                selectedOutline: `${board.accent} / 80%)`,
                checkGradient: CHECK_GRADIENT,
              }}
              onMove={(from, to, promotion) => {
                const localChess = new Chess(fen);
                const result = localChess.move({
                  from,
                  to,
                  promotion: promotion ?? undefined,
                });
                if (!result) return false;
                onMove(from, to, result.promotion || undefined);
                return true;
              }}
            />
            {ending && (
              <div className="pointer-events-none absolute inset-0 z-50 flex items-center justify-center bg-black/35 animate-in fade-in duration-500">
                <div
                  className={`rounded-xl border px-7 py-5 text-center text-white shadow-2xl backdrop-blur-md animate-in zoom-in-90 duration-300 ${
                    gameOver?.reason === "checkmate"
                      ? "border-red-400/50 bg-red-950/85"
                      : "border-white/15 bg-black/70"
                  }`}
                >
                  <p className="font-heading text-3xl font-bold tracking-tight">{ending.title}</p>
                  <p className="mt-1 text-sm text-white/75">{ending.outcome}</p>
                </div>
              </div>
            )}
          </div>

          <PlayerBar
            name={username}
            you
            color={playerColor}
            clocks={clocks}
            active={!gameOver && currentTurn === playerColor}
            inCheck={!gameOver && inCheck && currentTurn === playerColor}
          />
        </div>

        {/* Side panel (below the board on phones) */}
        <aside className="w-full max-w-[560px] space-y-3 lg:w-80">
          <div
            role="status"
            className={`rounded-lg border px-3 py-2.5 text-sm font-medium ${
              inCheck && !gameOver
                ? "border-red-500/40 bg-red-500/10 text-red-500"
                : isMyTurn
                  ? "border-primary/40 bg-primary/10 text-foreground"
                  : "border-border bg-card/60 text-muted-foreground"
            }`}
          >
            {status}
          </div>

          {takebackRequest && !gameOver && (
            <div className="rounded-lg border border-amber/40 bg-amber-muted p-3 animate-in fade-in slide-in-from-top-1">
              <p className="mb-2 text-center text-sm font-medium">Opponent wants to take back a move</p>
              <div className="flex gap-2">
                <Button className="h-10 flex-1" onClick={() => onRespondTakeback(true)}>
                  Accept
                </Button>
                <Button variant="secondary" className="h-10 flex-1" onClick={() => onRespondTakeback(false)}>
                  Decline
                </Button>
              </div>
            </div>
          )}

          {/* Moves: horizontal strip on phones */}
          <div
            ref={stripRef}
            className="flex gap-1 overflow-x-auto rounded-lg border border-border bg-card/60 px-2 py-2 font-mono text-sm whitespace-nowrap [scrollbar-width:none] lg:hidden"
          >
            {pairs.length === 0 ? (
              <span className="px-1 text-xs text-muted-foreground">No moves yet</span>
            ) : (
              pairs.map((p, i) => (
                <span key={p.n} className="flex items-center gap-1">
                  <span className="pl-1 text-muted-foreground/60">{p.n}.</span>
                  <MoveChip san={p.white} latest={i * 2 === lastIndex} />
                  {p.black && <MoveChip san={p.black} latest={i * 2 + 1 === lastIndex} />}
                </span>
              ))
            )}
          </div>

          {/* Moves: table on desktop */}
          <div className="hidden rounded-lg border border-border bg-card/60 lg:block">
            <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs text-muted-foreground">
              <span className="font-medium">Moves</span>
              <span className="font-mono">{moveHistory.length}</span>
            </div>
            <div ref={listRef} className="max-h-[min(50dvh,24rem)] overflow-y-auto p-2">
              {pairs.length === 0 ? (
                <p className="py-4 text-center text-xs text-muted-foreground">No moves yet</p>
              ) : (
                <div className="grid grid-cols-[2rem_1fr_1fr] gap-x-1 gap-y-0.5 font-mono text-sm">
                  {pairs.map((p, i) => (
                    <div key={p.n} className="contents">
                      <span className="py-0.5 pr-1 text-right text-muted-foreground/60">{p.n}.</span>
                      <MoveChip san={p.white} latest={i * 2 === lastIndex} />
                      {p.black ? <MoveChip san={p.black} latest={i * 2 + 1 === lastIndex} /> : <span />}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {gameOver ? (
            <Button onClick={onBackToLobby} className="h-12 w-full text-base font-semibold" size="lg">
              Back to lobby
            </Button>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="secondary"
                onClick={onRequestTakeback}
                className="h-11"
                disabled={moveHistory.length === 0}
              >
                ↶ Takeback
              </Button>
              <Button
                variant={confirmResign ? "destructive" : "secondary"}
                onClick={() => (confirmResign ? onResign() : setConfirmResign(true))}
                className="h-11"
              >
                {confirmResign ? "Tap to confirm" : "⚑ Resign"}
              </Button>
            </div>
          )}
        </aside>
      </div>
    </Shell>
  );
}

function MoveChip({ san, latest }: { san: string; latest: boolean }) {
  return (
    <span
      className={`rounded px-1.5 py-0.5 ${
        latest ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground"
      }`}
    >
      {san}
    </span>
  );
}

function PlayerBar({
  name,
  you,
  color,
  clocks,
  active,
  inCheck,
}: {
  name: string;
  you?: boolean;
  color: Color;
  clocks: Clocks | null;
  active: boolean;
  inCheck: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-2">
        <span
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-md border text-lg select-none ${
            color === "white"
              ? "border-black/10 bg-neutral-100 text-neutral-900"
              : "border-white/10 bg-neutral-900 text-neutral-100"
          }`}
        >
          {color === "white" ? "♔" : "♚"}
        </span>
        <span className="truncate text-sm font-medium">
          {name}
          {you && <span className="ml-1 text-muted-foreground">(you)</span>}
        </span>
        {inCheck && (
          <span className="animate-pulse rounded bg-red-500/15 px-1.5 py-0.5 text-xs font-semibold text-red-500">
            Check
          </span>
        )}
        {active && !inCheck && !clocks && (
          <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber" />
        )}
      </div>
      {clocks && <Clock clocks={clocks} color={color} running={active} />}
    </div>
  );
}

function formatClock(ms: number) {
  const totalSeconds = Math.ceil(ms / 1000);
  const m = Math.floor(totalSeconds / 60);
  const sec = String(totalSeconds % 60).padStart(2, "0");
  // Show tenths in the last 10 seconds
  if (ms < 10_000) return `0:${(ms / 1000).toFixed(1).padStart(4, "0")}`;
  return `${m}:${sec}`;
}

function Clock({ clocks, color, running }: { clocks: Clocks; color: Color; running: boolean }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setNow(Date.now()), 100);
    return () => clearInterval(id);
  }, [running]);

  // Server is authoritative; this only counts down between updates
  const elapsed = running ? Math.max(0, now - clocks.receivedAt) : 0;
  const left = Math.max(0, clocks[color] - elapsed);
  const low = left < 20_000;

  return (
    <span
      className={`rounded-md px-3 py-1 font-mono text-xl font-semibold tabular-nums transition-colors ${
        running
          ? low
            ? "bg-red-500 text-white"
            : "bg-primary text-primary-foreground"
          : "bg-card text-muted-foreground ring-1 ring-border"
      }`}
    >
      {formatClock(left)}
    </span>
  );
}
