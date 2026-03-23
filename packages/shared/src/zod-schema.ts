import * as z from "zod";

const signup = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

const login = z.object({
  username: z.string().min(2).max(100),
  password: z.string().min(6).max(100),
});

export { signup, login };
