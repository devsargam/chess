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
  timestamp: Date;
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
  createdAt: Date;
  updatedAt: Date;
}

class GameStore {
  private static instance: GameStore;
  private games: Map<string, GameRecord> = new Map();

  private constructor() {}

  static getInstance(): GameStore {
    if (!GameStore.instance) {
      GameStore.instance = new GameStore();
    }
    return GameStore.instance;
  }

  createGame(playerId: string): GameRecord {
    const game: GameRecord = {
      id: crypto.randomUUID(),
      players: [{ id: playerId, color: "white" }],
      moves: [],
      status: "waiting",
      currentTurn: "white",
      fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
      winner: null,
      endReason: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    this.games.set(game.id, game);
    return game;
  }

  joinGame(gameId: string, playerId: string): GameRecord {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "waiting") throw new Error("Game is not accepting players");
    if (game.players.length >= 2) throw new Error("Game is full");
    if (game.players.some((p) => p.id === playerId)) throw new Error("Already in this game");

    game.players.push({ id: playerId, color: "black" });
    game.status = "active";
    game.updatedAt = new Date();
    return game;
  }

  getPlayerColor(gameId: string, playerId: string): PieceColor | null {
    const game = this.games.get(gameId);
    if (!game) return null;
    const player = game.players.find((p) => p.id === playerId);
    return player?.color ?? null;
  }

  addMove(
    gameId: string,
    playerId: string,
    move: { from: string; to: string; promotion?: string },
    san: string,
    fen: string,
  ): GameRecord {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");

    game.moves.push({
      from: move.from,
      to: move.to,
      san,
      playerId,
      timestamp: new Date(),
    });
    game.fen = fen;
    game.currentTurn = game.currentTurn === "white" ? "black" : "white";
    game.updatedAt = new Date();
    return game;
  }

  endGame(gameId: string, winner: string | null, reason: string): GameRecord {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");

    game.status = "completed";
    game.winner = winner;
    game.endReason = reason;
    game.updatedAt = new Date();
    return game;
  }

  resign(gameId: string, playerId: string): GameRecord {
    const game = this.games.get(gameId);
    if (!game) throw new Error("Game not found");
    if (game.status !== "active") throw new Error("Game is not active");

    const opponent = game.players.find((p) => p.id !== playerId);
    if (!opponent) throw new Error("No opponent found");

    return this.endGame(gameId, opponent.id, "resign");
  }

  findById(id: string): GameRecord | undefined {
    return this.games.get(id);
  }

  listGames(): GameRecord[] {
    return [...this.games.values()];
  }

  listOpenGames(): GameRecord[] {
    return [...this.games.values()].filter((g) => g.status === "waiting");
  }
}

export const gameStore = GameStore.getInstance();
export type { GameRecord, Player, Move, PieceColor, GameStatus };
