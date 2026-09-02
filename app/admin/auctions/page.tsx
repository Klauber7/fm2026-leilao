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

type AuctionSettings = {
  id: number;
  player_auctions_open: boolean;
  updated_at: string;
  updated_by: string | null;
};

type AuctionRow = {
  id: number;
  status: string;
  player_id: number | null;
  paused_remaining_seconds: number | null;

  current_bid?: number | null;
  highest_bid?: number | null;
  final_amount?: number | null;
  winning_bid?: number | null;

  current_bid_team_id?: number | null;
  highest_bid_team_id?: number | null;
  winner_team_id?: number | null;

  ends_at?: string | null;
  end_time?: string | null;
  created_at?: string | null;

  [key: string]: any;
};

type AuctionView = AuctionRow & {
  player_name: string;
  team_name: string | null;
  display_value: number;
  remaining_seconds: number | null;
};

export default function AdminAuctionsPage() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [settings, setSettings] =
    useState<AuctionSettings | null>(null);

  const [freePlayers, setFreePlayers] =
    useState(0);

  const [auctions, setAuctions] =
    useState<AuctionView[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [statusFilter, setStatusFilter] =
    useState("all");

  const loadPage =
    useCallback(async () => {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } =
        await supabase.auth.getUser();

      if (
        userError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      const {
        data: admin,
        error: adminError,
      } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (adminError) {
        console.error(
          adminError
        );

        alert(
          "Erro ao verificar acesso administrativo."
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      if (!admin) {
        alert(
          "Você não possui acesso administrativo."
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      setIsAdmin(true);

      const [
        settingsResponse,
        playersResponse,
        auctionsResponse,
      ] =
        await Promise.all([
          supabase
            .from("auction_settings")
            .select(`
              id,
              player_auctions_open,
              updated_at,
              updated_by
            `)
            .eq("id", 1)
            .single(),

          supabase
            .from("players")
            .select(
              "id",
              {
                count: "exact",
                head: true,
              }
            )
            .is(
              "team_id",
              null
            ),

          supabase
            .from("auctions")
            .select("*")
            .order(
              "id",
              {
                ascending:
                  false,
              }
            )
            .limit(100),
        ]);

      if (
        settingsResponse.error
      ) {
        console.error(
          settingsResponse.error
        );

        alert(
          "Erro ao carregar configuração dos leilões."
        );

        setLoading(false);

        return;
      }

      if (
        auctionsResponse.error
      ) {
        console.error(
          auctionsResponse.error
        );

        alert(
          "Erro ao carregar os leilões."
        );

        setLoading(false);

        return;
      }

      setSettings(
        settingsResponse.data as AuctionSettings
      );

      setFreePlayers(
        playersResponse.count ||
          0
      );

      const rows =
        (auctionsResponse.data ||
          []) as AuctionRow[];

      const playerIds =
        Array.from(
          new Set(
            rows
              .map(
                (row) =>
                  Number(
                    row.player_id
                  )
              )
              .filter(
                (id) =>
                  Number.isFinite(
                    id
                  ) &&
                  id > 0
              )
          )
        );

      const teamIds =
        Array.from(
          new Set(
            rows
              .map(
                (row) =>
                  Number(
                    row.winner_team_id ??
                      row.current_bid_team_id ??
                      row.highest_bid_team_id
                  )
              )
              .filter(
                (id) =>
                  Number.isFinite(
                    id
                  ) &&
                  id > 0
              )
          )
        );

      const [
        playersData,
        teamsData,
      ] =
        await Promise.all([
          playerIds.length >
          0
            ? supabase
                .from("players")
                .select(
                  "id, name"
                )
                .in(
                  "id",
                  playerIds
                )
            : Promise.resolve(
                {
                  data: [],
                  error: null,
                }
              ),

          teamIds.length >
          0
            ? supabase
                .from("teams")
                .select(
                  "id, name"
                )
                .in(
                  "id",
                  teamIds
                )
            : Promise.resolve(
                {
                  data: [],
                  error: null,
                }
              ),
        ]);

      const playerMap =
        new Map<
          number,
          string
        >();

      for (
        const player of
        playersData.data ||
        []
      ) {
        playerMap.set(
          Number(
            player.id
          ),
          String(
            player.name ||
              `Jogador #${player.id}`
          )
        );
      }

      const teamMap =
        new Map<
          number,
          string
        >();

      for (
        const team of
        teamsData.data ||
        []
      ) {
        teamMap.set(
          Number(
            team.id
          ),
          String(
            team.name ||
              `Clube #${team.id}`
          )
        );
      }

      const now =
        Date.now();

      const hydrated:
        AuctionView[] =
        rows.map(
          (row) => {
            const teamId =
              Number(
                row.winner_team_id ??
                  row.current_bid_team_id ??
                  row.highest_bid_team_id
              );

            const value =
              Number(
                row.final_amount ??
                  row.winning_bid ??
                  row.current_bid ??
                  row.highest_bid ??
                  0
              );

            let remaining:
              | number
              | null =
              row.paused_remaining_seconds !==
              null &&
              row.paused_remaining_seconds !==
                undefined
                ? Number(
                    row.paused_remaining_seconds
                  )
                : null;

            const endValue =
              row.ends_at ||
              row.end_time ||
              null;

            if (
              remaining ===
                null &&
              endValue &&
              row.status ===
                "active"
            ) {
              const endMs =
                new Date(
                  endValue
                ).getTime();

              if (
                !Number.isNaN(
                  endMs
                )
              ) {
                remaining =
                  Math.max(
                    0,
                    Math.floor(
                      (
                        endMs -
                        now
                      ) /
                        1000
                    )
                  );
              }
            }

            return {
              ...row,

              id:
                Number(
                  row.id
                ),

              player_id:
                row.player_id !==
                null &&
                row.player_id !==
                  undefined
                  ? Number(
                      row.player_id
                    )
                  : null,

              paused_remaining_seconds:
                row.paused_remaining_seconds !==
                null &&
                row.paused_remaining_seconds !==
                  undefined
                  ? Number(
                      row.paused_remaining_seconds
                    )
                  : null,

              player_name:
                row.player_id
                  ? playerMap.get(
                      Number(
                        row.player_id
                      )
                    ) ||
                    `Jogador #${row.player_id}`
                  : `Leilão #${row.id}`,

              team_name:
                Number.isFinite(
                  teamId
                ) &&
                teamId > 0
                  ? teamMap.get(
                      teamId
                    ) ||
                    `Clube #${teamId}`
                  : null,

              display_value:
                Number.isFinite(
                  value
                )
                  ? value
                  : 0,

              remaining_seconds:
                remaining,
            };
          }
        );

      setAuctions(
        hydrated
      );

      setLoading(false);

    }, [router]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const channel =
      supabase
        .channel(
          "admin-auctions-control"
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
              "auction_settings",
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
    isAdmin,
    loadPage,
  ]);

  async function changeStatus(
    open: boolean
  ) {
    const confirmed =
      window.confirm(
        open
          ? "Abrir os leilões de jogadores?"
          : "Fechar novos leilões de jogadores?\n\nLeilões já iniciados continuarão normalmente."
      );

    if (!confirmed) {
      return;
    }

    setSaving(true);

    const {
      error,
    } =
      await supabase.rpc(
        "admin_set_player_auctions_open",
        {
          p_open: open,
        }
      );

    setSaving(false);

    if (error) {
      console.error(
        error
      );

      alert(
        "Não foi possível alterar o status dos leilões."
      );

      return;
    }

    alert(
      open
        ? "Leilões de jogadores ABERTOS!"
        : "Novos leilões de jogadores FECHADOS!"
    );

    await loadPage();
  }

  function money(
    value:
      | number
      | null
      | undefined
  ) {
    return `R$ ${Number(
      value ||
        0
    ).toLocaleString(
      "pt-BR"
    )}`;
  }

  function formatRemaining(
    seconds:
      | number
      | null
  ) {
    if (
      seconds ===
        null ||
      seconds <= 0
    ) {
      return "--:--:--";
    }

    const hours =
      String(
        Math.floor(
          seconds /
            3600
        )
      ).padStart(
        2,
        "0"
      );

    const minutes =
      String(
        Math.floor(
          (
            seconds %
            3600
          ) /
            60
        )
      ).padStart(
        2,
        "0"
      );

    const secs =
      String(
        seconds %
          60
      ).padStart(
        2,
        "0"
      );

    return `${hours}:${minutes}:${secs}`;
  }

  function statusLabel(
    status: string
  ) {
    switch (
      status
    ) {
      case "active":
        return "Ativo";

      case "closed":
      case "ended":
      case "finished":
        return "Encerrado";

      case "cancelled":
        return "Cancelado";

      default:
        return status;
    }
  }

  function statusClass(
    status: string
  ) {
    switch (
      status
    ) {
      case "active":
        return "bg-green-500/15 text-green-400 border-green-500/30";

      case "cancelled":
        return "bg-red-500/15 text-red-400 border-red-500/30";

      default:
        return "bg-zinc-800 text-zinc-300 border-zinc-700";
    }
  }

  const activeAuctions =
    useMemo(
      () =>
        auctions.filter(
          (auction) =>
            auction.status ===
            "active"
        ),
      [auctions]
    );

  const closedAuctions =
    useMemo(
      () =>
        auctions.filter(
          (auction) =>
            auction.status !==
            "active"
        ),
      [auctions]
    );

  const filteredAuctions =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      return auctions.filter(
        (auction) => {
          const matchesStatus =
            statusFilter ===
              "all" ||
            (
              statusFilter ===
                "active" &&
              auction.status ===
                "active"
            ) ||
            (
              statusFilter ===
                "closed" &&
              auction.status !==
                "active"
            );

          const matchesSearch =
            !query ||
            auction.player_name
              .toLowerCase()
              .includes(
                query
              ) ||
            (
              auction.team_name ||
              ""
            )
              .toLowerCase()
              .includes(
                query
              ) ||
            String(
              auction.id
            ).includes(
              query
            );

          return (
            matchesStatus &&
            matchesSearch
          );
        }
      );
    }, [
      auctions,
      search,
      statusFilter,
    ]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando controle dos leilões...
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  const open =
    settings?.player_auctions_open ===
    true;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <header>
            <p className="font-bold uppercase tracking-widest text-purple-400">
              Área administrativa
            </p>

            <h1 className="mt-2 text-5xl font-black">
              🔨 Controle dos Leilões
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Abra ou feche novos leilões e acompanhe os leilões de jogadores da liga.
            </p>
          </header>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              ← Administração
            </Link>

            <Link
              href="/auctions"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 text-sm font-black text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
            >
              🔥 Leilões públicos
            </Link>
          </div>
        </div>

        <section
          className={`rounded-3xl border p-8 ${
            open
              ? "border-green-500/40 bg-green-500/10"
              : "border-red-500/40 bg-red-500/10"
          }`}
        >
          <p
            className={`text-sm font-black uppercase tracking-widest ${
              open
                ? "text-green-400"
                : "text-red-400"
            }`}
          >
            Status
          </p>

          <h2 className="mt-3 text-4xl font-black">
            {open
              ? "🟢 LEILÕES ABERTOS"
              : "🔴 LEILÕES FECHADOS"}
          </h2>

          <p className="mt-4 text-zinc-400">
            {open
              ? "Presidentes podem iniciar novos leilões pelo Mercado."
              : "Nenhum novo jogador pode ser abordado neste momento."}
          </p>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              Jogadores disponíveis
            </p>

            <p className="mt-3 text-4xl font-black">
              {freePlayers.toLocaleString(
                "pt-BR"
              )}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-6">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              Leilões ativos
            </p>

            <p className="mt-3 text-4xl font-black text-green-400">
              {activeAuctions.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              Encerrados / outros
            </p>

            <p className="mt-3 text-4xl font-black text-zinc-300">
              {closedAuctions.length}
            </p>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <button
            type="button"
            disabled={
              saving ||
              open
            }
            onClick={() =>
              changeStatus(
                true
              )
            }
            className="rounded-2xl bg-green-600 px-6 py-6 text-xl font-black transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            ABRIR LEILÕES
          </button>

          <button
            type="button"
            disabled={
              saving ||
              !open
            }
            onClick={() =>
              changeStatus(
                false
              )
            }
            className="rounded-2xl bg-red-600 px-6 py-6 text-xl font-black transition hover:bg-red-500 disabled:cursor-not-allowed disabled:bg-zinc-800 disabled:text-zinc-500"
          >
            TRANCAR NOVOS LEILÕES
          </button>
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="block text-sm font-black text-zinc-300">
                Buscar
              </label>

              <input
                type="text"
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
                placeholder="Jogador, clube ou ID..."
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="block text-sm font-black text-zinc-300">
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
                    event.target.value
                  )
                }
                className="mt-2 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              >
                <option value="all">
                  Todos
                </option>

                <option value="active">
                  Ativos
                </option>

                <option value="closed">
                  Encerrados
                </option>
              </select>
            </div>
          </div>
        </section>

        <section className="mt-8">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-purple-400">
                Leilões
              </p>

              <h2 className="mt-1 text-3xl font-black">
                Controle e acompanhamento
              </h2>
            </div>

            <p className="text-sm font-bold text-zinc-500">
              {filteredAuctions.length} registro(s)
            </p>
          </div>

          {filteredAuctions.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-500">
              Nenhum leilão encontrado.
            </div>
          ) : (
            <div className="mt-6 space-y-4">
              {filteredAuctions.map(
                (
                  auction
                ) => (
                  <article
                    key={
                      auction.id
                    }
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                  >
                    <div className="grid gap-5 lg:grid-cols-[0.7fr_1.6fr_1fr_1fr_auto] lg:items-center">

                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          Leilão
                        </p>

                        <p className="mt-1 text-xl font-black">
                          #{auction.id}
                        </p>

                        <span
                          className={`mt-2 inline-flex rounded-full border px-3 py-1 text-xs font-black ${statusClass(
                            auction.status
                          )}`}
                        >
                          {statusLabel(
                            auction.status
                          )}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          Jogador
                        </p>

                        <p className="mt-1 text-xl font-black">
                          {auction.player_name}
                        </p>

                        {auction.team_name && (
                          <p className="mt-1 text-sm text-zinc-500">
                            Clube líder/vencedor:{" "}
                            <strong className="text-white">
                              {auction.team_name}
                            </strong>
                          </p>
                        )}
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          Lance / valor
                        </p>

                        <p className="mt-1 text-xl font-black text-green-400">
                          {money(
                            auction.display_value
                          )}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                          Tempo
                        </p>

                        <p
                          className={`mt-1 text-xl font-black ${
                            auction.paused_remaining_seconds !==
                            null
                              ? "text-yellow-400"
                              : "text-white"
                          }`}
                        >
                          {auction.status ===
                          "active"
                            ? formatRemaining(
                                auction.remaining_seconds
                              )
                            : "Encerrado"}
                        </p>

                        {auction.paused_remaining_seconds !==
                          null && (
                          <p className="mt-1 text-xs font-bold text-yellow-400">
                            Pausado
                          </p>
                        )}
                      </div>

                      <div className="min-w-[150px]">
                        <Link
                          href={`/auctions/${auction.id}`}
                          className="block rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-center font-black text-purple-300 transition hover:bg-purple-500/20"
                        >
                          Ver leilão
                        </Link>
                      </div>

                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="text-xl font-black">
            Como funciona
          </h2>

          <div className="mt-4 space-y-2 text-zinc-400">
            <p>
              • Abrir permite que presidentes iniciem novos leilões pelo Mercado.
            </p>

            <p>
              • O primeiro lance será o valor definido para o jogador.
            </p>

            <p>
              • Cada novo lance reinicia o relógio para 1 hora.
            </p>

            <p>
              • Trancar bloqueia somente novos leilões.
            </p>

            <p>
              • Leilões já iniciados continuam normalmente até o encerramento ou pausa causada pelo fechamento da janela.
            </p>
          </div>
        </section>

      </div>
    </main>
  );
}
