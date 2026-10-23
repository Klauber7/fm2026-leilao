"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = { id: number; name: string; budget: number | null; manager_id: string | null };
type Player = { id: number; name: string; position: string | null; value: number | null; drafted: boolean | null };
type Release = { id: string; team_id: number; player_name: string; refund: number; original_value: number; created_at: string };
const money = (value: number | null) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const messages: Record<string, string> = {
  FULL_REFUND_ALREADY_USED: "Sua equipe já utilizou a dispensa de 100% desta rodada.",
  NOT_AUTHENTICATED: "Entre novamente para confirmar a dispensa.",
  TEAM_NOT_FOUND: "Sua conta não está vinculada a uma equipe.",
  PLAYER_NOT_FOUND: "Jogador não encontrado. Atualize a lista.",
  PLAYER_NOT_OWNED: "Esse jogador não pertence mais à sua equipe.",
  INVALID_PLAYER_VALUE: "O jogador precisa ter um valor válido antes da dispensa.",
  DRAFT_PLAYER_LOCKED: "Este jogador tem vínculo protegido e não pode ser dispensado.",
  PLAYER_ON_LOAN: "Resolva o empréstimo deste jogador antes da dispensa.",
  PLAYER_IN_NEGOTIATION: "Encerre a negociação ou o leilão deste jogador antes da dispensa.",
};

