import { WebSocket } from "ws";
import { Chess } from "chess.js";
import { events } from "@repo/shared/events";
import { gameStore, timeLeft, type GameRecord } from "@repo/db/game-store";
import { timeControl } from "@repo/shared/zod-schema";
import { handleSudokuCreate, handleSudokuPlace, syncSudoku, tryJoinSudoku } from "./sudoku";

interface AuthenticatedUser {
  id: string;
  username: string;
}

// userId -> WebSocket (managed by index.ts)
export const connections = new Map<string, WebSocket>();

// One Chess instance per active game, keyed by gameId
const chessInstances = new Map<string, Chess>();

async function getChess(gameId: string): Promise<Chess> {
  let chess = chessInstances.get(gameId);
  if (!chess) {
    const game = await gameStore.findById(gameId);
    if (!game) throw new Error("Game not found");
    // Replay moves (not just the FEN) so undo history survives a server restart
    chess = new Chess();
    for (const m of game.moves) chess.move(m.san);
    chessInstances.set(gameId, chess);
  }
  return chess;
}

// gameId -> timer that fires when the side to move runs out of time
const flagTimers = new Map<string, ReturnType<typeof setTimeout>>();

function liveClocks(game: GameRecord) {
  if (!game.clocks) return null;
  return { white: timeLeft(game, "white"), black: timeLeft(game, "black") };
}

function scheduleFlag(game: GameRecord) {
  clearTimeout(flagTimers.get(game.id));
  flagTimers.delete(game.id);
  if (game.status !== "active" || !game.clocks) return;
  const ms = timeLeft(game, game.currentTurn);
  flagTimers.set(game.id, setTimeout(() => checkFlag(game.id), ms + 50));
}

/** End the game if the side to move is out of time. Returns true if it ended. */
async function checkFlag(gameId: string): Promise<boolean> {
  const game = await gameStore.findById(gameId);
  if (!game || game.status !== "active" || !game.clocks) return false;
  if (timeLeft(game, game.currentTurn) > 0) {
    scheduleFlag(game); // also re-arms timers lost in a server restart
    return false;
  }
  const winner = game.players.find((p) => p.color !== game.currentTurn);
  const ended = await gameStore.endGame(gameId, winner?.id ?? null, "timeout");
  chessInstances.delete(gameId);
  flagTimers.delete(gameId);
  await syncPlayers(ended);
  return true;
}

/** Full game state from one player's point of view */
function gameState(game: GameRecord, userId: string) {
  const last = game.moves.at(-1);
  return {
    gameId: game.id,
    status: game.status,
    color: game.players.find((p) => p.id === userId)?.color,
    opponent: game.players.find((p) => p.id !== userId)?.id ?? null,
    fen: game.fen,
    currentTurn: game.currentTurn,
    moves: game.moves.map((m) => m.san),
    lastMove: last ? { from: last.from, to: last.to } : null,
    winner: game.winner,
    endReason: game.endReason,
    timeControl: game.timeControl ?? null,
    clocks: liveClocks(game),
  };
}

