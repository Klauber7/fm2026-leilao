"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "./Navbar";

type AuthGuardProps = {
  children: ReactNode;
};

const publicRoutes = ["/", "/login"];

function isPublicRoute(pathname: string) {
  return publicRoutes.includes(pathname);
}

export default function AuthGuard({ children }: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);

  const publicPage = isPublicRoute(pathname);

  useEffect(() => {
    let active = true;

    async function verifySession() {
      const {
        data: { session },
        error,
      } = await supabase.auth.getSession();

      if (!active) {
        return;
      }

      if (error) {
        console.error("Erro ao verificar sessão:", error);
      }

      const hasSession = Boolean(session?.user);

      setAuthenticated(hasSession);

      if (!hasSession && !publicPage) {
        router.replace("/login");
        return;
      }

      if (hasSession && pathname === "/login") {
        router.replace("/dashboard");
        return;
      }

      setLoading(false);
    }

    verifySession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) {
        return;
      }

      const hasSession = Boolean(session?.user);

      setAuthenticated(hasSession);

      if (!hasSession && !publicPage) {
        router.replace("/login");
        return;
      }

      if (hasSession && pathname === "/login") {
        router.replace("/dashboard");
        return;
      }

      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [pathname, publicPage, router]);

  if (loading && !publicPage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-semibold text-zinc-400">
            Verificando sua conta...
          </p>
        </div>
      </main>
    );
  }

  if (!authenticated && !publicPage) {
    return null;
  }

  const showNavbar = authenticated && pathname !== "/login";

  return (
    <>
      {showNavbar && <Navbar />}

      <div className={showNavbar ? "lg:pl-72" : ""}>{children}</div>
    </>
  );
}