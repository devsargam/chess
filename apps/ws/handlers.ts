import { WebSocket } from "ws";
import { events } from "@repo/shared/events";

export const handleMessage = (ws: WebSocket, type: string, payload: unknown) => {
  switch (type) {
    case events.createRoom:
      console.log("Create Room:", payload);
      break;
    case events.joinRoom:
      console.log("Join Room:", payload);
      break;
    case events.move:
      console.log("Move:", payload);
      break;
    case events.resign:
      console.log("Resign:", payload);
      break;
    default:
      console.warn("Unknown event:", type);
  }
};
