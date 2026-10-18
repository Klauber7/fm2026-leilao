"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
type Pool = { player_id:number;category:string;chosen_team_id:number|null; players:{name:string;position:string|null;ca:number|null;age:number|null}|null };
const categories=[["GK","🧤 Goleiros"],["DEF","🛡️ Defensores"],["MID","⚙️ Meio-campo"],["WING","⚡ Pontas"],["ST","🎯 Atacantes"]];
export default function DraftPage(){
 const [pool,setPool]=useState<Pool[]>([]);
 const [status,setStatus]=useState("closed");
 const [loading,setLoading]=useState(true);
 const [error,setError]=useState("");
 useEffect(()=>{let alive=true;(async()=>{
  const [s,p]=await Promise.all([supabase.from("fz_draft_settings").select("status").eq("id",1).single(),supabase.from("fz_draft_pool").select("player_id,category,chosen_team_id,players(name,position,ca,age)").order("created_at")]);
  if(!alive)return;
  if(s.error||p.error)setError("Não foi possível carregar o Draft.");
  else{setStatus(s.data.status);setPool((p.data||[]) as unknown as Pool[]);}
  setLoading(false);
 })();return()=>{alive=false};},[]);
 const selected=pool.filter(p=>p.chosen_team_id!==null).length;
 return <main className="min-h-screen bg-[#08090b] px-4 py-10 text-white"><div className="mx-auto max-w-6xl">
  <p className="text-sm font-black uppercase tracking-widest text-green-400">FriendZone League FM</p>
  <h1 className="mt-2 text-4xl font-black">🏆 Draft FZ 2026</h1>
  <p className="mt-3 text-zinc-400">200 jogadores · 20 clubes · 5 escolhas gratuitas por clube · 1 jogador de cada categoria.</p>
  <div className="mt-6 grid gap-3 sm:grid-cols-3">
   <div className="rounded-xl bg-zinc-900 p-5"><p className="text-zinc-400">Lista cadastrada</p><p className="text-3xl font-black">{pool.length}/200</p></div>
   <div className="rounded-xl bg-zinc-900 p-5"><p className="text-zinc-400">Já escolhidos</p><p className="text-3xl font-black">{selected}</p></div>
   <div className="rounded-xl bg-zinc-900 p-5"><p className="text-zinc-400">Situação</p><p className="text-2xl font-black">{status==="open"?"Aberto":status==="completed"?"Finalizado":"🔒 Fechado"}</p></div>
  </div>
  <p className="mt-5 rounded-xl border border-amber-700/50 bg-amber-950/20 p-4 text-amber-200">Jogadores escolhidos no Draft ficam vinculados permanentemente ao clube, sem venda, troca, empréstimo ou dispensa. As escolhas serão liberadas somente depois da configuração administrativa.</p>
  {error&&<p role="alert" className="mt-5 text-red-400">{error}</p>}
  {loading?<p className="mt-8">Carregando...</p>:<div className="mt-8 grid gap-5 md:grid-cols-2">
   {categories.map(([id,title])=><section key={id} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
    <h2 className="text-xl font-black">{title}</h2><p className="mt-1 text-sm text-zinc-400">{pool.filter(p=>p.category===id).length} jogadores · 1 escolha por clube</p>
    <div className="mt-4 space-y-2">{pool.filter(p=>p.category===id).map(p=><div key={p.player_id} className="flex justify-between rounded-lg bg-zinc-950 p-3"><span>{p.players?.name||"Jogador"} · CA {p.players?.ca??"—"}</span><span className="text-zinc-400">{p.chosen_team_id?"🔒 Escolhido":"Disponível"}</span></div>)}
     {!pool.some(p=>p.category===id)&&<p className="text-sm text-zinc-500">Aguardando cadastro dos jogadores.</p>}
    </div>
   </section>)}
  </div>}
  <Link href="/dashboard" className="mt-8 inline-block text-green-400">← Voltar</Link>
 </div></main>;
}