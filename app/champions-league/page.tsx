"use client";
import { useEffect,useState } from "react";
import {supabase} from "@/lib/supabase";
import ChampionsBracket from "./ChampionsBracket";
type Team={id:number;name:string;logo_url:string|null};
export default function ChampionsLeaguePage(){
 const [teams,setTeams]=useState<Team[]>([]);
 useEffect(()=>{void supabase.from("teams").select("id,name,logo_url").in("id",[21,39]).then(({data})=>setTeams((data||[]) as Team[]));},[]);
 const club=(id:number)=>teams.find(t=>t.id===id);
 return <main className="min-h-screen bg-[#080c18] px-4 py-8 text-white md:px-8"><div className="mx-auto max-w-[1800px]">
 <h1 className="mb-8 text-center text-3xl font-black md:text-5xl">🏆 Champions Cup FZ</h1>
 <section className="mb-10 rounded-2xl border border-amber-500/40 bg-[#0b1830] p-6">
 <h2 className="mb-2 text-center text-2xl font-black text-amber-300">🏆 Hall da Fama</h2><p className="text-center text-slate-400">Temporada 2025</p>
 <div className="mt-5 grid gap-4 sm:grid-cols-2">{[[39,"🥇 Campeão"],[21,"🥈 Vice-campeão"]].map(([id,label])=><div key={id} className="flex items-center gap-4 rounded-xl bg-[#071120] p-5">{club(Number(id))?.logo_url&&<img src={club(Number(id))?.logo_url||""} alt="" className="h-14 w-14 object-contain"/>}<div><p className="text-amber-300">{label}</p><p className="font-black">{club(Number(id))?.name||(Number(id)===39?"Oeste Brasil FZ":"Sport FZ")}</p></div></div>)}</div>
 </section><h2 className="mb-5 text-center text-2xl font-black">Chaveamento 2026 — Ida e Volta</h2><ChampionsBracket/></div></main>;
}