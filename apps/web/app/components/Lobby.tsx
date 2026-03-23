"use client";
import { useState } from "react";

interface LobbyProps {
  username: string;
  connected: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (gameId: string) => void;
  onLogout: () => void;
}

export function Lobby({
  username,
  connected,
  onCreateRoom,
  onJoinRoom,
  onLogout,
}: LobbyProps) {
  const [joinId, setJoinId] = useState("");

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Chess</h1>
          <div className="flex items-center gap-3">
            <span className="max-w-24 truncate text-sm text-zinc-400">
              {username}
            </span>
            <button
              onClick={onLogout}
              className="text-sm text-zinc-500 active:text-zinc-300 hover:text-zinc-300"
            >
              Logout
            </button>
          </div>
        </div>

        <div
          className={`text-center text-sm ${connected ? "text-green-400" : "text-yellow-400"}`}
        >
          {connected ? "Connected" : "Connecting..."}
        </div>

        <button
          onClick={onCreateRoom}
          disabled={!connected}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white active:bg-blue-700 hover:bg-blue-700 disabled:opacity-50"
        >
          Create Room
        </button>

        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Room ID"
            value={joinId}
            onChange={(e) => setJoinId(e.target.value)}
            className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-white placeholder-zinc-500 outline-none focus:border-blue-500"
          />
          <button
            onClick={() => joinId && onJoinRoom(joinId)}
            disabled={!connected || !joinId}
            className="rounded-lg bg-zinc-700 px-5 py-3 font-medium text-white active:bg-zinc-600 hover:bg-zinc-600 disabled:opacity-50"
          >
            Join
          </button>
        </div>
      </div>
    </div>
  );
}
