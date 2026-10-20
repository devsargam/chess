import * as z from "zod";

const signup = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

const login = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

const websocketMessage = z.object({
  type: z.string(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

// Milliseconds: 1 to 180 minutes, 0 to 60 second increment
const timeControl = z.object({
  initial: z.number().int().min(60_000).max(180 * 60_000),
  increment: z.number().int().min(0).max(60_000),
});

export { signup, login, websocketMessage, timeControl };
