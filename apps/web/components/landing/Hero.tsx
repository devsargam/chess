"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export function Hero() {
  const router = useRouter();

  return (
    <section className="relative flex min-h-[80vh] items-center justify-center overflow-hidden px-4">
      {/* Background glowing orb */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute top-1/2 left-1/2 h-[600px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[120px]" />
      </div>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="animate-float mb-8 inline-block">
          <span
            className="select-none text-8xl md:text-9xl"
            style={{
              filter: "drop-shadow(0 0 30px oklch(0.78 0.12 75 / 40%))",
            }}
          >
            ♔
          </span>
        </div>

        <h1 className="animate-in slide-in-from-bottom-4 fade-in duration-700 mb-6 text-5xl font-extrabold tracking-tight md:text-7xl">
          Master the <span className="text-primary">Board</span>
        </h1>

        <p className="animate-in slide-in-from-bottom-5 fade-in duration-700 delay-150 mb-10 text-xl text-muted-foreground md:text-2xl max-w-2xl mx-auto">
          Experience chess like never before. Real-time multiplayer, beautiful interface, and instant matchmaking.
        </p>

        <div className="animate-in slide-in-from-bottom-6 fade-in duration-700 delay-300 flex flex-col sm:flex-row items-center justify-center gap-4">
          <Button
            size="lg"
            onClick={() => router.push('/play')}
            className="h-14 px-8 text-lg font-medium glow-amber transition-all hover:scale-105"
          >
            Play Now
          </Button>
          <Button
            size="lg"
            variant="outline"
            onClick={() => router.push('/play')}
            className="h-14 px-8 text-lg font-medium transition-all hover:bg-primary/5 hover:text-primary"
          >
            Sign In
          </Button>
        </div>
      </div>
    </section>
  );
}
