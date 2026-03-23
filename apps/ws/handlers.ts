import { WebSocket } from "ws";
import { Chess } from "chess.js";
import { events } from "@repo/shared/events";
import { gameStore } from "@repo/db/game-store";

interface AuthenticatedUser {
  id: string;
  username: string;
}

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
    // Pre-create the chess instance for this game
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
    send(ws, events.joinRoom, {
      gameId: game.id,
      status: game.status,
      fen: game.fen,
    });

    // TODO: notify the other player that someone joined
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

    // Verify it's this player's turn
    const playerColor = gameStore.getPlayerColor(gameId, user.id);
    if (!playerColor) return sendError(ws, "You are not in this game");

    const chess = getChess(gameId);
    const expectedColor = chess.turn() === "w" ? "white" : "black";
    if (playerColor !== expectedColor) return sendError(ws, "Not your turn");

    // Attempt the move via chess.js — validates legality
    const result = chess.move({ from, to, promotion });
    if (!result) return sendError(ws, "Illegal move");

    // Persist in game store
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

    // Check for game-over conditions
    if (chess.isGameOver()) {
      let winner: string | null = null;
      let reason: string;

      if (chess.isCheckmate()) {
        reason = "checkmate";
        // The player who just moved wins
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

    send(ws, events.move, movePayload);

    // TODO: broadcast move to opponent
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

    send(ws, events.resign, { gameId: game.id, winner: game.winner, endReason: "resign" });

    // TODO: notify opponent about resignation
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
