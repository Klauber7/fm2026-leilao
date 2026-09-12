"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "./Navbar";

type AuthGuardProps = {
  children: ReactNode;
};

/*
  PÁGINAS PÚBLICAS
  Não exigem login
  Não mostram Navbar
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

  const publicPage =
    isPublicRoute(pathname);

  const [loading, setLoading] =
    useState(true);

  const [authorized, setAuthorized] =
    useState(false);

  /*
    Guarda qual usuário já foi
    verificado e aprovado.

    Isso evita consultar o banco
    toda vez que muda de página.
  */
  const verifiedUserId =
    useRef<string | null>(null);

  /*
    VERIFICAÇÃO COMPLETA

    Essa função só será usada quando:
    - abrir o sistema pela primeira vez
    - fizer login
    - trocar de usuário

    NÃO será executada toda vez
    que navegar entre páginas.
  */
  async function verifyUser() {
    setLoading(true);

    try {
      /*
        1. VERIFICA O USUÁRIO
        DIRETAMENTE NO SUPABASE AUTH
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
        verifiedUserId.current =
          null;

        setAuthorized(false);
        setLoading(false);

        router.replace("/login");

        return;
      }

      /*
        Se esse usuário já foi
        aprovado nesta sessão,
        não consulta o banco novamente.
      */
      if (
        verifiedUserId.current ===
        user.id
      ) {
        setAuthorized(true);
        setLoading(false);
        return;
      }

      /*
        2. CONFERE SE O USUÁRIO
        ESTÁ APROVADO
      */
      const {
        data: approval,
        error: approvalError,
      } = await supabase
        .from("user_approvals")
        .select("status")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();

      if (approvalError) {
        console.error(
          "Erro ao verificar aprovação:",
          approvalError
        );

        /*
          IMPORTANTE:
          Erro temporário de banco/rede
          NÃO força logout imediatamente.

          Isso evita expulsar usuários
          por uma falha momentânea.
        */
        setAuthorized(false);
        setLoading(false);

        return;
      }

      /*
        Usuário existe,
        mas não está aprovado.
      */
      if (!approval) {
        verifiedUserId.current =
          null;

        setAuthorized(false);
        setLoading(false);

        await supabase.auth.signOut();

        router.replace("/login");

        return;
      }

      /*
        USUÁRIO APROVADO
      */
      verifiedUserId.current =
        user.id;

      setAuthorized(true);
      setLoading(false);
    } catch (error) {
      console.error(
        "Erro inesperado no AuthGuard:",
        error
      );

      /*
        NÃO damos signOut em erro
        temporário de conexão.

        Apenas bloqueamos a tela
        até nova tentativa/login.
      */
      setAuthorized(false);
      setLoading(false);
    }
  }

  /*
    VERIFICAÇÃO INICIAL
  */
  useEffect(() => {
    /*
      Página pública não precisa
      verificar autorização.
    */
    if (publicPage) {
      setLoading(false);
      return;
    }

    /*
      Se o usuário já passou
      pela verificação, NÃO repete
      quando muda de página.
    */
    if (
      verifiedUserId.current &&
      authorized
    ) {
      setLoading(false);
      return;
    }

    verifyUser();

    /*
      NÃO colocamos pathname aqui.

      Essa é uma das mudanças
      principais para impedir
      revalidação em cada página.
    */
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicPage]);

  /*
    ESCUTA LOGIN E LOGOUT

    Não fazemos verificação completa
    em TOKEN_REFRESHED.
  */
  useEffect(() => {
    const {
      data: { subscription },
    } =
      supabase.auth.onAuthStateChange(
        (event, session) => {
          /*
            LOGOUT
          */
          if (
            event === "SIGNED_OUT"
          ) {
            verifiedUserId.current =
              null;

            setAuthorized(false);

            if (!publicPage) {
              router.replace(
                "/login"
              );
            }

            return;
          }

          /*
            LOGIN

            Verifica autorização
            uma única vez.
          */
          if (
            event === "SIGNED_IN" &&
            session?.user
          ) {
            /*
              Se já verificamos
              este mesmo usuário,
              não fazemos nada.
            */
            if (
              verifiedUserId.current ===
              session.user.id
            ) {
              setAuthorized(true);
              setLoading(false);
              return;
            }

            /*
              Pequeno atraso para
              sair do callback do
              auth antes de consultar
              outras APIs.
            */
            window.setTimeout(
              () => {
                void verifyUser();
              },
              0
            );

            return;
          }

          /*
            TOKEN_REFRESHED

            IMPORTANTE:
            NÃO refaz consulta,
            NÃO mostra loading,
            NÃO redireciona.

            Apenas deixa a sessão
            continuar normalmente.
          */
          if (
            event ===
            "TOKEN_REFRESHED"
          ) {
            return;
          }
        }
      );

    return () => {
      subscription.unsubscribe();
    };

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    publicPage,
    router,
  ]);

  /*
    PÁGINA PÚBLICA
  */
  if (publicPage) {
    return (
      <div className="min-h-screen bg-zinc-950 text-white">
        {children}
      </div>
    );
  }

  /*
    SOMENTE NA PRIMEIRA VERIFICAÇÃO
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
  */
  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <p className="font-semibold text-zinc-400">
            Não foi possível verificar sua conta.
          </p>

          <button
            onClick={() => {
              void verifyUser();
            }}
            className="mt-4 rounded-lg bg-green-500 px-5 py-3 font-bold text-black hover:bg-green-400"
          >
            Tentar novamente
          </button>
        </div>
      </main>
    );
  }

  /*
    USUÁRIO:
    ✓ logado
    ✓ aprovado
    ✓ autorizado

    Agora navega livremente.
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