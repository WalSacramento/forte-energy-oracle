import type { Metadata } from "next";
import { Bebas_Neue, JetBrains_Mono, Space_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const bebasNeue = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-bebas",
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  display: "swap",
});

const spaceMono = Space_Mono({
  weight: ["400", "700"],
  subsets: ["latin"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "EAON — Energy Grid Terminal",
  description: "Energy-Aware Oracle Network P2P Trading Platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${bebasNeue.variable} ${jetbrainsMono.variable} ${spaceMono.variable} dark`}
    >
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
