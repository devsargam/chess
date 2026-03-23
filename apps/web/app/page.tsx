"use client";
import { useState } from "react";
import { Chessboard } from "react-chessboard";

export default function Home() {
  const [position, setPosition] = useState(
    "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR",
  );

  return (
    <main className="flex min-h-screen flex-col items-center justify-between p-24">
      <h1 className="text-4xl font-bold">Welcome to Chess Game</h1>
      <p className="mt-4 text-lg">Create or join a game to start playing!</p>
      <Chessboard
        options={{
          id: "click-or-drag-to-move",
          position: position,
          onPieceDrop: ({ sourceSquare, targetSquare }) => {
            console.log("Piece dropped from", sourceSquare, "to", targetSquare);
            setPosition((prev) => {
              // Update the position based on the move (this is just a placeholder)
              // In a real application, you would validate the move and update the position accordingly

              return prev;
            });
            return true;
          },
          onSquareClick: ({ square, piece }) => {
            // Handle square click logic here
            console.log("Square clicked:", square, "Piece:", piece);
            return;
          },
        }}
      />
    </main>
  );
}
