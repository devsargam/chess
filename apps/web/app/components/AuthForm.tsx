"use client";
import { useState } from "react";

interface AuthFormProps {
  onAuth: (
    mode: "login" | "signup",
    username: string,
    password: string,
  ) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function AuthForm({ onAuth, loading, error }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAuth(mode, username, password);
  };

  return (
    <div className="flex min-h-dvh items-center justify-center bg-zinc-950 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-4 rounded-xl border border-zinc-800 bg-zinc-900 p-6 sm:p-8"
      >
        <h1 className="text-center text-2xl font-bold text-white">
          {mode === "login" ? "Log In" : "Sign Up"}
        </h1>

        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-white placeholder-zinc-500 outline-none focus:border-blue-500"
          required
          minLength={2}
        />

        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-4 py-3 text-base text-white placeholder-zinc-500 outline-none focus:border-blue-500"
          required
          minLength={6}
        />

        {error && (
          <p className="text-center text-sm text-red-400">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white active:bg-blue-700 hover:bg-blue-700 disabled:opacity-50"
        >
          {loading ? "..." : mode === "login" ? "Log In" : "Sign Up"}
        </button>

        <p className="text-center text-sm text-zinc-400">
          {mode === "login" ? "No account? " : "Already have an account? "}
          <button
            type="button"
            onClick={() => setMode(mode === "login" ? "signup" : "login")}
            className="text-blue-400 hover:underline"
          >
            {mode === "login" ? "Sign Up" : "Log In"}
          </button>
        </p>
      </form>
    </div>
  );
}
