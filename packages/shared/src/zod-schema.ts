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
  payload: z.object().optional(),
});

export { signup, login, websocketMessage };