export default function FullRefundReleasesPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [releases, setReleases] = useState<Release[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [selected, setSelected] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [auth, clubs, ledger] = await Promise.all([
        supabase.auth.getUser(),
        supabase.from("teams").select("id,name,budget,manager_id").order("name"),
        supabase.from("full_refund_releases").select("id,team_id,player_name,refund,original_value,created_at"),
      ]);
      if (auth.error) throw auth.error;
      if (clubs.error) throw clubs.error;
      if (ledger.error) throw ledger.error;
      const uid = auth.data.user?.id || null;
      const allTeams = (clubs.data || []) as Team[];
      setUserId(uid);
      setTeams(allTeams);
      setReleases((ledger.data || []) as Release[]);
      const ownTeam = allTeams.find((team) => team.manager_id === uid);
      if (ownTeam) {
        const result = await supabase.from("players").select("id,name,position,value,drafted")
          .eq("team_id", ownTeam.id).order("name");
        if (result.error) throw result.error;
        setPlayers((result.data || []) as Player[]);
      } else setPlayers([]);
    } catch {
      setError("Não foi possível atualizar as dispensas. Recarregue a página para tentar novamente.");
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function releasePlayer() {
    const player = players.find((item) => String(item.id) === selected);
    if (!player || submitting) return;
    if (!window.confirm(`Dispensar ${player.name}?\n\nSeu clube recebe 100%: ${money(player.value)}.\nO jogador volta ao mercado pelo valor original e a transação será registrada no BID.\n\nEsta é a única dispensa de 100% da sua equipe nesta rodada. Confirmar?`)) return;
    setSubmitting(true); setError(""); setSuccess("");
    try {
      const result = await supabase.rpc("release_player_full_refund", { p_player_id: player.id });
      if (result.error) throw result.error;
      setSuccess(`${result.data.player_name} foi dispensado. ${money(Number(result.data.refund))} creditados no caixa. Registro publicado no BID.`);
      setSelected("");
      await load();
    } catch (failure) {
      const message = failure && typeof failure === "object" && "message" in failure ? String(failure.message) : "";
      setError(Object.entries(messages).find(([code]) => message.includes(code))?.[1] || "Não foi possível confirmar a dispensa. Atualize a página para conferir o resultado antes de tentar novamente.");
    } finally { setSubmitting(false); }
  }

  const ownTeam = teams.find((team) => userId !== null && team.manager_id === userId);
  const selectedPlayer = players.find((player) => String(player.id) === selected);

  return <main className="min-h-screen bg-zinc-950 px-5 py-10 text-white md:px-10">
    <div className="mx-auto max-w-7xl">
      <p className="text-sm font-black uppercase tracking-widest text-emerald-400">FriendZone League FM</p>
      <h1 className="mt-2 text-4xl font-black md:text-5xl">Dispensa 100%</h1>
      <p className="mt-4 max-w-3xl text-zinc-300">Cada equipe pode dispensar 1 jogador do próprio elenco e receber 100% do valor. O jogador volta ao mercado pelo preço original, com registro automático no BID.</p>
      <div className="mt-6 flex flex-wrap gap-3">
        {ownTeam && <a href={`#equipe-${ownTeam.id}`} className="rounded-xl bg-emerald-600 px-5 py-3 font-bold hover:bg-emerald-500">Ir para minha equipe</a>}
        <Link href="/bid" className="rounded-xl border border-zinc-700 px-5 py-3 font-bold hover:bg-zinc-800">Ver registros no BID</Link>
      </div>
      {!loading && <p className="mt-5 text-sm text-zinc-400">{releases.length} de {teams.length} equipes já utilizaram a dispensa.</p>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">{error}</p>}
      {success && <p role="status" className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-emerald-200">{success}</p>}
      {loading ? <p className="mt-10 text-zinc-400">Carregando equipes...</p> : <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const receipt = releases.find((item) => item.team_id === team.id);
          const isOwner = userId !== null && team.manager_id === userId;
          return <section id={`equipe-${team.id}`} key={team.id} className={`scroll-mt-6 rounded-2xl border p-5 ${isOwner ? "border-emerald-500/60 bg-emerald-950/20" : "border-zinc-800 bg-zinc-900"}`}>
            <div className="flex items-start justify-between gap-3">
              <Link href={`/teams/${team.id}`} className="text-xl font-black hover:text-emerald-300">{team.name}</Link>
              <span className={`rounded-full px-3 py-1 text-xs font-bold ${receipt ? "bg-zinc-800 text-zinc-300" : "bg-emerald-500/15 text-emerald-300"}`}>{receipt ? "Utilizada" : "1 disponível"}</span>
            </div>
            {receipt ? <div className="mt-5">
              <p className="text-xs uppercase text-zinc-400">Jogador dispensado</p>
              <p className="mt-1 text-lg font-bold">{receipt.player_name}</p>
              <p className="mt-3 text-2xl font-black text-emerald-400">+ {money(receipt.refund)}</p>
              <p className="mt-2 text-sm text-zinc-400">Devolvido ao mercado · registrado no BID</p>
            </div> : isOwner ? <div className="mt-5">
              <p className="mb-4 text-sm text-zinc-400">Caixa: {money(team.budget)}</p>
              <label htmlFor="release-player" className="mb-2 block text-sm font-bold">Escolha um jogador do seu elenco</label>
              <select id="release-player" value={selected} disabled={submitting} onChange={(event) => setSelected(event.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-3 text-white">
                <option value="">Selecionar jogador</option>
                {players.filter((player) => !player.drafted && Number(player.value) > 0).map((player) => <option key={player.id} value={player.id}>{player.name} · {player.position} · {money(player.value)}</option>)}
              </select>
              {selectedPlayer && <p className="mt-3 text-sm text-emerald-300">Seu clube recebe: <strong>{money(selectedPlayer.value)}</strong></p>}
              <button type="button" disabled={!selected || submitting} onClick={() => void releasePlayer()} className="mt-4 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-40">{submitting ? "Confirmando..." : "Dispensar e receber 100%"}</button>
              <p className="mt-3 text-xs text-zinc-500">1 jogador por equipe. A escolha é definitiva após a confirmação.</p>
            </div> : <p className="mt-5 text-sm text-zinc-400">Aguardando a escolha do presidente desta equipe.</p>}
          </section>;
        })}
      </div>}
    </div>
  </main>;
}
