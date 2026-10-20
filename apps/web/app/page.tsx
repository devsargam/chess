"use client";
import { useState, useCallback, useRef, useEffect } from "react";
import { Chess } from "chess.js";
import { events } from "@repo/shared/events";
import { useAuth } from "./hooks/useAuth";
import { useSocket } from "./hooks/useSocket";
import { AuthForm } from "./components/AuthForm";
import { Lobby } from "./components/Lobby";
import { Game, type Clocks, type TimeControl } from "./components/Game";
import { Waiting } from "./components/Waiting";
import { Sudoku, type SudokuState } from "./components/Sudoku";

type Screen = "auth" | "lobby" | "waiting" | "game" | "sudoku";

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
  const [opponent, setOpponent] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [sudoku, setSudoku] = useState<SudokuState | null>(null);
  const [sudokuWrong, setSudokuWrong] = useState<{
    index: number;
    value: number;
    at: number;
  } | null>(null);

  const rollbackRef = useRef<RollbackState | null>(null);

  const handleWsMessage = useCallback(
    (type: string, payload: Record<string, unknown>) => {
      switch (type) {
        case events.createRoom: {
          setSudoku(null);
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
          setOpponent((payload.opponent as string | null) ?? null);
          setServerError(null);
          setSudoku(null);
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
        case events.sudokuSync: {
          const state = { ...(payload as unknown as SudokuState), receivedAt: Date.now() };
          setSudoku(state);
          setGameId(state.gameId);
          setServerError(null);
          setScreen(state.status === "waiting" ? "waiting" : "sudoku");
          break;
        }
        case events.sudokuWrong: {
          setSudokuWrong({
            index: payload.index as number,
            value: payload.value as number,
            at: Date.now(),
          });
          new Audio("/sounds/notify.mp3").play().catch(() => {});
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
          setServerError(payload.message as string);
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

  // Invite links (/?join=<id>) join automatically once connected
  useEffect(() => {
    if (!connected) return;
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get("join");
    if (!joinId) return;
    send(events.joinRoom, { gameId: joinId });
    window.history.replaceState(null, "", window.location.pathname);
  }, [connected, send]);

  const handleLogout = () => {
    logout();
    setGameId(null);
    setScreen("auth");
  };

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
        onCreateSudoku={(difficulty) => send(events.sudokuCreate, { difficulty })}
        onJoinRoom={(id) => {
          setServerError(null);
          send(events.joinRoom, { gameId: id });
        }}
        error={serverError}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === "waiting" && gameId) {
    return (
      <Waiting
        gameId={gameId}
        subtitle={
          sudoku
            ? `Sudoku race · ${sudoku.difficulty}`
            : `${
                timeControl
                  ? `${timeControl.initial / 60_000}+${timeControl.increment / 1000}`
                  : "No clock"
              } · you play white`
        }
        username={username!}
        connected={connected}
        onLogout={handleLogout}
        onBack={() => {
          setGameId(null);
          setScreen("lobby");
        }}
      />
    );
  }

  if (screen === "sudoku" && sudoku) {
    return (
      <Sudoku
        game={sudoku}
        username={username!}
        connected={connected}
        wrong={sudokuWrong}
        onPlace={(index, value) =>
          send(events.sudokuPlace, { gameId: sudoku.gameId, index, value })
        }
        onBackToLobby={() => {
          setSudoku(null);
          setGameId(null);
          setScreen("lobby");
        }}
        onLogout={handleLogout}
      />
    );
  }

  if (screen === "game" && gameId) {
    return (
      <Game
        username={username!}
        opponent={opponent}
        connected={connected}
        onLogout={handleLogout}
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
