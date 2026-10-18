"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Standing = {
  season_id: number;
  team_id: number;
  team_name: string;
  games: number;
  wins: number;
  draws: number;
  losses: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
};
type Honor = { champion_team_id: number; runner_up_team_id: number };
type Club = { id: number; name: string; logo_url: string | null };

export default function Standings2026() {
  const [rows, setRows] = useState<Standing[]>([]);
  const [clubs, setClubs] = useState<Club[]>([]);
  const [honor, setHonor] = useState<Honor | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const [seasons, teamResponse] = await Promise.all([
        supabase.from("fz_seasons").select("id, year").in("year", [2025, 2026]),
        supabase.from("teams").select("id, name, logo_url"),
      ]);
      if (!alive) return;
      if (seasons.error || teamResponse.error || !seasons.data) {
        setError("Não foi possível carregar as temporadas. Tente atualizar a página.");
        setLoading(false);
        return;
      }
      const s2026 = seasons.data.find((s) => s.year === 2026);
      const s2025 = seasons.data.find((s) => s.year === 2025);
      if (!s2026 || !s2025) {
        setError("Temporadas não encontradas.");
        setLoading(false);
        return;
      }
      const [table, hall] = await Promise.all([
        supabase.from("fz_premier_standings").select("*").eq("season_id", s2026.id),
        supabase.from("fz_hall_of_fame").select("champion_team_id, runner_up_team_id").eq("season_id", s2025.id).eq("competition_id", "premier").maybeSingle(),
      ]);
      if (!alive) return;
      if (table.error || hall.error) {
        setError("Não foi possível carregar a classificação ou o Hall da Fama.");
      } else {
        setRows((table.data || []) as Standing[]);
        setHonor((hall.data || null) as Honor | null);
        setClubs((teamResponse.data || []) as Club[]);
      }
      setLoading(false);
    }
    void load();
    return () => { alive = false; };
  }, []);

  const club = (id: number) => clubs.find((t) => t.id === id);
  const ordered = [...rows].sort((a, b) =>
    b.points - a.points || b.wins - a.wins ||
    b.goal_difference - a.goal_difference || b.goals_for - a.goals_for ||
    a.team_name.localeCompare(b.team_name, "pt-BR")
  );

  return (
    <section className="mb-14 space-y-7">
      <div className="rounded-3xl border border-amber-500/40 bg-zinc-900 p-5 md:p-7">
        <h2 className="text-2xl font-black text-amber-300 md:text-3xl">🏆 Hall da Fama</h2>
        <p className="mt-1 text-sm text-zinc-400">Premier League · Temporada 2025</p>
        {loading ? <p className="mt-5 text-zinc-400">Carregando...</p> : honor ? (
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              { label: "🥇 Campeão", id: honor.champion_team_id },
              { label: "🥈 Vice-campeão", id: honor.runner_up_team_id },
            ].map(({ label, id }) => (
              <div key={label} className="flex items-center gap-4 rounded-2xl bg-zinc-950 p-5">
                {club(id)?.logo_url && <img src={club(id)!.logo_url!} alt="" className="h-12 w-12 object-contain" />}
                <div><p className="text-sm text-amber-300">{label}</p><p className="font-bold">{club(id)?.name || "Equipe"}</p></div>
              </div>
            ))}
          </div>
        ) : <p className="mt-4 text-zinc-400">Histórico indisponível.</p>}
      </div>
      <div className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 p-5 md:p-7">
          <p className="text-xs font-black uppercase tracking-widest text-green-400">Temporada 2026</p>
          <h2 className="mt-1 text-2xl font-black md:text-3xl">📊 Classificação da Premier League</h2>
          <p className="mt-2 text-sm text-zinc-400">Tabela calculada automaticamente a partir dos resultados oficiais.</p>
        </div>
        {loading ? <p className="p-6 text-zinc-400">Carregando classificação...</p> : error ? <p role="alert" className="p-6 text-red-400">{error}</p> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-zinc-950 text-xs uppercase text-zinc-400">
                <tr>{["#","Equipe","PTS","J","V","E","D","GP","GC","SG"].map((x) => <th key={x} className="px-3 py-4 first:pl-5">{x}</th>)}</tr>
              </thead>
              <tbody>{ordered.map((r, i) => (
                <tr key={r.team_id} className="border-t border-zinc-800">
                  <td className="py-3 pl-5 pr-3 text-zinc-400">{i + 1}</td>
                  <td className="px-3 py-3 font-bold"><span className="flex items-center gap-3">{club(r.team_id)?.logo_url && <img src={club(r.team_id)!.logo_url!} alt="" className="h-7 w-7 object-contain" />}{r.team_name}</span></td>
                  {[r.points,r.games,r.wins,r.draws,r.losses,r.goals_for,r.goals_against,r.goal_difference].map((n,j) => <td key={j} className={"px-3 py-3 tabular-nums " + (j===0 ? "font-black text-green-400" : "")}>{n}</td>)}
                </tr>
              ))}</tbody>
            </table>
            {ordered.length === 0 && <p className="p-6 text-zinc-400">Nenhuma equipe encontrada.</p>}
          </div>
        )}
      </div>
    </section>
  );
}
