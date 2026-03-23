"use client";
import { useState, useCallback } from "react";
import { events } from "@repo/shared/events";
import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";
import { AuthForm } from "./components/AuthForm";
import { Lobby } from "./components/Lobby";
import { Game } from "./components/Game";

type Screen = "auth" | "lobby" | "waiting" | "game";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

export default function Home() {
  const { token, username, error, loading, authenticate, logout } = useAuth();

  const [screen, setScreen] = useState<Screen>("auth");
  const [gameId, setGameId] = useState<string | null>(null);
  const [fen, setFen] = useState(START_FEN);
  const [playerColor, setPlayerColor] = useState<"white" | "black">("white");
  const [currentTurn, setCurrentTurn] = useState<"white" | "black">("white");
  const [gameOver, setGameOver] = useState<{
    winner: string | null;
    reason: string;
  } | null>(null);

  const handleWsMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      switch (type) {
        case events.createRoom: {
          setGameId(payload.gameId as string);
          setPlayerColor("white");
          setFen(START_FEN);
          setCurrentTurn("white");
          setGameOver(null);
          setScreen("waiting");
          break;
        }
        case events.joinRoom: {
          const incomingGameId = payload.gameId as string;
          setFen((payload.fen as string) || START_FEN);
          setCurrentTurn("white");
          setGameOver(null);
          setScreen("game");

          // If we're the joiner, set up our state. If we're the creator
          // (already have this gameId from create_room), keep our color.
          setGameId((prev) => {
            if (prev !== incomingGameId) {
              setPlayerColor("black");
            }
            return incomingGameId;
          });
          break;
        }
        case events.move: {
          setFen(payload.fen as string);
          setCurrentTurn(payload.currentTurn as "white" | "black");

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
        case "error": {
          console.error("Server error:", payload.message);
          break;
        }
      }
    },
    [],
  );

  const { connected, send } = useSocket(token, handleWsMessage);

  // Move to lobby once authenticated
  if (token && screen === "auth") {
    setScreen("lobby");
  }

  if (!token) {
    return (
      <AuthForm onAuth={authenticate} loading={loading} error={error} />
    );
  }

  if (screen === "lobby") {
    return (
      <Lobby
        username={username!}
        connected={connected}
        onCreateRoom={() => send(events.createRoom)}
        onJoinRoom={(id) => send(events.joinRoom, { gameId: id })}
        onLogout={() => {
          logout();
          setScreen("auth");
        }}
      />
    );
  }

  if (screen === "waiting") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-zinc-950 px-4">
        <p className="text-lg text-white">Waiting for opponent...</p>
        <p className="max-w-full break-all text-center font-mono text-sm text-zinc-400">
          Room ID: {gameId}
        </p>
        <p className="text-xs text-zinc-500">
          Share this ID with your opponent
        </p>
        <button
          onClick={() => {
            if (gameId) navigator.clipboard.writeText(gameId);
          }}
          className="rounded-lg bg-zinc-800 px-5 py-3 text-sm text-zinc-300 active:bg-zinc-700 hover:bg-zinc-700"
        >
          Copy Room ID
        </button>
        <button
          onClick={() => setScreen("lobby")}
          className="text-sm text-zinc-500 active:text-zinc-300 hover:text-zinc-300"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  if (screen === "game" && gameId) {
    return (
      <Game
        gameId={gameId}
        fen={fen}
        playerColor={playerColor}
        currentTurn={currentTurn}
        gameOver={gameOver}
        onMove={(from, to, promotion) =>
          send(events.move, { gameId, from, to, promotion })
        }
        onResign={() => send(events.resign, { gameId })}
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
