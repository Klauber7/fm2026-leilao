"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_id: string | null;
  manager_name: string | null;
  logo_url: string | null;
  city: string | null;
  stadium: string | null;
};

type FeaturedPlayer = {
  id: number;
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  ca: number | null;
  value: number | null;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
};

function money(
  value: number | null | undefined
) {
  return Number(value || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }
  );
}

export default function DashboardPage() {
  const router = useRouter();

  const [team, setTeam] =
    useState<Team | null>(null);

  const [
    playerCount,
    setPlayerCount,
  ] = useState(0);

  const [
    staffCount,
    setStaffCount,
  ] = useState(0);

  const [
    featuredPlayer,
    setFeaturedPlayer,
  ] =
    useState<FeaturedPlayer | null>(
      null
    );

  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<TransferWindow | null>(
      null
    );

  const [
    receivedNegotiations,
    setReceivedNegotiations,
  ] = useState(0);

  const [
    sentNegotiations,
    setSentNegotiations,
  ] = useState(0);

  const [
    installmentsToPay,
    setInstallmentsToPay,
  ] = useState(0);

  const [
    installmentsToReceive,
    setInstallmentsToReceive,
  ] = useState(0);

  const [
    installmentsToPayCount,
    setInstallmentsToPayCount,
  ] = useState(0);

  const [
    installmentsToReceiveCount,
    setInstallmentsToReceiveCount,
  ] = useState(0);

  const [loading, setLoading] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
    CARREGA DASHBOARD
  */

  const loadDashboard =
    useCallback(async () => {
      try {
        setLoading(true);

        setErrorMessage("");

        /*
          USUÁRIO
        */

        const {
          data: { user },
          error: userError,
        } =
          await supabase.auth.getUser();

        if (userError) {
          throw userError;
        }

        if (!user) {
          router.replace(
            "/login"
          );

          return;
        }

        /*
          CLUBE DO PRESIDENTE
        */

        const {
          data: teamData,
          error: teamError,
        } =
          await supabase
            .from("teams")
            .select(`
              id,
              name,
              budget,
              manager_id,
              manager_name,
              logo_url,
              city,
              stadium
            `)
            .eq(
              "manager_id",
              user.id
            )
            .maybeSingle();

        if (teamError) {
          throw teamError;
        }

        /*
          SEM CLUBE
        */

        if (!teamData) {
          setTeam(null);

          setPlayerCount(0);

          setStaffCount(0);

          setFeaturedPlayer(
            null
          );

          setReceivedNegotiations(
            0
          );

          setSentNegotiations(
            0
          );

          setInstallmentsToPay(
            0
          );

          setInstallmentsToReceive(
            0
          );

          setInstallmentsToPayCount(
            0
          );

          setInstallmentsToReceiveCount(
            0
          );

          return;
        }

        const loadedTeam =
          teamData as Team;

        setTeam(
          loadedTeam
        );

        /*
          CARREGA TUDO
          EM PARALELO
        */

        const [
          playersResult,
          staffResult,
          featuredResult,
          windowResult,
          negotiationsResult,
          installmentsPayResult,
          installmentsReceiveResult,
        ] =
          await Promise.all([
            /*
              QUANTIDADE
              DE JOGADORES
            */

            supabase
              .from("players")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "team_id",
                loadedTeam.id
              ),

            /*
              QUANTIDADE
              DE STAFF
            */

            supabase
              .from("coaches")
              .select("id", {
                count: "exact",
                head: true,
              })
              .eq(
                "team_id",
                loadedTeam.id
              ),

            /*
              JOGADOR
              DE MAIOR CA
            */

            supabase
              .from("players")
              .select(`
                id,
                name,
                age,
                position,
                nationality,
                ca,
                value
              `)
              .eq(
                "team_id",
                loadedTeam.id
              )
              .not(
                "ca",
                "is",
                null
              )
              .order(
                "ca",
                {
                  ascending:
                    false,
                }
              )
              .order(
                "value",
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle(),

            /*
              JANELA ATUAL
            */

            supabase
              .from(
                "transfer_windows"
              )
              .select(`
                id,
                window_number,
                name,
                status
              `)
              .eq(
                "status",
                "open"
              )
              .order(
                "window_number",
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle(),

            /*
              NEGOCIAÇÕES
              DO CLUBE
            */

            supabase
              .from(
                "negotiations"
              )
              .select(`
                id,
                buyer_team_id,
                seller_team_id,
                created_by_team_id,
                status,
                created_at
              `)
              .or(
                `buyer_team_id.eq.${loadedTeam.id},seller_team_id.eq.${loadedTeam.id}`
              ),

            /*
              PARCELAS
              A PAGAR
            */

            supabase
              .from(
                "negotiation_installments"
              )
              .select(`
                id,
                amount,
                status
              `)
              .eq(
                "payer_team_id",
                loadedTeam.id
              )
              .eq(
                "status",
                "pending"
              ),

            /*
              PARCELAS
              A RECEBER
            */

            supabase
              .from(
                "negotiation_installments"
              )
              .select(`
                id,
                amount,
                status
              `)
              .eq(
                "receiver_team_id",
                loadedTeam.id
              )
              .eq(
                "status",
                "pending"
              ),
          ]);

        /*
          ERROS
        */

        if (
          playersResult.error
        ) {
          throw playersResult.error;
        }

        if (
          staffResult.error
        ) {
          throw staffResult.error;
        }

        if (
          featuredResult.error
        ) {
          throw featuredResult.error;
        }

        if (
          windowResult.error
        ) {
          throw windowResult.error;
        }

        if (
          negotiationsResult.error
        ) {
          throw negotiationsResult.error;
        }

        if (
          installmentsPayResult.error
        ) {
          throw installmentsPayResult.error;
        }

        if (
          installmentsReceiveResult.error
        ) {
          throw installmentsReceiveResult.error;
        }

        /*
          CONTADORES
        */

        setPlayerCount(
          playersResult.count ||
            0
        );

        setStaffCount(
          staffResult.count ||
            0
        );

        /*
          JOGADOR DESTAQUE
        */

        setFeaturedPlayer(
          featuredResult.data
            ? {
                id:
                  featuredResult
                    .data.id,

                name:
                  featuredResult
                    .data.name,

                age:
                  featuredResult
                    .data.age,

                position:
                  featuredResult
                    .data.position,

                nationality:
                  featuredResult
                    .data
                    .nationality,

                ca:
                  featuredResult
                    .data.ca,

                value:
                  featuredResult
                    .data.value,
              }
            : null
        );

        /*
          JANELA
        */

        setCurrentWindow(
          windowResult.data
            ? (windowResult.data as TransferWindow)
            : null
        );

        /*
          NEGOCIAÇÕES

          IMPORTANTE:
          só conta PENDING.

          COUNTERED já foi
          substituída por outra.
        */

        const negotiations =
          negotiationsResult.data ||
          [];

        const received =
          negotiations.filter(
            (
              negotiation
            ) =>
              negotiation.status ===
                "pending" &&
              negotiation.created_by_team_id !==
                loadedTeam.id
          );

        const sent =
          negotiations.filter(
            (
              negotiation
            ) =>
              negotiation.status ===
                "pending" &&
              negotiation.created_by_team_id ===
                loadedTeam.id
          );

        setReceivedNegotiations(
          received.length
        );

        setSentNegotiations(
          sent.length
        );

        /*
          PARCELAS
        */

        const payRows =
          installmentsPayResult.data ||
          [];

        const receiveRows =
          installmentsReceiveResult.data ||
          [];

        const totalPay =
          payRows.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.amount ||
                  0
              ),
            0
          );

        const totalReceive =
          receiveRows.reduce(
            (
              total,
              item
            ) =>
              total +
              Number(
                item.amount ||
                  0
              ),
            0
          );

        setInstallmentsToPay(
          totalPay
        );

        setInstallmentsToReceive(
          totalReceive
        );

        setInstallmentsToPayCount(
          payRows.length
        );

        setInstallmentsToReceiveCount(
          receiveRows.length
        );
      } catch (error) {
        console.error(
          "Erro ao carregar dashboard:",
          error
        );

        if (
          typeof error ===
            "object" &&
          error !== null &&
          "message" in error
        ) {
          setErrorMessage(
            String(
              (
                error as {
                  message: unknown;
                }
              ).message
            )
          );
        } else {
          setErrorMessage(
            "Não foi possível carregar as informações do dashboard."
          );
        }
      } finally {
        setLoading(false);
      }
    }, [router]);

  /*
    PRIMEIRO CARREGAMENTO
  */

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  /*
    TEMPO REAL
  */

  useEffect(() => {
    if (!team?.id) {
      return;
    }

    const channel =
      supabase
        .channel(
          `dashboard-${team.id}`
        )

        /*
          JOGADORES
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "players",
          },
          () => {
            loadDashboard();
          }
        )

        /*
          STAFF
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "coaches",
          },
          () => {
            loadDashboard();
          }
        )

        /*
          CLUBES / ORÇAMENTO
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "teams",
          },
          () => {
            loadDashboard();
          }
        )

        /*
          NEGOCIAÇÕES
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "negotiations",
          },
          () => {
            loadDashboard();
          }
        )

        /*
          PARCELAS
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "negotiation_installments",
          },
          () => {
            loadDashboard();
          }
        )

        /*
          JANELAS
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "transfer_windows",
          },
          () => {
            loadDashboard();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    team?.id,
    loadDashboard,
  ]);

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

        <div className="text-center">

          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-semibold text-zinc-400">
            Carregando dashboard...
          </p>

        </div>

      </main>
    );
  }

  /*
    ERRO
  */

  if (errorMessage) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

        <div className="w-full max-w-lg rounded-2xl border border-red-900 bg-zinc-900 p-8 text-center">

          <h1 className="text-2xl font-black text-red-400">
            Erro ao carregar
          </h1>

          <p className="mt-3 text-zinc-400">
            {errorMessage}
          </p>

          <button
            type="button"
            onClick={
              loadDashboard
            }
            className="mt-6 rounded-xl bg-green-600 px-6 py-3 font-bold transition hover:bg-green-500"
          >
            Tentar novamente
          </button>

        </div>

      </main>
    );
  }

  /*
    SEM CLUBE
  */

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">

          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-4xl">
            🏟️
          </div>

          <p className="mt-6 font-bold uppercase tracking-widest text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Você ainda não possui um clube
          </h1>

          <p className="mx-auto mt-4 max-w-lg text-zinc-400">
            Escolha um clube disponível para começar sua trajetória como manager.
          </p>

          <Link
            href="/choose-team"
            className="mt-8 inline-flex rounded-xl bg-green-600 px-8 py-4 font-black transition hover:bg-green-500"
          >
            Escolher clube
          </Link>

        </div>

      </main>
    );
  }

  /*
    DASHBOARD
  */

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white lg:px-10">

      <div className="mx-auto max-w-7xl">

        {/* CLUBE */}

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">

          <div className="flex flex-col gap-6 p-8 md:flex-row md:items-center md:justify-between">

            <div className="flex flex-col gap-5 sm:flex-row sm:items-center">

              {/* ESCUDO */}

              <div className="flex h-24 w-24 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-zinc-700 bg-zinc-950">

                {team.logo_url ? (
                  <img
                    src={
                      team.logo_url
                    }
                    alt={`Escudo do ${team.name}`}
                    className="h-full w-full object-contain p-2"
                  />
                ) : (
                  <span className="text-4xl">
                    ⚽
                  </span>
                )}

              </div>

              {/* DADOS */}

              <div>

                <p className="font-bold uppercase tracking-widest text-green-400">
                  Dashboard do Manager
                </p>

                <h1 className="mt-2 text-4xl font-black md:text-5xl">
                  {team.name}
                </h1>

                <p className="mt-2 text-zinc-400">
                  Manager:{" "}

                  <span className="font-semibold text-white">
                    {team.manager_name ||
                      "Não informado"}
                  </span>
                </p>

                {(team.city ||
                  team.stadium) && (
                  <p className="mt-1 text-sm text-zinc-500">
                    {[
                      team.city,
                      team.stadium,
                    ]
                      .filter(
                        Boolean
                      )
                      .join(
                        " • "
                      )}
                  </p>
                )}

              </div>

            </div>

            <Link
              href={`/teams/${team.id}`}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-6 py-3 text-center font-bold transition hover:border-green-500 hover:text-green-400"
            >
              Ver perfil do clube
            </Link>

          </div>

        </section>

        {/* NÚMEROS PRINCIPAIS */}

        <section className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">

          {/* ORÇAMENTO */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Orçamento disponível
            </p>

            <h2 className="mt-3 text-3xl font-black text-green-400">
              {money(
                team.budget
              )}
            </h2>

          </div>

          {/* JOGADORES */}

          <Link
            href="/squad"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-blue-500"
          >

            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Jogadores
            </p>

            <h2 className="mt-3 text-4xl font-black">
              {playerCount}
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Atletas no elenco principal
            </p>

          </Link>

          {/* STAFF */}

          <Link
            href="/staff"
            className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 transition hover:border-purple-500"
          >

            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Comissão técnica
            </p>

            <h2 className="mt-3 text-4xl font-black">
              {staffCount}
            </h2>

            <p className="mt-2 text-sm text-zinc-500">
              Profissionais contratados
            </p>

          </Link>

        </section>

        {/* PAINEL DE NEGOCIAÇÕES */}

        <section className="mt-8">

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">

            <div>

              <p className="text-sm font-black uppercase tracking-widest text-green-400">
                Mercado de Transferências
              </p>

              <h2 className="mt-1 text-3xl font-black">
                Central de Negociações
              </h2>

            </div>

            <div>

              {currentWindow ? (
                <div className="inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">

                  <span className="h-2 w-2 rounded-full bg-green-400" />

                  <span className="text-sm font-black text-green-400">
                    MERCADO ABERTO
                  </span>

                  <span className="text-sm font-bold text-zinc-300">
                    • Janela{" "}
                    {
                      currentWindow.window_number
                    }
                  </span>

                </div>
              ) : (
                <div className="inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">

                  <span className="h-2 w-2 rounded-full bg-red-400" />

                  <span className="text-sm font-black text-red-400">
                    MERCADO FECHADO
                  </span>

                </div>
              )}

            </div>

          </div>

          {/* ALERTA PROPOSTAS */}

          {receivedNegotiations >
            0 && (
            <Link
              href="/transfers/negotiations"
              className="mt-5 block rounded-2xl border border-yellow-500/40 bg-yellow-500/10 p-6 transition hover:border-yellow-400 hover:bg-yellow-500/15"
            >

              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">

                <div className="flex items-center gap-4">

                  <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-yellow-500/15 text-2xl">
                    🔔
                  </div>

                  <div>

                    <p className="font-black text-yellow-400">
                      Você tem proposta aguardando resposta
                    </p>

                    <p className="mt-1 text-sm text-zinc-400">
                      {receivedNegotiations ===
                      1
                        ? "1 negociação precisa da sua decisão."
                        : `${receivedNegotiations} negociações precisam da sua decisão.`}
                    </p>

                  </div>

                </div>

                <span className="font-black text-yellow-400">
                  RESPONDER →
                </span>

              </div>

            </Link>
          )}

          {/* CARDS */}

          <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

            {/* RECEBIDAS */}

            <Link
              href="/transfers/negotiations"
              className={`rounded-2xl border p-5 transition ${
                receivedNegotiations >
                0
                  ? "border-yellow-500/40 bg-yellow-500/10 hover:border-yellow-400"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >

              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Aguardando você
              </p>

              <p
                className={`mt-3 text-4xl font-black ${
                  receivedNegotiations >
                  0
                    ? "text-yellow-400"
                    : "text-white"
                }`}
              >
                {
                  receivedNegotiations
                }
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Propostas recebidas
              </p>

            </Link>

            {/* ENVIADAS */}

            <Link
              href="/transfers/negotiations"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-blue-500"
            >

              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Aguardando rival
              </p>

              <p className="mt-3 text-4xl font-black text-blue-400">
                {
                  sentNegotiations
                }
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                Propostas enviadas
              </p>

            </Link>

            {/* A PAGAR */}

            <Link
              href="/transfers/installments"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-red-500"
            >

              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Parcelas a pagar
              </p>

              <p className="mt-3 text-2xl font-black text-red-400">
                {money(
                  installmentsToPay
                )}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                {
                  installmentsToPayCount
                }{" "}
                parcela(s) pendente(s)
              </p>

            </Link>

            {/* A RECEBER */}

            <Link
              href="/transfers/installments"
              className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5 transition hover:border-green-500"
            >

              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Parcelas a receber
              </p>

              <p className="mt-3 text-2xl font-black text-green-400">
                {money(
                  installmentsToReceive
                )}
              </p>

              <p className="mt-2 text-sm text-zinc-500">
                {
                  installmentsToReceiveCount
                }{" "}
                parcela(s) pendente(s)
              </p>

            </Link>

          </div>

          {/* BOTÕES */}

          <div className="mt-5 grid gap-3 sm:grid-cols-2">

            <Link
              href="/transfers/negotiations"
              className="rounded-xl bg-green-600 px-6 py-4 text-center font-black transition hover:bg-green-500"
            >
              Abrir negociações
            </Link>

            <Link
              href="/transfers/installments"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-4 text-center font-black transition hover:bg-zinc-800"
            >
              Ver parcelas
            </Link>

          </div>

        </section>

        {/* JOGADOR EM DESTAQUE */}

        <section className="mt-8">

          <div className="mb-5 flex items-center justify-between">

            <div>

              <p className="text-sm font-black uppercase tracking-widest text-yellow-400">
                ⭐ Jogador em destaque
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Melhor jogador do elenco
              </h2>

            </div>

            <Link
              href="/squad"
              className="text-sm font-bold text-zinc-400 transition hover:text-white"
            >
              Ver elenco →
            </Link>

          </div>

          {featuredPlayer ? (
            <Link
              href={`/players/${featuredPlayer.id}`}
              className="group block overflow-hidden rounded-3xl border border-yellow-500/30 bg-gradient-to-r from-yellow-500/10 via-zinc-900 to-zinc-900 transition hover:border-yellow-400"
            >

              <div className="grid gap-6 p-7 lg:grid-cols-[1fr_auto] lg:items-center">

                <div className="flex items-center gap-5">

                  <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl border border-yellow-500/30 bg-yellow-500/10">

                    <span className="text-4xl">
                      ⭐
                    </span>

                  </div>

                  <div>

                    <p className="text-sm font-bold uppercase tracking-widest text-yellow-400">
                      Maior CA do elenco
                    </p>

                    <h3 className="mt-1 text-3xl font-black transition group-hover:text-yellow-400 md:text-4xl">
                      {featuredPlayer.name}
                    </h3>

                    <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-400">

                      {featuredPlayer.position && (
                        <span>
                          {
                            featuredPlayer.position
                          }
                        </span>
                      )}

                      {featuredPlayer.age !==
                        null && (
                        <span>
                          {
                            featuredPlayer.age
                          }{" "}
                          anos
                        </span>
                      )}

                      {featuredPlayer.nationality && (
                        <span>
                          {
                            featuredPlayer.nationality
                          }
                        </span>
                      )}

                    </div>

                  </div>

                </div>

                <div className="grid grid-cols-2 gap-3 sm:min-w-[350px]">

                  <div className="rounded-2xl border border-yellow-500/20 bg-zinc-950/70 p-5 text-center">

                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      CA
                    </p>

                    <p className="mt-2 text-4xl font-black text-yellow-400">
                      {featuredPlayer.ca ??
                        "-"}
                    </p>

                  </div>

                  <div className="rounded-2xl border border-zinc-800 bg-zinc-950/70 p-5 text-center">

                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Valor
                    </p>

                    <p className="mt-2 text-xl font-black text-green-400">
                      {money(
                        featuredPlayer.value
                      )}
                    </p>

                  </div>

                </div>

              </div>

            </Link>
          ) : (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center">

              <p className="text-4xl">
                ⭐
              </p>

              <h3 className="mt-4 text-xl font-black">
                Nenhum jogador no elenco
              </h3>

              <p className="mt-2 text-zinc-500">
                Quando o clube tiver jogadores, o atleta com maior CA aparecerá aqui automaticamente.
              </p>

            </div>
          )}

        </section>

        {/* ACESSO RÁPIDO */}

        <section className="mt-8">

          <h2 className="text-2xl font-black">
            Acesso rápido
          </h2>

          <div className="mt-5 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">

            <Link
              href="/players"
              className="rounded-2xl border border-green-700 bg-green-600 p-7 transition hover:-translate-y-1 hover:bg-green-500"
            >

              <span className="text-3xl">
                🔎
              </span>

              <h3 className="mt-4 text-xl font-black">
                Mercado
              </h3>

              <p className="mt-2 text-sm text-green-100">
                Consulte jogadores disponíveis.
              </p>

            </Link>

            <Link
              href="/auctions"
              className="rounded-2xl border border-yellow-600 bg-yellow-500 p-7 text-black transition hover:-translate-y-1 hover:bg-yellow-400"
            >

              <span className="text-3xl">
                🔨
              </span>

              <h3 className="mt-4 text-xl font-black">
                Leilões
              </h3>

              <p className="mt-2 text-sm text-yellow-950">
                Acompanhe e faça seus lances.
              </p>

            </Link>

            <Link
              href="/squad"
              className="rounded-2xl border border-blue-700 bg-blue-600 p-7 transition hover:-translate-y-1 hover:bg-blue-500"
            >

              <span className="text-3xl">
                👥
              </span>

              <h3 className="mt-4 text-xl font-black">
                Meu elenco
              </h3>

              <p className="mt-2 text-sm text-blue-100">
                Veja os jogadores do clube.
              </p>

            </Link>

            <Link
              href="/staff"
              className="rounded-2xl border border-purple-700 bg-purple-600 p-7 transition hover:-translate-y-1 hover:bg-purple-500"
            >

              <span className="text-3xl">
                📋
              </span>

              <h3 className="mt-4 text-xl font-black">
                Comissão técnica
              </h3>

              <p className="mt-2 text-sm text-purple-100">
                Gerencie os profissionais do clube.
              </p>

            </Link>

          </div>

        </section>

      </div>

    </main>
  );
}