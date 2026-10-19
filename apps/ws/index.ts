import { WebSocketServer } from "ws";
import { websocketMessage } from "@repo/shared/zod-schema";
import { verifyJwt, extractToken } from "./auth";
import { handleMessage, connections, syncUser } from "./handlers";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  if (!req.url) return ws.close(1008, "Missing token");

  const token = extractToken(req.url);
  const decoded = token ? verifyJwt(token) : null;

  if (!decoded || typeof decoded === "string") return ws.close(1008, "Invalid token");

  const payload = decoded as Record<string, unknown>;
  const username = payload.email as string;
  if (!username) return ws.close(1008, "Invalid token payload");

  // Use username as id since the user store lives in the API process
  const user = { id: username, username };

  // Register this connection (a newer tab/reconnect replaces the old one)
  connections.get(user.id)?.close(4000, "Replaced by new connection");
  connections.set(user.id, ws);

  console.log("Connected:", user);

  // Resume whatever game this user was in before reloading/reconnecting
  syncUser(ws, user.id);

  let alive = true;
  ws.on("pong", () => (alive = true));
  const heartbeat = setInterval(() => {
    if (!alive) return ws.terminate();
    alive = false;
    ws.ping();
  }, 30_000);

  ws.on("error", console.error);

  ws.on("close", () => {
    clearInterval(heartbeat);
    // Only unregister if a newer connection hasn't already taken over
    if (connections.get(user.id) === ws) connections.delete(user.id);
    console.log("Disconnected:", user);
  });

  ws.on("message", (raw) => {
    let json: unknown;
    try {
      json = JSON.parse(raw.toString());
    } catch {
      console.error("Malformed message:", raw.toString());
      return;
    }
    const { data, success } = websocketMessage.safeParse(json);

    if (!success) {
      console.error("Invalid message:", raw.toString());
      return;
    }

    handleMessage(ws, user, data.type, data.payload);
  });
});

console.log("WebSocket server running on ws://localhost:8080");
