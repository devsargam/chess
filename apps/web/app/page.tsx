"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { events } from "@repo/shared/events";
import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";
import { AuthForm } from "./components/AuthForm";
import { Lobby } from "./components/Lobby";
import { Game, type Clocks, type TimeControl } from "./components/Game";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";

type Screen = "auth" | "lobby" | "waiting" | "game";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface RollbackState {
  fen: string;
  currentTurn: "white" | "black";
  moveHistory: string[];
  lastMove: { from: string; to: string } | null;
}

/** Server sends time left in ms; stamp it with when we received it */
function toClocks(raw: unknown): Clocks | null {
  if (!raw) return null;
  const { white, black } = raw as { white: number; black: number };
  return { white, black, receivedAt: Date.now() };
}

export default function Home() {
  const { token, username, ready, error, loading, authenticate, logout } =
    useAuth();
  const [copied, setCopied] = useState(false);

  const [screen, setScreen] = useState<Screen>("auth");
  const [gameId, setGameId] = useState<string | null>(null);
  const [fen, setFen] = useState(START_FEN);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [currentTurn, setCurrentTurn] = useState<"white" | "black">("white");
  const [moveHistory, setMoveHistory] = useState<string[]>([]);
  const [lastMove, setLastMove] = useState<{ from: string; to: string } | null>(
    null,
  );
  const [takebackRequest, setTakebackRequest] = useState(false);
  const [gameOver, setGameOver] = useState<{
    winner: string | null;
    reason: string;
  } | null>(null);

  const [timeControl, setTimeControl] = useState<TimeControl | null>(null);
  const [clocks, setClocks] = useState<Clocks | null>(null);

  const rollbackRef = useRef<RollbackState | null>(null);

  const handleWsMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      switch (type) {
        case events.createRoom: {
          setGameId(payload.gameId as string);
          setTimeControl(payload.timeControl as TimeControl | null);
          setClocks(null);
          setPlayerColor("white");
          setFen(START_FEN);
          setCurrentTurn("white");
          setGameOver(null);
          setMoveHistory([]);
          setLastMove(null);
          setScreen("waiting");
          break;
        }
        case events.sync: {
          // Full game state from the server: sent on connect, join and rejoin
          const status = payload.status as string;
          setGameId(payload.gameId as string);
          setPlayerColor(payload.color as "white" | "black");
          setFen(payload.fen as string);
          setCurrentTurn(payload.currentTurn as "white" | "black");
          setMoveHistory(payload.moves as string[]);
          setLastMove(payload.lastMove as { from: string; to: string } | null);
          setTimeControl(payload.timeControl as TimeControl | null);
          setClocks(toClocks(payload.clocks));
          setTakebackRequest(false);
          rollbackRef.current = null;
          setGameOver(
            status === "completed"
              ? {
                  winner: payload.winner as string | null,
                  reason: payload.endReason as string,
                }
              : null,
          );
          setScreen(status === "waiting" ? "waiting" : "game");
          break;
        }
        case events.move: {
          setFen(payload.fen as string);
          setCurrentTurn(payload.currentTurn as "white" | "black");
          setLastMove({
            from: payload.from as string,
            to: payload.to as string,
          });
          setMoveHistory(payload.moves as string[]);
          setClocks(toClocks(payload.clocks));
          rollbackRef.current = null;

          if (payload.inCheck) {
            new Audio("/sounds/notify.mp3").play().catch(() => {});
          } else if (payload.captured) {
            new Audio("/sounds/capture.mp3").play().catch(() => {});
          } else {
            new Audio("/sounds/move-self.mp3").play().catch(() => {});
          }

          if (payload.gameOver) {
            setGameOver({
              winner: payload.winner as string | null,
              reason: payload.endReason as string,
            });
          }
          break;
        }
        case events.resign: {
          setGameOver({
            winner: payload.winner as string | null,
            reason: "resign",
          });
          break;
        }
        case events.takebackRequest: {
          setTakebackRequest(true);
          break;
        }
        case events.takebackResponse: {
          break;
        }
        case events.takebackApplied: {
          setFen(payload.fen as string);
          setCurrentTurn(payload.currentTurn as "white" | "black");
          setMoveHistory(payload.moves as string[]);
          setClocks(toClocks(payload.clocks));
          setLastMove(null);
          setTakebackRequest(false);
          rollbackRef.current = null;
          break;
        }
        case "error": {
          console.error("Server error:", payload.message);
          const rollback = rollbackRef.current;
          if (rollback) {
            setFen(rollback.fen);
            setCurrentTurn(rollback.currentTurn);
            setMoveHistory(rollback.moveHistory);
            setLastMove(rollback.lastMove);
            rollbackRef.current = null;
          }
          break;
        }
      }
    },
    [],
  );

  const { connected, send } = useSocket(token, handleWsMessage, logout);

  // After a reconnect, ask for the current game's state in case we missed
  // anything (e.g. the opponent moved or resigned while we were offline)
  const gameIdRef = useRef(gameId);
  gameIdRef.current = gameId;
  useEffect(() => {
    if (connected && gameIdRef.current) {
      send(events.joinRoom, { gameId: gameIdRef.current });
    }
  }, [connected, send]);

  if (token && screen === "auth") {
    setScreen("lobby");
  }

  if (!ready) return null;

  if (!token) {
    return <AuthForm onAuth={authenticate} loading={loading} error={error} />;
  }

  if (screen === "lobby") {
    return (
      <Lobby
        username={username!}
        connected={connected}
        onCreateRoom={(tc) => send(events.createRoom, { timeControl: tc })}
        onJoinRoom={(id) => send(events.joinRoom, { gameId: id })}
        onLogout={() => {
          logout();
          setGameId(null);
          setScreen("auth");
        }}
      />
    );
  }

  if (screen === "waiting") {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="pointer-events-none fixed inset-0 overflow-hidden">
          <div className="absolute top-1/3 left-1/2 h-[500px] w-[500px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/5 blur-[120px]" />
        </div>

        <div className="relative w-full max-w-sm">
          <Card className="glow-amber border-border/50 bg-card/80 backdrop-blur-sm">
            <CardHeader className="text-center">
              <div className="animate-pulse-amber mb-2">
                <span
                  className="text-5xl select-none"
                  style={{
                    filter: "drop-shadow(0 0 20px oklch(0.78 0.12 75 / 30%))",
                  }}
                >
                  ♔
                </span>
              </div>
              <CardTitle className="text-xl">Waiting for opponent</CardTitle>
              <CardDescription>
                Share this room code with your opponent
              </CardDescription>
              {timeControl && (
                <p className="font-mono text-sm text-foreground">
                  {timeControl.initial / 60_000}+{timeControl.increment / 1000}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Room code display */}
              <div
                className="cursor-pointer rounded-lg border border-border/50 bg-background/50 p-4 text-center font-mono text-xs break-all text-muted-foreground transition-colors hover:border-primary/30 hover:text-foreground"
                onClick={() => {
                  if (gameId) {
                    navigator.clipboard.writeText(gameId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {gameId}
              </div>

              <Button
                variant="secondary"
                className="h-11 w-full"
                size="lg"
                onClick={() => {
                  if (gameId) {
                    navigator.clipboard.writeText(gameId);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }
                }}
              >
                {copied ? "Copied!" : "Copy Room Code"}
              </Button>

              <Button
                variant="ghost"
                className="w-full text-muted-foreground"
                onClick={() => {
                  setGameId(null);
                  setScreen("lobby");
                }}
              >
                Back to Lobby
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  if (screen === "game" && gameId) {
    return (
      <Game
        gameId={gameId}
        username={username!}
        fen={fen}
        playerColor={playerColor}
        currentTurn={currentTurn}
        moveHistory={moveHistory}
        lastMove={lastMove}
        clocks={clocks}
        takebackRequest={takebackRequest}
        gameOver={gameOver}
        onMove={(from, to, promotion) => {
          const localChess = new Chess(fen);
          const result = localChess.move({ from, to, promotion });
          if (!result) return;

          rollbackRef.current = {
            fen,
            currentTurn,
            moveHistory,
            lastMove,
          };

          setFen(localChess.fen());
          setCurrentTurn(localChess.turn() === "w" ? "white" : "black");
          setLastMove({ from, to });
          setMoveHistory((prev) => [...prev, result.san]);

          send(events.move, { gameId, from, to, promotion });
        }}
        onResign={() => send(events.resign, { gameId })}
        onRequestTakeback={() => send(events.takebackRequest, { gameId })}
        onRespondTakeback={(accepted) => {
          send(events.takebackResponse, { gameId, accepted });
          setTakebackRequest(false);
        }}
        onBackToLobby={() => {
          setGameId(null);
          setGameOver(null);
          setScreen("lobby");
        }}
      />
    );
  }

  return null;
}
