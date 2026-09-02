import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";
import AuthGuard from "./components/AuthGuard";

export const metadata: Metadata = {
  title: {
    default: "FriendZone League FM",
    template: "%s | FriendZone League FM",
  },
  description: "Construa seu elenco. Vença a liga. Faça história.",
};

type RootLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="pt-BR">
      <body className="min-h-screen bg-zinc-950 text-white antialiased">
        <AuthGuard>{children}</AuthGuard>
      </body>
    </html>
  );
}