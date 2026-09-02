"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
};

type Player = {
  id: number;
  name: string;
  position: string | null;
  ca: number | null;
};

type InstallmentRow = {
  id: number;

  negotiation_id: number;

  payer_team_id: number;
  receiver_team_id: number;

  installment_number: number;

  amount: number;

  status: string;

  due_transfer_window: number | null;

  paid_at: string | null;

  processed_at: string | null;

  failure_reason: string | null;

  created_at: string;

  payer_team: Team | null;

  receiver_team: Team | null;

  player: Player | null;
};

type TabType =
  | "pending"
  | "paid"
  | "all";

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

function dateTime(
  value: string | null | undefined
) {
  if (!value) {
    return "-";
  }

  return new Date(
    value
  ).toLocaleString(
    "pt-BR"
  );
}

export default function InstallmentsPage() {
  const router = useRouter();

  const [
    myTeam,
    setMyTeam,
  ] =
    useState<Team | null>(
      null
    );

  const [
    installments,
    setInstallments,
  ] = useState<
    InstallmentRow[]
  >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<TabType>(
      "pending"
    );

  /*
    CARREGAR PÁGINA
  */

  const loadPage =
    useCallback(async () => {
      try {
        setLoading(true);

        setErrorMessage(
          ""
        );

        /*
          USUÁRIO
        */

        const {
          data: {
            user,
          },
          error:
            authError,
        } =
          await supabase.auth.getUser();

        if (
          authError ||
          !user
        ) {
          router.replace(
            "/login"
          );

          return;
        }

        /*
          MEU CLUBE
        */

        const {
          data:
            teamData,
          error:
            teamError,
        } =
          await supabase
            .from(
              "teams"
            )
            .select(`
              id,
              name
            `)
            .eq(
              "manager_id",
              user.id
            )
            .maybeSingle();

        if (
          teamError
        ) {
          throw teamError;
        }

        if (
          !teamData
        ) {
          setMyTeam(
            null
          );

          setInstallments(
            []
          );

          return;
        }

        const loadedTeam =
          teamData as Team;

        setMyTeam(
          loadedTeam
        );

        /*
          PARCELAS EM QUE
          MEU CLUBE PARTICIPA
        */

        const {
          data:
            installmentsData,
          error:
            installmentsError,
        } =
          await supabase
            .from(
              "negotiation_installments"
            )
            .select(`
              id,
              negotiation_id,
              payer_team_id,
              receiver_team_id,
              installment_number,
              amount,
              status,
              due_transfer_window,
              paid_at,
              processed_at,
              failure_reason,
              created_at
            `)
            .or(
              `payer_team_id.eq.${loadedTeam.id},receiver_team_id.eq.${loadedTeam.id}`
            )
            .order(
              "created_at",
              {
                ascending:
                  false,
              }
            );

        if (
          installmentsError
        ) {
          throw installmentsError;
        }

        const rawRows =
          installmentsData ||
          [];

        /*
          BUSCA IDS
          DAS NEGOCIAÇÕES
        */

        const negotiationIds =
          Array.from(
            new Set(
              rawRows
                .map(
                  (
                    row: any
                  ) =>
                    Number(
                      row.negotiation_id
                    )
                )
                .filter(
                  Boolean
                )
            )
          );

        /*
          BUSCA NEGOCIAÇÕES
          PARA SABER O JOGADOR
        */

        let negotiationMap =
          new Map<
            number,
            number
          >();

        if (
          negotiationIds.length >
          0
        ) {
          const {
            data:
              negotiationsData,
            error:
              negotiationsError,
          } =
            await supabase
              .from(
                "negotiations"
              )
              .select(`
                id,
                player_id
              `)
              .in(
                "id",
                negotiationIds
              );

          if (
            negotiationsError
          ) {
            throw negotiationsError;
          }

          (
            negotiationsData ||
            []
          ).forEach(
            (
              negotiation: any
            ) => {
              negotiationMap.set(
                Number(
                  negotiation.id
                ),
                Number(
                  negotiation.player_id
                )
              );
            }
          );
        }

        /*
          IDS DE CLUBES
        */

        const teamIds =
          Array.from(
            new Set(
              rawRows.flatMap(
                (
                  row: any
                ) => [
                  Number(
                    row.payer_team_id
                  ),
                  Number(
                    row.receiver_team_id
                  ),
                ]
              )
            )
          ).filter(
            Boolean
          );

        /*
          IDS DOS JOGADORES
        */

        const playerIds =
          Array.from(
            new Set(
              Array.from(
                negotiationMap.values()
              )
            )
          ).filter(
            Boolean
          );

        /*
          CLUBES
        */

        const teamMap =
          new Map<
            number,
            Team
          >();

        if (
          teamIds.length >
          0
        ) {
          const {
            data:
              teamsData,
            error:
              teamsError,
          } =
            await supabase
              .from(
                "teams"
              )
              .select(`
                id,
                name
              `)
              .in(
                "id",
                teamIds
              );

          if (
            teamsError
          ) {
            throw teamsError;
          }

          (
            teamsData ||
            []
          ).forEach(
            (
              team: any
            ) => {
              teamMap.set(
                Number(
                  team.id
                ),
                {
                  id:
                    Number(
                      team.id
                    ),

                  name:
                    team.name,
                }
              );
            }
          );
        }

        /*
          JOGADORES
        */

        const playerMap =
          new Map<
            number,
            Player
          >();

        if (
          playerIds.length >
          0
        ) {
          const {
            data:
              playersData,
            error:
              playersError,
          } =
            await supabase
              .from(
                "players"
              )
              .select(`
                id,
                name,
                position,
                ca
              `)
              .in(
                "id",
                playerIds
              );

          if (
            playersError
          ) {
            throw playersError;
          }

          (
            playersData ||
            []
          ).forEach(
            (
              player: any
            ) => {
              playerMap.set(
                Number(
                  player.id
                ),
                {
                  id:
                    Number(
                      player.id
                    ),

                  name:
                    player.name,

                  position:
                    player.position,

                  ca:
                    player.ca,
                }
              );
            }
          );
        }

        /*
          HIDRATA TUDO
        */

        const hydrated:
          InstallmentRow[] =
          rawRows.map(
            (
              row: any
            ) => {
              const negotiationId =
                Number(
                  row.negotiation_id
                );

              const playerId =
                negotiationMap.get(
                  negotiationId
                );

              return {
                id:
                  Number(
                    row.id
                  ),

                negotiation_id:
                  negotiationId,

                payer_team_id:
                  Number(
                    row.payer_team_id
                  ),

                receiver_team_id:
                  Number(
                    row.receiver_team_id
                  ),

                installment_number:
                  Number(
                    row.installment_number
                  ),

                amount:
                  Number(
                    row.amount ||
                      0
                  ),

                status:
                  row.status ||
                  "pending",

                due_transfer_window:
                  row.due_transfer_window ===
                  null
                    ? null
                    : Number(
                        row.due_transfer_window
                      ),

                paid_at:
                  row.paid_at,

                processed_at:
                  row.processed_at,

                failure_reason:
                  row.failure_reason,

                created_at:
                  row.created_at,

                payer_team:
                  teamMap.get(
                    Number(
                      row.payer_team_id
                    )
                  ) ||
                  null,

                receiver_team:
                  teamMap.get(
                    Number(
                      row.receiver_team_id
                    )
                  ) ||
                  null,

                player:
                  playerId
                    ? playerMap.get(
                        playerId
                      ) ||
                      null
                    : null,
              };
            }
          );

        setInstallments(
          hydrated
        );
      } catch (
        error
      ) {
        console.error(
          "Erro ao carregar parcelas:",
          error
        );

        if (
          typeof error ===
            "object" &&
          error !== null &&
          "message" in
            error
        ) {
          setErrorMessage(
            String(
              (
                error as {
                  message:
                    unknown;
                }
              ).message
            )
          );
        } else {
          setErrorMessage(
            "Não foi possível carregar as parcelas."
          );
        }
      } finally {
        setLoading(false);
      }
    }, [router]);

  /*
    PRIMEIRO
    CARREGAMENTO
  */

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  /*
    TEMPO REAL
  */

  useEffect(() => {
    if (
      !myTeam?.id
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `installments-${myTeam.id}`
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "negotiation_installments",
          },
          () => {
            loadPage();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    myTeam?.id,
    loadPage,
  ]);

  /*
    MINHAS CONTAS
  */

  const toPay =
    useMemo(() => {
      if (
        !myTeam
      ) {
        return [];
      }

      return installments.filter(
        (
          installment
        ) =>
          installment.payer_team_id ===
          myTeam.id
      );
    }, [
      installments,
      myTeam,
    ]);

  const toReceive =
    useMemo(() => {
      if (
        !myTeam
      ) {
        return [];
      }

      return installments.filter(
        (
          installment
        ) =>
          installment.receiver_team_id ===
          myTeam.id
      );
    }, [
      installments,
      myTeam,
    ]);

  /*
    PENDENTES
  */

  const pendingToPay =
    useMemo(
      () =>
        toPay.filter(
          (
            installment
          ) =>
            installment.status ===
            "pending" ||
            installment.status ===
            "failed"
        ),
      [toPay]
    );

  const pendingToReceive =
    useMemo(
      () =>
        toReceive.filter(
          (
            installment
          ) =>
            installment.status ===
            "pending" ||
            installment.status ===
            "failed"
        ),
      [toReceive]
    );

  /*
    TOTAL PENDENTE
  */

  const totalToPay =
    useMemo(
      () =>
        pendingToPay.reduce(
          (
            total,
            installment
          ) =>
            total +
            Number(
              installment.amount ||
                0
            ),
          0
        ),
      [pendingToPay]
    );

  const totalToReceive =
    useMemo(
      () =>
        pendingToReceive.reduce(
          (
            total,
            installment
          ) =>
            total +
            Number(
              installment.amount ||
                0
            ),
          0
        ),
      [
        pendingToReceive,
      ]
    );

  /*
    JÁ PAGOU
  */

  const totalPaid =
    useMemo(
      () =>
        toPay
          .filter(
            (
              installment
            ) =>
              installment.status ===
              "paid"
          )
          .reduce(
            (
              total,
              installment
            ) =>
              total +
              Number(
                installment.amount ||
                  0
              ),
            0
          ),
      [toPay]
    );

  /*
    JÁ RECEBEU
  */

  const totalReceived =
    useMemo(
      () =>
        toReceive
          .filter(
            (
              installment
            ) =>
              installment.status ===
              "paid"
          )
          .reduce(
            (
              total,
              installment
            ) =>
              total +
              Number(
                installment.amount ||
                  0
              ),
            0
          ),
      [toReceive]
    );

  /*
    FILTRO
  */

  const filtered =
    useMemo(() => {
      if (
        activeTab ===
        "all"
      ) {
        return installments;
      }

      if (
        activeTab ===
        "paid"
      ) {
        return installments.filter(
          (
            installment
          ) =>
            installment.status ===
            "paid"
        );
      }

      return installments.filter(
        (
          installment
        ) =>
          installment.status ===
            "pending" ||
          installment.status ===
            "failed"
      );
    }, [
      installments,
      activeTab,
    ]);

  /*
    STATUS
  */

  function statusLabel(
    status: string
  ) {
    if (
      status ===
      "paid"
    ) {
      return "PAGA";
    }

    if (
      status ===
      "failed"
    ) {
      return "FALHOU";
    }

    return "PENDENTE";
  }

  function statusClass(
    status: string
  ) {
    if (
      status ===
      "paid"
    ) {
      return "border-green-500/30 bg-green-500/10 text-green-400";
    }

    if (
      status ===
      "failed"
    ) {
      return "border-red-500/30 bg-red-500/10 text-red-400";
    }

    return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
  }

  /*
    LOADING
  */

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">

        <div className="text-center">

          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-bold text-zinc-400">
            Carregando parcelas...
          </p>

        </div>

      </main>
    );
  }

  /*
    ERRO
  */

  if (
    errorMessage
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

        <div className="w-full max-w-lg rounded-2xl border border-red-500/30 bg-zinc-900 p-8 text-center">

          <h1 className="text-2xl font-black text-red-400">
            Erro ao carregar
          </h1>

          <p className="mt-3 text-zinc-400">
            {
              errorMessage
            }
          </p>

          <button
            type="button"
            onClick={
              loadPage
            }
            className="mt-6 rounded-xl bg-green-600 px-6 py-3 font-black hover:bg-green-500"
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

  if (
    !myTeam
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

          <h1 className="text-3xl font-black">
            Nenhum clube selecionado
          </h1>

          <Link
            href="/choose-team"
            className="mt-6 inline-block rounded-xl bg-green-600 px-6 py-3 font-black"
          >
            Escolher clube
          </Link>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        {/* CABEÇALHO */}

        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="font-black uppercase tracking-widest text-green-400">
              Mercado de Transferências
            </p>

            <h1 className="mt-2 text-5xl font-black">
              Parcelas
            </h1>

            <p className="mt-3 text-zinc-400">
              Controle financeiro das transferências do{" "}
              <span className="font-bold text-white">
                {
                  myTeam.name
                }
              </span>
              .
            </p>

          </div>

          <Link
            href="/transfers/negotiations"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-center font-black transition hover:bg-zinc-800"
          >
            ← Negociações
          </Link>

        </div>

        {/* RESUMO */}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          {/* PAGAR */}

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              A pagar
            </p>

            <p className="mt-3 text-3xl font-black text-red-400">
              {
                money(
                  totalToPay
                )
              }
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              {
                pendingToPay.length
              }{" "}
              parcela(s)
            </p>

          </div>

          {/* RECEBER */}

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              A receber
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              {
                money(
                  totalToReceive
                )
              }
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              {
                pendingToReceive.length
              }{" "}
              parcela(s)
            </p>

          </div>

          {/* JÁ PAGO */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Já pago
            </p>

            <p className="mt-3 text-3xl font-black">
              {
                money(
                  totalPaid
                )
              }
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Pelo seu clube
            </p>

          </div>

          {/* JÁ RECEBIDO */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Já recebido
            </p>

            <p className="mt-3 text-3xl font-black">
              {
                money(
                  totalReceived
                )
              }
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              De outros clubes
            </p>

          </div>

        </section>

        {/* EXPLICAÇÃO */}

        <section className="mt-8 rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">

          <p className="font-black text-blue-400">
            💳 Como funciona
          </p>

          <p className="mt-2 text-sm leading-7 text-zinc-300">
            A segunda parcela é cobrada automaticamente quando a janela indicada é aberta. Primeiro o clube recebe o crédito da nova janela e depois o sistema processa a parcela.
          </p>

        </section>

        {/* FILTROS */}

        <section className="mt-8">

          <div className="flex flex-wrap gap-3">

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "pending"
                )
              }
              className={`rounded-xl px-5 py-3 font-black transition ${
                activeTab ===
                "pending"
                  ? "bg-yellow-500 text-black"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              Pendentes
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "paid"
                )
              }
              className={`rounded-xl px-5 py-3 font-black transition ${
                activeTab ===
                "paid"
                  ? "bg-green-600 text-white"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              Pagas
            </button>

            <button
              type="button"
              onClick={() =>
                setActiveTab(
                  "all"
                )
              }
              className={`rounded-xl px-5 py-3 font-black transition ${
                activeTab ===
                "all"
                  ? "bg-blue-600 text-white"
                  : "border border-zinc-700 bg-zinc-900 text-zinc-300"
              }`}
            >
              Todas
            </button>

          </div>

        </section>

        {/* LISTA */}

        <section className="mt-8">

          <div className="mb-5 flex items-center justify-between">

            <h2 className="text-2xl font-black">
              Parcelas das transferências
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {
                filtered.length
              }{" "}
              resultado(s)
            </span>

          </div>

          {filtered.length ===
          0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

              <p className="text-4xl">
                💰
              </p>

              <h3 className="mt-4 text-xl font-black">
                Nenhuma parcela encontrada
              </h3>

              <p className="mt-2 text-zinc-500">
                Quando uma negociação em 2x for concluída, a segunda parcela aparecerá aqui.
              </p>

            </div>
          ) : (
            <div className="space-y-4">

              {filtered.map(
                (
                  installment
                ) => {
                  const isPaying =
                    installment.payer_team_id ===
                    myTeam.id;

                  return (
                    <article
                      key={
                        installment.id
                      }
                      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                    >

                      {/* HEADER */}

                      <div className="flex flex-col gap-3 border-b border-zinc-800 bg-zinc-950/60 px-6 py-4 sm:flex-row sm:items-center sm:justify-between">

                        <div className="flex flex-wrap items-center gap-3">

                          <span
                            className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                              installment.status
                            )}`}
                          >
                            {
                              statusLabel(
                                installment.status
                              )
                            }
                          </span>

                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              isPaying
                                ? "bg-red-500/10 text-red-400"
                                : "bg-green-500/10 text-green-400"
                            }`}
                          >
                            {isPaying
                              ? "A PAGAR"
                              : "A RECEBER"}
                          </span>

                          <span className="text-sm text-zinc-500">
                            Parcela{" "}
                            {
                              installment.installment_number
                            }
                          </span>

                        </div>

                        <p className="text-sm text-zinc-500">
                          Negociação #
                          {
                            installment.negotiation_id
                          }
                        </p>

                      </div>

                      {/* CONTEÚDO */}

                      <div className="grid gap-6 p-6 lg:grid-cols-[1fr_260px] lg:items-center">

                        <div>

                          {/* JOGADOR */}

                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            Transferência
                          </p>

                          <h3 className="mt-2 text-2xl font-black">
                            {installment.player?.name ||
                              `Negociação #${installment.negotiation_id}`}
                          </h3>

                          {installment.player && (
                            <p className="mt-2 text-sm text-zinc-500">
                              {installment.player.position ||
                                "Posição -"}

                              {installment.player.ca !==
                              null
                                ? ` • CA ${installment.player.ca}`
                                : ""}
                            </p>
                          )}

                          {/* CLUBES */}

                          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">

                            <span className="font-bold text-red-400">
                              {installment.payer_team?.name ||
                                `Clube ${installment.payer_team_id}`}
                            </span>

                            <span className="text-zinc-600">
                              →
                            </span>

                            <span className="font-bold text-green-400">
                              {installment.receiver_team?.name ||
                                `Clube ${installment.receiver_team_id}`}
                            </span>

                          </div>

                          {/* JANELA */}

                          <div className="mt-5 flex flex-wrap gap-3">

                            {installment.due_transfer_window !==
                              null && (
                              <div className="rounded-lg border border-blue-500/20 bg-blue-500/10 px-3 py-2 text-sm">

                                <span className="text-zinc-400">
                                  Vencimento:
                                </span>{" "}

                                <span className="font-black text-blue-400">
                                  Janela{" "}
                                  {
                                    installment.due_transfer_window
                                  }
                                </span>

                              </div>
                            )}

                            {installment.paid_at && (
                              <div className="rounded-lg border border-green-500/20 bg-green-500/10 px-3 py-2 text-sm">

                                <span className="text-zinc-400">
                                  Paga em:
                                </span>{" "}

                                <span className="font-bold text-green-400">
                                  {
                                    dateTime(
                                      installment.paid_at
                                    )
                                  }
                                </span>

                              </div>
                            )}

                          </div>

                          {/* FALHA */}

                          {installment.status ===
                            "failed" && (
                            <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4">

                              <p className="font-black text-red-400">
                                ⚠️ Pagamento não realizado
                              </p>

                              <p className="mt-1 text-sm text-red-200">
                                {installment.failure_reason ||
                                  "O processamento desta parcela falhou."}
                              </p>

                              {installment.processed_at && (
                                <p className="mt-2 text-xs text-red-300/70">
                                  Tentativa em{" "}
                                  {
                                    dateTime(
                                      installment.processed_at
                                    )
                                  }
                                </p>
                              )}

                            </div>
                          )}

                        </div>

                        {/* VALOR */}

                        <div
                          className={`rounded-2xl border p-5 ${
                            isPaying
                              ? "border-red-500/20 bg-red-500/5"
                              : "border-green-500/20 bg-green-500/5"
                          }`}
                        >

                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            Valor
                          </p>

                          <p
                            className={`mt-2 text-3xl font-black ${
                              isPaying
                                ? "text-red-400"
                                : "text-green-400"
                            }`}
                          >
                            {
                              money(
                                installment.amount
                              )
                            }
                          </p>

                          <p className="mt-3 text-sm text-zinc-500">
                            {isPaying
                              ? `Seu clube paga para ${installment.receiver_team?.name || "outro clube"}.`
                              : `Seu clube recebe de ${installment.payer_team?.name || "outro clube"}.`}
                          </p>

                        </div>

                      </div>

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  );
}