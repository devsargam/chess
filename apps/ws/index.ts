import { WebSocketServer } from "ws";
import { websocketMessage } from "@repo/shared/zod-schema";
import { events } from "@repo/shared/events";
import { JWT_SECRET } from "@repo/shared/constants";
import jwt from "jsonwebtoken";

const wss = new WebSocketServer({ port: 8080 });

export const verifyJwt = (token: string) => {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
};

wss.on("connection", function connection(ws, req) {
  if (!req.url) return ws.close(1008, "Missing token");

  const token = new URL(`http://localhost:8080${req.url}`).searchParams.get(
    "token",
  );

  const user = token ? verifyJwt(token) : null;

  if (!user) {
    return ws.close(1008, "Invalid token");
  }

  console.log("New WebSocket connection established with user:", user);

  ws.on("error", console.error);

  ws.on("message", function message(raw) {
    const { data, success } = websocketMessage.safeParse(
      JSON.parse(raw.toString()),
    );

    if (!success) {
      console.error("Invalid message received:", raw.toString());
      return;
    }

    switch (data.type) {
      case events.createRoom:
        console.log("Create Room event received with payload:", data.payload);
        break;
      case events.joinRoom:
        console.log("Join Room event received with payload:", data.payload);
        break;
      case events.move:
        console.log("Move event received with payload:", data.payload);
        break;
      case events.resign:
        console.log("Resign event received with payload:", data.payload);
        break;
      default:
        console.warn("Unknown event type received:", data.type);
    }
  });

  ws.send("something");
});

console.log("WebSocket server is running on ws://localhost:8080");
