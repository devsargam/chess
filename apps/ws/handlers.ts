import { WebSocket } from "ws";
import { events } from "@repo/shared/events";
import { gameStore } from "@repo/db/game-store";

interface AuthenticatedUser {
  id: string;
  username: string;
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
    send(ws, events.joinRoom, { gameId: game.id, status: game.status });

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
    const piece = payload?.piece as string;

    if (!gameId || !from || !to || !piece) {
      return sendError(ws, "Missing move fields: gameId, from, to, piece");
    }

    const game = gameStore.addMove(gameId, user.id, from, to, piece);
    send(ws, events.move, {
      gameId: game.id,
      from,
      to,
      piece,
      currentTurn: game.currentTurn,
    });

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
    send(ws, events.resign, { gameId: game.id, winner: game.winner });

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
