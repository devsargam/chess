import type { Metadata } from "next";
import "./globals.css";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { cn } from "@/lib/utils";

const geist = Geist({ subsets: ["latin"], variable: "--font-sans" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-mono" });
const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-serif" });

// Apply the saved design before first paint so there's no flash
const designScript = `try{var d=localStorage.getItem("chess_design");if(d){document.documentElement.dataset.design=d;if(d==="paper")document.documentElement.classList.remove("dark")}}catch(e){}`;

export const metadata: Metadata = {
  title: "Chess",
  description: "Play chess online",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-design="obsidian"
      suppressHydrationWarning
      className={cn("dark font-sans antialiased", geist.variable, geistMono.variable, fraunces.variable)}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: designScript }} />
      </head>
      <body className="min-h-dvh bg-background text-foreground">
        {children}
      </body>
    </html>
  );
}
