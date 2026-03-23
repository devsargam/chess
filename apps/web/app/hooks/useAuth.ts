"use client";
import { useState, useCallback } from "react";

const API_URL =
  process.env.NODE_ENV === "production"
    ? "https://api.chess.sarg.am"
    : "http://localhost:4000";

export function useAuth() {
  const [token, setToken] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
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
  }, []);

  return { token, username, error, loading, authenticate, logout };
}
