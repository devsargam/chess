"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Shell } from "./Shell";

interface AuthFormProps {
  onAuth: (
    mode: "login" | "signup",
    username: string,
    password: string,
  ) => Promise<boolean>;
  loading: boolean;
  error: string | null;
}

export function AuthForm({ onAuth, loading, error }: AuthFormProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onAuth(mode, username, password);
  };

  return (
    <Shell>
      <div className="mb-8 text-center">
        {/* Mini board motif */}
        <div className="mx-auto mb-5 grid w-20 grid-cols-4 overflow-hidden rounded-md opacity-90 shadow-lg">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`aspect-square ${(Math.floor(i / 4) + i) % 2 ? "bg-primary/70" : "bg-primary/20"}`}
            />
          ))}
        </div>
        <h1 className="font-heading text-3xl font-semibold tracking-tight">
          {mode === "login" ? "Welcome back" : "Create your account"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {mode === "login"
            ? "Sign in to play with friends"
            : "Pick a username and you're in"}
        </p>
      </div>

      <Card className="glow-amber border-border/60 bg-card/80 backdrop-blur-sm">
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Username</span>
              <Input
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                autoCorrect="off"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="h-12 bg-background/50 text-base sm:text-sm"
                required
                minLength={2}
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-xs font-medium text-muted-foreground">Password</span>
              <Input
                type="password"
                autoComplete={mode === "login" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 bg-background/50 text-base sm:text-sm"
                required
                minLength={6}
              />
              {mode === "signup" && (
                <span className="text-xs text-muted-foreground">At least 6 characters</span>
              )}
            </label>

            {error && (
              <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <Button
              type="submit"
              disabled={loading}
              className="h-12 w-full text-base font-semibold"
              size="lg"
            >
              {loading ? (
                <span className="animate-pulse-amber">Connecting…</span>
              ) : mode === "login" ? (
                "Sign in"
              ) : (
                "Create account"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        {mode === "login" ? "New here? " : "Already have an account? "}
        <button
          type="button"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
          className="font-medium text-primary underline-offset-4 hover:underline"
        >
          {mode === "login" ? "Create an account" : "Sign in"}
        </button>
      </p>
    </Shell>
  );
}
