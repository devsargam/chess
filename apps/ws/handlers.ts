import { WebSocket } from "ws";
import { Chess } from "chess.js";
import { events } from "@repo/shared/events";
import { gameStore } from "@repo/db/game-store";

interface AuthenticatedUser {
  id: string;
  username: string;
}

// userId -> WebSocket (managed by index.ts)
export const connections = new Map<string, WebSocket>();

// One Chess instance per active game, keyed by gameId
const chessInstances = new Map<string, Chess>();

function getChess(gameId: string): Chess {
  let chess = chessInstances.get(gameId);
  if (!chess) {
    const game = gameStore.findById(gameId);
    if (!game) throw new Error("Game not found");
    chess = new Chess(game.fen);
    chessInstances.set(gameId, chess);
  }
  return chess;
}

/** Send to all players in a game */
function broadcast(gameId: string, type: string, payload: Record<string, unknown>) {
  const game = gameStore.findById(gameId);
  if (!game) return;

  const msg = JSON.stringify({ type, payload });
  for (const player of game.players) {
    const ws = connections.get(player.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export const handleMessage = (
  ws: WebSocket,
  user: AuthenticatedUser,
  type: string,
  payload: Record<string, unknown> | undefined,
) => {
  switch (type) {
    case events.createRoom:
      handleCreateRoom(ws, user);
      break;
    case events.joinRoom:
      handleJoinRoom(ws, user, payload);
      break;
    case events.move:
      handleMove(ws, user, payload);
      break;
    case events.resign:
      handleResign(ws, user, payload);
      break;
    default:
      sendError(ws, "Unknown event: " + type);
  }
};

function handleCreateRoom(ws: WebSocket, user: AuthenticatedUser) {
  try {
    const game = gameStore.createGame(user.id);
    chessInstances.set(game.id, new Chess());
    send(ws, events.createRoom, { gameId: game.id });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

function handleJoinRoom(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    if (!gameId) return sendError(ws, "Missing gameId");

    const game = gameStore.joinGame(gameId, user.id);

    // Notify both players that the game is starting
    broadcast(gameId, events.joinRoom, {
      gameId: game.id,
      status: game.status,
      fen: game.fen,
    });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

function handleMove(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    const from = payload?.from as string;
    const to = payload?.to as string;
    const promotion = payload?.promotion as string | undefined;

    if (!gameId || !from || !to) {
      return sendError(ws, "Missing move fields: gameId, from, to");
    }

    const game = gameStore.findById(gameId);
    if (!game) return sendError(ws, "Game not found");
    if (game.status !== "active") return sendError(ws, "Game is not active");

    const playerColor = gameStore.getPlayerColor(gameId, user.id);
    if (!playerColor) return sendError(ws, "You are not in this game");

    const chess = getChess(gameId);
    const expectedColor = chess.turn() === "w" ? "white" : "black";
    if (playerColor !== expectedColor) return sendError(ws, "Not your turn");

    const result = chess.move({ from, to, promotion });
    if (!result) return sendError(ws, "Illegal move");

    gameStore.addMove(gameId, user.id, { from, to, promotion }, result.san, chess.fen());

    const movePayload: Record<string, unknown> = {
      gameId,
      from,
      to,
      san: result.san,
      fen: chess.fen(),
      currentTurn: chess.turn() === "w" ? "white" : "black",
    };

    if (result.captured) movePayload.captured = result.captured;
    if (chess.inCheck()) movePayload.inCheck = true;

    if (chess.isGameOver()) {
      let winner: string | null = null;
      let reason: string;

      if (chess.isCheckmate()) {
        reason = "checkmate";
        winner = user.id;
      } else if (chess.isStalemate()) {
        reason = "stalemate";
      } else if (chess.isDraw()) {
        reason = "draw";
      } else {
        reason = "unknown";
      }

      gameStore.endGame(gameId, winner, reason);
      chessInstances.delete(gameId);

      movePayload.gameOver = true;
      movePayload.winner = winner;
      movePayload.endReason = reason;
    }

    // Broadcast move to both players
    broadcast(gameId, events.move, movePayload);
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

function handleResign(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    if (!gameId) return sendError(ws, "Missing gameId");

    const game = gameStore.resign(gameId, user.id);
    chessInstances.delete(gameId);

    // Notify both players
    broadcast(gameId, events.resign, { gameId: game.id, winner: game.winner, endReason: "resign" });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

function send(ws: WebSocket, type: string, payload: Record<string, unknown>) {
  ws.send(JSON.stringify({ type, payload }));
}

function sendError(ws: WebSocket, message: string) {
  ws.send(JSON.stringify({ type: "error", payload: { message } }));
}
