"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
type Team = { id: number; name: string };
export default function PremierResultAdmin() {
 const [authorized,setAuthorized]=useState(false);
 const [teams,setTeams]=useState<Team[]>([]);
 const [round,setRound]=useState(1);
 const [home,setHome]=useState("");
 const [away,setAway]=useState("");
 const [hg,setHg]=useState("0");
 const [ag,setAg]=useState("0");
 const [busy,setBusy]=useState(false);
 const [notice,setNotice]=useState("");
 useEffect(()=>{ let active=true; (async()=>{
 const {data:{user}}=await supabase.auth.getUser();
 if(!user)return;
 const {data:admin}=await supabase.from("site_admins").select("user_id").eq("user_id",user.id).eq("is_active",true).maybeSingle();
 if(!active||!admin)return;
 setAuthorized(true);
 const {data}=await supabase.from("teams").select("id,name").order("name");
 if(active)setTeams((data||[]) as Team[]);
 })();return()=>{active=false};},[]);
 async function submit(e:React.FormEvent) {
 e.preventDefault();
 if(busy)return;
 if(!home||!away||home===away){setNotice("Selecione duas equipes diferentes.");return;}
 if(!Number.isInteger(Number(hg))||!Number.isInteger(Number(ag))||Number(hg)<0||Number(ag)<0){setNotice("Informe placares válidos.");return;}
 if(!window.confirm("Confirmar resultado definitivo? A classificação e os pagamentos serão atualizados. Não é possível editar este placar nesta tela."))return;
 setBusy(true);setNotice("");
 const {error}=await supabase.rpc("fz_finalize_premier_match",{p_round:round,p_home:Number(home),p_away:Number(away),p_home_goals:Number(hg),p_away_goals:Number(ag)});
 if(error){setNotice("Erro: "+error.message);}else{setNotice("Resultado confirmado e ambos os clubes pagos. Atualize a página para ver a nova classificação.");setHome("");setAway("");setHg("0");setAg("0");}
 setBusy(false);
 }
 if(!authorized)return null;
 const field="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-white";
 return <section className="mb-12 rounded-3xl border border-green-600/40 bg-zinc-900 p-5 md:p-7">
 <h2 className="text-2xl font-black">⚽ Administração — Resultados 2026</h2>
 <p className="my-3 text-sm text-zinc-400">Apenas administradores. Cada resultado final credita automaticamente 500 mil por participação, mais 250 mil por vitória ou 100 mil por empate.</p>
 <form onSubmit={submit} className="grid grid-cols-1 gap-4 md:grid-cols-5">
 <label className="text-sm">Rodada<input aria-label="Rodada" className={field} type="number" min="1" max="38" value={round} onChange={e=>setRound(Number(e.target.value))} required /></label>
 <label className="text-sm">Mandante<select className={field} value={home} onChange={e=>setHome(e.target.value)} required><option value="">Escolher equipe</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label className="text-sm">Gols mandante<input className={field} type="number" min="0" max="99" value={hg} onChange={e=>setHg(e.target.value)} required /></label>
 <label className="text-sm">Visitante<select className={field} value={away} onChange={e=>setAway(e.target.value)} required><option value="">Escolher equipe</option>{teams.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label className="text-sm">Gols visitante<input className={field} type="number" min="0" max="99" value={ag} onChange={e=>setAg(e.target.value)} required /></label>
 <button type="submit" disabled={busy} className="rounded-xl bg-green-600 px-5 py-3 font-black text-white disabled:opacity-50 md:col-span-5">{busy?"Salvando...":"Confirmar resultado e pagar clubes"}</button>
 </form>
 {notice&&<p role="status" className="mt-4 text-sm">{notice}</p>}
 </section>;
}
