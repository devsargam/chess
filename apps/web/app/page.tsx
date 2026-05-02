import { Hero } from "@/components/landing/Hero";
import { FeatureCard } from "@/components/landing/FeatureCard";
import { Globe, Zap, Users } from "lucide-react";

export default function LandingPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <main className="flex-1">
        <Hero />
        
        <section className="container mx-auto px-4 py-24">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Why Play Here?
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Everything you need for the perfect game of chess.
            </p>
          </div>
          
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            <FeatureCard
              title="Real-time Action"
              description="Lightning-fast WebSocket connections ensure your moves are transmitted instantly."
              icon={<Zap className="h-6 w-6" />}
            />
            <FeatureCard
              title="Global Multiplayer"
              description="Play against friends or find opponents from around the world in our lobby."
              icon={<Globe className="h-6 w-6" />}
            />
            <FeatureCard
              title="Community Driven"
              description="Join a growing community of chess enthusiasts. Chat, play, and improve together."
              icon={<Users className="h-6 w-6" />}
            />
          </div>
        </section>
      </main>

      <footer className="border-t border-border/50 py-8 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} Chess. All rights reserved.</p>
      </footer>
    </div>
  );
}
