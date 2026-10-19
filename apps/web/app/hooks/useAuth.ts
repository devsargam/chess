"use client";
import { useState, useCallback, useEffect } from "react";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.chess.sarg.am"
    : "http://localhost:4000";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  // false until localStorage has been read, so we don't flash the login form
  const [ready, setReady] = useState(false);

  // Read after mount (not during render) to avoid an SSR hydration mismatch
  useEffect(() => {
    setToken(localStorage.getItem("chess_token"));
    setUsername(localStorage.getItem("chess_username"));
    setReady(true);
  }, []);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const authenticate = useCallback(
    async (
      mode: "login" | "signup",
      usernameInput: string,
      password: string,
    ) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch(`${API_URL}/${mode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: usernameInput, password }),
        });

        const json = await res.json();

        if (json.error) {
          setError(json.error);
          return false;
        }

        setToken(json.data.token);
        setUsername(usernameInput);
        localStorage.setItem("chess_token", json.data.token);
        localStorage.setItem("chess_username", usernameInput);
        return true;
      } catch {
        setError("Failed to connect to server");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUsername(null);
    localStorage.removeItem("chess_token");
    localStorage.removeItem("chess_username");
  }, []);

  return { token, username, ready, error, loading, authenticate, logout };
}
