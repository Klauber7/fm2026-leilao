"use client";
import { useEffect,useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
type Team={id:number;name:string;manager_id:string|null};
type Player={id:number;name:string;team_id:number|null;position:string|null};
type Loan={id:number;player_id:number;lender_team_id:number;borrower_team_id:number;amount:number;duration:string;status:string;created_by_team_id:number;};
export default function LoansPage(){
 const [me,setMe]=useState<Team|null>(null),[teams,setTeams]=useState<Team[]>([]),[players,setPlayers]=useState<Player[]>([]),[loans,setLoans]=useState<Loan[]>([]);
 const [lender,setLender]=useState(""),[player,setPlayer]=useState(""),[amount,setAmount]=useState("0"),[duration,setDuration]=useState("end_season");
 const [message,setMessage]=useState(""),[busy,setBusy]=useState(false);
 async function load(){
  const {data:{user}}=await supabase.auth.getUser();if(!user)return;
  const [{data:t},{data:p},{data:l}]=await Promise.all([
   supabase.from("teams").select("id,name,manager_id").order("name"),
   supabase.from("players").select("id,name,team_id,position").order("name"),
   supabase.from("player_loans").select("*").order("created_at",{ascending:false})
  ]);
  const all=t||[];setTeams(all);setMe(all.find(x=>x.manager_id===user.id)||null);setPlayers(p||[]);setLoans(l||[]);
 }
 useEffect(()=>{load()},[]);
 const club=(id:number)=>teams.find(t=>t.id===id)?.name||"Clube";
 const playerName=(id:number)=>players.find(p=>p.id===id)?.name||"Jogador";
 async function propose(e:React.FormEvent){
  e.preventDefault();if(!me)return;
  const value=Number(amount);if(!Number.isFinite(value)||value<0){setMessage("Informe um valor válido, inclusive 0.");return}
  setBusy(true);setMessage("");
  const {error}=await supabase.rpc("propose_player_loan",{p_player_id:Number(player),p_borrower_team_id:me.id,p_amount:value,p_duration:duration});
  setMessage(error?error.message:"Proposta de empréstimo enviada para aprovação do outro clube.");
  setBusy(false);await load();
 }
 async function accept(id:number){
  setBusy(true);setMessage("");
  const {error}=await supabase.rpc("accept_player_loan",{p_loan_id:id});
  setMessage(error?error.message:"Empréstimo aceito. Jogador transferido temporariamente.");
  setBusy(false);await load();
 }
 return <main className="min-h-screen bg-[#08090b] px-5 py-10 text-white"><div className="mx-auto max-w-5xl space-y-7">
 <Link href="/transfers/negotiations" className="text-green-400">← Voltar às negociações</Link>
 <div><p className="text-sm font-bold uppercase tracking-widest text-green-400">FriendZone League FM</p><h1 className="text-3xl font-black">Empréstimos · Mercado Interno</h1><p className="mt-2 text-zinc-400">Empréstimos gratuitos ou pagos. Cada empréstimo ocupa uma das duas contratações permitidas por janela.</p></div>
 {message&&<div role="status" className="rounded-xl border border-zinc-700 bg-zinc-900 p-4">{message}</div>}
 <form onSubmit={propose} className="space-y-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
 <h2 className="text-xl font-bold">Solicitar empréstimo</h2>
 <label className="block text-sm">Clube de origem<select required className="mt-2 w-full rounded-lg bg-zinc-950 p-3" value={lender} onChange={e=>{setLender(e.target.value);setPlayer("")}}><option value="">Selecione um clube</option>{teams.filter(t=>t.id!==me?.id).map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 <label className="block text-sm">Jogador<select required className="mt-2 w-full rounded-lg bg-zinc-950 p-3" value={player} onChange={e=>setPlayer(e.target.value)}><option value="">Selecione um jogador</option>{players.filter(p=>p.team_id===Number(lender)).map(p=><option key={p.id} value={p.id}>{p.name}{p.position?" · "+p.position:""}</option>)}</select></label>
 <label className="block text-sm">Valor (R$) — pode ser zero<input type="number" min="0" step="1" required className="mt-2 w-full rounded-lg bg-zinc-950 p-3" value={amount} onChange={e=>setAmount(e.target.value)}/></label>
 <label className="block text-sm">Prazo<select className="mt-2 w-full rounded-lg bg-zinc-950 p-3" value={duration} onChange={e=>setDuration(e.target.value)}><option value="next_window">Até a próxima janela</option><option value="end_season">Até o fim da temporada</option></select></label>
 <button disabled={!me||!player||busy} className="rounded-xl bg-green-500 px-5 py-3 font-bold text-black disabled:opacity-40">Enviar proposta de empréstimo</button>
 </form>
 <section className="space-y-3"><h2 className="text-xl font-bold">Meus empréstimos</h2>{loans.length===0&&<p className="text-zinc-400">Nenhum empréstimo registrado.</p>}
 {loans.map(l=><div key={l.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4"><div className="font-bold">{playerName(l.player_id)}</div><p className="text-sm text-zinc-400">{club(l.lender_team_id)} → {club(l.borrower_team_id)} · R$ {Number(l.amount).toLocaleString("pt-BR")} · {l.duration==="end_season"?"Fim da temporada":"Próxima janela"}</p><div className="mt-2 flex items-center justify-between"><span className="text-sm uppercase text-green-400">{l.status}</span>{l.status==="pending"&&me&&l.created_by_team_id!==me.id&&<button disabled={busy} onClick={()=>accept(l.id)} className="rounded-lg bg-green-500 px-4 py-2 font-bold text-black">Aceitar empréstimo</button>}</div></div>)}</section>
 </div></main>;
}