"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  budget: number | null;
};

type TransferWindow = {
  id: number;
  season_number: number;
  window_number: number;
  name: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
  created_at: string;
};

type Installment = {
  id: number;
  payer_team_id: number;
  receiver_team_id: number;
  amount: number;
  status: string;
  due_season_number: number | null;
  due_transfer_window: number | null;
};

type Auction = {
  id: number;
  status: string;
  paused_remaining_seconds: number | null;
};

type CreditMode =
  | "equal"
  | "individual";

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

function formatRemainingTime(
  seconds: number | null | undefined
) {
  if (
    seconds === null ||
    seconds === undefined ||
    seconds <= 0
  ) {
    return "00:00:00";
  }

  const hours = String(
    Math.floor(seconds / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor(
      (seconds % 3600) / 60
    )
  ).padStart(2, "0");

  const secs = String(
    seconds % 60
  ).padStart(2, "0");

  return `${hours}:${minutes}:${secs}`;
}

export default function TransferWindowsAdminPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    isAdmin,
    setIsAdmin,
  ] =
    useState(false);

  const [
    processing,
    setProcessing,
  ] =
    useState(false);

  const [
    teams,
    setTeams,
  ] =
    useState<Team[]>([]);

  const [
    windows,
    setWindows,
  ] =
    useState<
      TransferWindow[]
    >([]);

  const [
    installments,
    setInstallments,
  ] =
    useState<
      Installment[]
    >([]);

  const [
    auctions,
    setAuctions,
  ] =
    useState<
      Auction[]
    >([]);

  const [
    creditMode,
    setCreditMode,
  ] =
    useState<CreditMode>(
      "equal"
    );

  const [
    creditAmount,
    setCreditAmount,
  ] =
    useState("");

  const [
    individualCredits,
    setIndividualCredits,
  ] =
    useState<
      Record<
        number,
        string
      >
    >({});

  /*
  ============================================================
  CARREGAR PÁGINA
  ============================================================
  */

  const loadPage =
    useCallback(async () => {
      setLoading(true);

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
        ADMIN
      */

      const {
        data:
          adminData,
        error:
          adminError,
      } =
        await supabase
          .from(
            "admin_users"
          )
          .select(
            "user_id"
          )
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        adminError ||
        !adminData
      ) {
        console.error(
          adminError
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      setIsAdmin(
        true
      );

      /*
        DADOS
      */

      const [
        teamsResult,
        windowsResult,
        installmentsResult,
        auctionsResult,
      ] =
        await Promise.all([
          supabase
            .from(
              "teams"
            )
            .select(`
              id,
              name,
              budget
            `)
            .order(
              "name",
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from(
              "transfer_windows"
            )
            .select(`
              id,
              season_number,
              window_number,
              name,
              status,
              opened_at,
              closed_at,
              created_at
            `)
            .order(
              "season_number",
              {
                ascending:
                  false,
              }
            )
            .order(
              "window_number",
              {
                ascending:
                  false,
              }
            ),

          supabase
            .from(
              "negotiation_installments"
            )
            .select(`
              id,
              payer_team_id,
              receiver_team_id,
              amount,
              status,
              due_season_number,
              due_transfer_window
            `)
            .eq(
              "status",
              "pending"
            ),

          supabase
            .from(
              "auctions"
            )
            .select(`
              id,
              status,
              paused_remaining_seconds
            `)
            .eq(
              "status",
              "active"
            ),
        ]);

      if (
        teamsResult.error
      ) {
        console.error(
          teamsResult.error
        );

        alert(
          "Erro ao carregar clubes."
        );

        setLoading(false);

        return;
      }

      if (
        windowsResult.error
      ) {
        console.error(
          windowsResult.error
        );

        alert(
          "Erro ao carregar janelas."
        );

        setLoading(false);

        return;
      }

      if (
        installmentsResult.error
      ) {
        console.error(
          installmentsResult.error
        );

        alert(
          "Erro ao carregar parcelas."
        );

        setLoading(false);

        return;
      }

      if (
        auctionsResult.error
      ) {
        console.error(
          auctionsResult.error
        );

        alert(
          "Erro ao carregar leilões."
        );

        setLoading(false);

        return;
      }

      const loadedTeams =
        (teamsResult.data ||
          []) as Team[];

      setTeams(
        loadedTeams
      );

      setWindows(
        (
          windowsResult.data ||
          []
        ).map(
          (
            item: any
          ) => ({
            ...item,
            season_number:
              Number(
                item.season_number
              ),
            window_number:
              Number(
                item.window_number
              ),
          })
        )
      );

      setInstallments(
        (
          installmentsResult.data ||
          []
        ).map(
          (
            item: any
          ) => ({
            ...item,

            amount:
              Number(
                item.amount ||
                  0
              ),

            due_season_number:
              item.due_season_number ===
              null
                ? null
                : Number(
                    item.due_season_number
                  ),

            due_transfer_window:
              item.due_transfer_window ===
              null
                ? null
                : Number(
                    item.due_transfer_window
                  ),
          })
        )
      );

      setAuctions(
        (
          auctionsResult.data ||
          []
        ).map(
          (
            item: any
          ) => ({
            id:
              Number(
                item.id
              ),

            status:
              item.status,

            paused_remaining_seconds:
              item.paused_remaining_seconds ===
              null
                ? null
                : Number(
                    item.paused_remaining_seconds
                  ),
          })
        )
      );

      setIndividualCredits(
        (
          current
        ) => {
          const next:
            Record<
              number,
              string
            > =
            {};

          loadedTeams.forEach(
            (
              team
            ) => {
              next[
                team.id
              ] =
                current[
                  team.id
                ] ||
                "";
            }
          );

          return next;
        }
      );

      setLoading(
        false
      );
    }, [router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  /*
  ============================================================
  REALTIME
  ============================================================
  */

  useEffect(() => {
    if (
      !isAdmin
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          "admin-transfer-windows-season"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "transfer_windows",
          },
          loadPage
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
          loadPage
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auctions",
          },
          loadPage
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    isAdmin,
    loadPage,
  ]);

  /*
  ============================================================
  JANELA ATUAL
  ============================================================
  */

  const currentWindow =
    useMemo(() => {
      return (
        windows.find(
          (
            item
          ) =>
            item.status ===
            "open"
        ) ||
        null
      );
    }, [
      windows,
    ]);

  /*
  ============================================================
  ÚLTIMA JANELA CRIADA
  ============================================================
  */

  const lastWindow =
    useMemo(() => {
      if (
        windows.length ===
        0
      ) {
        return null;
      }

      return [
        ...windows,
      ].sort(
        (
          a,
          b
        ) => {
          if (
            a.season_number !==
            b.season_number
          ) {
            return (
              b.season_number -
              a.season_number
            );
          }

          return (
            b.window_number -
            a.window_number
          );
        }
      )[0];
    }, [
      windows,
    ]);

  /*
  ============================================================
  PRÓXIMA TEMPORADA / JANELA
  ============================================================
  */

  const nextWindow =
    useMemo(() => {
      if (
        !lastWindow
      ) {
        return {
          season: 1,
          window: 1,
        };
      }

      if (
        lastWindow.window_number ===
        1
      ) {
        return {
          season:
            lastWindow.season_number,
          window: 2,
        };
      }

      return {
        season:
          lastWindow.season_number +
          1,
        window: 1,
      };
    }, [
      lastWindow,
    ]);

  const isFirstWindow =
    windows.length ===
    0;

  const canReopen =
    !currentWindow &&
    lastWindow?.status ===
      "closed";

  /*
  ============================================================
  LEILÕES
  ============================================================
  */

  const pausedAuctions =
    useMemo(() => {
      return auctions.filter(
        (
          auction
        ) =>
          auction.paused_remaining_seconds !==
          null
      );
    }, [
      auctions,
    ]);

  const runningAuctions =
    useMemo(() => {
      return auctions.filter(
        (
          auction
        ) =>
          auction.paused_remaining_seconds ===
          null
      );
    }, [
      auctions,
    ]);

  const shortestPausedTime =
    useMemo(() => {
      if (
        pausedAuctions.length ===
        0
      ) {
        return null;
      }

      return Math.min(
        ...pausedAuctions.map(
          (
            auction
          ) =>
            Number(
              auction.paused_remaining_seconds ||
                0
            )
        )
      );
    }, [
      pausedAuctions,
    ]);

  /*
  ============================================================
  PARCELAS QUE SERÃO DESCONTADAS
  NA PRÓXIMA JANELA
  ============================================================
  */

  const dueInstallments =
    useMemo(() => {
      return installments.filter(
        (
          item
        ) =>
          item.status ===
            "pending" &&
          item.due_season_number ===
            nextWindow.season &&
          item.due_transfer_window ===
            nextWindow.window
      );
    }, [
      installments,
      nextWindow,
    ]);

  const totalDue =
    useMemo(() => {
      return dueInstallments.reduce(
        (
          sum,
          item
        ) =>
          sum +
          Number(
            item.amount ||
              0
          ),
        0
      );
    }, [
      dueInstallments,
    ]);

  /*
  ============================================================
  CRÉDITOS
  ============================================================
  */

  const equalAmount =
    Number(
      creditAmount ||
        0
    );

  const totalEqualCredit =
    Number.isFinite(
      equalAmount
    ) &&
    equalAmount >
      0
      ? equalAmount *
        teams.length
      : 0;

  const totalIndividualCredit =
    useMemo(() => {
      return teams.reduce(
        (
          sum,
          team
        ) => {
          const value =
            Number(
              individualCredits[
                team.id
              ] ||
                0
            );

          if (
            !Number.isFinite(
              value
            ) ||
            value <=
              0
          ) {
            return sum;
          }

          return (
            sum +
            value
          );
        },
        0
      );
    }, [
      teams,
      individualCredits,
    ]);

  /*
  ============================================================
  FECHAR
  ============================================================
  */

  async function closeCurrentWindow() {
    if (
      !currentWindow
    ) {
      alert(
        "Não existe janela aberta."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `FECHAR TEMPORADA ${currentWindow.season_number} - JANELA ${currentWindow.window_number}?\n\n` +
          `${auctions.length} leilão(ões) ativo(s) serão pausados automaticamente.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessing(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_close_transfer_window"
        );

      if (error) {
        throw error;
      }

      alert(
        `Temporada ${data?.season_number ?? currentWindow.season_number} - Janela ${data?.window_number ?? currentWindow.window_number} fechada.\n\n` +
          `${Number(
            data?.paused_auctions ||
              0
          )} leilão(ões) pausado(s).`
      );

      await loadPage();
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      alert(
        error?.message ||
          "Erro ao fechar janela."
      );
    } finally {
      setProcessing(
        false
      );
    }
  }

  /*
  ============================================================
  REABRIR
  ============================================================
  */

  async function reopenLastWindow() {
    if (
      !lastWindow
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `REABRIR TEMPORADA ${lastWindow.season_number} - JANELA ${lastWindow.window_number}?\n\n` +
          `Não haverá novo crédito e nenhuma parcela será descontada novamente.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessing(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_reopen_transfer_window"
        );

      if (error) {
        throw error;
      }

      alert(
        `Temporada ${data?.season_number} - Janela ${data?.window_number} reaberta.\n\n` +
          `${Number(
            data?.resumed_auctions ||
              0
          )} leilão(ões) retomado(s).`
      );

      await loadPage();
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      alert(
        error?.message ||
          "Erro ao reabrir janela."
      );
    } finally {
      setProcessing(
        false
      );
    }
  }

  /*
  ============================================================
  MONTA CRÉDITOS
  ============================================================
  */

  function buildCredits() {
    const credits:
      Record<
        string,
        number
      > =
      {};

    if (
      isFirstWindow
    ) {
      return credits;
    }

    if (
      creditMode ===
      "equal"
    ) {
      if (
        !Number.isFinite(
          equalAmount
        ) ||
        equalAmount <=
          0
      ) {
        throw new Error(
          "Digite um valor válido."
        );
      }

      teams.forEach(
        (
          team
        ) => {
          credits[
            String(
              team.id
            )
          ] =
            equalAmount;
        }
      );

      return credits;
    }

    let hasCredit =
      false;

    teams.forEach(
      (
        team
      ) => {
        const value =
          Number(
            individualCredits[
              team.id
            ] ||
              0
          );

        if (
          Number.isFinite(
            value
          ) &&
          value >
            0
        ) {
          credits[
            String(
              team.id
            )
          ] =
            value;

          hasCredit =
            true;
        }
      }
    );

    if (
      !hasCredit
    ) {
      throw new Error(
        "Digite pelo menos um crédito individual."
      );
    }

    return credits;
  }

  /*
  ============================================================
  ABRIR PRÓXIMA
  ============================================================
  */

  async function openNextWindow() {
    let credits:
      Record<
        string,
        number
      >;

    try {
      credits =
        buildCredits();
    } catch (
      error: any
    ) {
      alert(
        error.message
      );

      return;
    }

    const totalCredit =
      Object.values(
        credits
      ).reduce(
        (
          sum,
          value
        ) =>
          sum +
          value,
        0
      );

    const confirmed =
      window.confirm(
        `ABRIR TEMPORADA ${nextWindow.season} - JANELA ${nextWindow.window}?\n\n` +
          `Créditos: ${money(
            totalCredit
          )}\n` +
          `Parcelas obrigatórias: ${money(
            totalDue
          )}\n\n` +
          `O crédito entra primeiro e as parcelas são descontadas imediatamente depois.`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setProcessing(
      true
    );

    try {
      const {
        data,
        error,
      } =
        await supabase.rpc(
          "admin_open_transfer_window",
          {
            p_credits:
              credits,
          }
        );

      if (error) {
        throw error;
      }

      alert(
        `TEMPORADA ${data?.season_number} - JANELA ${data?.window_number} ABERTA!\n\n` +
          `Créditos distribuídos: ${money(
            data?.total_credit ||
              0
          )}\n` +
          `Parcelas vencidas nesta janela foram descontadas automaticamente.`
      );

      setCreditAmount(
        ""
      );

      setIndividualCredits(
        {}
      );

      await loadPage();
    } catch (
      error: any
    ) {
      console.error(
        error
      );

      alert(
        error?.message ||
          "Erro ao abrir janela."
      );
    } finally {
      setProcessing(
        false
      );
    }
  }

  function updateIndividualCredit(
    teamId: number,
    value: string
  ) {
    setIndividualCredits(
      (
        current
      ) => ({
        ...current,

        [teamId]:
          value,
      })
    );
  }

  /*
  ============================================================
  LOADING
  ============================================================
  */

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando janelas...
        </p>
      </main>
    );
  }

  if (
    !isAdmin
  ) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            ← Administração
          </Link>

          <Link
            href="/admin/finance"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            💰 Finanças
          </Link>

          <Link
            href="/admin/installments"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            📆 Parcelas
          </Link>
        </div>

        <header className="mt-8">

          <p className="font-bold uppercase tracking-widest text-red-400">
            Área administrativa
          </p>

          <h1 className="mt-2 text-5xl font-black">
            Janelas de Transferências
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Cada temporada possui duas janelas. Abra, feche ou reabra o mercado, distribua créditos e acompanhe parcelas e leilões vinculados à janela.
          </p>

        </header>

        {/* STATUS */}

        <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Mercado atual
            </p>

            {currentWindow ? (
              <>
                <p className="mt-3 text-2xl font-black text-green-400">
                  Temporada{" "}
                  {
                    currentWindow.season_number
                  }
                </p>

                <p className="mt-1 text-xl font-black">
                  Janela{" "}
                  {
                    currentWindow.window_number
                  }
                </p>
              </>
            ) : (
              <p className="mt-3 text-3xl font-black text-red-400">
                FECHADO
              </p>
            )}

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Próxima abertura
            </p>

            <p className="mt-3 text-2xl font-black">
              Temporada{" "}
              {
                nextWindow.season
              }
            </p>

            <p className="mt-1 text-xl font-black text-yellow-400">
              Janela{" "}
              {
                nextWindow.window
              }
            </p>

          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Parcelas na próxima
            </p>

            <p className="mt-3 text-3xl font-black text-yellow-400">
              {money(
                totalDue
              )}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              {
                dueInstallments.length
              }{" "}
              parcela(s)
            </p>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Leilões
            </p>

            {currentWindow ? (
              <>
                <p className="mt-3 text-3xl font-black text-green-400">
                  {
                    runningAuctions.length
                  }
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  rodando
                </p>
              </>
            ) : (
              <>
                <p className="mt-3 text-3xl font-black text-red-400">
                  {
                    pausedAuctions.length
                  }
                </p>

                <p className="mt-2 text-sm text-zinc-500">
                  pausados
                </p>
              </>
            )}

          </div>

        </div>

        {/* PAUSADOS */}

        {!currentWindow &&
          pausedAuctions.length >
            0 && (
            <section className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-6">

              <p className="font-black text-yellow-400">
                ⏸️ LEILÕES PAUSADOS
              </p>

              <p className="mt-3 text-zinc-300">
                O tempo está congelado enquanto o mercado estiver fechado.
              </p>

              {shortestPausedTime !==
                null && (
                <p className="mt-3 text-sm text-zinc-400">
                  Menor tempo restante:{" "}
                  <span className="font-black text-yellow-400">
                    {formatRemainingTime(
                      shortestPausedTime
                    )}
                  </span>
                </p>
              )}

            </section>
          )}

        {/* FECHAR */}

        {currentWindow && (
          <section className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">

            <p className="font-black text-red-400">
              FECHAR MERCADO
            </p>

            <h2 className="mt-2 text-3xl font-black">
              Temporada{" "}
              {
                currentWindow.season_number
              }{" "}
              — Janela{" "}
              {
                currentWindow.window_number
              }
            </h2>

            <p className="mt-3 text-zinc-400">
              Os leilões ativos serão pausados e o tempo restante será preservado.
            </p>

            <button
              type="button"
              disabled={
                processing
              }
              onClick={
                closeCurrentWindow
              }
              className="mt-6 w-full rounded-xl bg-red-600 px-6 py-4 text-lg font-black hover:bg-red-500 disabled:bg-zinc-700"
            >
              {processing
                ? "PROCESSANDO..."
                : "FECHAR JANELA"}
            </button>

          </section>
        )}

        {/* REABRIR */}

        {canReopen &&
          lastWindow && (
            <section className="mt-8 rounded-2xl border border-blue-500/30 bg-blue-500/5 p-6">

              <p className="font-black text-blue-400">
                REABRIR MERCADO
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Temporada{" "}
                {
                  lastWindow.season_number
                }{" "}
                — Janela{" "}
                {
                  lastWindow.window_number
                }
              </h2>

              <p className="mt-3 text-zinc-400">
                Não distribui novo crédito e não desconta parcelas novamente.
              </p>

              <button
                type="button"
                disabled={
                  processing
                }
                onClick={
                  reopenLastWindow
                }
                className="mt-6 w-full rounded-xl bg-blue-600 px-6 py-4 text-lg font-black hover:bg-blue-500 disabled:bg-zinc-700"
              >
                {processing
                  ? "PROCESSANDO..."
                  : "REABRIR JANELA"}
              </button>

            </section>
          )}

        {/* PRÓXIMA */}

        {currentWindow && (
          <section className="mt-8 rounded-2xl border border-yellow-500/30 bg-yellow-500/10 p-5">
            <p className="font-black text-yellow-400">
              ⚠️ A janela atual ainda está aberta
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-300">
              Feche a Temporada {currentWindow.season_number} — Janela {currentWindow.window_number} antes de abrir a próxima janela.
            </p>
          </section>
        )}

        <section className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/5 p-6">

          <p className="font-black text-green-400">
            PRÓXIMA ABERTURA
          </p>

          <h2 className="mt-2 text-3xl font-black">
            Temporada{" "}
            {
              nextWindow.season
            }{" "}
            — Janela{" "}
            {
              nextWindow.window
            }
          </h2>

          {nextWindow.window ===
            1 &&
            !isFirstWindow && (
              <div className="mt-4 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4">

                <p className="font-black text-blue-400">
                  🏆 NOVA TEMPORADA
                </p>

                <p className="mt-2 text-sm text-zinc-300">
                  A próxima abertura inicia a Temporada{" "}
                  {
                    nextWindow.season
                  }{" "}
                  e volta para a Janela 1.
                </p>

              </div>
            )}

          {!isFirstWindow && (
            <>

              <div className="mt-7 grid gap-3 md:grid-cols-2">

                <button
                  type="button"
                  onClick={() =>
                    setCreditMode(
                      "equal"
                    )
                  }
                  className={`rounded-xl border p-5 text-left ${
                    creditMode ===
                    "equal"
                      ? "border-green-500 bg-green-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="font-black">
                    Mesmo valor para todos
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setCreditMode(
                      "individual"
                    )
                  }
                  className={`rounded-xl border p-5 text-left ${
                    creditMode ===
                    "individual"
                      ? "border-blue-500 bg-blue-500/10"
                      : "border-zinc-700 bg-zinc-950"
                  }`}
                >
                  <p className="font-black">
                    Valor individual
                  </p>
                </button>

              </div>

              {creditMode ===
                "equal" && (
                <div className="mt-6">

                  <label className="text-sm font-black">
                    Crédito por clube
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={
                      creditAmount
                    }
                    onChange={(
                      event
                    ) =>
                      setCreditAmount(
                        event.target.value
                      )
                    }
                    placeholder="Ex: 50000000"
                    className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-4 text-xl font-black outline-none focus:border-green-500"
                  />

                  <p className="mt-3 font-black text-green-400">
                    Total:{" "}
                    {money(
                      totalEqualCredit
                    )}
                  </p>

                </div>
              )}

              {creditMode ===
                "individual" && (
                <div className="mt-7 space-y-3">

                  {teams.map(
                    (
                      team
                    ) => (
                      <div
                        key={
                          team.id
                        }
                        className="grid gap-3 rounded-xl border border-zinc-800 bg-zinc-950 p-4 md:grid-cols-[1fr_220px] md:items-center"
                      >

                        <div>

                          <p className="font-black">
                            {
                              team.name
                            }
                          </p>

                          <p className="mt-1 text-sm text-zinc-500">
                            Saldo:{" "}
                            {money(
                              team.budget
                            )}
                          </p>

                        </div>

                        <input
                          type="number"
                          min="0"
                          value={
                            individualCredits[
                              team.id
                            ] ||
                            ""
                          }
                          onChange={(
                            event
                          ) =>
                            updateIndividualCredit(
                              team.id,
                              event.target.value
                            )
                          }
                          className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-black outline-none"
                          placeholder="0"
                        />

                      </div>
                    )
                  )}

                  <p className="font-black text-green-400">
                    Total:{" "}
                    {money(
                      totalIndividualCredit
                    )}
                  </p>

                </div>
              )}

            </>
          )}

          {/* REGRA */}

          <div className="mt-7 rounded-xl border border-yellow-500/20 bg-yellow-500/10 p-5">

            <p className="font-black text-yellow-400">
              Ordem automática
            </p>

            <p className="mt-3 leading-7 text-zinc-300">
              1. Crédito da nova janela entra.
              <br />
              2. A nova Temporada/Janela é aberta.
              <br />
              3. Parcelas que vencem exatamente nessa janela são descontadas.
              <br />
              4. O vendedor recebe automaticamente.
              <br />
              5. Leilões pausados são retomados quando necessário.
            </p>

          </div>

          <button
            type="button"
            disabled={
              processing ||
              Boolean(currentWindow)
            }
            onClick={
              openNextWindow
            }
            className="mt-6 w-full rounded-xl bg-green-600 px-6 py-5 text-xl font-black hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
          >
            {processing
              ? "PROCESSANDO..."
              : currentWindow
              ? "FECHE A JANELA ATUAL PRIMEIRO"
              : `ABRIR TEMPORADA ${nextWindow.season} — JANELA ${nextWindow.window}`}
          </button>

        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-3">
          <Link
            href="/admin/finance"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            💰 Financeiro
          </Link>

          <Link
            href="/admin/installments"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📆 Parcelas da liga
          </Link>

          <Link
            href="/admin/auctions"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🔨 Leilões
          </Link>
        </section>

        {/* HISTÓRICO */}

        <section className="mt-14">

          <h2 className="text-3xl font-black">
            Histórico
          </h2>

          <div className="mt-6 space-y-3">

            {windows.length === 0 && (
              <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-500">
                Nenhuma janela criada ainda.
              </div>
            )}

            {windows.map(
              (
                item
              ) => (
                <div
                  key={
                    item.id
                  }
                  className="rounded-xl border border-zinc-800 bg-zinc-900 p-5"
                >

                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                    <div>

                      <p className="text-xl font-black">
                        Temporada{" "}
                        {
                          item.season_number
                        }{" "}
                        — Janela{" "}
                        {
                          item.window_number
                        }
                      </p>

                      {item.opened_at && (
                        <p className="mt-2 text-sm text-zinc-500">
                          Aberta:{" "}
                          {new Date(
                            item.opened_at
                          ).toLocaleString(
                            "pt-BR"
                          )}
                        </p>
                      )}

                      {item.closed_at && (
                        <p className="mt-1 text-sm text-zinc-500">
                          Fechada:{" "}
                          {new Date(
                            item.closed_at
                          ).toLocaleString(
                            "pt-BR"
                          )}
                        </p>
                      )}

                    </div>

                    <span
                      className={`rounded-full px-4 py-2 text-sm font-black ${
                        item.status ===
                        "open"
                          ? "bg-green-500/15 text-green-400"
                          : "bg-red-500/15 text-red-400"
                      }`}
                    >
                      {item.status ===
                      "open"
                        ? "ABERTA"
                        : "FECHADA"}
                    </span>

                  </div>

                </div>
              )
            )}

          </div>

        </section>

      </div>

    </main>
  );
}