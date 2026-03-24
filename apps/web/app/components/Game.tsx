"use client";
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";
import confetti from "canvas-confetti";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

interface GameProps {
  gameId: string;
  fen: string;
  playerColor: "white" | "black";
  currentTurn: "white" | "black";
  moveHistory: string[];
  lastMove: { from: string; to: string } | null;
  takebackRequest: boolean;
  gameOver: { winner: string | null; reason: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  onResign: () => void;
  onRequestTakeback: () => void;
  onRespondTakeback: (accepted: boolean) => void;
  onBackToLobby: () => void;
}

export function Game({
  gameId,
  fen,
  playerColor,
  currentTurn,
  moveHistory,
  lastMove,
  takebackRequest,
  gameOver,
  onMove,
  onResign,
  onRequestTakeback,
  onRespondTakeback,
  onBackToLobby,
}: GameProps) {
  const isMyTurn = currentTurn === playerColor && !gameOver;
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const firedConfetti = useRef(false);
  const movesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    movesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [moveHistory.length]);

  useEffect(() => {
    if (gameOver?.reason === "checkmate" && !firedConfetti.current) {
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
  }, [gameOver]);

  const chess = useMemo(() => new Chess(fen), [fen]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !isMyTurn) return [];
    return chess.moves({ square: selectedSquare, verbose: true });
  }, [chess, selectedSquare, isMyTurn]);

  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};
    // Highlight last move
    if (lastMove) {
      styles[lastMove.from] = { backgroundColor: "oklch(0.78 0.12 75 / 20%)" };
      styles[lastMove.to] = { backgroundColor: "oklch(0.78 0.12 75 / 30%)" };
    }
    // Highlight king square in red when in check
    if (chess.inCheck()) {
      const turn = chess.turn(); // 'w' or 'b'
      const board = chess.board();
      for (let r = 0; r < 8; r++) {
        for (let c = 0; c < 8; c++) {
          const piece = board[r]![c];
          if (piece && piece.type === "k" && piece.color === turn) {
            const file = String.fromCharCode(97 + c);
            const rank = String(8 - r);
            const sq = `${file}${rank}`;
            styles[sq] = {
              backgroundColor: "oklch(0.55 0.2 25 / 50%)",
              boxShadow: "inset 0 0 12px oklch(0.55 0.2 25 / 40%)",
            };
          }
        }
      }
    }
    // Selected square and legal moves (override last move highlight)
    if (selectedSquare && isMyTurn) {
      styles[selectedSquare] = { backgroundColor: "oklch(0.78 0.12 75 / 35%)" };
      for (const move of legalMoves) {
        styles[move.to] = move.captured
          ? { background: "radial-gradient(transparent 55%, oklch(0.78 0.12 75 / 30%) 55%)" }
          : { background: "radial-gradient(oklch(0.78 0.12 75 / 30%) 22%, transparent 22%)" };
      }
    }
    return styles;
  }, [selectedSquare, legalMoves, isMyTurn, lastMove]);

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (!isMyTurn) return;
      const sq = square as Square;
      if (selectedSquare) {
        const move = legalMoves.find((m) => m.to === sq);
        if (move) {
          onMove(selectedSquare, sq, move.promotion);
          setSelectedSquare(null);
          return;
        }
      }
      const piece = chess.get(sq);
      const myColorChar = playerColor === "white" ? "w" : "b";
      if (piece && piece.color === myColorChar) {
        setSelectedSquare(sq);
      } else {
        setSelectedSquare(null);
      }
    },
    [isMyTurn, selectedSquare, legalMoves, chess, playerColor, onMove],
  );

  const handlePieceDrop = useCallback(
    ({ sourceSquare, targetSquare }: { sourceSquare: string; targetSquare: string | null }) => {
      if (!targetSquare || !isMyTurn) return false;
      const localChess = new Chess(fen);
      const result = localChess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!result) return false;
      onMove(sourceSquare, targetSquare, result.promotion || undefined);
      setSelectedSquare(null);
      return true;
    },
    [isMyTurn, fen, onMove],
  );

  const handlePieceClick = useCallback(
    ({ square }: { square: string | null }) => {
      if (!square) return;
      handleSquareClick({ square });
    },
    [handleSquareClick],
  );

  const moveCount = chess.moveNumber();

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center p-4 lg:flex-row lg:gap-6 lg:p-8">
      {/* Mobile top bar */}
      <div className="mb-3 flex w-full max-w-[min(90vw,560px)] items-center justify-between rounded-xl border border-border/50 bg-card/60 px-4 py-2.5 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2">
          <span className="text-lg select-none">{playerColor === "white" ? "♔" : "♚"}</span>
          <span className="text-sm font-medium capitalize text-foreground">{playerColor}</span>
        </div>
        <Badge
          variant={isMyTurn ? "default" : "secondary"}
          className={isMyTurn ? "" : "text-muted-foreground"}
        >
          {isMyTurn ? "Your turn" : "Waiting..."}
        </Badge>
      </div>

      {/* Board */}
      <div className="glow-amber w-full max-w-[min(90vw,560px)] overflow-hidden rounded-xl">
        <Chessboard
          options={{
            id: "game",
            position: fen,
            boardOrientation: playerColor,
            allowDragging: isMyTurn,
            squareStyles,
            darkSquareStyle: { backgroundColor: "#7A6652" },
            lightSquareStyle: { backgroundColor: "#C8B898" },
            onSquareClick: handleSquareClick,
            onPieceClick: handlePieceClick,
            onPieceDrop: handlePieceDrop,
          }}
        />
      </div>

      {/* Side panel */}
      <div className="mt-3 w-full max-w-[min(90vw,560px)] lg:mt-0 lg:w-72">
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm">
          {/* Desktop info */}
          <CardHeader className="hidden lg:block">
            <CardTitle className="flex items-center justify-between text-base">
              <div className="flex items-center gap-2">
                <span className="text-xl select-none">{playerColor === "white" ? "♔" : "♚"}</span>
                <span className="capitalize">{playerColor}</span>
              </div>
              <Badge
                variant={isMyTurn ? "default" : "secondary"}
                className={isMyTurn ? "" : "text-muted-foreground"}
              >
                {isMyTurn ? "Your turn" : "Waiting..."}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Turn indicator bar */}
            <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-background/30 px-3 py-2.5">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  isMyTurn
                    ? "bg-amber shadow-[0_0_8px_oklch(0.78_0.12_75)]"
                    : "bg-muted-foreground/40"
                }`}
              />
              <span className="text-sm text-muted-foreground">
                {currentTurn === "white" ? "White" : "Black"} to move
              </span>
            </div>

            {/* Move history */}
            <div className="rounded-lg border border-border/50 bg-background/30">
              <div className="flex items-center justify-between px-3 py-2 border-b border-border/50">
                <span className="text-xs font-medium text-muted-foreground">Moves</span>
                <span className="text-xs text-muted-foreground font-mono">{moveCount}</span>
              </div>
              <div className="max-h-48 overflow-y-auto p-2 lg:max-h-64">
                {moveHistory.length === 0 ? (
                  <p className="py-3 text-center text-xs text-muted-foreground/60">No moves yet</p>
                ) : (
                  <div className="grid grid-cols-[auto_1fr_1fr] gap-x-2 gap-y-0.5">
                    {Array.from({ length: Math.ceil(moveHistory.length / 2) }, (_, i) => {
                      const moveNum = i + 1;
                      const white = moveHistory[i * 2];
                      const black = moveHistory[i * 2 + 1];
                      const isLatest = i * 2 + 1 >= moveHistory.length - 1;
                      return (
                        <div key={moveNum} className="contents">
                          <span className="text-xs text-muted-foreground/50 font-mono pr-1 text-right">{moveNum}.</span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isLatest && !black ? "bg-amber/10 text-foreground" : "text-muted-foreground"}`}>
                            {white}
                          </span>
                          <span className={`text-xs font-mono px-1.5 py-0.5 rounded ${isLatest && black ? "bg-amber/10 text-foreground" : "text-muted-foreground"}`}>
                            {black ?? ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
                <div ref={movesEndRef} />
              </div>
            </div>

            {/* Takeback request banner */}
            {takebackRequest && !gameOver && (
              <div className="rounded-lg border border-amber/30 bg-amber-muted p-3">
                <p className="text-sm font-medium text-foreground text-center mb-2">Opponent requests a takeback</p>
                <div className="flex gap-2">
                  <Button
                    variant="secondary"
                    className="h-9 flex-1"
                    onClick={() => onRespondTakeback(true)}
                  >
                    Accept
                  </Button>
                  <Button
                    variant="ghost"
                    className="h-9 flex-1"
                    onClick={() => onRespondTakeback(false)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}

            {gameOver ? (
              <div className="space-y-3">
                <div className="rounded-lg border border-amber/20 bg-amber-muted p-4 text-center">
                  <p className="text-lg font-semibold text-foreground">Game Over</p>
                  <p className="mt-1 text-sm capitalize text-muted-foreground">{gameOver.reason}</p>
                </div>
                <Button onClick={onBackToLobby} className="h-11 w-full font-semibold" size="lg">
                  Back to Lobby
                </Button>
              </div>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="secondary"
                  onClick={onRequestTakeback}
                  className="h-10 flex-1"
                  size="lg"
                  disabled={moveHistory.length === 0}
                >
                  Undo
                </Button>
                <Button
                  variant="destructive"
                  onClick={onResign}
                  className="h-10 flex-1"
                  size="lg"
                >
                  Resign
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
