"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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

type ExchangePlayer = {
  id: number;
  player_id: number;
  from_team_id: number | null;
  to_team_id: number | null;
  player: Player | null;
  from_team: Team | null;
  to_team: Team | null;
};

type MarketMovement = {
  key: string;
  id: number;
  source: "internal" | "auction";
  negotiation_id: number | null;
  auction_id: number | null;

  player_id: number;
  buyer_team_id: number | null;
  seller_team_id: number | null;

  amount: number;
  installments: number;
  installment_1: number;
  installment_2: number;

  completed_at: string | null;

  player: Player | null;
  buyer_team: Team | null;
  seller_team: Team | null;

  exchange_players: ExchangePlayer[];
};

type MovementFilter = "all" | "internal" | "auction" | "trade" | "installments";

function firstNumber(...values: unknown[]) {
  for (const value of values) {
    if (value !== null && value !== undefined && value !== "") {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }
  return null;
}

function firstString(...values: unknown[]) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value;
    }
  }
  return null;
}

export default function HistoryPage() {
  const [movements, setMovements] = useState<MarketMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [search, setSearch] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterType, setFilterType] = useState<MovementFilter>("all");

  async function getPlayer(playerId: number | null): Promise<Player | null> {
    if (!playerId) return null;

    const { data } = await supabase
      .from("players")
      .select("id, name, position, ca")
      .eq("id", playerId)
      .maybeSingle();

    return data || null;
  }

  async function getTeam(teamId: number | null): Promise<Team | null> {
    if (!teamId) return null;

    const { data } = await supabase
      .from("teams")
      .select("id, name")
      .eq("id", teamId)
      .maybeSingle();

    return data || null;
  }

  const loadHistory = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      /*
        1. NEGOCIAÇÕES INTERNAS CONCLUÍDAS
      */
      const { data: transferRows, error: historyError } = await supabase
        .from("transfer_history")
        .select(`
          id,
          negotiation_id,
          player_id,
          buyer_team_id,
          seller_team_id,
          amount,
          payment_type,
          installments,
          installment_1,
          installment_2,
          completed_at,
          created_at
        `)
        .order("completed_at", { ascending: false });

      if (historyError) {
        throw historyError;
      }

      const internalMovements: MarketMovement[] = await Promise.all(
        (transferRows || []).map(async (transfer: any) => {
          const [player, buyerTeam, sellerTeam, exchangeResult] =
            await Promise.all([
              getPlayer(Number(transfer.player_id)),
              getTeam(Number(transfer.buyer_team_id)),
              getTeam(Number(transfer.seller_team_id)),
              transfer.negotiation_id
                ? supabase
                    .from("negotiation_players")
                    .select("id, player_id, from_team_id, to_team_id")
                    .eq("negotiation_id", transfer.negotiation_id)
                : Promise.resolve({ data: [], error: null }),
            ]);

          const exchangePlayers: ExchangePlayer[] = await Promise.all(
            (exchangeResult.data || []).map(async (row: any) => {
              const fromTeamId =
                row.from_team_id === null
                  ? null
                  : Number(row.from_team_id);

              const toTeamId =
                row.to_team_id === null
                  ? null
                  : Number(row.to_team_id);

              const [
                exchangePlayer,
                fromTeam,
                toTeam,
              ] = await Promise.all([
                getPlayer(Number(row.player_id)),
                getTeam(fromTeamId),
                getTeam(toTeamId),
              ]);

              return {
                id: Number(row.id),
                player_id: Number(row.player_id),
                from_team_id: fromTeamId,
                to_team_id: toTeamId,
                player: exchangePlayer,
                from_team: fromTeam,
                to_team: toTeam,
              };
            })
          );

          return {
            key: `internal-${transfer.id}`,
            id: Number(transfer.id),
            source: "internal",
            negotiation_id:
              transfer.negotiation_id === null
                ? null
                : Number(transfer.negotiation_id),
            auction_id: null,

            player_id: Number(transfer.player_id),
            buyer_team_id: Number(transfer.buyer_team_id),
            seller_team_id: Number(transfer.seller_team_id),

            amount: Number(transfer.amount || 0),
            installments: Number(transfer.installments || 1),
            installment_1: Number(transfer.installment_1 || 0),
            installment_2: Number(transfer.installment_2 || 0),

            completed_at:
              transfer.completed_at || transfer.created_at || null,

            player,
            buyer_team: buyerTeam,
            seller_team: sellerTeam,
            exchange_players: exchangePlayers,
          };
        })
      );

      /*
        2. LEILÕES ENCERRADOS

        Usamos select("*") para aproveitar os dados que já existem
        na sua tabela auctions sem exigir uma nova tabela de histórico.

        O código aceita os nomes mais comuns usados para vencedor/valor,
        inclusive current_bid, que é o valor exibido no leilão encerrado.
      */
      const { data: auctionRows, error: auctionError } = await supabase
        .from("auctions")
        .select("*")
        .in("status", ["closed", "ended", "finished", "completed"]);

      if (auctionError) {
        console.error("Erro ao carregar leilões no histórico:", auctionError);
      }

      const auctionMovements: MarketMovement[] = await Promise.all(
        (auctionRows || []).map(async (auction: any) => {
          const playerId = firstNumber(
            auction.player_id,
            auction.playerId
          );

          const buyerTeamId = firstNumber(
            auction.winner_team_id,
            auction.winning_team_id,
            auction.current_winner_team_id,
            auction.highest_bid_team_id,
            auction.current_bidder_team_id,
            auction.winner_id
          );

          const amount =
            firstNumber(
              auction.final_price,
              auction.winning_bid,
              auction.final_bid,
              auction.current_bid,
              auction.highest_bid,
              auction.price,
              auction.amount
            ) || 0;

          const completedAt = firstString(
            auction.ended_at,
            auction.closed_at,
            auction.completed_at,
            auction.updated_at,
            auction.created_at
          );

          const [player, buyerTeam] = await Promise.all([
            getPlayer(playerId),
            getTeam(buyerTeamId),
          ]);

          return {
            key: `auction-${auction.id}`,
            id: Number(auction.id),
            source: "auction",
            negotiation_id: null,
            auction_id: Number(auction.id),

            player_id: playerId || 0,
            buyer_team_id: buyerTeamId,
            seller_team_id: null,

            amount,
            installments: 1,
            installment_1: amount,
            installment_2: 0,

            completed_at: completedAt,

            player,
            buyer_team: buyerTeam,
            seller_team: null,
            exchange_players: [],
          };
        })
      );

      /*
        Não mostramos leilão sem vencedor.
      */
      const validAuctions = auctionMovements.filter(
        (movement) =>
          movement.player_id > 0 &&
          movement.buyer_team_id !== null
      );

      const allMovements = [
        ...internalMovements,
        ...validAuctions,
      ].sort((a, b) => {
        const aTime = a.completed_at
          ? new Date(a.completed_at).getTime()
          : 0;

        const bTime = b.completed_at
          ? new Date(b.completed_at).getTime()
          : 0;

        return bTime - aTime;
      });

      setMovements(allMovements);
    } catch (err) {
      console.error(err);

      setError(
        "Não foi possível carregar o histórico completo do mercado."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const channel = supabase
      .channel("history-market-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfer_history",
        },
        () => {
          loadHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "negotiation_players",
        },
        () => {
          loadHistory();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
        },
        () => {
          loadHistory();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadHistory]);

  function money(value: number | null | undefined) {
    return `R$ ${Number(value || 0).toLocaleString("pt-BR")}`;
  }

  function formatDate(value: string | null | undefined) {
    if (!value) return "-";
    return new Date(value).toLocaleString("pt-BR");
  }

  const teams = useMemo(() => {
    const map = new Map<number, Team>();

    movements.forEach((movement) => {
      if (movement.buyer_team) {
        map.set(movement.buyer_team.id, movement.buyer_team);
      }

      if (movement.seller_team) {
        map.set(movement.seller_team.id, movement.seller_team);
      }
    });

    return Array.from(map.values()).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
  }, [movements]);

  const filteredMovements = useMemo(() => {
    const cleanSearch = search.trim().toLowerCase();

    return movements.filter((movement) => {
      const playerName =
        movement.player?.name?.toLowerCase() || "";

      const buyerName =
        movement.buyer_team?.name?.toLowerCase() || "";

      const sellerName =
        movement.seller_team?.name?.toLowerCase() || "";

      const exchangeNames = movement.exchange_players
        .map((item) => item.player?.name || "")
        .join(" ")
        .toLowerCase();

      const matchesSearch =
        !cleanSearch ||
        playerName.includes(cleanSearch) ||
        buyerName.includes(cleanSearch) ||
        sellerName.includes(cleanSearch) ||
        exchangeNames.includes(cleanSearch);

      const matchesTeam =
        !filterTeam ||
        movement.buyer_team_id === Number(filterTeam) ||
        movement.seller_team_id === Number(filterTeam);

      let matchesType = true;

      if (filterType === "internal") {
        matchesType = movement.source === "internal";
      }

      if (filterType === "auction") {
        matchesType = movement.source === "auction";
      }

      if (filterType === "trade") {
        matchesType = movement.exchange_players.length > 0;
      }

      if (filterType === "installments") {
        matchesType = movement.installments === 2;
      }

      return matchesSearch && matchesTeam && matchesType;
    });
  }, [movements, search, filterTeam, filterType]);

  const totalMoney = useMemo(
    () =>
      filteredMovements.reduce(
        (total, movement) =>
          total + Number(movement.amount || 0),
        0
      ),
    [filteredMovements]
  );

  const auctionCount = filteredMovements.filter(
    (movement) => movement.source === "auction"
  ).length;

  const internalCount = filteredMovements.filter(
    (movement) => movement.source === "internal"
  ).length;

  const tradeCount = filteredMovements.filter(
    (movement) => movement.exchange_players.length > 0
  ).length;

  const installmentCount = filteredMovements.filter(
    (movement) => movement.installments === 2
  ).length;

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando histórico do mercado...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        {/* TOPO */}
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              FriendZone League FM
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              Histórico do Mercado
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Todas as movimentações de jogadores da FriendZone League FM.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/bid"
              className="rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-center font-black text-green-300 transition hover:bg-green-500/20"
            >
              📢 BID oficial
            </Link>

            <Link
              href="/transfers"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
            >
              Negociação interna
            </Link>

            <button
              type="button"
              onClick={loadHistory}
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
            >
              ↻ Atualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="mt-8 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {/* RESUMO */}
        <div className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Movimentações
            </p>
            <p className="mt-3 text-3xl font-black">
              {filteredMovements.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Dinheiro movimentado
            </p>
            <p className="mt-3 text-3xl font-black text-green-400">
              {money(totalMoney)}
            </p>
          </div>

          <div className="rounded-2xl border border-purple-500/20 bg-purple-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Leilões
            </p>
            <p className="mt-3 text-3xl font-black text-purple-400">
              {auctionCount}
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Negociações internas
            </p>
            <p className="mt-3 text-3xl font-black text-blue-400">
              {internalCount}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Parceladas
            </p>
            <p className="mt-3 text-3xl font-black text-yellow-400">
              {installmentCount}
            </p>
          </div>
        </div>

        {/* FILTROS */}
        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 lg:grid-cols-[1fr_260px_260px]">

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Buscar
              </label>

              <input
                type="text"
                value={search}
                onChange={(event) =>
                  setSearch(event.target.value)
                }
                placeholder="Jogador ou clube..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Tipo
              </label>

              <select
                value={filterType}
                onChange={(event) =>
                  setFilterType(
                    event.target.value as MovementFilter
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="all">Todas</option>
                <option value="auction">Leilões</option>
                <option value="internal">Negociação interna</option>
                <option value="trade">Trocas</option>
                <option value="installments">Parceladas</option>
              </select>
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Clube
              </label>

              <select
                value={filterTeam}
                onChange={(event) =>
                  setFilterTeam(event.target.value)
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              >
                <option value="">
                  Todos os clubes
                </option>

                {teams.map((team) => (
                  <option
                    key={team.id}
                    value={team.id}
                  >
                    {team.name}
                  </option>
                ))}
              </select>
            </div>

          </div>
        </section>

        {/* HISTÓRICO */}
        <section className="mt-10">

          <div className="mb-5 flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-black uppercase tracking-widest text-green-400">
                Mercado
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Todas as transferências
              </h2>
            </div>

            <p className="text-sm font-bold text-zinc-500">
              {filteredMovements.length} resultado(s)
            </p>
          </div>

          {filteredMovements.length === 0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <p className="text-4xl">📋</p>

              <h3 className="mt-4 text-xl font-black">
                Nenhuma movimentação encontrada
              </h3>

              <p className="mt-2 text-zinc-500">
                Leilões concluídos e negociações internas aparecerão aqui.
              </p>
            </div>
          ) : (
            <div className="space-y-5">

              {filteredMovements.map((movement) => {
                const isAuction =
                  movement.source === "auction";

                const isTwoPayments =
                  movement.installments === 2;

                return (
                  <article
                    key={movement.key}
                    className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                  >

                    {/* CABEÇALHO */}
                    <div className="border-b border-zinc-800 bg-zinc-950/60 px-6 py-4">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">

                        <div className="flex flex-wrap items-center gap-3">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-black ${
                              isAuction
                                ? "bg-purple-500/15 text-purple-400"
                                : "bg-blue-500/15 text-blue-400"
                            }`}
                          >
                            {isAuction
                              ? "🔨 LEILÃO"
                              : "🔄 NEGOCIAÇÃO INTERNA"}
                          </span>

                          <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-black text-green-400">
                            CONCLUÍDA
                          </span>

                          {movement.negotiation_id && (
                            <span className="text-sm text-zinc-600">
                              Negociação #{movement.negotiation_id}
                            </span>
                          )}

                          {movement.auction_id && (
                            <span className="text-sm text-zinc-600">
                              Leilão #{movement.auction_id}
                            </span>
                          )}
                        </div>

                        <p className="text-sm text-zinc-500">
                          {formatDate(movement.completed_at)}
                        </p>
                      </div>
                    </div>

                    <div className="p-6">
                      <div className="grid gap-8 xl:grid-cols-[1fr_360px]">

                        <div>
                          <div className="grid gap-5 md:grid-cols-[1fr_auto_1fr] md:items-center">

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-red-400">
                                Origem
                              </p>

                              <p className="mt-2 text-xl font-black">
                                {isAuction
                                  ? "Leilão da Liga"
                                  : movement.seller_team?.name || "-"}
                              </p>
                            </div>

                            <div className="text-center text-3xl font-black text-zinc-600">
                              →
                            </div>

                            <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-5">
                              <p className="text-xs font-black uppercase tracking-widest text-green-400">
                                Destino
                              </p>

                              <p className="mt-2 text-xl font-black">
                                {movement.buyer_team?.name || "-"}
                              </p>
                            </div>
                          </div>

                          <div className="mt-6 rounded-xl border border-green-500/20 bg-green-500/5 p-5">
                            <p className="text-xs font-black uppercase tracking-widest text-green-400">
                              Jogador transferido
                            </p>

                            <div className="mt-3 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                              <div>
                                <h3 className="text-3xl font-black">
                                  {movement.player?.name ||
                                    `Jogador #${movement.player_id}`}
                                </h3>

                                {movement.player && (
                                  <p className="mt-2 text-sm text-zinc-400">
                                    {movement.player.position ||
                                      "Posição -"}

                                    {movement.player.ca !== null
                                      ? ` • CA ${movement.player.ca}`
                                      : ""}
                                  </p>
                                )}
                              </div>

                              <div className="text-left md:text-right">
                                <p className="text-xs uppercase text-zinc-500">
                                  Destino
                                </p>

                                <p className="mt-1 font-black text-green-400">
                                  {movement.buyer_team?.name || "-"}
                                </p>
                              </div>
                            </div>
                          </div>

                          {movement.exchange_players.length > 0 && (
                            <div className="mt-6">
                              <p className="text-sm font-black uppercase tracking-widest text-blue-400">
                                Jogadores usados na troca
                              </p>

                              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {movement.exchange_players.map(
                                  (exchangePlayer) => (
                                    <div
                                      key={exchangePlayer.id}
                                      className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4"
                                    >
                                      <p className="font-black">
                                        {exchangePlayer.player?.name ||
                                          `Jogador #${exchangePlayer.player_id}`}
                                      </p>

                                      {exchangePlayer.player && (
                                        <p className="mt-1 text-sm text-zinc-500">
                                          {exchangePlayer.player.position ||
                                            "Posição -"}

                                          {exchangePlayer.player.ca !== null
                                            ? ` • CA ${exchangePlayer.player.ca}`
                                            : ""}
                                        </p>
                                      )}

                                      <p className="mt-3 text-xs font-bold uppercase text-blue-400">
                                        Parte do pagamento
                                      </p>

                                      <p className="mt-2 text-sm font-bold text-zinc-300">
                                        {exchangePlayer.from_team?.name ||
                                          (exchangePlayer.from_team_id
                                            ? `Clube ${exchangePlayer.from_team_id}`
                                            : "?")}
                                        {" → "}
                                        {exchangePlayer.to_team?.name ||
                                          (exchangePlayer.to_team_id
                                            ? `Clube ${exchangePlayer.to_team_id}`
                                            : "?")}
                                      </p>
                                    </div>
                                  )
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* PAGAMENTO */}
                        <aside className="rounded-xl border border-zinc-800 bg-zinc-950 p-6">

                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            {isAuction
                              ? "Valor final do leilão"
                              : "Valor da negociação"}
                          </p>

                          <p className="mt-3 text-4xl font-black text-green-400">
                            {money(movement.amount)}
                          </p>

                          <div className="mt-6 border-t border-zinc-800 pt-5">
                            <p className="text-xs font-black uppercase text-zinc-500">
                              Tipo
                            </p>

                            <p
                              className={`mt-2 text-lg font-black ${
                                isAuction
                                  ? "text-purple-400"
                                  : "text-blue-400"
                              }`}
                            >
                              {isAuction
                                ? "Leilão"
                                : movement.exchange_players.length > 0
                                ? "Negociação com troca"
                                : "Negociação interna"}
                            </p>
                          </div>

                          {!isAuction && (
                            <>
                              <div className="mt-5 border-t border-zinc-800 pt-5">
                                <p className="text-xs font-black uppercase text-zinc-500">
                                  Forma de pagamento
                                </p>

                                <p className="mt-2 text-lg font-black">
                                  {isTwoPayments
                                    ? "2 parcelas"
                                    : "À vista"}
                                </p>
                              </div>

                              {isTwoPayments ? (
                                <div className="mt-5 space-y-3">
                                  <div className="rounded-lg bg-zinc-900 p-4">
                                    <p className="text-xs text-zinc-500">
                                      1ª parcela
                                    </p>

                                    <p className="mt-1 text-xl font-black">
                                      {money(movement.installment_1)}
                                    </p>
                                  </div>

                                  <div className="rounded-lg bg-zinc-900 p-4">
                                    <p className="text-xs text-zinc-500">
                                      2ª parcela
                                    </p>

                                    <p className="mt-1 text-xl font-black">
                                      {money(movement.installment_2)}
                                    </p>
                                  </div>
                                </div>
                              ) : (
                                <div className="mt-5 rounded-lg bg-zinc-900 p-4">
                                  <p className="text-xs text-zinc-500">
                                    Pagamento
                                  </p>

                                  <p className="mt-1 text-xl font-black">
                                    {money(movement.amount)}
                                  </p>
                                </div>
                              )}
                            </>
                          )}
                        </aside>

                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          {tradeCount > 0 && (
            <p className="mt-6 text-sm text-zinc-500">
              {tradeCount} movimentação(ões) com jogadores incluídos em troca.
            </p>
          )}
        </section>

        <section className="mt-10 grid gap-3 md:grid-cols-3">
          <Link
            href="/bid"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            📢 BID
          </Link>

          <Link
            href="/transfers"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🔄 Negociações
          </Link>

          <Link
            href="/teams"
            className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 font-black transition hover:border-zinc-600"
          >
            🏟️ Clubes
          </Link>
        </section>

      </div>
    </main>
  );
}
