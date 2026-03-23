import { WebSocketServer } from "ws";
import { websocketMessage } from "@repo/shared/zod-schema";
import { verifyJwt, extractToken } from "./auth";
import { handleMessage } from "./handlers";

const wss = new WebSocketServer({ port: 8080 });

wss.on("connection", (ws, req) => {
  if (!req.url) return ws.close(1008, "Missing token");

  const token = extractToken(req.url);
  const user = token ? verifyJwt(token) : null;

  if (!user) return ws.close(1008, "Invalid token");

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

    handleMessage(ws, data.type, data.payload);
  });
});

console.log("WebSocket server running on ws://localhost:8080");
