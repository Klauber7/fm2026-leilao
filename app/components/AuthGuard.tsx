"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "./Navbar";

type AuthGuardProps = {
  children: ReactNode;
};

/*
  Essas páginas podem ser vistas SEM login
  e NUNCA mostram a barra lateral.
*/
const publicRoutes = [
  "/",
  "/login",
  "/reset-password",
];

function isPublicRoute(pathname: string) {
  return publicRoutes.some(
    (route) =>
      pathname === route ||
      pathname.startsWith(`${route}/`)
  );
}

export default function AuthGuard({
  children,
}: AuthGuardProps) {
  const pathname = usePathname();
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  const publicPage =
    isPublicRoute(pathname);

  const verifyAccess = useCallback(
    async () => {
      /*
        PÁGINAS PÚBLICAS

        Login, página inicial e reset de senha
        NÃO precisam carregar Navbar.
      */
      if (publicPage) {
        setAuthorized(false);
        setLoading(false);
        return;
      }

      setLoading(true);

      try {
        /*
          1. VERIFICA O USUÁRIO DE VERDADE
        */
        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (
          userError ||
          !user
        ) {
          setAuthorized(false);

          router.replace("/login");

          return;
        }

        /*
          2. VERIFICA SE ESSE USUÁRIO
          ESTÁ NA LISTA APROVADA
        */
        const {
          data: approval,
          error: approvalError,
        } = await supabase
          .from("user_approvals")
          .select("status")
          .eq(
            "user_id",
            user.id
          )
          .eq(
            "status",
            "approved"
          )
          .maybeSingle();

        /*
          Se não estiver aprovado,
          não entra no sistema.
        */
        if (
          approvalError ||
          !approval
        ) {
          if (approvalError) {
            console.error(
              "Erro ao verificar autorização:",
              approvalError
            );
          }

          setAuthorized(false);

          await supabase.auth.signOut();

          router.replace("/login");

          return;
        }

        /*
          3. USUÁRIO LOGADO
          + APROVADO
        */
        setAuthorized(true);
      } catch (error) {
        console.error(
          "Erro ao verificar acesso:",
          error
        );

        setAuthorized(false);

        await supabase.auth.signOut();

        router.replace("/login");
      } finally {
        setLoading(false);
      }
    },
    [
      publicPage,
      router,
    ]
  );

  useEffect(() => {
    let mounted = true;

    async function runCheck() {
      if (!mounted) {
        return;
      }

      await verifyAccess();
    }

    runCheck();

    /*
      Se fizer login/logout,
      verificamos novamente.
    */
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        async (
          event,
          session
        ) => {
          if (!mounted) {
            return;
          }

          /*
            LOGOUT
          */
          if (
            event ===
              "SIGNED_OUT" ||
            !session
          ) {
            setAuthorized(false);

            if (!publicPage) {
              router.replace(
                "/login"
              );
            }

            return;
          }

          /*
            LOGIN / REFRESH DA SESSÃO
          */
          if (
            event ===
              "SIGNED_IN" ||
            event ===
              "TOKEN_REFRESHED"
          ) {
            /*
              Na tela de login,
              o próprio LoginPage
              decide para onde mandar:
              dashboard/admin/etc.
            */
            if (
              pathname ===
                "/login" ||
              pathname === "/" ||
              pathname ===
                "/reset-password"
            ) {
              return;
            }

            await verifyAccess();
          }
        }
      );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [
    pathname,
    publicPage,
    router,
    verifyAccess,
  ]);

  /*
    PÁGINA PÚBLICA

    IMPORTANTE:
    Aqui NÃO carregamos Navbar.
  */
  if (publicPage) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        {children}
      </div>
    );
  }

  /*
    Enquanto verifica login +
    autorização, não mostra
    absolutamente nada do sistema.
  */
  if (loading) {
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

  /*
    NÃO AUTORIZADO

    Não renderiza Navbar.
    Não renderiza página.
    Não renderiza menu.
  */
  if (!authorized) {
    return null;
  }

  /*
    SOMENTE AQUI o usuário
    já está:

    ✓ logado
    ✓ autorizado
    ✓ aprovado

    Agora pode carregar Navbar
    e o conteúdo do sistema.
  */
  return (
    <>
      <Navbar />

      <div className="lg:pl-72">
        {children}
      </div>
    </>
  );
}