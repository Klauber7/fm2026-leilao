"use client";
import { useCallback,useEffect,useState } from "react";
import { supabase } from "@/lib/supabase";
type Tie={id:number;phase:string;slot:number;home_team_id:number|null;away_team_id:number|null;leg1_home:number|null;leg1_away:number|null;leg2_home:number|null;leg2_away:number|null;penalties_home:number|null;penalties_away:number|null;winner_team_id:number|null;settled_at:string|null};
type Team={id:number;name:string;logo_url:string|null};
const phases=[["R16","Oitavas de final"],["QF","Quartas de final"],["SF","Semifinais"],["FINAL","Final"]];
export default function ChampionsBracket({admin=false}:{admin?:boolean}){
 const [ties,setTies]=useState<Tie[]>([]),[teams,setTeams]=useState<Team[]>([]),[error,setError]=useState(""),[loading,setLoading]=useState(true);
 const [edits,setEdits]=useState<Record<number,Tie>>({}),[saving,setSaving]=useState<number|null>(null);
 const reload=useCallback(async()=>{const [a,b]=await Promise.all([supabase.from("fz_champions_ties").select("*").eq("season_year",2026).order("slot"),supabase.from("teams").select("id,name,logo_url").order("name")]);if(a.error||b.error){setError(a.error?.message||b.error?.message||"Erro ao carregar chaveamento");}else{setTies((a.data||[]) as Tie[]);setTeams((b.data||[]) as Team[]);}setLoading(false);},[]);
 useEffect(()=>{void reload();},[reload]);
 function name(id:number|null){return teams.find(t=>t.id===id)?.name||"A definir";}
 function update(t:Tie,k:keyof Tie,v:number|null){setEdits(old=>({...old,[t.id]:{...(old[t.id]||t),[k]:v}}));}
 async function save(t:Tie){const x=edits[t.id]||t;if(!x.home_team_id||!x.away_team_id){setError("Escolha duas equipes.");return;}if(x.home_team_id===x.away_team_id){setError("Escolha equipes diferentes.");return;}
  setSaving(t.id);setError("");
  const {data,error:e}=await supabase.rpc("fz_champions_save",{p_phase:x.phase,p_slot:x.slot,p_home:x.home_team_id,p_away:x.away_team_id,p_h1:x.leg1_home,p_a1:x.leg1_away,p_h2:x.leg2_home,p_a2:x.leg2_away,p_ph:x.penalties_home,p_pa:x.penalties_away});
  if(e)setError(e.message);else{setError(String(data));setEdits(old=>{const n={...old};delete n[t.id];return n;});await reload();}
  setSaving(null);
 }
 return <div className="space-y-6">{error&&<p role="status" className="rounded-xl bg-zinc-900 p-4 text-amber-300">{error}</p>}{loading?<p>Carregando...</p>:<div className="grid gap-4 lg:grid-cols-4">
 {phases.map(([phase,title])=><section key={phase} className="space-y-3"><h2 className="rounded-xl bg-sky-900/40 px-3 py-3 text-center text-lg font-black">{title}</h2>
 {ties.filter(t=>t.phase===phase).map(t=>{const x=edits[t.id]||t;const aggregated=x.leg1_home!==null&&x.leg2_away!==null&&x.leg1_away!==null&&x.leg2_home!==null;
 return <div key={t.id} className="rounded-xl border border-sky-800/50 bg-[#0b1830] p-3 text-sm">
 <p className="mb-2 text-xs text-slate-400">Confronto {t.slot} {t.settled_at?"· ✓ Encerrado":""}</p>
 {(["home_team_id","away_team_id"] as const).map((k,i)=><div key={k} className={"mb-2 rounded-lg p-2 "+(t.winner_team_id===x[k]?"bg-emerald-900/30":"bg-[#071120]")}>
 {admin&&phase==="R16"&&!t.settled_at?<select aria-label={i===0?"Equipe A":"Equipe B"} className="w-full bg-transparent" value={x[k]||""} onChange={e=>update(t,k,e.target.value?Number(e.target.value):null)}><option value="">A definir</option>{teams.map(team=><option key={team.id} value={team.id}>{team.name}</option>)}</select>:<span className="font-semibold">{name(x[k])}</span>}
 </div>)}
 <div className="grid grid-cols-2 gap-2 text-center"><div><p className="text-xs text-slate-400">Ida (A × B)</p>{admin&&!t.settled_at?<div className="flex gap-1">{(["leg1_home","leg1_away"] as const).map(k=><input key={k} aria-label={k} type="number" min="0" max="99" className="w-1/2 rounded bg-slate-900 p-1 text-center" value={x[k]??""} onChange={e=>update(t,k,e.target.value===""?null:Number(e.target.value))}/>)}</div>:<p className="font-bold">{x.leg1_home??"–"} × {x.leg1_away??"–"}</p>}</div>
 <div><p className="text-xs text-slate-400">Volta (B × A)</p>{admin&&!t.settled_at?<div className="flex gap-1">{(["leg2_home","leg2_away"] as const).map(k=><input key={k} aria-label={k} type="number" min="0" max="99" className="w-1/2 rounded bg-slate-900 p-1 text-center" value={x[k]??""} onChange={e=>update(t,k,e.target.value===""?null:Number(e.target.value))}/>)}</div>:<p className="font-bold">{x.leg2_home??"–"} × {x.leg2_away??"–"}</p>}</div></div>
 {aggregated&&<p className="mt-2 text-center text-xs text-slate-300">Agregado: {Number(x.leg1_home)+Number(x.leg2_away)} × {Number(x.leg1_away)+Number(x.leg2_home)}</p>}
 {admin&&!t.settled_at&&<><p className="mt-2 text-xs text-slate-400">Pênaltis (somente se agregado empatado)</p><div className="mb-2 flex gap-2">{(["penalties_home","penalties_away"] as const).map(k=><input key={k} aria-label={k} type="number" min="0" max="99" className="w-1/2 rounded bg-slate-900 p-1 text-center" placeholder="–" value={x[k]??""} onChange={e=>update(t,k,e.target.value===""?null:Number(e.target.value))}/>)}</div><button disabled={saving!==null} className="w-full rounded-lg bg-sky-700 p-2 font-bold disabled:opacity-50" onClick={()=>void save(t)}>{saving===t.id?"Salvando...":"Salvar / confirmar confronto"}</button></>}
 </div>})}</section>)}</div>}</div>;
}
