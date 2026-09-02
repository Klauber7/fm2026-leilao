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

type ExchangePlayer = {
  id: number;

  player_id: number;

  player_name: string | null;

  player_position: string | null;

  player_ca: number | null;

  from_team_id: number | null;

  from_team_name: string | null;

  to_team_id: number | null;

  to_team_name: string | null;
};

type InstallmentRow = {
  id: number;

  installment_number: number;

  amount: number;

  status: string;

  due_transfer_window: number | null;

  paid_at: string | null;

  processed_at: string | null;

  failure_reason: string | null;

  payer_team_id: number;

  payer_team_name: string | null;

  receiver_team_id: number;

  receiver_team_name: string | null;
};

type Negotiation = {
  id: number;

  player_id: number;

  player_name: string | null;

  player_position: string | null;

  player_ca: number | null;

  buyer_team_id: number;

  buyer_team_name: string | null;

  seller_team_id: number;

  seller_team_name: string | null;

  amount: number;

  payment_type: string | null;

  installments: number;

  installment_1: number;

  installment_2: number;

  status: string;

  parent_negotiation_id: number | null;

  created_by_team_id: number | null;

  created_by_team_name: string | null;

  created_at: string;

  updated_at: string | null;

  accepted_at: string | null;

  rejected_at: string | null;

  cancelled_at: string | null;

  transfer_completed_at: string | null;

  exchange_players: ExchangePlayer[];

  installment_rows: InstallmentRow[];
};

type FilterStatus =
  | "all"
  | "pending"
  | "accepted"
  | "rejected"
  | "countered"
  | "cancelled";

type CurrentWindow = {
  id: number;
  season_number: number;
  window_number: number;
  opened_at: string | null;
};

