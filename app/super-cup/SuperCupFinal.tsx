"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = { id: number; name: string; logo_url: string | null };
type Final = { home_team_id: number | null; away_team_id: number | null };
type Result = { home_team_id: number; away_team_id: number; home_goals: number | null; away_goals: number | null; winner_team_id: number | null; status: string };
const season = 2026;

export default function SuperCupFinal({ admin = false }: { admin?: boolean }) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [final, setFinal] = useState<Final | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const [match, clubs, played] = await Promise.all([
        supabase.from("fz_super_cup_final").select("home_team_id,away_team_id").eq("season_year", season).single(),
        supabase.from("teams").select("id,name,logo_url").order("name"),
        supabase.from("fz_matches").select("home_team_id,away_team_id,home_goals,away_goals,winner_team_id,status,fz_seasons!inner(year)").eq("competition_id", "super_cup").eq("fz_seasons.year", season).eq("status", "final").order("finalized_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (!alive) return;
      if (match.error || clubs.error) setMessage("Não foi possível carregar a final. Atualize a página para tentar novamente.");
      else { setFinal(match.data); setTeams(clubs.data || []); if (!played.error) setResult(played.data); }
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  async function save() {
    if (!final) return;
    if (final.home_team_id !== null && final.home_team_id === final.away_team_id) {
      setMessage("Escolha equipes diferentes para a final."); return;
    }
    setSaving(true); setMessage("");
    try {
      const { data, error } = await supabase.from("fz_super_cup_final")
        .update(final).eq("season_year", season).select("home_team_id,away_team_id").single();
      if (error) setMessage("Não foi possível salvar os finalistas. Verifique seu acesso administrativo e tente novamente.");
      else { setFinal(data); setMessage("Finalistas salvos! A final já está disponível na página pública."); }
    } catch { setMessage("Falha de conexão. Tente salvar novamente."); }
    finally { setSaving(false); }
  }

  const completed = result?.status === "final" && result.home_team_id === final?.home_team_id && result.away_team_id === final?.away_team_id;
  const champion = completed ? teams.find(t => t.id === result?.winner_team_id) : null;

  if (loading) return <p className="text-center text-slate-400">Carregando final...</p>;
  return <section className="mx-auto max-w-3xl rounded-2xl border border-amber-500/40 bg-[#0b1830] p-5 md:p-8">
    <h2 className="text-center text-2xl font-black text-amber-300">🏆 Final — {season}</h2>
    {message && <p role="status" className="my-4 rounded-xl bg-zinc-900 p-4 text-amber-200">{message}</p>}
    {final && <>
      <div className="mt-6 grid grid-cols-[1fr_auto_1fr] items-center gap-3 md:gap-6">
        {(["home_team_id", "away_team_id"] as const).map((key, index) => {
          const team = teams.find(t => t.id === final[key]);
          return <div key={key} className="contents">
            {index === 1 && <span className="text-xl font-black text-amber-300">{completed ? `${result?.home_goals} × ${result?.away_goals}` : "×"}</span>}
            <div className="min-w-0 rounded-xl bg-[#071120] p-3 text-center md:p-5">
              {team?.logo_url && <img src={team.logo_url} alt="" className="mx-auto mb-3 h-20 w-20 object-contain" />}
              <p className="mb-3 font-bold">{team?.name || "A definir"}</p>
              {admin && <select aria-label={`Finalista ${index + 1}`} className="w-full rounded-lg bg-slate-900 p-3 text-sm" value={final[key] ?? ""} disabled={saving} onChange={e => { setFinal({ ...final, [key]: e.target.value ? Number(e.target.value) : null }); setMessage(""); }}>
                <option value="">A definir</option>
                {teams.map(club => <option key={club.id} value={club.id} disabled={club.id === final[index === 0 ? "away_team_id" : "home_team_id"]}>{club.name}</option>)}
              </select>}
            </div>
          </div>;
        })}
      </div>
      {champion && <div className="mt-6 rounded-xl border border-amber-400/50 bg-amber-400/10 p-5 text-center" role="status"><p className="text-sm font-bold uppercase tracking-widest text-amber-300">🏆 Campeão da Super Cup {season}</p><p className="mt-2 text-2xl font-black text-white">{champion.name}</p><p className="mt-2 text-sm text-slate-300">Final encerrada</p></div>}
      {admin && <button onClick={() => void save()} disabled={saving} className="mt-6 w-full rounded-xl bg-sky-700 px-5 py-3 font-bold disabled:opacity-50">{saving ? "Salvando..." : "Salvar finalistas"}</button>}
    </>}
  </section>;
}
