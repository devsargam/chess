import { WebSocketServer } from "ws";
import { websocketMessage } from "@repo/shared/zod-schema";
import { userStore } from "@repo/db";
import { verifyJwt, extractToken } from "./auth";
import { handleMessage } from "./handlers";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  if (!req.url) return ws.close(1008, "Missing token");

  const token = extractToken(req.url);
  const decoded = token ? verifyJwt(token) : null;

  if (!decoded || typeof decoded === "string") return ws.close(1008, "Invalid token");

  const username = (decoded as Record<string, unknown>).email as string;
  const userRecord = username ? userStore.findByUsername(username) : undefined;

  if (!userRecord) return ws.close(1008, "User not found");

  const user = { id: userRecord.id, username: userRecord.username };

  console.log("Connected:", user);

  ws.on("error", console.error);

  ws.on("message", (raw) => {
    const { data, success } = websocketMessage.safeParse(
      JSON.parse(raw.toString()),
    );

    if (!success) {
      console.error("Invalid message:", raw.toString());
      return;
    }

    handleMessage(ws, user, data.type, data.payload);
  });
});

console.log("WebSocket server running on ws://localhost:8080");
