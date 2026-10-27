"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { getPositionBadge, getPositionGroup, POSITION_SECTIONS } from "@/lib/squad-positions";
import {
  addPlayerToPlan, assignStarter, changeFormation, cleanPlan, emptyPlan, FORMATIONS, isFormation,
  money, PLANNING_PLAYER_COLUMNS, planTotals, suggestStarters,
  type PlanKind, type PlanningPlayer, type PlanningTeam, type TeamPlan,
} from "@/lib/team-planning";

type Staff = { id: number; name: string; role: string | null; image_url: string | null; ca: number | null };
const control = "rounded-lg border border-zinc-700 bg-zinc-900 px-3 py-2 text-sm text-white focus:outline-2 focus:outline-green-400 disabled:opacity-50";
const action = `${control} font-bold transition hover:border-green-500`;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").trim();

export function PersonPhoto({ name, src, large = false }: { name: string; src: string | null; large?: boolean }) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const safeSrc = src && /^https?:\/\//i.test(src) && src !== failedSrc ? src : null;
  return (
    <span className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-white/15 bg-zinc-800 text-lg font-black text-zinc-300 ${large ? "h-14 w-14 sm:h-16 sm:w-16" : "h-11 w-11"}`}>
      {safeSrc ? <img src={safeSrc} alt={name} loading="lazy" className="h-full w-full object-contain" onError={() => setFailedSrc(src)} /> : name.slice(0, 1).toUpperCase()}
    </span>
  );
}

export default function TeamPlanner({ team, roster, mode }: { team: PlanningTeam; roster: PlanningPlayer[]; mode: PlanKind }) {
  const [plans, setPlans] = useState<TeamPlan[]>([]);
  const [plan, setPlan] = useState<TeamPlan | null>(null);
  const [extras, setExtras] = useState<PlanningPlayer[]>([]);
  const [shortlist, setShortlist] = useState<number[]>([]);
  const [listSearch, setListSearch] = useState("");
  const [listGroup, setListGroup] = useState("all");
  const [listLoading, setListLoading] = useState(false);
  const [listError, setListError] = useState("");
  const listRequest = useRef(0);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [staffError, setStaffError] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [saveError, setSaveError] = useState("");
  const [slotIndex, setSlotIndex] = useState<number | null>(null);
  const [source, setSource] = useState("roster");
  const [search, setSearch] = useState("");
  const [group, setGroup] = useState("all");
  const [results, setResults] = useState<PlanningPlayer[]>([]);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [pendingPlayer, setPendingPlayer] = useState<number | null>(null);
  const field = useRef<HTMLDivElement>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const opener = useRef<HTMLButtonElement | null>(null);
  const planning = mode === "planning";

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setLoadError("");
      setStaffError("");
      setPlan(null);
      setDirty(false);
      try {
        const [saved, coaches, shopping] = await Promise.all([
          supabase.from("team_plans").select("*").eq("team_id", team.id).eq("kind", mode).order("updated_at", { ascending: false }),
          supabase.from("coaches").select("id,name,role,image_url,ca").eq("team_id", team.id).order("ca", { ascending: false, nullsFirst: false }),
          planning ? supabase.from("player_shopping_list").select("player_id").eq("team_id", team.id) : Promise.resolve({ data: [], error: null }),
        ]);
        if (saved.error) throw saved.error;
        if (shopping.error) throw shopping.error;
        const savedPlans = (saved.data || []) as TeamPlan[];
        const shortlistIds = (shopping.data || []).map((row) => Number(row.player_id));
        const extraIds = [...new Set([...shortlistIds, ...savedPlans.flatMap((p) => [...p.targets, ...p.starters.filter((id): id is number => id !== null)])])];
        const playerRows: PlanningPlayer[] = [];
        // Chunk the ID list to avoid overly long REST URLs for larger saved lists.
        for (let offset = 0; offset < extraIds.length; offset += 100) {
          const response = await supabase.from("players").select(PLANNING_PLAYER_COLUMNS).in("id", extraIds.slice(offset, offset + 100));
          if (response.error) throw response.error;
          playerRows.push(...(response.data || []) as PlanningPlayer[]);
        }
        if (!active) return;
        setPlans(savedPlans);
        setPlan(savedPlans[0] || emptyPlan(team.id, mode));
        setExtras(playerRows);
        setShortlist(shortlistIds);
        setStaff((coaches.data || []) as Staff[]);
        if (coaches.error) setStaffError("Não foi possível carregar a comissão técnica. Tente recarregar a página.");
      } catch {
        if (active) setLoadError("Não foi possível carregar seus planos. Tente novamente; suas alterações salvas continuam protegidas.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [team.id, mode, planning, retry]);

  const refreshShortlist = useCallback(async () => {
    if (!planning) return;
    const request = ++listRequest.current;
    setListLoading(true);
    setListError("");
    try {
      const { data, error } = await supabase.from("player_shopping_list").select("player_id").eq("team_id", team.id);
      if (error) throw error;
      const ids = (data || []).map((row) => Number(row.player_id));
      const rows: PlanningPlayer[] = [];
      for (let offset = 0; offset < ids.length; offset += 100) {
        const response = await supabase.from("players").select(PLANNING_PLAYER_COLUMNS).in("id", ids.slice(offset, offset + 100));
        if (response.error) throw response.error;
        rows.push(...(response.data || []) as PlanningPlayer[]);
      }
      if (request !== listRequest.current) return;
      setShortlist(ids);
      setExtras((existing) => [...new Map([...existing, ...rows].map((p) => [p.id, p])).values()]);
    } catch {
      if (request === listRequest.current) setListError("Não foi possível atualizar sua lista preferencial. Tente novamente.");
    } finally {
      if (request === listRequest.current) setListLoading(false);
    }
  }, [team.id, planning]);

  useEffect(() => {
    if (!planning || loading) return;
    const refresh = () => { void refreshShortlist(); };
    const onVisibility = () => { if (document.visibilityState === "visible") refresh(); };
    const channel = supabase.channel(`planning-shortlist-${team.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "player_shopping_list", filter: `team_id=eq.${team.id}` }, refresh)
      .subscribe();
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      ++listRequest.current;
      void supabase.removeChannel(channel);
      window.removeEventListener("focus", refresh);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [planning, loading, team.id, refreshShortlist]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (slotIndex !== null) dialog.current?.showModal();
    else if (dialog.current?.open) dialog.current.close();
  }, [slotIndex]);

  useEffect(() => {
    if (slotIndex === null || source !== "market") return;
    let active = true;
    setSearching(true);
    setSearchError("");
    setResults([]);
    const timer = window.setTimeout(async () => {
      try {
        let query = supabase.from("players").select(PLANNING_PLAYER_COLUMNS)
          .or(`team_id.is.null,team_id.neq.${team.id}`).order("ca", { ascending: false, nullsFirst: false }).limit(40);
        const term = normalize(search);
        if (term) query = query.ilike("search_name", `%${term}%`);
        const { data, error } = await query;
        if (error) throw error;
        if (active) setResults((data || []) as PlanningPlayer[]);
      } catch {
        if (active) setSearchError("Não foi possível buscar jogadores. Tente outra busca ou use Minha lista.");
      } finally {
        if (active) setSearching(false);
      }
    }, 300);
    return () => { active = false; window.clearTimeout(timer); };
  }, [source, search, slotIndex, team.id]);

  const allPlayers = useMemo(() => [...new Map([...extras.filter((p) => p.team_id !== team.id), ...roster].map((p) => [p.id, p])).values()], [extras, roster, team.id]);
  const current = useMemo(() => plan ? cleanPlan(plan, allPlayers, team.id) : null, [plan, allPlayers, team.id]);
  const playerMap = useMemo(() => new Map(allPlayers.map((p) => [p.id, p])), [allPlayers]);
  const pool = useMemo(() => current ? allPlayers.filter((p) => p.team_id === team.id || current.targets.includes(p.id)) : [], [allPlayers, current, team.id]);
  const bench = useMemo(() => pool.filter((p) => !current?.starters.includes(p.id)).sort((a, b) => (b.ca ?? -1) - (a.ca ?? -1)), [pool, current]);
  const totals = planTotals(pool, team.id, team.budget, Number(current?.staff_budget || 0));
  const shortlistPlayers = useMemo(() => allPlayers.filter((p) => shortlist.includes(p.id)), [allPlayers, shortlist]);
  const visibleShortlist = shortlistPlayers.filter((p) => normalize(p.name).includes(normalize(listSearch)) && (listGroup === "all" || getPositionGroup(p) === listGroup));
  const candidatePlayers = source === "roster" ? roster : source === "planned" ? pool.filter((p) => p.team_id !== team.id) : source === "shortlist" ? allPlayers.filter((p) => shortlist.includes(p.id)) : results;
  const filtered = candidatePlayers.filter((p) => (source === "market" || normalize(p.name).includes(normalize(search))) && (group === "all" || getPositionGroup(p) === group));
  const missing = plan ? plan.starters.filter((id) => id !== null).length - (current?.starters.filter((id) => id !== null).length || 0) : 0;

  function edit(next: TeamPlan) {
    setPlan(next);
    setDirty(true);
    setFeedback("");
    setSaveError("");
  }

  function openPicker(index: number, button: HTMLButtonElement) {
    if (pendingPlayer !== null && current && index >= 0) {
      const player = playerMap.get(pendingPlayer);
      if (player) edit(addPlayerToPlan(current, player, index));
      setPendingPlayer(null);
      return;
    }
    opener.current = button;
    setSource(planning ? "shortlist" : "roster");
    setSearch("");
    setGroup("all");
    setSlotIndex(index);
  }

  function choose(player: PlanningPlayer) {
    if (!current || slotIndex === null) return;
    if (slotIndex === -1 && current.starters.includes(player.id)) {
      setSearchError("Este jogador já é titular. Clique na posição dele para enviá-lo ao banco.");
      return;
    }
    setExtras((rows) => [...rows.filter((p) => p.id !== player.id), player]);
    edit(addPlayerToPlan(current, player, slotIndex === -1 ? null : slotIndex));
    setSlotIndex(null);
  }

  function switchPlan(id: string) {
    if (dirty && !window.confirm("Trocar de plano e descartar as alterações não salvas?")) return;
    const selected = plans.find((p) => p.id === id);
    if (selected) { setPlan(selected); setPendingPlayer(null); setDirty(false); setFeedback(""); setSaveError(""); }
  }

  function newPlan(duplicate: boolean) {
    if (!current) return;
    if (!duplicate && dirty && !window.confirm("Criar outro plano e descartar as alterações não salvas?")) return;
    const next = duplicate ? { ...current, id: crypto.randomUUID(), name: `${current.name.slice(0, 70)} (cópia)` } : emptyPlan(team.id, mode);
    setPendingPlayer(null);
    edit(next);
  }

  async function save() {
    if (!current || busy) return;
    if (!current.name.trim()) { setSaveError("Dê um nome ao planejamento."); return; }
    setBusy(true);
    setSaveError("");
    setFeedback("");
    try {
      const { data, error } = await supabase.from("team_plans").upsert({
        id: current.id, team_id: team.id, kind: mode, name: current.name.trim(), formation: current.formation,
        starters: current.starters, targets: current.targets, staff_budget: Number(current.staff_budget || 0),
      }, { onConflict: "id" }).select().single();
      if (error) throw error;
      const saved = data as TeamPlan;
      setPlans((rows) => [saved, ...rows.filter((p) => p.id !== saved.id)]);
      setPlan(saved);
      setDirty(false);
      setFeedback(planning ? "Planejamento salvo na sua conta." : "Escalação salva na sua conta.");
    } catch {
      setSaveError("Não foi possível salvar. Confira a conexão e tente novamente. Se o elenco mudou, recarregue a página antes de tentar outra vez.");
    } finally { setBusy(false); }
  }

  async function deletePlan() {
    if (!current || busy || !window.confirm(`Excluir o planejamento “${current.name}”?`)) return;
    const id = current.id;
    setBusy(true);
    const { error } = await supabase.from("team_plans").delete().eq("id", id).eq("team_id", team.id);
    setBusy(false);
    if (error) { setSaveError("Não foi possível excluir o plano. Tente novamente."); return; }
    const remaining = plans.filter((p) => p.id !== id);
    setPlans(remaining);
    setPlan(remaining[0] || emptyPlan(team.id, mode));
    setDirty(false);
    setFeedback("Planejamento excluído.");
  }

  if (loading) return <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400" role="status">Carregando {planning ? "planejamento" : "escalação"}...</div>;
  if (loadError || !current) return <div className="mt-8 rounded-2xl border border-red-500/30 p-6" role="alert"><p>{loadError || "Não foi possível abrir o plano."}</p><button className={`${action} mt-4`} onClick={() => setRetry((n) => n + 1)}>Tentar novamente</button></div>;

  const slots = FORMATIONS[current.formation].flat();
  let fieldIndex = 0;
  return (
    <section className="mt-8 space-y-6" aria-label={planning ? "Meu planejamento" : "Minha escalação"}>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-widest text-green-400">{planning ? "Planejamento privado" : "Organize sua equipe"}</p>
          <h2 className="mt-1 text-2xl font-black">{planning ? "Meu planejamento" : "Minha escalação"}</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-400">{planning ? "Monte seu time e teste reforços da sua lista ou do mercado. Valores estimados; as escolhas não realizam contratações." : "Escolha a formação e clique nas posições para escalar. Todos os outros jogadores do clube ficam no banco."}</p>
        </div>
        {!planning && <Link href="/planning" className={action}>Planejar reforços →</Link>}
      </header>

      {feedback && <p role="status" className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-sm text-green-300">{feedback}</p>}
      {saveError && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">{saveError}</p>}
      {missing > 0 && <p role="status" className="text-sm text-amber-300">{missing} jogador(es) da escalação salva não está(ão) mais disponível(is). As posições foram liberadas.</p>}

      <fieldset disabled={busy} className="min-w-0 space-y-6">
        <legend className="sr-only">Configurar {planning ? "planejamento" : "escalação"}</legend>
        <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-zinc-800 bg-zinc-900/60 p-4">
          {planning && <>
            <label className="min-w-0 flex-1 text-xs text-zinc-400">Planos salvos
              <select className={`${control} mt-1 block w-full`} value={plans.some((p) => p.id === current.id) ? current.id : "new"} onChange={(e) => switchPlan(e.target.value)}>
                {!plans.some((p) => p.id === current.id) && <option value="new">Novo plano (não salvo)</option>}
                {plans.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </label>
            <button type="button" className={action} onClick={() => newPlan(false)}>Novo</button>
            <button type="button" className={action} onClick={() => newPlan(true)}>Duplicar</button>
            {plans.some((p) => p.id === current.id) && <button type="button" className={`${action} text-red-300`} onClick={() => void deletePlan()}>Excluir</button>}
            <label className="w-full text-xs text-zinc-400">Nome do planejamento<input className={`${control} mt-1 block w-full`} maxLength={80} value={current.name} onChange={(e) => edit({ ...current, name: e.target.value })} /></label>
          </>}
          <label className="text-xs text-zinc-400">Formação
            <select className={`${control} mt-1 block`} value={current.formation} onChange={(e) => { if (isFormation(e.target.value)) edit(changeFormation(current, e.target.value)); }}>
              {Object.keys(FORMATIONS).map((f) => <option key={f}>{f}</option>)}
            </select>
          </label>
          <button type="button" className={action} onClick={() => { if (!current.starters.some(Boolean) || window.confirm("Substituir os titulares por uma sugestão por posição e CA?")) edit({ ...current, starters: suggestStarters(pool, current.formation) }); }}>Sugerir por CA e posição</button>
          <button type="button" className={action} onClick={() => { if (window.confirm("Enviar todos os titulares para o banco?")) edit({ ...current, starters: Array(11).fill(null) }); }}>Limpar titulares</button>
          {planning && <button type="button" className={action} onClick={async () => {
            if (dirty && !window.confirm("Substituir este plano pela sua escalação salva?")) return;
            const { data, error } = await supabase.from("team_plans").select("*").eq("team_id", team.id).eq("kind", "lineup").maybeSingle();
            if (error) { setSaveError("Não foi possível carregar sua escalação."); return; }
            if (!data) { setSaveError("Salve primeiro sua escalação na página Elenco."); return; }
            const lineup = cleanPlan(data as TeamPlan, roster, team.id);
            edit({ ...current, formation: lineup.formation, starters: lineup.starters, targets: [] });
          }}>Usar minha escalação</button>}
        </div>

        {planning && <section aria-label="Jogadores da minha lista preferencial" className="rounded-2xl border border-indigo-500/30 bg-indigo-500/[0.04] p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div><h3 className="text-xl font-black">Minha lista preferencial <span className="text-sm text-indigo-300">({shortlistPlayers.length})</span></h3><p className="mt-2 max-w-3xl text-sm text-zinc-400">Todos os jogadores da sua lista estão disponíveis para planejar. Escolha quem será titular ou reserva; você decide depois se quer fazer uma oferta.</p></div>
            <div className="flex flex-wrap gap-2"><button type="button" className={action} disabled={listLoading} onClick={() => void refreshShortlist()}>{listLoading ? "Atualizando..." : "Atualizar lista"}</button><Link className={action} href="/transfers/shopping-list">Abrir minha lista →</Link></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <label className="text-xs text-zinc-400">Buscar na minha lista<input className={`${control} mt-1 block w-full`} value={listSearch} placeholder="Nome do jogador" onChange={(e) => setListSearch(e.target.value)} /></label>
            <label className="text-xs text-zinc-400">Filtrar lista por posição<select className={`${control} mt-1 block w-full`} value={listGroup} onChange={(e) => setListGroup(e.target.value)}><option value="all">Todas as posições</option>{POSITION_SECTIONS.map((g) => <option key={g.key} value={g.key}>{g.title}</option>)}</select></label>
          </div>
          {listError && <p role="alert" className="mt-3 text-sm text-red-300">{listError}</p>}
          {shortlistPlayers.length === 0 ? <p className="mt-4 rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">Sua lista preferencial está vazia. <Link href="/players" className="font-bold text-green-400">Adicionar jogadores no mercado →</Link></p> : visibleShortlist.length === 0 ? <p className="mt-4 text-sm text-zinc-400">Nenhum jogador da lista corresponde aos filtros.</p> : <div className="mt-4 grid max-h-[560px] gap-3 overflow-y-auto pr-1 sm:grid-cols-2 2xl:grid-cols-3">
            {visibleShortlist.map((player) => {
              const starter = current.starters.includes(player.id);
              const included = player.team_id === team.id || current.targets.includes(player.id);
              return <article key={player.id} className={`min-w-0 rounded-xl border bg-zinc-950/70 p-3 ${included ? "border-green-500/40" : "border-zinc-700"}`}>
                <div className="flex items-start gap-3"><PersonPhoto name={player.name} src={player.image_url} /><div className="min-w-0 flex-1"><Link href={`/players/${player.id}`} className="block truncate text-sm font-black hover:text-green-300">{player.name}</Link><p className="mt-1 text-[11px] text-zinc-400">{player.position || getPositionBadge(player)} · {player.age ?? "—"} anos</p><p className="mt-1 text-[11px] text-zinc-400">CA {player.ca ?? "—"} · CP {player.cp ?? "—"}</p></div></div>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-xs"><span className="font-bold text-amber-300">{money(player.value)}</span><span className={included ? "text-green-400" : "text-zinc-400"}>{starter ? "Titular no plano" : included ? "Reserva no plano" : "Disponível para planejar"}</span></div>
                <div className="mt-3 flex flex-wrap gap-2"><button type="button" className={`${action} flex-1 text-xs`} disabled={starter} onClick={() => {
                  setPendingPlayer(player.id);
                  field.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}>{starter ? "Já é titular" : "Escalar no campo"}</button><button type="button" className={`${action} flex-1 text-xs`} disabled={included} onClick={() => edit(addPlayerToPlan(current, player))}>{included ? "Já no plano" : "+ Reserva"}</button></div>
              </article>;
            })}
          </div>}
          <p className="mt-4 text-xs text-zinc-500">Estar na lista não aumenta o custo do plano. Apenas os reforços que você escolher entram no cálculo. Nenhuma oferta é enviada aqui.</p>
        </section>}

        <div className={`grid min-w-0 gap-5 ${planning ? "xl:grid-cols-[minmax(0,1fr)_280px]" : ""}`}>
          <div className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3"><h3 className="font-black">Titulares</h3><span className="text-xs text-zinc-400">{current.starters.filter(Boolean).length}/11 · {current.formation}</span></div>
            {pendingPlayer !== null && <div role="status" className="mb-3 flex items-center justify-between gap-3 rounded-xl border border-green-500/40 bg-green-500/10 p-3 text-sm text-green-300"><span>Clique na posição para escalar <strong>{playerMap.get(pendingPlayer)?.name}</strong>.</span><button type="button" className={action} onClick={() => setPendingPlayer(null)}>Cancelar</button></div>}
            <div ref={field} className="relative scroll-mt-24 overflow-hidden rounded-2xl border border-green-700/60 bg-[#0b3525] p-2 sm:p-5" style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 12%,rgba(255,255,255,.025) 12%,rgba(255,255,255,.025) 24%)" }}>
              <div aria-hidden="true" className="pointer-events-none absolute inset-3 rounded-sm border border-white/20 sm:inset-5"><div className="absolute inset-x-0 top-1/2 border-t border-white/20" /><div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/20" /><div className="absolute left-1/4 right-1/4 top-0 h-[15%] border-x border-b border-white/20" /><div className="absolute bottom-0 left-1/4 right-1/4 h-[15%] border-x border-t border-white/20" /></div>
              <div className="relative flex min-h-[580px] flex-col justify-between gap-5 py-4 sm:min-h-[640px]">
                {FORMATIONS[current.formation].map((row, rowIndex) => <div key={rowIndex} className="flex justify-around gap-1 sm:gap-3">
                  {row.map((slot) => {
                    const index = fieldIndex++;
                    const player = playerMap.get(current.starters[index] || -1);
                    const target = player && player.team_id !== team.id;
                    return <button type="button" key={index} aria-label={`${slot.label} ${index + 1}: ${player?.name || "escolher titular"}`} title={player?.name || "Escolher titular"} onClick={(e) => openPicker(index, e.currentTarget)} className={`flex w-full min-w-0 max-w-28 flex-col items-center gap-1 rounded-xl border px-0.5 py-2 text-center shadow-lg transition hover:border-green-300 focus-visible:outline-2 focus-visible:outline-green-300 ${target ? "border-amber-400/60 bg-amber-950/80" : "border-white/15 bg-zinc-950/70"}`}>
                      <span className="text-[10px] font-black text-green-300">{slot.label}</span>
                      {player ? <PersonPhoto name={player.name} src={player.image_url} large /> : <span className="flex h-14 w-12 items-center justify-center text-3xl font-light text-green-300 sm:h-16">+</span>}
                      <span className="line-clamp-2 w-full break-words text-[10px] font-black leading-tight sm:text-xs">{player?.name || "Escolher"}</span>
                      {player && <span className="text-[9px] text-zinc-300 sm:text-[10px]">CA {player.ca ?? "—"} · CP {player.cp ?? "—"}</span>}
                      {target && <span className="text-[9px] font-bold text-amber-300">Reforço</span>}
                    </button>;
                  })}
                </div>)}
              </div>
            </div>
          </div>

          {planning && <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-5 xl:sticky xl:top-5" aria-label="Resumo do planejamento">
            <p className="text-xs font-black uppercase tracking-widest text-green-400">Seu plano, na conta</p>
            <dl className="mt-5 space-y-4 text-sm">
              <div><dt className="text-zinc-400">Orçamento atual</dt><dd className="mt-1 text-xl font-black">{money(team.budget)}</dd></div>
              <div><dt className="text-zinc-400">Reforços planejados ({current.targets.length})</dt><dd className="mt-1 font-bold text-amber-300">{money(totals.cost)}</dd></div>
            </dl>
            <label className="mt-4 block text-xs text-zinc-400">Reserva para comissão (R$)<input type="number" min="0" max="1000000000000" step="1000" className={`${control} mt-2 w-full`} value={current.staff_budget} onChange={(e) => edit({ ...current, staff_budget: Math.min(1e12, Math.max(0, Number(e.target.value) || 0)) })} /></label>
            <p className="mt-5 border-t border-zinc-700 pt-4 text-xs text-zinc-400">Saldo projetado</p><p className={`mt-1 text-2xl font-black ${totals.balance < 0 ? "text-red-400" : "text-green-400"}`}>{money(totals.balance)}</p>
            {totals.unpriced > 0 && <p className="mt-3 text-xs text-amber-300">{totals.unpriced} reforço(s) sem preço válido. O total está incompleto.</p>}
            <p className="mt-3 text-xs leading-relaxed text-zinc-500">Estimativa pelos valores atuais do FZ. Leilões, negociações e compromissos financeiros podem alterar o custo e a disponibilidade.</p>
            <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-700 pt-4 text-xs text-zinc-400">
              <p><strong className="block text-lg text-white">{totals.count}</strong>Jogadores</p><p><strong className="block text-lg text-white">{totals.goalkeepers}</strong>Goleiros</p>
              <p><strong className="block text-lg text-white">{totals.averageCa ?? "—"}</strong>CA médio</p><p><strong className="block text-lg text-white">{totals.averageAge ?? "—"}</strong>Idade média</p>
            </div>
          </aside>}
        </div>

        <section aria-label="Banco de reservas">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3"><h3 className="text-xl font-black">Reservas <span className="text-sm text-zinc-500">({bench.length})</span></h3>{planning && <button type="button" className={action} onClick={(e) => openPicker(-1, e.currentTarget)}>+ Planejar reserva</button>}</div>
          {bench.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">Nenhum reserva. Os jogadores que não estiverem entre os titulares aparecerão aqui.</p> : <div className="grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
            {bench.map((p) => <article key={p.id} className={`flex min-w-0 items-center gap-3 rounded-xl border p-3 ${p.team_id !== team.id ? "border-amber-500/30 bg-amber-500/5" : "border-zinc-800 bg-zinc-900"}`}>
              <PersonPhoto name={p.name} src={p.image_url} />
              <div className="min-w-0 flex-1"><Link href={`/players/${p.id}`} className="block truncate text-sm font-black hover:text-green-300">{p.name}</Link><p className="mt-1 text-[11px] text-zinc-400">{getPositionBadge(p)} · {p.age ?? "—"} anos · CA {p.ca ?? "—"} · CP {p.cp ?? "—"}</p>{p.team_id !== team.id && <p className="mt-1 text-[11px] text-amber-300">Reforço · {money(p.value)}</p>}</div>
              <div className="flex shrink-0 flex-col gap-2"><button type="button" className={`${action} px-2 py-1 text-xs`} onClick={(e) => {
                opener.current = e.currentTarget;
                setPendingPlayer(p.id);
                field.current?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}>Escalar</button>{p.team_id !== team.id && <button type="button" className="text-xs text-red-300" onClick={() => edit({ ...current, targets: current.targets.filter((id) => id !== p.id) })}>Retirar plano</button>}</div>
            </article>)}
          </div>}
        </section>

        <div className="flex flex-wrap items-center gap-3 border-t border-zinc-800 pt-5">
          <button type="button" className="rounded-xl bg-green-500 px-6 py-3 text-sm font-black text-zinc-950 transition hover:bg-green-400 disabled:opacity-50" disabled={busy} onClick={() => void save()}>{busy ? "Salvando..." : planning ? "Salvar planejamento" : "Salvar escalação"}</button>
          <span className="text-xs text-zinc-400">{dirty ? "Alterações não salvas" : current.updated_at ? `Salvo em ${new Date(current.updated_at).toLocaleString("pt-BR")}` : "Escolha seus titulares e salve para continuar depois."}</span>
        </div>
      </fieldset>

      <section className="border-t border-zinc-800 pt-6" aria-label="Comissão técnica">
        <div className="mb-4 flex items-center justify-between gap-3"><h3 className="text-xl font-black">Comissão técnica</h3><Link href="/staff" className="text-xs font-bold text-green-400 hover:underline">Ver comissão →</Link></div>
        {staffError ? <p role="alert" className="text-sm text-red-300">{staffError}</p> : staff.length === 0 ? <p className="rounded-xl border border-dashed border-zinc-700 p-5 text-sm text-zinc-400">Seu clube ainda não tem profissionais contratados. <Link href="/coaches" className="text-green-400">Buscar comissão técnica →</Link></p> : <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {staff.map((member) => <Link key={member.id} href={`/coaches/${member.id}`} className="flex min-w-0 items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-green-500/50"><PersonPhoto name={member.name} src={member.image_url} /><div className="min-w-0"><p className="text-xs font-bold text-green-400">{member.role || "Comissão técnica"}</p><p className="mt-1 truncate text-sm font-black">{member.name}</p><p className="mt-1 text-xs text-zinc-400">CA {member.ca ?? "—"}</p></div></Link>)}
        </div>}
      </section>

      <dialog ref={dialog} onCancel={() => setSlotIndex(null)} onClose={() => { setSlotIndex(null); setSearchError(""); opener.current?.focus(); }} className="fixed inset-0 m-auto max-h-[88dvh] w-[calc(100%-2rem)] max-w-xl overflow-y-auto rounded-2xl border border-zinc-700 bg-zinc-950 p-4 text-white shadow-2xl backdrop:bg-black/75 sm:p-6" aria-labelledby="player-picker-title">
        <div className="flex items-start justify-between gap-3"><div><h3 id="player-picker-title" className="text-xl font-black">{slotIndex === -1 ? "Planejar reserva" : `Escolher titular · ${slots[slotIndex ?? 0]?.label}`}</h3><p className="mt-1 text-xs text-zinc-400">{planning ? "Jogadores externos entram como reforços planejados." : "Escolha entre os jogadores do seu elenco."}</p></div><button type="button" aria-label="Fechar seleção" className={action} onClick={() => setSlotIndex(null)}>✕</button></div>
        {planning && <label className="mt-4 block text-xs text-zinc-400">Buscar em<select className={`${control} mt-1 block w-full`} value={source} onChange={(e) => { setSource(e.target.value); setSearchError(""); }}><option value="roster">Meu elenco</option><option value="planned">Reforços deste plano</option><option value="shortlist">Minha lista preferencial</option><option value="market">Mercado do FZ</option></select></label>}
        <label className="mt-4 block text-xs text-zinc-400">Nome do jogador<input autoFocus className={`${control} mt-1 block w-full`} placeholder="Buscar jogador..." value={search} onChange={(e) => setSearch(e.target.value)} /></label>
        <label className="mt-3 block text-xs text-zinc-400">Posição<select className={`${control} mt-1 block w-full`} value={group} onChange={(e) => setGroup(e.target.value)}><option value="all">Todas as posições</option>{POSITION_SECTIONS.map((g) => <option value={g.key} key={g.key}>{g.title}</option>)}</select></label>
        {slotIndex !== null && slotIndex >= 0 && current.starters[slotIndex] !== null && <button type="button" className={`${action} mt-4 w-full text-amber-300`} onClick={() => { edit({ ...current, starters: assignStarter(current.starters, slotIndex, null) }); setSlotIndex(null); }}>Enviar titular para o banco</button>}
        {searchError && <p role="alert" className="mt-4 text-sm text-red-300">{searchError}</p>}
        <div className="mt-4 space-y-2" aria-live="polite">
          {source === "market" && searching ? <p className="p-4 text-sm text-zinc-400">Buscando jogadores...</p> : filtered.length === 0 ? <p className="p-4 text-sm text-zinc-400">Nenhum jogador encontrado.{source === "shortlist" && " Adicione jogadores à Minha lista no mercado."}</p> : filtered.map((p) => <button type="button" key={p.id} onClick={() => choose(p)} className="flex w-full items-center gap-3 rounded-xl border border-zinc-800 bg-zinc-900 p-3 text-left hover:border-green-500 focus-visible:outline-2 focus-visible:outline-green-400"><PersonPhoto name={p.name} src={p.image_url} /><span className="min-w-0 flex-1"><span className="block text-sm font-black">{p.name}</span><span className="mt-1 block text-xs text-zinc-400">{p.position || getPositionBadge(p)} · {p.age ?? "—"} anos · CA {p.ca ?? "—"} · CP {p.cp ?? "—"}</span><span className={`mt-1 block text-xs ${p.team_id === team.id ? "text-green-400" : "text-amber-300"}`}>{p.team_id === team.id ? "Do elenco" : `Reforço · ${money(p.value)}`}{current.starters.includes(p.id) ? " · Titular (trocar)" : ""}</span></span></button>)}
          {source === "market" && <p className="pt-2 text-xs text-zinc-500">Até 40 resultados por busca. Digite o nome para encontrar outras opções; filtre a posição entre os resultados.</p>}
        </div>
      </dialog>
    </section>
  );
}
