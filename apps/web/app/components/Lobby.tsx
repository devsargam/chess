"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { TimeControl } from "./Game";

// [minutes, increment seconds]
const PRESETS: { name: string; controls: [number, number][] }[] = [
  { name: "Blitz", controls: [[3, 0], [3, 2], [5, 3]] },
  { name: "Rapid", controls: [[10, 0], [10, 5], [15, 10]] },
  { name: "Classical", controls: [[30, 0], [30, 20], [60, 30]] },
];

interface LobbyProps {
  username: string;
  connected: boolean;
  onCreateRoom: (timeControl: TimeControl) => void;
  onJoinRoom: (gameId: string) => void;
  onLogout: () => void;
}

export function Lobby({
  username,
  connected,
  onCreateRoom,
  onJoinRoom,
  onLogout,
}: LobbyProps) {
  const [joinId, setJoinId] = useState("");
  const [picked, setPicked] = useState<string>("10+0");
  const [customMinutes, setCustomMinutes] = useState("20");
  const [customIncrement, setCustomIncrement] = useState("5");

  const [minutes, increment] =
    picked === "custom"
      ? [Number(customMinutes), Number(customIncrement)]
      : picked.split("+").map(Number);
  const validTime =
    Number.isInteger(minutes) &&
    Number.isInteger(increment) &&
    minutes! >= 1 &&
    minutes! <= 180 &&
    increment! >= 0 &&
    increment! <= 60;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4">
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-1/4 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber/5 blur-[150px]" />
      </div>

      <div className="relative w-full max-w-sm">
        <Card className="glow-amber border-border/50 bg-card/80 backdrop-blur-sm">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-3 text-xl tracking-tight">
                <span className="text-2xl select-none" style={{ filter: "drop-shadow(0 0 12px oklch(0.78 0.12 75 / 30%))" }}>♛</span>
                Chess
              </CardTitle>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="max-w-28 truncate font-mono text-xs font-normal">
                  {username}
                </Badge>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={onLogout}
                  className="text-muted-foreground"
                >
                  Logout
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Connection status */}
            <div className="flex items-center justify-center gap-2 text-sm">
              <span
                className={`inline-block h-2 w-2 rounded-full ${
                  connected
                    ? "bg-emerald-400 shadow-[0_0_8px_oklch(0.7_0.15_155)]"
                    : "animate-pulse-amber bg-amber"
                }`}
              />
              <span className="text-muted-foreground">
                {connected ? "Connected" : "Connecting..."}
              </span>
            </div>

            {/* Time control */}
            <div className="space-y-2">
              {PRESETS.map((group) => (
                <div key={group.name} className="grid grid-cols-[5rem_1fr_1fr_1fr] items-center gap-2">
                  <span className="text-xs text-muted-foreground">{group.name}</span>
                  {group.controls.map(([m, inc]) => {
                    const key = `${m}+${inc}`;
                    return (
                      <Button
                        key={key}
                        variant={picked === key ? "default" : "secondary"}
                        size="sm"
                        className="font-mono"
                        onClick={() => setPicked(key)}
                      >
                        {key}
                      </Button>
                    );
                  })}
                </div>
              ))}
              <div className="grid grid-cols-[5rem_1fr] items-center gap-2">
                <span className="text-xs text-muted-foreground">Custom</span>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={180}
                    aria-label="Minutes per side"
                    value={customMinutes}
                    onFocus={() => setPicked("custom")}
                    onChange={(e) => setCustomMinutes(e.target.value)}
                    className={`h-8 w-16 font-mono text-sm ${picked === "custom" ? "border-primary" : ""}`}
                  />
                  <span className="text-xs text-muted-foreground">min +</span>
                  <Input
                    type="number"
                    min={0}
                    max={60}
                    aria-label="Increment in seconds"
                    value={customIncrement}
                    onFocus={() => setPicked("custom")}
                    onChange={(e) => setCustomIncrement(e.target.value)}
                    className={`h-8 w-16 font-mono text-sm ${picked === "custom" ? "border-primary" : ""}`}
                  />
                  <span className="text-xs text-muted-foreground">sec</span>
                </div>
              </div>
            </div>

            {/* Create room */}
            <Button
              onClick={() =>
                onCreateRoom({ initial: minutes! * 60_000, increment: increment! * 1000 })
              }
              disabled={!connected || !validTime}
              className="h-12 w-full text-sm font-semibold"
              size="lg"
            >
              <span className="mr-1.5 select-none">+</span>
              New Game
            </Button>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground uppercase tracking-widest">or join</span>
              <div className="h-px flex-1 bg-border" />
            </div>

            {/* Join room */}
            <div className="flex gap-2">
              <Input
                type="text"
                placeholder="Paste room code"
                value={joinId}
                onChange={(e) => setJoinId(e.target.value)}
                className="h-11 flex-1 bg-background/50 font-mono text-sm"
              />
              <Button
                onClick={() => joinId && onJoinRoom(joinId)}
                disabled={!connected || !joinId}
                variant="secondary"
                className="h-11 px-5"
                size="lg"
              >
                Join
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
