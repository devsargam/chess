"use client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Shell } from "./Shell";

interface WaitingProps {
  gameId: string;
  /** e.g. "3+2 · you play white" */
  subtitle: string;
  username: string;
  connected: boolean;
  onLogout: () => void;
  onBack: () => void;
}

export function Waiting({ gameId, subtitle, username, connected, onLogout, onBack }: WaitingProps) {
  const [copied, setCopied] = useState<"link" | "code" | null>(null);
  const inviteLink = typeof window === "undefined" ? "" : `${window.location.origin}/?join=${gameId}`;

  const copy = async (what: "link" | "code") => {
    const text = what === "link" ? inviteLink : gameId;
    // Phones get the native share sheet for the link
    if (what === "link" && navigator.share) {
      try {
        await navigator.share({ title: "Play with me", url: inviteLink });
        return;
      } catch {
        // dismissed or unsupported: fall back to copying
      }
    }
    await navigator.clipboard.writeText(text);
    setCopied(what);
    setTimeout(() => setCopied(null), 2000);
  };

  return (
    <Shell username={username} connected={connected} onLogout={onLogout}>
      <div className="text-center">
        <div className="animate-float mb-4 text-6xl text-amber select-none">♔</div>
        <h1 className="font-heading text-2xl font-semibold tracking-tight">Waiting for opponent</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {subtitle}
        </p>
      </div>

      <div className="mt-8 space-y-3">
        <Button onClick={() => copy("link")} className="glow-amber h-13 w-full text-base font-semibold" size="lg">
          {copied === "link" ? "Link copied!" : "Share invite link"}
        </Button>

        <button
          type="button"
          onClick={() => copy("code")}
          className="w-full rounded-lg border border-dashed border-border bg-card/60 p-3 text-left transition-colors hover:border-primary/50"
        >
          <span className="block text-xs text-muted-foreground">
            {copied === "code" ? "Code copied!" : "Or tap to copy the room code"}
          </span>
          <span className="mt-1 block font-mono text-xs break-all text-foreground/80">{gameId}</span>
        </button>

        <Button variant="ghost" className="h-11 w-full text-muted-foreground" onClick={onBack}>
          Back to lobby
        </Button>
      </div>
    </Shell>
  );
}
