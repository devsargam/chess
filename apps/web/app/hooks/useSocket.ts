"use client";
import { useRef, useState, useCallback, useEffect } from "react";

const WS_URL =
  process.env.NODE_ENV === "production"
    ? "wss://ws.chess.sarg.am"
    : "ws://localhost:8080";

type MessageHandler = (type: string, payload: Record<string, unknown>) => void;

// Close codes the server uses when reconnecting won't help
const CLOSE_INVALID_TOKEN = 1008;
const CLOSE_REPLACED = 4000;

export function useSocket(
  token: string | null,
  onMessage: MessageHandler,
  onAuthError: () => void,
) {
  const wsRef = useRef<WebSocket | null>(null);
  const [connected, setConnected] = useState(false);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;
  const onAuthErrorRef = useRef(onAuthError);
  onAuthErrorRef.current = onAuthError;

  useEffect(() => {
    if (!token) return;

    let disposed = false;
    let attempt = 0;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      const ws = new WebSocket(`${WS_URL}?token=${token}`);
      wsRef.current = ws;

      ws.onopen = () => {
        attempt = 0;
        setConnected(true);
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (disposed) return;
        if (event.code === CLOSE_INVALID_TOKEN) return onAuthErrorRef.current();
        if (event.code === CLOSE_REPLACED) return;
        // Exponential backoff, capped at 10s
        const delay = Math.min(10_000, 500 * 2 ** attempt++);
        retryTimer = setTimeout(connect, delay);
      };

      ws.onmessage = (event) => {
        try {
          const { type, payload } = JSON.parse(event.data);
          onMessageRef.current(type, payload);
        } catch {
          console.error("Failed to parse message:", event.data);
        }
      };
    };

    // Reconnect right away when the tab comes back or the network returns
    const reconnectNow = () => {
      if (disposed || document.visibilityState !== "visible") return;
      const state = wsRef.current?.readyState;
      if (state === WebSocket.OPEN || state === WebSocket.CONNECTING) return;
      clearTimeout(retryTimer);
      attempt = 0;
      connect();
    };
    window.addEventListener("online", reconnectNow);
    document.addEventListener("visibilitychange", reconnectNow);

    connect();

    return () => {
      disposed = true;
      clearTimeout(retryTimer);
      window.removeEventListener("online", reconnectNow);
      document.removeEventListener("visibilitychange", reconnectNow);
      wsRef.current?.close();
      wsRef.current = null;
      setConnected(false);
    };
  }, [token]);

  const send = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type, payload }));
      }
    },
    [],
  );

  return { connected, send };
}
