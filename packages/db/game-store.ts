import { redis } from "./redis";

type PieceColor = "white" | "black";

type GameStatus = "waiting" | "active" | "completed" | "abandoned";

interface Player {
  id: string;
  color: PieceColor;
}

interface Move {
  from: string;
  to: string;
  san: string;
  playerId: string;
  timestamp: string;
}

/** All values in milliseconds */
interface TimeControl {
  initial: number;
  increment: number;
}

interface Clocks {
  white: number;
  black: number;
}

interface GameRecord {
  id: string;
  players: Player[];
  moves: Move[];
  status: GameStatus;
  currentTurn: PieceColor;
  fen: string;
  winner: string | null;
  endReason: string | null;
  timeControl: TimeControl | null;
  // Time left for each side as of turnStartedAt; null for untimed games
  clocks: Clocks | null;
  turnStartedAt: number | null;
  createdAt: string;
  updatedAt: string;
}

const GAME_KEY = (id: string) => `game:${id}`;
// Points a user at the game they're currently in, so reconnects can resume it
const ACTIVE_GAME_KEY = (userId: string) => `user:${userId}:active-game`;

/** Time `color` has left right now, counting the running clock */
function timeLeft(game: GameRecord, color: PieceColor): number {
  if (!game.clocks) return Infinity;
  let left = game.clocks[color];
  if (game.status === "active" && color === game.currentTurn && game.turnStartedAt) {
    left -= Date.now() - game.turnStartedAt;
  }
  return Math.max(0, left);
}

/** Stop the running clock: charge the side to move for time spent so far */
function chargeClock(game: GameRecord, increment = 0) {
  if (!game.clocks) return;
  game.clocks[game.currentTurn] = timeLeft(game, game.currentTurn) + increment;
  game.turnStartedAt = Date.now();
}

class GameStore {
  private async getGame(gameId: string): Promise<GameRecord | null> {
    const data = await redis.get(GAME_KEY(gameId));
    return data ? JSON.parse(data) : null;
  }

  private async saveGame(game: GameRecord): Promise<void> {
    await redis.set(GAME_KEY(game.id), JSON.stringify(game));
  }

  async createGame(
    playerId: string,
    timeControl: TimeControl | null,
  ): Promise<GameRecord> {
    const game: GameRecord = {
      id: crypto.randomUUID(),
      players: [{ id: playerId, color: "white" }],
      moves: [],
      status: "waiting",
      currentTurn: "white",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      winner: null,
      endReason: null,
      timeControl,
      clocks: timeControl
        ? { white: timeControl.initial, black: timeControl.initial }
        : null,
      turnStartedAt: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    await this.saveGame(game);
    await redis.set(ACTIVE_GAME_KEY(playerId), game.id);
    return game;
  }

  async joinGame(gameId: string, playerId: string): Promise<GameRecord> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting")
      throw new Error("Game is not accepting players");
    if (game.players.length >= 2) throw new Error("Game is full");
    if (game.players.some((p) => p.id === playerId))
      throw new Error("Already in this game");

    game.players.push({ id: playerId, color: "black" });
    game.status = "active";
    game.turnStartedAt = Date.now(); // white's clock starts now
    game.updatedAt = new Date().toISOString();
    await this.saveGame(game);
    await redis.set(ACTIVE_GAME_KEY(playerId), game.id);
    return game;
  }

  async getPlayerColor(
    gameId: string,
    playerId: string,
  ): Promise<PieceColor | null> {
    const game = await this.getGame(gameId);
    if (!game) return null;
    const player = game.players.find((p) => p.id === playerId);
    return player?.color ?? null;
  }

  async addMove(
    gameId: string,
    playerId: string,
    move: { from: string; to: string; promotion?: string },
    san: string,
    fen: string,
  ): Promise<GameRecord> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");

    game.moves.push({
      from: move.from,
      to: move.to,
      san,
      playerId,
      timestamp: new Date().toISOString(),
    });
    game.fen = fen;
    chargeClock(game, game.timeControl?.increment);
    game.currentTurn = game.currentTurn === "white" ? "black" : "white";
    game.updatedAt = new Date().toISOString();
    await this.saveGame(game);
    return game;
  }

  async endGame(
    gameId: string,
    winner: string | null,
    reason: string,
  ): Promise<GameRecord> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");

    if (game.status === "active") chargeClock(game);
    game.status = "completed";
    game.winner = winner;
    game.endReason = reason;
    game.updatedAt = new Date().toISOString();
    await this.saveGame(game);
    await redis.del(...game.players.map((p) => ACTIVE_GAME_KEY(p.id)));
    return game;
  }

  async resign(gameId: string, playerId: string): Promise<GameRecord> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");

    const opponent = game.players.find((p) => p.id !== playerId);
    if (!opponent) throw new Error("No opponent found");

    return this.endGame(gameId, opponent.id, "resign");
  }

  async undoMove(gameId: string): Promise<GameRecord> {
    const game = await this.getGame(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");
    if (game.moves.length === 0) throw new Error("No moves to undo");

    game.moves.pop();
    chargeClock(game);
    game.currentTurn = game.currentTurn === "white" ? "black" : "white";
    game.updatedAt = new Date().toISOString();
    // fen will be set by the caller after chess.undo()
    return game;
  }

  async saveGamePublic(game: GameRecord): Promise<void> {
    await this.saveGame(game);
  }

  async findById(id: string): Promise<GameRecord | null> {
    return this.getGame(id);
  }

  async findActiveGame(userId: string): Promise<GameRecord | null> {
    const gameId = await redis.get(ACTIVE_GAME_KEY(userId));
    if (!gameId) return null;
    const game = await this.getGame(gameId);
    if (!game || (game.status !== "waiting" && game.status !== "active")) {
      await redis.del(ACTIVE_GAME_KEY(userId));
      return null;
    }
    return game;
  }
}

export const gameStore = new GameStore();
export { timeLeft };
export type {
  GameRecord,
  Player,
  Move,
  PieceColor,
  GameStatus,
  TimeControl,
  Clocks,
};