type DirectionUsage = {
  from_team_id: number;
  to_team_id: number;
  count: number;
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

export default function AdminTransfersPage() {
  const router =
    useRouter();

  const [
    negotiations,
    setNegotiations,
  ] = useState<
    Negotiation[]
  >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    statusFilter,
    setStatusFilter,
  ] =
    useState<FilterStatus>(
      "all"
    );

  const [
    selectedTeam,
    setSelectedTeam,
  ] =
    useState("");

  const [
    expandedNegotiation,
    setExpandedNegotiation,
  ] =
    useState<number | null>(
      null
    );


  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<CurrentWindow | null>(
      null
    );

  const [
    directionUsage,
    setDirectionUsage,
  ] =
    useState<DirectionUsage[]>(
      []
    );

  /*
    CARREGAR
  */

  const loadPage =
    useCallback(async () => {
      try {
        setLoading(true);

        setErrorMessage(
          ""
        );

        /*
          AUTH
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
          RPC ADMIN
        */

        const {
          data,
          error,
        } =
          await supabase.rpc(
            "admin_get_transfer_audit"
          );

        if (error) {
          throw error;
        }

        const rows =
          Array.isArray(
            data?.negotiations
          )
            ? data.negotiations
            : [];

        setNegotiations(
          rows.map(
            (
              row: any
            ) => ({
              ...row,

              id:
                Number(
                  row.id
                ),

              player_id:
                Number(
                  row.player_id
                ),

              buyer_team_id:
                Number(
                  row.buyer_team_id
                ),

              seller_team_id:
                Number(
                  row.seller_team_id
                ),

              created_by_team_id:
                row.created_by_team_id ===
                null
                  ? null
                  : Number(
                      row.created_by_team_id
                    ),

              amount:
                Number(
                  row.amount ||
                    0
                ),

              installments:
                Number(
                  row.installments ||
                    1
                ),

              installment_1:
                Number(
                  row.installment_1 ||
                    0
                ),

              installment_2:
                Number(
                  row.installment_2 ||
                    0
                ),

              exchange_players:
                Array.isArray(
                  row.exchange_players
                )
                  ? row.exchange_players
                  : [],

              installment_rows:
                Array.isArray(
                  row.installment_rows
                )
                  ? row.installment_rows
                  : [],
            })
          )
        );

        const {
          data: windowData,
          error: windowError,
        } = await supabase
          .from("transfer_windows")
          .select("id, season_number, window_number, opened_at")
          .eq("status", "open")
          .order("window_number", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (windowError) {
          console.error("Erro ao carregar janela atual:", windowError);
          setCurrentWindow(null);
          setDirectionUsage([]);
        } else {
          setCurrentWindow(
            windowData
              ? {
                  id: Number(windowData.id),
                  season_number: Number(windowData.season_number),
                  window_number: Number(windowData.window_number),
                  opened_at: windowData.opened_at || null,
                }
              : null
          );

          if (windowData?.opened_at) {
            const {
              data: historyRows,
              error: historyError,
            } = await supabase
              .from("transfer_history")
              .select(
                "negotiation_id, seller_team_id, buyer_team_id, completed_at"
              )
              .gte("completed_at", windowData.opened_at);

            if (historyError) {
              console.error(
                "Erro ao carregar uso do limite da janela:",
                historyError
              );
              setDirectionUsage([]);
            } else {
              const usageMap = new Map<string, DirectionUsage>();
              const history = historyRows || [];

              for (const row of history) {
                const fromTeamId = Number(row.seller_team_id);
                const toTeamId = Number(row.buyer_team_id);

                if (
                  !Number.isFinite(fromTeamId) ||
                  !Number.isFinite(toTeamId)
                ) {
                  continue;
                }

                const key = `${fromTeamId}-${toTeamId}`;
                const current = usageMap.get(key);

                usageMap.set(key, {
                  from_team_id: fromTeamId,
                  to_team_id: toTeamId,
                  count: (current?.count || 0) + 1,
                });
              }

              const negotiationIds = history
                .map((row: any) => row.negotiation_id)
                .filter(
                  (id: number | null): id is number =>
                    id !== null && id !== undefined
                );

              if (negotiationIds.length > 0) {
                const {
                  data: exchangeRows,
                  error: exchangeError,
                } = await supabase
                  .from("negotiation_players")
                  .select("negotiation_id, from_team_id, to_team_id")
                  .in("negotiation_id", negotiationIds);

                if (!exchangeError) {
                  for (const exchange of exchangeRows || []) {
                    if (
                      exchange.from_team_id === null ||
                      exchange.to_team_id === null
                    ) {
                      continue;
                    }

                    const fromTeamId = Number(exchange.from_team_id);
                    const toTeamId = Number(exchange.to_team_id);
                    const key = `${fromTeamId}-${toTeamId}`;
                    const current = usageMap.get(key);

                    usageMap.set(key, {
                      from_team_id: fromTeamId,
                      to_team_id: toTeamId,
                      count: (current?.count || 0) + 1,
                    });
                  }
                }
              }

              setDirectionUsage(Array.from(usageMap.values()));
            }
          } else {
            setDirectionUsage([]);
          }
        }

      } catch (
        error
      ) {
        console.error(
          "Erro auditoria:",
          error
        );

        if (
          typeof error ===
            "object" &&
          error !== null &&
          "message" in
            error
        ) {
          const message =
            String(
              (
                error as {
                  message:
                    unknown;
                }
              ).message
            );

          if (
            message.includes(
              "NOT_ADMIN"
            )
          ) {
            alert(
              "Você não possui acesso administrativo."
            );

            router.replace(
              "/dashboard"
            );

            return;
          }

          setErrorMessage(
            message
          );
        } else {
          setErrorMessage(
            "Não foi possível carregar as negociações."
          );
        }
      } finally {
        setLoading(false);
      }
    }, [router]);

  /*
    CARREGAMENTO
  */

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  /*
    TEMPO REAL
  */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "admin-transfer-audit"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "negotiations",
          },
          () => {
            loadPage();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "negotiation_players",
          },
          () => {
            loadPage();
          }
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

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "transfer_history",
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
  }, [loadPage]);

  /*
    CLUBES
  */

  const teams =
    useMemo(() => {
      const map =
        new Map<
          number,
          string
        >();

      negotiations.forEach(
        (
          negotiation
        ) => {
          if (
            negotiation.buyer_team_name
          ) {
            map.set(
              negotiation.buyer_team_id,
              negotiation.buyer_team_name
            );
          }

          if (
            negotiation.seller_team_name
          ) {
            map.set(
              negotiation.seller_team_id,
              negotiation.seller_team_name
            );
          }
        }
      );

      return Array.from(
        map.entries()
      )
        .map(
          ([
            id,
            name,
          ]) => ({
            id,
            name,
          })
        )
        .sort(
          (
            a,
            b
          ) =>
            a.name.localeCompare(
              b.name
            )
        );
    }, [negotiations]);

  /*
    CONTADORES
  */

  const pendingCount =
    useMemo(
      () =>
        negotiations.filter(
          (
            item
          ) =>
            item.status ===
            "pending"
        ).length,
      [negotiations]
    );

  const acceptedCount =
    useMemo(
      () =>
        negotiations.filter(
          (
            item
          ) =>
            item.status ===
            "accepted"
        ).length,
      [negotiations]
    );

  const counteredCount =
    useMemo(
      () =>
        negotiations.filter(
          (
            item
          ) =>
            item.status ===
            "countered"
        ).length,
      [negotiations]
    );

  const rejectedCount =
    useMemo(
      () =>
        negotiations.filter(
          (
            item
          ) =>
            item.status ===
            "rejected"
        ).length,
      [negotiations]
    );

  /*
    VALOR DE TRANSFERÊNCIAS
    ACEITAS
  */

  const totalAccepted =
    useMemo(
      () =>
        negotiations
          .filter(
            (
              item
            ) =>
              item.status ===
              "accepted"
          )
          .reduce(
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
          ),
      [negotiations]
    );

  /*
    PARCELAS
  */

  const allInstallments =
    useMemo(
      () =>
        negotiations.flatMap(
          (
            negotiation
          ) =>
            negotiation.installment_rows ||
            []
        ),
      [negotiations]
    );

  const pendingInstallments =
    useMemo(
      () =>
        allInstallments.filter(
          (
            installment
          ) =>
            installment.status ===
            "pending"
        ),
      [allInstallments]
    );

  const failedInstallments =
    useMemo(
      () =>
        allInstallments.filter(
          (
            installment
          ) =>
            installment.status ===
            "failed"
        ),
      [allInstallments]
    );

  const pendingInstallmentsValue =
    useMemo(
      () =>
        pendingInstallments.reduce(
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
        pendingInstallments,
      ]
    );

  /*
    FILTRAGEM
  */

  const filteredNegotiations =
    useMemo(() => {
      const cleanSearch =
        search
          .trim()
          .toLowerCase();

      return negotiations.filter(
        (
          negotiation
        ) => {
          const matchesStatus =
            statusFilter ===
              "all" ||
            negotiation.status ===
              statusFilter;

          const teamId =
            Number(
              selectedTeam
            );

          const matchesTeam =
            !selectedTeam ||
            negotiation.buyer_team_id ===
              teamId ||
            negotiation.seller_team_id ===
              teamId;

          const exchangeText =
            negotiation.exchange_players
              .map(
                (
                  player
                ) =>
                  player.player_name ||
                  ""
              )
              .join(
                " "
              )
              .toLowerCase();

          const matchesSearch =
            !cleanSearch ||
            (
              negotiation.player_name ||
              ""
            )
              .toLowerCase()
              .includes(
                cleanSearch
              ) ||
            (
              negotiation.buyer_team_name ||
              ""
            )
              .toLowerCase()
              .includes(
                cleanSearch
              ) ||
            (
              negotiation.seller_team_name ||
              ""
            )
              .toLowerCase()
              .includes(
                cleanSearch
              ) ||
            exchangeText.includes(
              cleanSearch
            ) ||
            String(
              negotiation.id
            ).includes(
              cleanSearch
            );

          return (
            matchesStatus &&
            matchesTeam &&
            matchesSearch
          );
        }
      );
    }, [
      negotiations,
      statusFilter,
      selectedTeam,
      search,
    ]);

  function getDirectionUsage(
    fromTeamId: number,
    toTeamId: number
  ) {
    return (
      directionUsage.find(
        (item) =>
          item.from_team_id === fromTeamId &&
          item.to_team_id === toTeamId
      )?.count || 0
    );
  }

  /*
    STATUS
  */

  function statusText(
    status: string
  ) {
    if (
      status ===
      "pending"
    ) {
      return "PENDENTE";
    }

    if (
      status ===
      "accepted"
    ) {
      return "ACEITA";
    }

    if (
      status ===
      "rejected"
    ) {
      return "RECUSADA";
    }

    if (
      status ===
      "countered"
    ) {
      return "CONTRAPROPOSTA";
    }

    if (
      status ===
      "cancelled"
    ) {
      return "CANCELADA";
    }

    return status.toUpperCase();
  }

  function statusClass(
    status: string
  ) {
    if (
      status ===
      "pending"
    ) {
      return "border-yellow-500/30 bg-yellow-500/10 text-yellow-400";
    }

    if (
      status ===
      "accepted"
    ) {
      return "border-green-500/30 bg-green-500/10 text-green-400";
    }

    if (
      status ===
      "rejected"
    ) {
      return "border-red-500/30 bg-red-500/10 text-red-400";
    }

    if (
      status ===
      "countered"
    ) {
      return "border-blue-500/30 bg-blue-500/10 text-blue-400";
    }

    return "border-zinc-700 bg-zinc-800 text-zinc-300";
  }

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">

        <div className="text-center">

          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-red-400" />

          <p className="mt-4 font-bold text-zinc-400">
            Carregando auditoria de transferências...
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

        <div className="w-full max-w-xl rounded-2xl border border-red-500/30 bg-zinc-900 p-8 text-center">

          <h1 className="text-3xl font-black text-red-400">
            Erro
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
            className="mt-6 rounded-xl bg-red-600 px-6 py-3 font-black hover:bg-red-500"
          >
            Tentar novamente
          </button>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        {/* TOPO */}

        <div className="flex flex-wrap gap-3">
          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            ← Administração
          </Link>

          <Link
            href="/admin/installments"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            📆 Parcelas
          </Link>

          <Link
            href="/bid"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
          >
            📢 BID
          </Link>
        </div>

        <header className="mt-8">
          <p className="font-black uppercase tracking-widest text-blue-400">
            Área Administrativa
          </p>

          <h1 className="mt-2 text-5xl font-black md:text-6xl">
            🔄 Transferências da Liga
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Auditoria completa das propostas, contrapropostas, trocas, transferências concluídas e parcelas da FriendZone League FM.
          </p>

          <div
            className={`mt-5 inline-flex rounded-full border px-4 py-2 text-sm font-black ${
              currentWindow
                ? "border-green-500/30 bg-green-500/10 text-green-400"
                : "border-red-500/30 bg-red-500/10 text-red-400"
            }`}
          >
            {currentWindow
              ? `🟢 Temporada ${currentWindow.season_number} — Janela ${currentWindow.window_number}`
              : "🔒 Nenhuma janela aberta"}
          </div>
        </header>

        {/* RESUMO */}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Pendentes
            </p>

            <p className="mt-3 text-4xl font-black text-yellow-400">
              {
                pendingCount
              }
            </p>

          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Aceitas
            </p>

            <p className="mt-3 text-4xl font-black text-green-400">
              {
                acceptedCount
              }
            </p>

          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Contrapropostas
            </p>

            <p className="mt-3 text-4xl font-black text-blue-400">
              {
                counteredCount
              }
            </p>

          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Recusadas
            </p>

            <p className="mt-3 text-4xl font-black text-red-400">
              {
                rejectedCount
              }
            </p>

          </div>

        </section>

        {/* FINANCEIRO */}

        <section className="mt-5 grid gap-4 md:grid-cols-3">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Valor aceito
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              {
                money(
                  totalAccepted
                )
              }
            </p>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Parcelas pendentes
            </p>

            <p className="mt-3 text-3xl font-black text-yellow-400">
              {
                money(
                  pendingInstallmentsValue
                )
              }
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              {
                pendingInstallments.length
              }{" "}
              parcela(s)
            </p>

          </div>

          <div
            className={`rounded-2xl border p-6 ${
              failedInstallments.length >
              0
                ? "border-red-500/30 bg-red-500/10"
                : "border-zinc-800 bg-zinc-900"
            }`}
          >

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Parcelas com falha
            </p>

            <p
              className={`mt-3 text-4xl font-black ${
                failedInstallments.length >
                0
                  ? "text-red-400"
                  : "text-white"
              }`}
            >
              {
                failedInstallments.length
              }
            </p>

            {failedInstallments.length >
              0 && (
              <p className="mt-2 text-sm font-bold text-red-300">
                ⚠️ Requer atenção administrativa
              </p>
            )}

          </div>

        </section>

        <section className="mt-5 grid gap-4 md:grid-cols-2">
          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Regra da janela
            </p>

            <p className="mt-2 text-lg font-black text-yellow-400">
              Máximo de 2 jogadores
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Cada clube pode transferir no máximo 2 jogadores para o mesmo clube por janela. Jogadores usados em troca também contam.
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-6">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Fair Play Financeiro
            </p>

            <p className="mt-2 text-lg font-black text-blue-400">
              Limite de R$ 30.000.000
            </p>

            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Nenhum clube pode acumular mais de R$ 30.000.000 em parcelas futuras pendentes ou com falha.
            </p>
          </div>
        </section>

        {/* FILTROS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

          <div className="grid gap-4 lg:grid-cols-[1fr_240px_240px]">

            <div>

              <label className="mb-2 block text-sm font-black">
                Buscar
              </label>

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Jogador, clube ou número da negociação..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-black">
                Status
              </label>

              <select
                value={
                  statusFilter
                }
                onChange={(
                  event
                ) =>
                  setStatusFilter(
                    event.target
                      .value as FilterStatus
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
              >

                <option value="all">
                  Todos
                </option>

                <option value="pending">
                  Pendentes
                </option>

                <option value="accepted">
                  Aceitas
                </option>

                <option value="countered">
                  Contrapropostas
                </option>

                <option value="rejected">
                  Recusadas
                </option>

                <option value="cancelled">
                  Canceladas
                </option>

              </select>

            </div>

            <div>

              <label className="mb-2 block text-sm font-black">
                Clube
              </label>

              <select
                value={
                  selectedTeam
                }
                onChange={(
                  event
                ) =>
                  setSelectedTeam(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none"
              >

                <option value="">
                  Todos os clubes
                </option>

                {teams.map(
                  (
                    team
                  ) => (
                    <option
                      key={
                        team.id
                      }
                      value={
                        team.id
                      }
                    >
                      {
                        team.name
                      }
                    </option>
                  )
                )}

              </select>

            </div>

          </div>

        </section>

        {/* RESULTADOS */}

        <section className="mt-8">

          <div className="mb-5 flex items-center justify-between gap-4">

            <h2 className="text-2xl font-black">
              Negociações
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {
                filteredNegotiations.length
              }{" "}
              resultado(s)
            </span>

          </div>

          {filteredNegotiations.length ===
          0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

              <p className="text-4xl">
                📋
              </p>

              <h3 className="mt-4 text-xl font-black">
                Nenhuma negociação encontrada
              </h3>

            </div>
          ) : (
            <div className="space-y-4">

              {filteredNegotiations.map(
                (
                  negotiation
                ) => {
                  const expanded =
                    expandedNegotiation ===
                    negotiation.id;

                  return (
                    <article
                      key={
                        negotiation.id
                      }
                      className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                    >

                      {/* CABEÇALHO */}

                      <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-4">

                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                          <div className="flex flex-wrap items-center gap-3">

                            <span
                              className={`rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                                negotiation.status
                              )}`}
                            >
                              {
                                statusText(
                                  negotiation.status
                                )
                              }
                            </span>

                            <span className="text-sm font-bold text-zinc-400">
                              Negociação #
                              {
                                negotiation.id
                              }
                            </span>

                            {negotiation.parent_negotiation_id && (
                              <span className="text-xs text-blue-400">
                                ↳ Contraproposta da #
                                {
                                  negotiation.parent_negotiation_id
                                }
                              </span>
                            )}

                          </div>

                          <span className="text-sm text-zinc-500">
                            {
                              dateTime(
                                negotiation.created_at
                              )
                            }
                          </span>

                        </div>

                      </div>

                      {/* PRINCIPAL */}

                      <div className="p-6">

                        <div className="grid gap-6 lg:grid-cols-[1fr_260px]">

                          <div>

                            <p className="text-xs font-black uppercase tracking-widest text-green-400">
                              Jogador
                            </p>

                            <h3 className="mt-2 text-2xl font-black">
                              {negotiation.player_name ||
                                `Jogador #${negotiation.player_id}`}
                            </h3>

                            <p className="mt-2 text-sm text-zinc-500">
                              {negotiation.player_position ||
                                "Posição -"}


                              {negotiation.player_ca !==
                              null
                                ? ` • CA ${negotiation.player_ca}`
                                : ""}
                            </p>

                            {/* CLUBES */}

                            <div className="mt-5 flex flex-wrap items-center gap-3">

                              <div className="rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3">

                                <p className="text-xs uppercase text-zinc-500">
                                  Vendedor
                                </p>

                                <p className="mt-1 font-black">
                                  {negotiation.seller_team_name ||
                                    `Clube ${negotiation.seller_team_id}`}
                                </p>

                              </div>

                              <span className="font-black text-zinc-600">
                                →
                              </span>

                              <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-4 py-3">

                                <p className="text-xs uppercase text-zinc-500">
                                  Comprador
                                </p>

                                <p className="mt-1 font-black">
                                  {negotiation.buyer_team_name ||
                                    `Clube ${negotiation.buyer_team_id}`}
                                </p>

                              </div>

                            </div>

                            <p className="mt-5 text-sm text-zinc-500">
                              Proposta criada por{" "}

                              <span className="font-bold text-white">
                                {negotiation.created_by_team_name ||
                                  "Clube não identificado"}
                              </span>
                            </p>

                          </div>

                            {currentWindow && (
                              <div className="mt-4 inline-flex rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-black text-yellow-300">
                                Limite nesta janela:{" "}
                                {getDirectionUsage(
                                  negotiation.seller_team_id,
                                  negotiation.buyer_team_id
                                )}
                                /2{" "}
                                {negotiation.seller_team_name ||
                                  `Clube ${negotiation.seller_team_id}`}
                                {" → "}
                                {negotiation.buyer_team_name ||
                                  `Clube ${negotiation.buyer_team_id}`}
                              </div>
                            )}

                          {/* DINHEIRO */}

                          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">

                            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                              Valor
                            </p>

                            <p className="mt-2 text-3xl font-black text-green-400">
                              {
                                money(
                                  negotiation.amount
                                )
                              }
                            </p>

                            <p className="mt-3 text-sm font-bold">
                              {negotiation.installments ===
                              2
                                ? "Pagamento em 2x"
                                : "Pagamento à vista"}
                            </p>

                            {negotiation.installments ===
                              2 && (
                              <div className="mt-4 space-y-2 text-sm">

                                <div className="flex justify-between gap-3">

                                  <span className="text-zinc-500">
                                    1ª parcela
                                  </span>

                                  <span className="font-black">
                                    {
                                      money(
                                        negotiation.installment_1
                                      )
                                    }
                                  </span>

                                </div>

                                <div className="flex justify-between gap-3">

                                  <span className="text-zinc-500">
                                    2ª parcela
                                  </span>

                                  <span className="font-black">
                                    {
                                      money(
                                        negotiation.installment_2
                                      )
                                    }
                                  </span>

                                </div>

                              </div>
                            )}

                          </div>

                        </div>

                        {/* EXPANDIR */}

                        <button
                          type="button"
                          onClick={() =>
                            setExpandedNegotiation(
                              expanded
                                ? null
                                : negotiation.id
                            )
                          }
                          className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-5 py-3 font-black transition hover:border-zinc-500"
                        >
                          {expanded
                            ? "▲ Ocultar detalhes"
                            : "▼ Ver auditoria completa"}
                        </button>

                        {/* DETALHES */}

                        {expanded && (
                          <div className="mt-6 space-y-6 border-t border-zinc-800 pt-6">

                            {negotiation.status === "accepted" && (
                              <div className="flex flex-wrap gap-3">
                                <Link
                                  href="/bid"
                                  className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 font-black text-green-300 transition hover:bg-green-500/20"
                                >
                                  📢 Ver no BID
                                </Link>

                                <Link
                                  href="/admin/installments"
                                  className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 font-black text-cyan-300 transition hover:bg-cyan-500/20"
                                >
                                  📆 Ver parcelas
                                </Link>
                              </div>
                            )}

                            {/* TROCAS */}

                            <div>

                              <h4 className="font-black">
                                Jogadores incluídos na negociação
                              </h4>

                              {negotiation.exchange_players.length ===
                              0 ? (
                                <p className="mt-3 text-sm text-zinc-500">
                                  Nenhum jogador usado como parte do pagamento.
                                </p>
                              ) : (
                                <div className="mt-3 grid gap-3 md:grid-cols-2">

                                  {negotiation.exchange_players.map(
                                    (
                                      exchangePlayer
                                    ) => (
                                      <div
                                        key={
                                          exchangePlayer.id
                                        }
                                        className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
                                      >

                                        <p className="font-black">
                                          {exchangePlayer.player_name ||
                                            `Jogador #${exchangePlayer.player_id}`}
                                        </p>

                                        <p className="mt-1 text-sm text-zinc-500">
                                          {exchangePlayer.player_position ||
                                            "-"}

                                          {exchangePlayer.player_ca !==
                                          null
                                            ? ` • CA ${exchangePlayer.player_ca}`
                                            : ""}
                                        </p>

                                        <p className="mt-3 text-sm text-blue-300">
                                          {exchangePlayer.from_team_name ||
                                            "?"}
                                          {" → "}
                                          {exchangePlayer.to_team_name ||
                                            "?"}
                                        </p>

                                      </div>
                                    )
                                  )}

                                </div>
                              )}

                            </div>

                            {/* PARCELAS */}

                            <div>

                              <h4 className="font-black">
                                Parcelas
                              </h4>

                              {negotiation.installment_rows.length ===
                              0 ? (
                                <p className="mt-3 text-sm text-zinc-500">
                                  Nenhuma parcela pendente registrada.
                                </p>
                              ) : (
                                <div className="mt-3 space-y-3">

                                  {negotiation.installment_rows.map(
                                    (
                                      installment
                                    ) => (
                                      <div
                                        key={
                                          installment.id
                                        }
                                        className="rounded-xl border border-zinc-800 bg-zinc-950 p-4"
                                      >

                                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

                                          <div>

                                            <p className="font-black">
                                              Parcela{" "}
                                              {
                                                installment.installment_number
                                              }
                                            </p>

                                            <p className="mt-1 text-sm text-zinc-500">
                                              {installment.payer_team_name ||
                                                "?"}
                                              {" → "}
                                              {installment.receiver_team_name ||
                                                "?"}
                                            </p>

                                          </div>

                                          <div className="sm:text-right">

                                            <p className="text-xl font-black">
                                              {
                                                money(
                                                  installment.amount
                                                )
                                              }
                                            </p>

                                            <p
                                              className={`mt-1 text-xs font-black ${
                                                installment.status ===
                                                "paid"
                                                  ? "text-green-400"
                                                  : installment.status ===
                                                    "failed"
                                                  ? "text-red-400"
                                                  : "text-yellow-400"
                                              }`}
                                            >
                                              {
                                                installment.status.toUpperCase()
                                              }
                                            </p>

                                          </div>

                                        </div>

                                        {installment.due_transfer_window !==
                                          null && (
                                          <p className="mt-3 text-sm text-blue-400">
                                            Vencimento: Janela{" "}
                                            {
                                              installment.due_transfer_window
                                            }
                                          </p>
                                        )}

                                        {installment.failure_reason && (
                                          <div className="mt-3 rounded-lg bg-red-500/10 p-3 text-sm text-red-300">
                                            ⚠️{" "}
                                            {
                                              installment.failure_reason
                                            }
                                          </div>
                                        )}

                                      </div>
                                    )
                                  )}

                                </div>
                              )}

                            </div>

                            {/* DATAS */}

                            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

                              <div className="rounded-xl bg-zinc-950 p-4">

                                <p className="text-xs uppercase text-zinc-500">
                                  Criada
                                </p>

                                <p className="mt-2 text-sm font-bold">
                                  {
                                    dateTime(
                                      negotiation.created_at
                                    )
                                  }
                                </p>

                              </div>

                              <div className="rounded-xl bg-zinc-950 p-4">

                                <p className="text-xs uppercase text-zinc-500">
                                  Aceita
                                </p>

                                <p className="mt-2 text-sm font-bold">
                                  {
                                    dateTime(
                                      negotiation.accepted_at
                                    )
                                  }
                                </p>

                              </div>

                              <div className="rounded-xl bg-zinc-950 p-4">

                                <p className="text-xs uppercase text-zinc-500">
                                  Recusada
                                </p>

                                <p className="mt-2 text-sm font-bold">
                                  {
                                    dateTime(
                                      negotiation.rejected_at
                                    )
                                  }
                                </p>

                              </div>

                              <div className="rounded-xl bg-zinc-950 p-4">

                                <p className="text-xs uppercase text-zinc-500">
                                  Transferência concluída
                                </p>

                                <p className="mt-2 text-sm font-bold">
                                  {
                                    dateTime(
                                      negotiation.transfer_completed_at
                                    )
                                  }
                                </p>

                              </div>

                            </div>

                          </div>
                        )}

                      </div>

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-4">
          <Link
            href="/admin/teams"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🏟️ Clubes
          </Link>

          <Link
            href="/admin/finance"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            💰 Finanças
          </Link>

          <Link
            href="/admin/installments"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📆 Parcelas
          </Link>

          <Link
            href="/bid"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📢 BID
          </Link>
        </section>

      </div>

    </main>
  );
}