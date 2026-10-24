"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = { id: number; name: string; budget: number | null };
type Transaction = {
  id: number;
  transaction_type: string;
  amount: number;
  reason: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
};
const PAGE_SIZE = 25;
const money = (value: number | null) => Number(value ?? 0).toLocaleString("pt-BR", {
  style: "currency", currency: "BRL", maximumFractionDigits: 0,
});

export default function FinanceiroPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [page, setPage] = useState(0);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setTeam(null);
    setTransactions([]);
    try {
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Entre novamente para consultar o financeiro.");
      // Ownership comes from the database, never from URL parameters or user metadata.
      const { data: ownTeam, error: teamError } = await supabase.from("teams")
        .select("id, name, budget").eq("manager_id", user.id).maybeSingle();
      if (teamError) throw teamError;
      if (!ownTeam) return;
      // RLS also restricts financial_transactions to the authenticated team's manager.
      const { data, count, error: historyError } = await supabase.from("financial_transactions")
        .select("id, transaction_type, amount, reason, balance_before, balance_after, created_at", { count: "exact" })
        .eq("team_id", ownTeam.id)
        .order("created_at", { ascending: false }).order("id", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);
      if (historyError) throw historyError;
      setTeam(ownTeam);
      setTransactions(data ?? []);
      setTotal(count ?? 0);
    } catch {
      setError("Não foi possível carregar o financeiro. Verifique sua conexão e tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [page]);

  useEffect(() => { void load(); }, [load]);

  return (
    <main className="min-h-screen bg-zinc-950 p-4 text-white sm:p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">Financeiro da Minha Equipe</h1>
            <p className="mt-2 text-zinc-400">Saldo atual e histórico de entradas e saídas da sua equipe.</p>
          </div>
          <button type="button" disabled={loading} onClick={() => void load()}
            className="rounded-xl border border-zinc-700 px-4 py-3 font-bold hover:bg-zinc-800 disabled:opacity-50">Atualizar</button>
        </header>

        {loading ? <p role="status" className="py-12 text-center text-zinc-400">Carregando financeiro...</p>
          : error ? <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-red-300">{error}</p>
          : !team ? <p className="rounded-xl border border-zinc-800 p-6 text-zinc-400">Sua conta ainda não está vinculada a uma equipe. Entre em contato com a administração.</p>
          : <>
            <section className="rounded-2xl border border-green-500/30 bg-green-500/5 p-6">
              <h2 className="text-lg font-bold">{team.name}</h2>
              <p className="mt-4 text-sm text-zinc-400">Saldo atual disponível</p>
              <p className={`mt-1 break-words text-3xl font-black sm:text-4xl ${Number(team.budget) < 0 ? "text-red-400" : "text-green-400"}`}>{money(team.budget)}</p>
            </section>
            <section className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/50">
              <h2 className="border-b border-zinc-800 p-5 text-lg font-bold">Histórico financeiro <span className="text-sm font-normal text-zinc-400">({total} registros)</span></h2>
              {transactions.length === 0 ? <p className="p-8 text-center text-zinc-400">Nenhuma movimentação financeira registrada.</p>
                : <div className="overflow-x-auto">
                  <table className="w-full min-w-[760px] text-left text-sm">
                    <caption className="sr-only">Movimentações financeiras de {team.name}, da mais recente para a mais antiga</caption>
                    <thead className="bg-zinc-800/50 text-zinc-400"><tr>
                      {["Data", "Tipo", "Descrição", "Valor", "Saldo anterior", "Saldo após"].map(label => <th scope="col" key={label} className="p-4">{label}</th>)}
                    </tr></thead>
                    <tbody>{transactions.map(item => {
                      const delta = Number(item.balance_after) - Number(item.balance_before);
                      return <tr key={item.id} className="border-t border-zinc-800 align-top">
                        <td className="whitespace-nowrap p-4">{new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</td>
                        <td className="p-4">{item.transaction_type === "credit" ? "Entrada" : item.transaction_type === "debit" ? "Saída" : "Ajuste"}</td>
                        <td className="min-w-56 whitespace-pre-wrap break-words p-4">{item.reason}</td>
                        <td className={`whitespace-nowrap p-4 font-bold ${delta < 0 ? "text-red-400" : "text-green-400"}`}>{delta > 0 ? "+" : ""}{money(delta)}</td>
                        <td className="whitespace-nowrap p-4 text-zinc-400">{money(item.balance_before)}</td>
                        <td className="whitespace-nowrap p-4 font-bold">{money(item.balance_after)}</td>
                      </tr>;
                    })}</tbody>
                  </table>
                </div>}
              <div className="flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800 p-4">
                <p className="text-sm text-zinc-400">Página {page + 1} de {Math.max(1, Math.ceil(total / PAGE_SIZE))} · Horário de Brasília</p>
                <div className="flex gap-3">
                  <button type="button" disabled={page === 0} onClick={() => setPage(p => p - 1)} className="rounded-lg border border-zinc-700 px-4 py-2 disabled:opacity-40">Anterior</button>
                  <button type="button" disabled={(page + 1) * PAGE_SIZE >= total} onClick={() => setPage(p => p + 1)} className="rounded-lg border border-zinc-700 px-4 py-2 disabled:opacity-40">Próxima</button>
                </div>
              </div>
            </section>
          </>}
      </div>
    </main>
  );
}
