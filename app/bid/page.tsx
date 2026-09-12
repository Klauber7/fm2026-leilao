"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type BidFeedRow = {
  feed_id: string;
  item_type: "player" | "staff";
  item_name: string | null;
  staff_role: string | null;
  origin_name: string | null;
  destination_name: string | null;
  amount: number | null;
  pricing_type: string | null;
  completed_at: string | null;
  player_id: number | null;
  coach_id: number | null;
  origin_team_id: number | null;
  destination_team_id: number | null;
};

function money(value: number | null | undefined) {
  const amount = Number(value || 0);
  if (amount === 0) return "GRÁTIS";

  return amount.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function dateTime(value: string | null | undefined) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("pt-BR");
}

function pricingLabel(value: string | null | undefined) {
  if (!value) return "";

  const labels: Record<string, string> = {
    auction: "Leilão",
    free: "Grátis",
    paid: "Valor aberto",
    manual: "Valor aberto",
    staff100: "100% do Staff",
    staff75: "75% do Staff",
    staff50: "50% do Staff",
    staff25: "25% do Staff",
  };

  return labels[value] || value;
}

export default function BidPage() {
  const [items, setItems] = useState<BidFeedRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");

  const loadBid = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const { data, error: bidError } = await supabase
        .from("bid_feed")
        .select(`
          feed_id,
          item_type,
          item_name,
          staff_role,
          origin_name,
          destination_name,
          amount,
          pricing_type,
          completed_at,
          player_id,
          coach_id,
          origin_team_id,
          destination_team_id
        `)
        .order("completed_at", {
          ascending: false,
          nullsFirst: false,
        });

      if (bidError) throw bidError;

      setItems((data || []) as BidFeedRow[]);
    } catch (loadError) {
      console.error("Erro ao carregar BID:", loadError);
      setError("Não foi possível carregar o BID.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBid();

    const channel = supabase
      .channel("bid-live-all-transfers")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "transfer_history" },
        () => void loadBid()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "draft_transfers" },
        () => void loadBid()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_draft_transfers" },
        () => void loadBid()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "auctions" },
        () => void loadBid()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "staff_auctions" },
        () => void loadBid()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadBid]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return items;

    return items.filter((item) => {
      const text = [
        item.item_name,
        item.staff_role,
        item.origin_name,
        item.destination_name,
        pricingLabel(item.pricing_type),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return text.includes(query);
    });
  }, [items, search]);

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            📢 BID
          </h1>

          <p className="mt-3 text-zinc-400">
            Boletim oficial com todas as contratações registradas no histórico da liga.
          </p>
        </div>

        <section className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-4">
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar jogador, staff ou clube..."
            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500"
          />
        </section>

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando BID...
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-300">
            {error}
          </div>
        )}

        {!loading && !error && filteredItems.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-xl font-black">Nenhuma contratação encontrada.</p>
          </div>
        )}

        {!loading && !error && filteredItems.length > 0 && (
          <div className="space-y-4">
            {filteredItems.map((item) => (
              <article
                key={item.feed_id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="grid gap-5 md:grid-cols-[1.25fr_2fr_1fr] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        {item.item_type === "staff" ? "Staff" : "Jogador"}
                      </p>

                      <span
                        className={`rounded-full border px-2 py-1 text-[10px] font-black uppercase ${
                          item.pricing_type === "auction"
                            ? "border-yellow-500/30 bg-yellow-500/10 text-yellow-300"
                            : item.item_type === "staff"
                              ? "border-purple-500/30 bg-purple-500/10 text-purple-300"
                              : "border-green-500/30 bg-green-500/10 text-green-300"
                        }`}
                      >
                        {pricingLabel(item.pricing_type)}
                      </span>
                    </div>

                    <h2 className="mt-1 text-2xl font-black">
                      {item.item_name ||
                        (item.item_type === "staff"
                          ? `Staff #${item.coach_id}`
                          : `Jogador #${item.player_id}`)}
                    </h2>

                    {item.item_type === "staff" && item.staff_role && (
                      <p className="mt-1 text-sm font-bold text-purple-300">
                        {item.staff_role}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Origem
                      </p>
                      <p className="mt-1 text-lg font-black">
                        {item.origin_name || "Mercado"}
                      </p>
                    </div>

                    <span className="text-3xl font-black text-green-400">→</span>

                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Destino
                      </p>
                      <p className="mt-1 text-lg font-black">
                        {item.destination_name || "-"}
                      </p>
                    </div>
                  </div>

                  <div className="md:text-right">
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Valor
                    </p>
                    <p className="mt-1 text-2xl font-black text-green-400">
                      {money(item.amount)}
                    </p>
                    <p className="mt-2 text-xs font-bold text-zinc-500">
                      {dateTime(item.completed_at)}
                    </p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
