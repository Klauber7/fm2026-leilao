"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type HistoryRow = {
  id: number;
  negotiation_id: number | null;
  player_id: number;
  seller_team_id: number;
  buyer_team_id: number;
  amount: number | null;
  completed_at: string | null;
};

type BidItem = {
  id: number;
  playerName: string;
  sellerName: string;
  buyerName: string;
  amount: number;
  completedAt: string;
};

export default function BidPage() {
  const [items, setItems] = useState<BidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    void loadBid();
  }, []);

  async function loadBid() {
    setLoading(true);
    setError("");

    const { data: historyData, error: historyError } = await supabase
      .from("transfer_history")
      .select(
        "id, negotiation_id, player_id, seller_team_id, buyer_team_id, amount, completed_at"
      )
      .order("completed_at", { ascending: false });

    if (historyError) {
      console.error("Erro ao carregar transfer_history:", historyError);
      setError("Não foi possível carregar o BID.");
      setLoading(false);
      return;
    }

    const history = (historyData || []) as HistoryRow[];

    const result: BidItem[] = [];

    for (const row of history) {
      const [playerResult, sellerResult, buyerResult] = await Promise.all([
        supabase
          .from("players")
          .select("name")
          .eq("id", row.player_id)
          .maybeSingle(),

        supabase
          .from("teams")
          .select("name")
          .eq("id", row.seller_team_id)
          .maybeSingle(),

        supabase
          .from("teams")
          .select("name")
          .eq("id", row.buyer_team_id)
          .maybeSingle(),
      ]);

      result.push({
        id: row.id,
        playerName:
          playerResult.data?.name || `Jogador #${row.player_id}`,
        sellerName:
          sellerResult.data?.name || `Clube #${row.seller_team_id}`,
        buyerName:
          buyerResult.data?.name || `Clube #${row.buyer_team_id}`,
        amount: Number(row.amount || 0),
        completedAt: row.completed_at || "",
      });
    }

    setItems(result);
    setLoading(false);
  }

  function money(value: number) {
    return `R$ ${Number(value || 0).toLocaleString("pt-BR")}`;
  }

  function date(value: string) {
    if (!value) return "-";

    const parsed = new Date(value);

    if (Number.isNaN(parsed.getTime())) {
      return "-";
    }

    return parsed.toLocaleString("pt-BR");
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            📢 BID
          </h1>

          <p className="mt-3 text-zinc-400">
            Boletim oficial das transferências entre clubes.
          </p>
        </div>

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

        {!loading && !error && items.length === 0 && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <p className="text-xl font-black">
              Nenhuma transferência publicada.
            </p>

            <p className="mt-2 text-zinc-500">
              As negociações concluídas entre clubes aparecerão aqui.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="grid gap-5 md:grid-cols-[1.2fr_2fr_1fr] md:items-center">
                  <div>
                    <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                      Jogador
                    </p>

                    <h2 className="mt-1 text-2xl font-black">
                      {item.playerName}
                    </h2>
                  </div>

                  <div className="flex items-center gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Origem
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {item.sellerName}
                      </p>
                    </div>

                    <span className="text-3xl font-black text-green-400">
                      →
                    </span>

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Destino
                      </p>

                      <p className="mt-1 text-lg font-black">
                        {item.buyerName}
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
                      {date(item.completedAt)}
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
