"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type PlayerHistoryRow = {
  id: number;
  negotiation_id: number | null;
  player_id: number;
  seller_team_id: number;
  buyer_team_id: number;
  amount: number | null;
  completed_at: string | null;
};

type StaffTransferRow = {
  id: number;
  coach_id: number;
  coach_name: string;
  from_team_id: number | null;
  from_team_name: string | null;
  to_team_id: number;
  to_team_name: string;
  amount: number | null;
  transfer_type: string;
  created_at: string | null;
};

type BidItem = {
  key: string;
  kind: "player" | "staff";
  subjectName: string;
  roleName?: string;
  sellerName: string;
  buyerName: string;
  amount: number;
  completedAt: string;
  transferType?: string;
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

    try {
      const [playerHistoryResult, staffHistoryResult] = await Promise.all([
        supabase
          .from("transfer_history")
          .select(
            "id, negotiation_id, player_id, seller_team_id, buyer_team_id, amount, completed_at"
          )
          .order("completed_at", { ascending: false }),

        supabase
          .from("staff_draft_transfers")
          .select(
            "id, coach_id, coach_name, from_team_id, from_team_name, to_team_id, to_team_name, amount, transfer_type, created_at"
          )
          .order("created_at", { ascending: false }),
      ]);

      if (playerHistoryResult.error) {
        console.error(
          "Erro ao carregar transfer_history:",
          playerHistoryResult.error
        );
      }

      if (staffHistoryResult.error) {
        console.error(
          "Erro ao carregar staff_draft_transfers:",
          staffHistoryResult.error
        );
      }

      if (playerHistoryResult.error && staffHistoryResult.error) {
        setError("Não foi possível carregar o BID.");
        setItems([]);
        return;
      }

      const result: BidItem[] = [];

      const playerHistory =
        (playerHistoryResult.data || []) as PlayerHistoryRow[];

      for (const row of playerHistory) {
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
          key: `player-${row.id}`,
          kind: "player",
          subjectName:
            playerResult.data?.name || `Jogador #${row.player_id}`,
          sellerName:
            sellerResult.data?.name || `Clube #${row.seller_team_id}`,
          buyerName:
            buyerResult.data?.name || `Clube #${row.buyer_team_id}`,
          amount: Number(row.amount || 0),
          completedAt: row.completed_at || "",
        });
      }

      const staffHistory =
        (staffHistoryResult.data || []) as StaffTransferRow[];

      for (const row of staffHistory) {
        const { data: coachData } = await supabase
          .from("coaches")
          .select("role")
          .eq("id", row.coach_id)
          .maybeSingle();

        result.push({
          key: `staff-${row.id}`,
          kind: "staff",
          subjectName: row.coach_name || `Staff #${row.coach_id}`,
          roleName: coachData?.role || "Staff",
          sellerName: row.from_team_name || "Mercado / Draft",
          buyerName: row.to_team_name || `Clube #${row.to_team_id}`,
          amount: Number(row.amount || 0),
          completedAt: row.created_at || "",
          transferType: row.transfer_type,
        });
      }

      result.sort((a, b) => {
        const dateA = new Date(a.completedAt || 0).getTime();
        const dateB = new Date(b.completedAt || 0).getTime();
        return dateB - dateA;
      });

      setItems(result);
    } catch (loadError) {
      console.error("Erro inesperado no BID:", loadError);
      setError("Não foi possível carregar o BID.");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

  function money(value: number) {
    if (Number(value || 0) === 0) {
      return "GRÁTIS";
    }

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

  function pricingLabel(value?: string) {
    if (!value) return "";

    const labels: Record<string, string> = {
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
            Boletim oficial das transferências de jogadores e comissão técnica.
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
              As negociações concluídas aparecerão aqui.
            </p>
          </div>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-4">
            {items.map((item) => (
              <article
                key={item.key}
                className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
              >
                <div className="grid gap-5 md:grid-cols-[1.25fr_2fr_1fr] md:items-center">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        {item.kind === "staff" ? "Staff" : "Jogador"}
                      </p>

                      {item.kind === "staff" && (
                        <span className="rounded-full border border-purple-500/30 bg-purple-500/10 px-2 py-1 text-[10px] font-black uppercase text-purple-300">
                          Comissão Técnica
                        </span>
                      )}
                    </div>

                    <h2 className="mt-1 text-2xl font-black">
                      {item.subjectName}
                    </h2>

                    {item.kind === "staff" && item.roleName && (
                      <p className="mt-1 text-sm font-bold text-purple-300">
                        {item.roleName}
                      </p>
                    )}
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

                    {item.kind === "staff" && item.transferType && (
                      <p className="mt-1 text-xs font-black text-purple-300">
                        {pricingLabel(item.transferType)}
                      </p>
                    )}

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
