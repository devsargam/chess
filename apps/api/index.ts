import { Elysia } from "elysia";
import { node } from "@elysiajs/node";
import * as schema from "@repo/shared/zod-schema";
import { signJwt } from "./lib/jwt";
import { authPlugin } from "./auth";

const app = new Elysia({ adapter: node() }).get("/", () => "Hello Elysia");

// Signup Route
app.post("/signup", (req) => {
  const { success, data } = schema.signup.safeParse(req.body);
  if (!success) {
    return { error: "Invalid input" };
  }

  const token = signJwt({ email: data.username });

  return {
    message: "User signed up successfully!",
    data: {
      token,
    },
  };
});

// Login Route
app.post("/login", (req) => {
  const { success, data } = schema.login.safeParse(req.body);
  if (!success) {
    return { error: "Invalid input" };
  }

  const token = signJwt({ email: data.username });

  return {
    message: "User logged in successfully!",
    data: {
      token,
    },
  };
});

// Protected Routes (auth plugin must be .use()'d before accessing its context)
app.use(authPlugin).get("/protected", ({ user }) => {
  return {
    message: "This is a protected route!",
    user: user,
  };
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
