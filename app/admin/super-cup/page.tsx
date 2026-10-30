"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import SuperCupFinal from "@/app/super-cup/SuperCupFinal";
export default function AdminSuperCupPage(){
 const router=useRouter();const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let alive=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!alive)return;if(!user){router.replace("/login");return;}const {data:role}=await supabase.rpc("get_my_admin_role");if(!alive)return;if(role!=="owner"&&role!=="master"){router.replace("/dashboard");return;}setAllowed(true);})();return()=>{alive=false};},[router]);
 if(!allowed)return <div className="min-h-screen bg-[#080c18] p-10 text-slate-400">Verificando acesso administrativo...</div>;
 return <main className="min-h-screen bg-[#080c18] px-3 py-8 text-white md:px-8"><div className="mx-auto max-w-[1800px]">
 <h1 className="mb-3 text-3xl font-black">🏆 ADM — FriendZone Super Cup 2026</h1>
 <p className="mb-7 text-slate-400">Selecione os dois finalistas e clique em Salvar finalistas. O confronto será exibido na página pública da Super Cup.</p>
 <SuperCupFinal admin/></div></main>;
}