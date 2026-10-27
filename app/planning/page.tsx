"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import TeamPlanner from "@/app/components/TeamPlanner";
import { PLANNING_PLAYER_COLUMNS, type PlanningPlayer, type PlanningTeam } from "@/lib/team-planning";

export default function PlanningPage() {
  const [team, setTeam] = useState<PlanningTeam | null>(null);
  const [roster, setRoster] = useState<PlanningPlayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError("");
      try {
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError) throw authError;
        if (!user) throw new Error("Sua sessão expirou. Entre novamente.");
        const { data, error: teamError } = await supabase.from("teams").select("id,name,budget").eq("manager_id", user.id).maybeSingle();
        if (teamError) throw teamError;
        if (!active) return;
        setTeam(data as PlanningTeam | null);
        if (!data) return;
        const { data: players, error: playersError } = await supabase.from("players").select(PLANNING_PLAYER_COLUMNS).eq("team_id", data.id).order("ca", { ascending: false, nullsFirst: false });
        if (playersError) throw playersError;
        if (active) setRoster((players || []) as PlanningPlayer[]);
      } catch {
        if (active) setError("Não foi possível carregar o planejamento. Verifique a conexão e tente novamente.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [retry]);

  return <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white md:px-8"><div className="mx-auto max-w-[1400px]">
    <Link href="/transfers/shopping-list" className="text-sm font-bold text-zinc-400 hover:text-green-400">← Minha lista preferencial</Link>
    <header className="mt-5"><p className="text-xs font-bold uppercase tracking-widest text-green-400">FriendZone League FM · {team?.name || "Minha equipe"}</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Meu planejamento</h1></header>
    <nav aria-label="Lista e planejamento" className="mt-5 flex flex-col items-start gap-2 text-sm font-bold"><Link href="/transfers/shopping-list" className="rounded-lg px-4 py-2 text-zinc-400 hover:bg-zinc-900">🛒 Minha lista</Link><Link href="/planning" aria-current="page" className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-green-400">⚽ Meu planejamento</Link></nav>
    {loading ? <p role="status" className="mt-8 text-zinc-400">Carregando sua equipe...</p> : error ? <div role="alert" className="mt-8 rounded-xl border border-red-500/30 p-5"><p className="text-red-300">{error}</p><button className="mt-3 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-bold" onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button></div> : team ? <TeamPlanner key={team.id} team={team} roster={roster} mode="planning" /> : <p className="mt-8 text-zinc-400">Você ainda não possui um clube. <Link className="text-green-400" href="/choose-team">Escolher clube →</Link></p>}
  </div></main>;
}
