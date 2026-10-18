"use client";
import {useEffect,useState} from "react";
import {useRouter} from "next/navigation";
import {supabase} from "@/lib/supabase";
import CupBracket from "@/app/friendzone-cup/CupBracket";
export default function AdminChampionsPage(){
 const router=useRouter();const [allowed,setAllowed]=useState(false);
 useEffect(()=>{let alive=true;(async()=>{const {data:{user}}=await supabase.auth.getUser();if(!alive)return;if(!user){router.replace("/login");return;}const {data:role}=await supabase.rpc("get_my_admin_role");if(!alive)return;if(role!=="owner"&&role!=="master"){router.replace("/dashboard");return;}setAllowed(true);})();return()=>{alive=false};},[router]);
 if(!allowed)return <div className="min-h-screen bg-[#080c18] p-10 text-slate-400">Verificando acesso administrativo...</div>;
 return <main className="min-h-screen bg-[#080c18] px-3 py-8 text-white md:px-8"><div className="mx-auto max-w-[1800px]">
 <h1 className="mb-3 text-3xl font-black">🏆 ADM — FriendZone Cup FZ 2026</h1>
 <p className="mb-7 text-slate-400">Defina os 4 confrontos da fase preliminar e as 12 vagas diretas das oitavas na ordem desejada e registre ida e volta. Com os dois jogos concluídos, o vencedor avança e as premiações são creditadas automaticamente. Se o agregado empatar, informe os pênaltis.</p>
 <CupBracket admin/></div></main>;
}