/** Send a user their current game (if any) so a reload/reconnect resumes it */
export async function syncUser(ws: WebSocket, userId: string) {
  try {
    const game = await gameStore.findActiveGame(userId);
    if (game && !(await checkFlag(game.id))) send(ws, events.sync, gameState(game, userId));
    await syncSudoku(ws, userId);
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function syncPlayers(game: GameRecord) {
  for (const player of game.players) {
    const ws = connections.get(player.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      send(ws, events.sync, gameState(game, player.id));
    }
  }
}

/** Send to all players in a game */
async function broadcast(gameId: string, type: string, payload: Record<string, unknown>) {
  const game = await gameStore.findById(gameId);
  if (!game) return;

  const msg = JSON.stringify({ type, payload });
  for (const player of game.players) {
    const ws = connections.get(player.id);
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(msg);
    }
  }
}

export const handleMessage = async (
  ws: WebSocket,
  user: AuthenticatedUser,
  type: string,
  payload: Record<string, unknown> | undefined,
) => {
  switch (type) {
    case events.createRoom:
      await handleCreateRoom(ws, user, payload);
      break;
    case events.joinRoom:
      await handleJoinRoom(ws, user, payload);
      break;
    case events.move:
      await handleMove(ws, user, payload);
      break;
    case events.resign:
      await handleResign(ws, user, payload);
      break;
    case events.takebackRequest:
      await handleTakebackRequest(ws, user, payload);
      break;
    case events.takebackResponse:
      await handleTakebackResponse(ws, user, payload);
      break;
    case events.sudokuCreate:
      await handleSudokuCreate(ws, user.id, payload);
      break;
    case events.sudokuPlace:
      await handleSudokuPlace(ws, user.id, payload);
      break;
    default:
      sendError(ws, "Unknown event: " + type);
  }
};

async function handleCreateRoom(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const tc = timeControl.nullable().optional().safeParse(payload?.timeControl);
    if (!tc.success) return sendError(ws, "Invalid time control");

    const game = await gameStore.createGame(user.id, tc.data ?? null);
    chessInstances.set(game.id, new Chess());
    send(ws, events.createRoom, { gameId: game.id, timeControl: game.timeControl });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function handleJoinRoom(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    if (!gameId) return sendError(ws, "Missing gameId");

    // Room codes are shared between chess and sudoku
    if (await tryJoinSudoku(ws, user.id, gameId)) return;

    // Re-joining a game you're already in just resyncs you
    const existing = await gameStore.findById(gameId);
    if (existing?.players.some((p) => p.id === user.id)) {
      if (await checkFlag(gameId)) return;
      return send(ws, events.sync, gameState(existing, user.id));
    }

    const game = await gameStore.joinGame(gameId, user.id);
    scheduleFlag(game);

    // Notify both players that the game is starting
    await syncPlayers(game);
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function handleMove(
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

    if (await checkFlag(gameId)) return;

    const game = await gameStore.findById(gameId);
    if (!game) return sendError(ws, "Game not found");
    if (game.status !== "active") return sendError(ws, "Game is not active");

    const playerColor = await gameStore.getPlayerColor(gameId, user.id);
    if (!playerColor) return sendError(ws, "You are not in this game");

    const chess = await getChess(gameId);
    const expectedColor = chess.turn() === "w" ? "white" : "black";
    if (playerColor !== expectedColor) return sendError(ws, "Not your turn");

    const result = chess.move({ from, to, promotion });
    if (!result) return sendError(ws, "Illegal move");

    let updated = await gameStore.addMove(gameId, user.id, { from, to, promotion }, result.san, chess.fen());

    const movePayload: Record<string, unknown> = {
      gameId,
      from,
      to,
      san: result.san,
      moves: updated.moves.map((m) => m.san),
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

      updated = await gameStore.endGame(gameId, winner, reason);
      chessInstances.delete(gameId);

      movePayload.gameOver = true;
      movePayload.winner = winner;
      movePayload.endReason = reason;
    }

    scheduleFlag(updated);
    movePayload.clocks = liveClocks(updated);

    // Broadcast move to both players
    await broadcast(gameId, events.move, movePayload);
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function handleResign(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    if (!gameId) return sendError(ws, "Missing gameId");

    const game = await gameStore.resign(gameId, user.id);
    chessInstances.delete(gameId);
    scheduleFlag(game); // clears the timer

    // Notify both players
    await broadcast(gameId, events.resign, { gameId: game.id, winner: game.winner, endReason: "resign" });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function handleTakebackRequest(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    if (!gameId) return sendError(ws, "Missing gameId");

    const game = await gameStore.findById(gameId);
    if (!game) return sendError(ws, "Game not found");
    if (game.status !== "active") return sendError(ws, "Game is not active");
    if (game.moves.length === 0) return sendError(ws, "No moves to undo");

    // Send request to opponent
    const opponent = game.players.find((p) => p.id !== user.id);
    if (!opponent) return sendError(ws, "No opponent found");

    const opponentWs = connections.get(opponent.id);
    if (opponentWs && opponentWs.readyState === WebSocket.OPEN) {
      send(opponentWs, events.takebackRequest, { gameId, requestedBy: user.id });
    }
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

async function handleTakebackResponse(
  ws: WebSocket,
  user: AuthenticatedUser,
  payload: Record<string, unknown> | undefined,
) {
  try {
    const gameId = payload?.gameId as string;
    const accepted = payload?.accepted as boolean;
    if (!gameId) return sendError(ws, "Missing gameId");

    const game = await gameStore.findById(gameId);
    if (!game) return sendError(ws, "Game not found");
    if (game.status !== "active") return sendError(ws, "Game is not active");

    if (!accepted) {
      // Notify requester that takeback was declined
      const requester = game.players.find((p) => p.id !== user.id);
      if (requester) {
        const reqWs = connections.get(requester.id);
        if (reqWs && reqWs.readyState === WebSocket.OPEN) {
          send(reqWs, events.takebackResponse, { gameId, accepted: false });
        }
      }
      return;
    }

    // Undo the move
    if (game.moves.length === 0) return sendError(ws, "No moves to undo");

    const chess = await getChess(gameId);
    chess.undo();

    const updatedGame = await gameStore.undoMove(gameId);
    updatedGame.fen = chess.fen();
    await gameStore.saveGamePublic(updatedGame);
    scheduleFlag(updatedGame);

    // Broadcast the undo to both players
    await broadcast(gameId, events.takebackApplied, {
      gameId,
      moves: updatedGame.moves.map((m) => m.san),
      clocks: liveClocks(updatedGame),
      fen: chess.fen(),
      currentTurn: chess.turn() === "w" ? "white" : "black",
    });
  } catch (err) {
    sendError(ws, (err as Error).message);
  }
}

export function send(ws: WebSocket, type: string, payload: Record<string, unknown>) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type, payload }));
}

export function sendError(ws: WebSocket, message: string) {
  if (ws.readyState !== WebSocket.OPEN) return;
  ws.send(JSON.stringify({ type: "error", payload: { message } }));
}
