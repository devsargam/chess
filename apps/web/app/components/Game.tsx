"use client";
import { useState, useMemo, useCallback } from "react";
import { Chess, type Square } from "chess.js";
import { Chessboard } from "react-chessboard";

interface GameProps {
  gameId: string;
  fen: string;
  playerColor: "white" | "black";
  currentTurn: "white" | "black";
  gameOver: { winner: string | null; reason: string } | null;
  onMove: (from: string, to: string, promotion?: string) => void;
  onResign: () => void;
  onBackToLobby: () => void;
}

export function Game({
  gameId,
  fen,
  playerColor,
  currentTurn,
  gameOver,
  onMove,
  onResign,
  onBackToLobby,
}: GameProps) {
  const isMyTurn = currentTurn === playerColor && !gameOver;
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  // Client-side chess instance to compute legal moves
  const chess = useMemo(() => new Chess(fen), [fen]);

  const legalMoves = useMemo(() => {
    if (!selectedSquare || !isMyTurn) return [];
    return chess.moves({ square: selectedSquare, verbose: true });
  }, [chess, selectedSquare, isMyTurn]);

  // Build highlight styles for selected square + legal move targets
  const squareStyles = useMemo(() => {
    const styles: Record<string, React.CSSProperties> = {};

    if (selectedSquare && isMyTurn) {
      styles[selectedSquare] = {
        backgroundColor: "rgba(255, 255, 0, 0.4)",
      };

      for (const move of legalMoves) {
        if (move.captured) {
          // Capture: ring highlight
          styles[move.to] = {
            background:
              "radial-gradient(transparent 55%, rgba(0,0,0,0.3) 55%)",
          };
        } else {
          // Quiet move: dot
          styles[move.to] = {
            background:
              "radial-gradient(rgba(0,0,0,0.25) 22%, transparent 22%)",
          };
        }
      }
    }

    return styles;
  }, [selectedSquare, legalMoves, isMyTurn]);

  const handleSquareClick = useCallback(
    ({ square }: { square: string }) => {
      if (!isMyTurn) return;
      const sq = square as Square;

      // If a piece is selected and this square is a legal target, make the move
      if (selectedSquare) {
        const move = legalMoves.find((m) => m.to === sq);
        if (move) {
          onMove(selectedSquare, sq, move.promotion);
          setSelectedSquare(null);
          return;
        }
      }

      // Select this square if it has one of our pieces
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
    ({
      sourceSquare,
      targetSquare,
    }: {
      sourceSquare: string;
      targetSquare: string | null;
    }) => {
      if (!targetSquare || !isMyTurn) return false;

      // Validate via our local chess instance
      const localChess = new Chess(fen);
      const result = localChess.move({ from: sourceSquare, to: targetSquare, promotion: "q" });
      if (!result) return false;

      onMove(sourceSquare, targetSquare, result.promotion || undefined);
      setSelectedSquare(null);
      return true;
    },
    [isMyTurn, fen, onMove],
  );

  // Clear selection when fen changes (opponent moved)
  const handlePieceClick = useCallback(
    ({ square }: { square: string | null }) => {
      if (!square) return;
      handleSquareClick({ square });
    },
    [handleSquareClick],
  );

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-zinc-950 p-4 lg:flex-row lg:gap-8 lg:p-8">
      {/* Info bar — shown above board on mobile, hidden on desktop */}
      <div className="mb-3 flex w-full max-w-[min(90vw,560px)] items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-2 lg:hidden">
        <span className="text-sm font-medium text-white">{playerColor}</span>
        <span
          className={`text-sm font-medium ${currentTurn === playerColor ? "text-green-400" : "text-zinc-400"}`}
        >
          {isMyTurn ? "Your turn" : "Waiting..."}
        </span>
      </div>

      {/* Board — scales to viewport width on mobile */}
      <div className="w-full max-w-[min(90vw,560px)]">
        <Chessboard
          options={{
            id: "game",
            position: fen,
            boardOrientation: playerColor,
            allowDragging: isMyTurn,
            squareStyles,
            onSquareClick: handleSquareClick,
            onPieceClick: handlePieceClick,
            onPieceDrop: handlePieceDrop,
          }}
        />
      </div>

      {/* Side panel — below board on mobile, beside it on desktop */}
      <div className="mt-3 w-full max-w-[min(90vw,560px)] space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-4 sm:p-6 lg:mt-0 lg:w-64">
        {/* Full info — desktop only */}
        <div className="hidden space-y-2 text-sm text-zinc-400 lg:block">
          <h2 className="text-lg font-bold text-white">Game Info</h2>
          <p>
            Room:{" "}
            <span className="font-mono text-zinc-300">
              {gameId.slice(0, 8)}...
            </span>
          </p>
          <p>
            You play:{" "}
            <span className="font-medium text-white">{playerColor}</span>
          </p>
          <p>
            Turn:{" "}
            <span
              className={`font-medium ${currentTurn === playerColor ? "text-green-400" : "text-zinc-300"}`}
            >
              {currentTurn}
              {currentTurn === playerColor ? " (you)" : ""}
            </span>
          </p>
        </div>

        {gameOver ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-zinc-700 bg-zinc-800 p-3 text-center">
              <p className="text-lg font-bold text-white">Game Over</p>
              <p className="text-sm text-zinc-400">{gameOver.reason}</p>
            </div>
            <button
              onClick={onBackToLobby}
              className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white active:bg-blue-700 hover:bg-blue-700"
            >
              Back to Lobby
            </button>
          </div>
        ) : (
          <button
            onClick={onResign}
            className="w-full rounded-lg bg-red-600/20 py-3 font-medium text-red-400 active:bg-red-600/30 hover:bg-red-600/30"
          >
            Resign
          </button>
        )}
      </div>
    </div>
  );
}
