"use client";



import Link from "next/link";

import { useParams } from "next/navigation";

import {

Â  useCallback,

Â  useEffect,

Â  useMemo,

Â  useState,

} from "react";

import { supabase } from "@/lib/supabase";



type Team = {

Â  id: number;

Â  name: string;

Â  city: string | null;

Â  stadium: string | null;

Â  budget: number | null;

Â  manager_id: string | null;

Â  manager_name: string | null;

Â  logo_url: string | null;

};



type Player = {

Â  id: number;

Â  name: string;

Â  age: number | null;

Â  position: string | null;

Â  nationality: string | null;

Â  ca: number | null;

Â  value: number | null;

Â  image_url: string | null;

Â  team_id: number | null;

};



type Coach = {

Â  id: number;

Â  unique_id: string | null;

Â  name: string;

Â  age: number | null;

Â  role: string | null;

Â  nationality: string | null;

Â  ca: number | null;

Â  cp: number | null;

Â  value: number | null;

Â  image_url: string | null;

Â  team_id: number | null;

Â  hired_at: string | null;

};



type PositionGroup =

Â  | "goalkeepers"

Â  | "defenders"

Â  | "midfielders"

Â  | "attackers"

Â  | "others";



type PlayerSection = {

Â  key: PositionGroup;

Â  title: string;

Â  abbreviation: string;

Â  players: Player[];

};



function money(value: number | null | undefined) {

Â  return Number(value || 0).toLocaleString("pt-BR", {

Â  Â  style: "currency",

Â  Â  currency: "BRL",

Â  Â  maximumFractionDigits: 0,

Â  });

}



function normalizeText(value: string | null | undefined) {

Â  return (value || "")

Â  Â  .trim()

Â  Â  .toLowerCase()

Â  Â  .normalize("NFD")

Â  Â  .replace(/[\u0300-\u036f]/g, "");

}



function getPositionGroup(

Â  position: string | null

): PositionGroup {

Â  const normalized = normalizeText(position)

Â  Â  .replace(/\s+/g, " ")

Â  Â  .replace(/\s\*,\s\*/g, ",")

Â  Â  .trim();



Â  if (!normalized) {

Â  Â  return "others";

Â  }



Â  // Goleiros

Â  if (

Â  Â  normalized === "gk" ||

Â  Â  normalized === "gr" ||

Â  Â  normalized === "gol" ||

Â  Â  normalized.includes("goleiro") ||

Â  Â  normalized.includes("goalkeeper") ||

Â  Â  normalized.includes("guarda-redes") ||

Â  Â  normalized.includes("guarda redes")

Â  ) {

Â  Â  return "goalkeepers";

Â  }



Â  // Atacantes / pontas

Â  if (

Â  Â  normalized === "st" ||

Â  Â  normalized === "cf" ||

Â  Â  normalized === "fw" ||

Â  Â  normalized === "ata" ||

Â  Â  normalized === "pl" ||

Â  Â  normalized.startsWith("pl ") ||

Â  Â  normalized.includes(" pl ") ||

Â  Â  normalized.includes("/pl") ||

Â  Â  normalized.includes("/ pl") ||

Â  Â  normalized.includes("atacante") ||

Â  Â  normalized.includes("avancado") ||

Â  Â  normalized.includes("striker") ||

Â  Â  normalized.includes("forward") ||

Â  Â  normalized.includes("centroavante") ||

Â  Â  normalized.includes("ponta") ||

Â  Â  normalized.includes("winger") ||

Â  Â  normalized === "rw" ||

Â  Â  normalized === "lw" ||

Â  Â  normalized === "pd" ||

Â  Â  normalized === "pe" ||

Â  Â  normalized.includes("amr") ||

Â  Â  normalized.includes("aml") ||

Â  Â  normalized.includes("mo (d)") ||

Â  Â  normalized.includes("mo (e)") ||

Â  Â  normalized.includes("mo (de)") ||

Â  Â  normalized.includes("mo (ed)")

Â  ) {

Â  Â  return "attackers";

Â  }



Â  // Meio-campistas

Â  if (

Â  Â  normalized === "dm" ||

Â  Â  normalized === "dmc" ||

Â  Â  normalized === "md" ||

Â  Â  normalized === "mc" ||

Â  Â  normalized === "cm" ||

Â  Â  normalized === "am" ||

Â  Â  normalized === "amc" ||

Â  Â  normalized.includes("volante") ||

Â  Â  normalized.includes("meio") ||

Â  Â  normalized.includes("midfielder") ||

Â  Â  normalized.includes("meia") ||

Â  Â  normalized.includes("attacking midfielder") ||

Â  Â  normalized.includes("m (c)") ||

Â  Â  normalized.includes("m (d)") ||

Â  Â  normalized.includes("m (e)") ||

Â  Â  normalized.includes("m (dc)") ||

Â  Â  normalized.includes("m (ec)") ||

Â  Â  normalized.includes("m (dec)") ||

Â  Â  normalized.includes("m/mo") ||

Â  Â  normalized.includes("mo (c)") ||

Â  Â  normalized.includes("mo (dc)") ||

Â  Â  normalized.includes("mo (ec)") ||

Â  Â  normalized.includes("mo (dec)") ||

Â  Â  normalized.includes("mo (de)") ||

Â  Â  normalized.includes("mo (ed)")

Â  ) {

Â  Â  return "midfielders";

Â  }



Â  // Defensores / laterais

Â  if (

Â  Â  normalized === "dc" ||

Â  Â  normalized === "cb" ||

Â  Â  normalized === "dl" ||

Â  Â  normalized === "dr" ||

Â  Â  normalized === "ld" ||

Â  Â  normalized === "le" ||

Â  Â  normalized === "lb" ||

Â  Â  normalized === "rb" ||

Â  Â  normalized.includes("zag") ||

Â  Â  normalized.includes("zagueiro") ||

Â  Â  normalized.includes("defensor") ||

Â  Â  normalized.includes("defender") ||

Â  Â  normalized.includes("lateral") ||

Â  Â  normalized.includes("left back") ||

Â  Â  normalized.includes("right back") ||

Â  Â  normalized.includes("wing back") ||

Â  Â  normalized.includes("d (c)") ||

Â  Â  normalized.includes("d (d)") ||

Â  Â  normalized.includes("d (e)") ||

Â  Â  normalized.includes("d (dc)") ||

Â  Â  normalized.includes("d (ec)") ||

Â  Â  normalized.includes("d (dec)") ||

Â  Â  normalized.includes("d (de)") ||

Â  Â  normalized.includes("d (ed)") ||

Â  Â  normalized.includes("d/da") ||

Â  Â  normalized.includes("da (d)") ||

Â  Â  normalized.includes("da (e)") ||

Â  Â  normalized.includes("da (de)") ||

Â  Â  normalized.includes("da (ed)")

Â  ) {

Â  Â  return "defenders";

Â  }



Â  return "others";

}



function getPositionBadge(position: string | null) {

Â  const group = getPositionGroup(position);



Â  if (group === "goalkeepers") return "GK";

Â  if (group === "defenders") return "DEF";

Â  if (group === "midfielders") return "MID";

Â  if (group === "attackers") return "ATA";



Â  const normalized = normalizeText(position);



Â  if (normalized.includes("d/da") || normalized.includes("da (")) {

Â  Â  return "LAT";

Â  }



Â  if (

Â  Â  normalized.includes("mo (d)") ||

Â  Â  normalized.includes("mo (e)") ||

Â  Â  normalized.includes("ponta") ||

Â  Â  normalized === "rw" ||

Â  Â  normalized === "lw" ||

Â  Â  normalized === "pd" ||

Â  Â  normalized === "pe"

Â  ) {

Â  Â  return "EXT";

Â  }



Â  return "OUT";

}



function getErrorMessage(error: unknown) {

Â  if (

Â  Â  typeof error === "object" &&

Â  Â  error !== null &&

Â  Â  "message" in error

Â  ) {

Â  Â  return String(

Â  Â  Â  (error as { message: unknown }).message

Â  Â  );

Â  }



Â  return "NÃ£o foi possÃ­vel carregar as informaÃ§Ãµes do clube.";

}



function getInitials(name: string) {

Â  const parts = name.trim().split(/\s+/).filter(Boolean);



Â  if (parts.length === 0) {

Â  Â  return "?";

Â  }



Â  if (parts.length === 1) {

Â  Â  return parts[0].charAt(0).toUpperCase();

Â  }



Â  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();

}



function StatCard({

Â  label,

Â  value,

Â  description,

Â  accent = "text-white",

}: {

Â  label: string;

Â  value: string | number;

Â  description: string;

Â  accent?: string;

}) {

Â  return (

Â  Â  \<div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

Â  Â  Â  \<p className="text-sm font-bold uppercase tracking-wider text-zinc-500">

Â  Â  Â  Â  {label}

Â  Â  Â  \</p>



Â  Â  Â  \<p className={\`mt-3 text-4xl font-black ${accent}\`}>

Â  Â  Â  Â  {value}

Â  Â  Â  \</p>



Â  Â  Â  \<p className="mt-2 text-sm text-zinc-500">

Â  Â  Â  Â  {description}

Â  Â  Â  \</p>

Â  Â  \</div>

Â  );

}



function BestPlayerCard({

Â  player,

}: {

Â  player: Player | null;

}) {

Â  return (

Â  Â  \<div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-zinc-900 to-zinc-950 p-5">

Â  Â  Â  \<p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">

Â  Â  Â  Â  Melhor jogador do elenco

Â  Â  Â  \</p>



Â  Â  Â  {!player ? (

Â  Â  Â  Â  \<div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">

Â  Â  Â  Â  Â  Nenhum jogador disponÃ­vel.

Â  Â  Â  Â  \</div>

Â  Â  Â  ) : (

Â  Â  Â  Â  \<div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">

Â  Â  Â  Â  Â  \<div className="flex min-w-0 items-center gap-4">

Â  Â  Â  Â  Â  Â  \<div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-yellow-500/20 bg-zinc-800">

Â  Â  Â  Â  Â  Â  Â  {player.image_url ? (

Â  Â  Â  Â  Â  Â  Â  Â  \<img

Â  Â  Â  Â  Â  Â  Â  Â  Â  src={player.image_url}

Â  Â  Â  Â  Â  Â  Â  Â  Â  alt={player.name}

Â  Â  Â  Â  Â  Â  Â  Â  Â  className="h-full w-full object-cover"

Â  Â  Â  Â  Â  Â  Â  Â  />

Â  Â  Â  Â  Â  Â  Â  ) : (

Â  Â  Â  Â  Â  Â  Â  Â  \<span className="text-xl font-black text-yellow-400">

Â  Â  Â  Â  Â  Â  Â  Â  Â  â˜…

Â  Â  Â  Â  Â  Â  Â  Â  \</span>

Â  Â  Â  Â  Â  Â  Â  )}

Â  Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  Â  \<div className="min-w-0">

Â  Â  Â  Â  Â  Â  Â  \<p className="text-[11px] font-black uppercase tracking-[0.18em] text-yellow-400">

Â  Â  Â  Â  Â  Â  Â  Â  Maior CA do elenco

Â  Â  Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  Â  Â  \<h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">

Â  Â  Â  Â  Â  Â  Â  Â  {player.name}

Â  Â  Â  Â  Â  Â  Â  \</h2>



Â  Â  Â  Â  Â  Â  Â  \<p className="mt-1 text-sm text-zinc-400">

Â  Â  Â  Â  Â  Â  Â  Â  {player.position || "Sem posiÃ§Ã£o"}

Â  Â  Â  Â  Â  Â  Â  Â  {player.age !== null ? \` Â· ${player.age} anos\` : ""}

Â  Â  Â  Â  Â  Â  Â  Â  {player.nationality ? \` Â· ${player.nationality}\` : ""}

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  \<div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">

Â  Â  Â  Â  Â  Â  \<div className="rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-center">

Â  Â  Â  Â  Â  Â  Â  \<p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">

Â  Â  Â  Â  Â  Â  Â  Â  CA

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  Â  \<p className="mt-1 text-3xl font-black text-yellow-400">

Â  Â  Â  Â  Â  Â  Â  Â  {player.ca ?? "-"}

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  Â  \<div className="rounded-2xl border border-green-500/20 bg-black/30 px-4 py-3 text-center">

Â  Â  Â  Â  Â  Â  Â  \<p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">

Â  Â  Â  Â  Â  Â  Â  Â  Valor

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  Â  \<p className="mt-1 text-xl font-black text-green-400">

Â  Â  Â  Â  Â  Â  Â  Â  {money(player.value)}

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  \</div>

Â  Â  Â  )}

Â  Â  \</div>

Â  );

}



function PlayerCardCompact({
  player,
}: {
  player: Player;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 transition hover:border-blue-500/50 hover:bg-zinc-900">
      <Link
        href={`/players/${player.id}`}
        className="block p-4 transition hover:bg-blue-500/[0.04]"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-2xl font-black text-zinc-400">
            {player.image_url ? (
              <img
                src={player.image_url}
                alt={player.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-black text-zinc-300">
                {getPositionBadge(player.position)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-wide text-green-400">
              {player.position || "Sem posiÃ§Ã£o"}
            </p>

            <h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">
              {player.name}
            </h3>

            <p className="mt-1 text-base text-zinc-300">
              {player.age !== null
                ? `${player.age} anos`
                : "Idade nÃ£o informada"}
            </p>

            <p className="text-base text-zinc-500">
              {player.nationality || "Nacionalidade nÃ£o informada"}
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
              CA
            </p>

            <p className="text-4xl font-black leading-none text-green-400">
              {player.ca ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Valor estimado
          </p>

          <p className="mt-1 text-3xl font-black text-green-400">
            {money(player.value)}
          </p>

          <p className="mt-3 text-sm font-black text-blue-400">
            Ver perfil completo e atributos â†’
          </p>
        </div>
      </Link>
    </article>
  );
}

function StaffCardCompact({

Â  member,

Â  onRelease,

Â  releasing,

Â  canRelease,

}: {

Â  member: Coach;

Â  onRelease: (member: Coach) => void;

Â  releasing: boolean;

Â  canRelease: boolean;

}) {

Â  const refundPreview = Number(member.value || 0) \* 0.5;



Â  return (

Â  Â  \<article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95">

Â  Â  Â  \<div className="p-4">

Â  Â  Â  Â  \<div className="flex items-start gap-3">

Â  Â  Â  Â  Â  \<div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-2xl font-black text-zinc-400">

Â  Â  Â  Â  Â  Â  {member.image_url ? (

Â  Â  Â  Â  Â  Â  Â  \<img

Â  Â  Â  Â  Â  Â  Â  Â  src={member.image_url}

Â  Â  Â  Â  Â  Â  Â  Â  alt={member.name}

Â  Â  Â  Â  Â  Â  Â  Â  className="h-full w-full object-cover"

Â  Â  Â  Â  Â  Â  Â  />

Â  Â  Â  Â  Â  Â  ) : (

Â  Â  Â  Â  Â  Â  Â  getInitials(member.name)

Â  Â  Â  Â  Â  Â  )}

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  \<div className="min-w-0 flex-1">

Â  Â  Â  Â  Â  Â  \<p className="text-sm font-black uppercase tracking-wide text-purple-400">

Â  Â  Â  Â  Â  Â  Â  {member.role || "Staff"}

Â  Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  Â  \<h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">

Â  Â  Â  Â  Â  Â  Â  {member.name}

Â  Â  Â  Â  Â  Â  \</h3>



Â  Â  Â  Â  Â  Â  \<p className="mt-1 text-base text-zinc-300">

Â  Â  Â  Â  Â  Â  Â  {member.age !== null

Â  Â  Â  Â  Â  Â  Â  Â  ? \`${member.age} anos\`

Â  Â  Â  Â  Â  Â  Â  Â  : "Idade nÃ£o informada"}

Â  Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  Â  \<p className="text-base text-zinc-500">

Â  Â  Â  Â  Â  Â  Â  {member.nationality || "Nacionalidade nÃ£o informada"}

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  \<div className="shrink-0 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-center">

Â  Â  Â  Â  Â  Â  \<p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">

Â  Â  Â  Â  Â  Â  Â  CA

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \<p className="text-4xl font-black leading-none text-green-400">

Â  Â  Â  Â  Â  Â  Â  {member.ca ?? "-"}

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  \</div>



Â  Â  Â  Â  \<div className="mt-5 border-t border-zinc-800 pt-4">

Â  Â  Â  Â  Â  \<p className="text-sm text-zinc-500">

Â  Â  Â  Â  Â  Â  Valor estimado

Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \<p className="mt-1 text-3xl font-black text-green-400">

Â  Â  Â  Â  Â  Â  {money(member.value)}

Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  \</div>

Â  Â  Â  \</div>



Â  Â  Â  {canRelease && (

Â  Â  Â  Â  \<div className="border-t border-red-500/30 bg-red-500/5 px-4 py-3">

Â  Â  Â  Â  Â  \<p className="text-sm font-black uppercase tracking-wide text-red-400">

Â  Â  Â  Â  Â  Â  Dispensa

Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \<p className="mt-1 text-sm text-zinc-300">

Â  Â  Â  Â  Â  Â  VocÃª recebe 50%

Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \<div className="mt-1 flex items-center justify-between gap-3">

Â  Â  Â  Â  Â  Â  \<p className="text-2xl font-black text-yellow-400">

Â  Â  Â  Â  Â  Â  Â  {money(refundPreview)}

Â  Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  Â  \<button

Â  Â  Â  Â  Â  Â  Â  type="button"

Â  Â  Â  Â  Â  Â  Â  disabled={releasing}

Â  Â  Â  Â  Â  Â  Â  onClick={() => onRelease(member)}

Â  Â  Â  Â  Â  Â  Â  className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"

Â  Â  Â  Â  Â  Â  >

Â  Â  Â  Â  Â  Â  Â  {releasing ? "Dispensando..." : "Dispensar"}

Â  Â  Â  Â  Â  Â  \</button>

Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  \</div>

Â  Â  Â  )}

Â  Â  \</article>

Â  );

}



export default function TeamPage() {

Â  const params = useParams();



Â  const rawTeamId = Array.isArray(params.id)

Â  Â  ? params.id[0]

Â  Â  : params.id;



Â  const teamId = Number(rawTeamId);



Â  const [team, setTeam] = useState\<Team | null>(null);

Â  const [players, setPlayers] = useState\<Player[]>([]);

Â  const [staff, setStaff] = useState\<Coach[]>([]);

Â  const [loading, setLoading] = useState(true);

Â  const [errorMessage, setErrorMessage] = useState("");

Â  const [successMessage, setSuccessMessage] = useState("");

Â  const [releasingStaffId, setReleasingStaffId] = useState\<number | null>(null);

Â  const [currentUserId, setCurrentUserId] = useState\<string | null>(null);



Â  const loadTeam = useCallback(async () => {

Â  Â  if (!Number.isInteger(teamId) || teamId <= 0) {

Â  Â  Â  setTeam(null);

Â  Â  Â  setPlayers([]);

Â  Â  Â  setStaff([]);

Â  Â  Â  setErrorMessage("Identificador do clube invÃ¡lido.");

Â  Â  Â  setLoading(false);

Â  Â  Â  return;

Â  Â  }



Â  Â  try {

Â  Â  Â  setLoading(true);

Â  Â  Â  setErrorMessage("");



Â  Â  Â  const { data: authData } = await supabase.auth.getUser();

Â  Â  Â  setCurrentUserId(authData.user?.id ?? null);



Â  Â  Â  const { data: teamData, error: teamError } = await supabase

Â  Â  Â  Â  .from("teams")

Â  Â  Â  Â  .select(\`

Â  Â  Â  Â  Â  id,

Â  Â  Â  Â  Â  name,

Â  Â  Â  Â  Â  city,

Â  Â  Â  Â  Â  stadium,

Â  Â  Â  Â  Â  budget,

Â  Â  Â  Â  Â  manager_id,

Â  Â  Â  Â  Â  manager_name,

Â  Â  Â  Â  Â  logo_url

Â  Â  Â  Â  \`)

Â  Â  Â  Â  .eq("id", teamId)

Â  Â  Â  Â  .maybeSingle();



Â  Â  Â  if (teamError) {

Â  Â  Â  Â  throw teamError;

Â  Â  Â  }



Â  Â  Â  if (!teamData) {

Â  Â  Â  Â  setTeam(null);

Â  Â  Â  Â  setPlayers([]);

Â  Â  Â  Â  setStaff([]);

Â  Â  Â  Â  setLoading(false);

Â  Â  Â  Â  return;

Â  Â  Â  }



Â  Â  Â  const loadedTeam = teamData as Team;

Â  Â  Â  setTeam(loadedTeam);



Â  Â  Â  const [playersResult, staffResult] = await Promise.all([

Â  Â  Â  Â  supabase

Â  Â  Â  Â  Â  .from("players")

Â  Â  Â  Â  Â  .select(\`

Â  Â  Â  Â  Â  Â  id,

Â  Â  Â  Â  Â  Â  name,

Â  Â  Â  Â  Â  Â  age,

Â  Â  Â  Â  Â  Â  position,

Â  Â  Â  Â  Â  Â  nationality,

Â  Â  Â  Â  Â  Â  ca,

Â  Â  Â  Â  Â  Â  value,

Â  Â  Â  Â  Â  Â  image_url,

Â  Â  Â  Â  Â  Â  team_id

Â  Â  Â  Â  Â  \`)

Â  Â  Â  Â  Â  .eq("team_id", loadedTeam.id)

Â  Â  Â  Â  Â  .order("ca", {

Â  Â  Â  Â  Â  Â  ascending: false,

Â  Â  Â  Â  Â  Â  nullsFirst: false,

Â  Â  Â  Â  Â  })

Â  Â  Â  Â  Â  .order("name", { ascending: true }),



Â  Â  Â  Â  supabase

Â  Â  Â  Â  Â  .from("coaches")

Â  Â  Â  Â  Â  .select(\`

Â  Â  Â  Â  Â  Â  id,

Â  Â  Â  Â  Â  Â  unique_id,

Â  Â  Â  Â  Â  Â  name,

Â  Â  Â  Â  Â  Â  age,

Â  Â  Â  Â  Â  Â  role,

Â  Â  Â  Â  Â  Â  nationality,

Â  Â  Â  Â  Â  Â  ca,

Â  Â  Â  Â  Â  Â  cp,

Â  Â  Â  Â  Â  Â  value,

Â  Â  Â  Â  Â  Â  image_url,

Â  Â  Â  Â  Â  Â  team_id,

Â  Â  Â  Â  Â  Â  hired_at

Â  Â  Â  Â  Â  \`)

Â  Â  Â  Â  Â  .eq("team_id", loadedTeam.id)

Â  Â  Â  Â  Â  .order("ca", {

Â  Â  Â  Â  Â  Â  ascending: false,

Â  Â  Â  Â  Â  Â  nullsFirst: false,

Â  Â  Â  Â  Â  })

Â  Â  Â  Â  Â  .order("name", { ascending: true }),

Â  Â  Â  ]);



Â  Â  Â  if (playersResult.error) {

Â  Â  Â  Â  throw playersResult.error;

Â  Â  Â  }



Â  Â  Â  if (staffResult.error) {

Â  Â  Â  Â  throw staffResult.error;

Â  Â  Â  }



Â  Â  Â  setPlayers((playersResult.data || []) as Player[]);

Â  Â  Â  setStaff((staffResult.data || []) as Coach[]);

Â  Â  } catch (error) {

Â  Â  Â  console.error(error);

Â  Â  Â  setErrorMessage(getErrorMessage(error));

Â  Â  Â  setTeam(null);

Â  Â  Â  setPlayers([]);

Â  Â  Â  setStaff([]);

Â  Â  } finally {

Â  Â  Â  setLoading(false);

Â  Â  }

Â  }, [teamId]);



Â  useEffect(() => {

Â  Â  void loadTeam();



Â  Â  const channel = supabase

Â  Â  Â  .channel(\`team-page-${teamId}\`)

Â  Â  Â  .on(

Â  Â  Â  Â  "postgres_changes",

Â  Â  Â  Â  {

Â  Â  Â  Â  Â  event: "\*",

Â  Â  Â  Â  Â  schema: "public",

Â  Â  Â  Â  Â  table: "teams",

Â  Â  Â  Â  },

Â  Â  Â  Â  () => {

Â  Â  Â  Â  Â  void loadTeam();

Â  Â  Â  Â  }

Â  Â  Â  )

Â  Â  Â  .on(

Â  Â  Â  Â  "postgres_changes",

Â  Â  Â  Â  {

Â  Â  Â  Â  Â  event: "\*",

Â  Â  Â  Â  Â  schema: "public",

Â  Â  Â  Â  Â  table: "players",

Â  Â  Â  Â  },

Â  Â  Â  Â  () => {

Â  Â  Â  Â  Â  void loadTeam();

Â  Â  Â  Â  }

Â  Â  Â  )

Â  Â  Â  .on(

Â  Â  Â  Â  "postgres_changes",

Â  Â  Â  Â  {

Â  Â  Â  Â  Â  event: "\*",

Â  Â  Â  Â  Â  schema: "public",

Â  Â  Â  Â  Â  table: "coaches",

Â  Â  Â  Â  },

Â  Â  Â  Â  () => {

Â  Â  Â  Â  Â  void loadTeam();

Â  Â  Â  Â  }

Â  Â  Â  )

Â  Â  Â  .subscribe();



Â  Â  return () => {

Â  Â  Â  supabase.removeChannel(channel);

Â  Â  };

Â  }, [loadTeam, teamId]);



Â  async function releaseStaff(member: Coach) {

Â  Â  if (releasingStaffId !== null) {

Â  Â  Â  return;

Â  Â  }



Â  Â  const confirmed = window\.confirm(

Â  Â  Â  \`Dispensar ${member.name}?\n\n\` +

Â  Â  Â  Â  \`O clube receberÃ¡ 50% do valor realmente pago por esse profissional.\n\n\` +

Â  Â  Â  Â  \`O staff voltarÃ¡ ao Mercado de Treinadores pelo seu preÃ§o normal: ${money(member.value)}.\`

Â  Â  );



Â  Â  if (!confirmed) {

Â  Â  Â  return;

Â  Â  }



Â  Â  setReleasingStaffId(member.id);

Â  Â  setErrorMessage("");

Â  Â  setSuccessMessage("");



Â  Â  const { data, error } = await supabase.rpc("release_staff", {

Â  Â  Â  p_coach_id: member.id,

Â  Â  });



Â  Â  if (error) {

Â  Â  Â  const message = String(error.message || "");



Â  Â  Â  if (message.includes("STAFF_NOT_OWNED")) {

Â  Â  Â  Â  setErrorMessage("Esse profissional nÃ£o pertence ao seu clube.");

Â  Â  Â  } else if (message.includes("TEAM_NOT_FOUND")) {

Â  Â  Â  Â  setErrorMessage("NÃ£o foi possÃ­vel localizar seu clube.");

Â  Â  Â  } else if (message.includes("STAFF_NOT_FOUND")) {

Â  Â  Â  Â  setErrorMessage("Profissional nÃ£o encontrado.");

Â  Â  Â  } else if (message.includes("NOT_AUTHENTICATED")) {

Â  Â  Â  Â  setErrorMessage("Sua sessÃ£o expirou. Entre novamente.");

Â  Â  Â  } else {

Â  Â  Â  Â  setErrorMessage("NÃ£o foi possÃ­vel dispensar o profissional.");

Â  Â  Â  }



Â  Â  Â  setReleasingStaffId(null);

Â  Â  Â  return;

Â  Â  }



Â  Â  const returnedRefund =

Â  Â  Â  data && typeof data === "object" && "refund" in data

Â  Â  Â  Â  ? Number((data as { refund?: number }).refund || 0)

Â  Â  Â  Â  : 0;



Â  Â  setSuccessMessage(

Â  Â  Â  \`${member.name} foi dispensado. ${money(returnedRefund)} foram devolvidos ao orÃ§amento do clube.\`

Â  Â  );



Â  Â  await loadTeam();

Â  Â  setReleasingStaffId(null);

Â  }



Â  const totalSquadValue = useMemo(

Â  Â  () => players.reduce((total, player) => total + Number(player.value || 0), 0),

Â  Â  [players]

Â  );



Â  const totalStaffValue = useMemo(

Â  Â  () => staff.reduce((total, member) => total + Number(member.value || 0), 0),

Â  Â  [staff]

Â  );



Â  const averageCa = useMemo(() => {

Â  Â  const validPlayers = players.filter((player) => player.ca !== null);



Â  Â  if (validPlayers.length === 0) {

Â  Â  Â  return 0;

Â  Â  }



Â  Â  return Math.round(

Â  Â  Â  validPlayers.reduce((total, player) => total + Number(player.ca || 0), 0) /

Â  Â  Â  Â  validPlayers.length

Â  Â  );

Â  }, [players]);



Â  const averageAge = useMemo(() => {

Â  Â  const validPlayers = players.filter((player) => player.age !== null);



Â  Â  if (validPlayers.length === 0) {

Â  Â  Â  return 0;

Â  Â  }



Â  Â  return Math.round(

Â  Â  Â  validPlayers.reduce((total, player) => total + Number(player.age || 0), 0) /

Â  Â  Â  Â  validPlayers.length

Â  Â  );

Â  }, [players]);



Â  const bestPlayer = useMemo(() => {

Â  Â  if (players.length === 0) {

Â  Â  Â  return null;

Â  Â  }



Â  Â  return [...players].sort((a, b) => {

Â  Â  Â  const caDifference = Number(b.ca || 0) - Number(a.ca || 0);

Â  Â  Â  if (caDifference !== 0) {

Â  Â  Â  Â  return caDifference;

Â  Â  Â  }



Â  Â  Â  return Number(b.value || 0) - Number(a.value || 0);

Â  Â  })[0];

Â  }, [players]);



Â  const playerSections = useMemo\<PlayerSection[]>(() => {

Â  Â  const grouped: Record\<PositionGroup, Player[]> = {

Â  Â  Â  goalkeepers: [],

Â  Â  Â  defenders: [],

Â  Â  Â  midfielders: [],

Â  Â  Â  attackers: [],

Â  Â  Â  others: [],

Â  Â  };



Â  Â  players.forEach((player) => {

Â  Â  Â  grouped[getPositionGroup(player.position)].push(player);

Â  Â  });



Â  Â  const sections: PlayerSection[] = [

Â  Â  Â  {

Â  Â  Â  Â  key: "goalkeepers",

Â  Â  Â  Â  title: "Goleiros",

Â  Â  Â  Â  abbreviation: "GK",

Â  Â  Â  Â  players: grouped.goalkeepers,

Â  Â  Â  },

Â  Â  Â  {

Â  Â  Â  Â  key: "defenders",

Â  Â  Â  Â  title: "Defensores",

Â  Â  Â  Â  abbreviation: "DEF",

Â  Â  Â  Â  players: grouped.defenders,

Â  Â  Â  },

Â  Â  Â  {

Â  Â  Â  Â  key: "midfielders",

Â  Â  Â  Â  title: "Meio-campistas",

Â  Â  Â  Â  abbreviation: "MID",

Â  Â  Â  Â  players: grouped.midfielders,

Â  Â  Â  },

Â  Â  Â  {

Â  Â  Â  Â  key: "attackers",

Â  Â  Â  Â  title: "Atacantes",

Â  Â  Â  Â  abbreviation: "ATA",

Â  Â  Â  Â  players: grouped.attackers,

Â  Â  Â  },

Â  Â  Â  {

Â  Â  Â  Â  key: "others",

Â  Â  Â  Â  title: "Outros jogadores",

Â  Â  Â  Â  abbreviation: "OUT",

Â  Â  Â  Â  players: grouped.others,

Â  Â  Â  },

Â  Â  ];



Â  Â  return sections.filter((section) => section.players.length > 0);

Â  }, [players]);



Â  if (loading) {

Â  Â  return (

Â  Â  Â  \<main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

Â  Â  Â  Â  \<div className="text-center">

Â  Â  Â  Â  Â  \<div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

Â  Â  Â  Â  Â  \<p className="mt-4 font-semibold text-zinc-400">Carregando clube...\</p>

Â  Â  Â  Â  \</div>

Â  Â  Â  \</main>

Â  Â  );

Â  }



Â  if (!team) {

Â  Â  return (

Â  Â  Â  \<main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">

Â  Â  Â  Â  \<div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">

Â  Â  Â  Â  Â  \<div className="text-6xl">ðŸŸï¸\</div>

Â  Â  Â  Â  Â  \<h1 className="mt-5 text-4xl font-black">Clube nÃ£o encontrado\</h1>

Â  Â  Â  Â  Â  \<p className="mt-3 text-zinc-400">

Â  Â  Â  Â  Â  Â  O clube solicitado nÃ£o existe ou nÃ£o estÃ¡ disponÃ­vel.

Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  {errorMessage && (

Â  Â  Â  Â  Â  Â  \<div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">

Â  Â  Â  Â  Â  Â  Â  {errorMessage}

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  )}



Â  Â  Â  Â  Â  \<Link

Â  Â  Â  Â  Â  Â  href="/teams"

Â  Â  Â  Â  Â  Â  className="mt-8 inline-block rounded-xl bg-green-600 px-7 py-4 font-black transition hover:bg-green-500"

Â  Â  Â  Â  Â  >

Â  Â  Â  Â  Â  Â  Voltar para clubes

Â  Â  Â  Â  Â  \</Link>

Â  Â  Â  Â  \</div>

Â  Â  Â  \</main>

Â  Â  );

Â  }



Â  return (

Â  Â  \<main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">

Â  Â  Â  \<div className="mx-auto max-w-7xl">

Â  Â  Â  Â  \<Link

Â  Â  Â  Â  Â  href="/teams"

Â  Â  Â  Â  Â  className="font-bold text-green-400 transition hover:text-green-300"

Â  Â  Â  Â  >

Â  Â  Â  Â  Â  â† Voltar para clubes

Â  Â  Â  Â  \</Link>



Â  Â  Â  Â  \<section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">

Â  Â  Â  Â  Â  \<div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7">

Â  Â  Â  Â  Â  Â  \<div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">

Â  Â  Â  Â  Â  Â  Â  \<div className="flex min-w-0 items-center gap-5">

Â  Â  Â  Â  Â  Â  Â  Â  \<div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-3">

Â  Â  Â  Â  Â  Â  Â  Â  Â  {team.logo_url ? (

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<img

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  src={team.logo_url}

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  alt={team.name}

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  className="h-full w-full object-contain"

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  />

Â  Â  Â  Â  Â  Â  Â  Â  Â  ) : (

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<span className="text-4xl font-black text-zinc-500">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  {getInitials(team.name)}

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \</span>

Â  Â  Â  Â  Â  Â  Â  Â  Â  )}

Â  Â  Â  Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  Â  Â  Â  \<div className="min-w-0">

Â  Â  Â  Â  Â  Â  Â  Â  Â  \<p className="text-xl font-black uppercase tracking-[0.18em] text-green-400">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Perfil do clube

Â  Â  Â  Â  Â  Â  Â  Â  Â  \</p>



Â  Â  Â  Â  Â  Â  Â  Â  Â  \<h1 className="mt-2 text-5xl font-black leading-none md:text-6xl">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  {team.name}

Â  Â  Â  Â  Â  Â  Â  Â  Â  \</h1>



Â  Â  Â  Â  Â  Â  Â  Â  Â  \<p className="mt-4 text-3xl text-zinc-300">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Manager: \<span className="font-black text-white">{team.manager_name || "Sem presidente"}\</span>

Â  Â  Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  \<BestPlayerCard player={bestPlayer} />

Â  Â  Â  Â  \</section>



Â  Â  Â  Â  {errorMessage && (

Â  Â  Â  Â  Â  \<div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">

Â  Â  Â  Â  Â  Â  {errorMessage}

Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  )}



Â  Â  Â  Â  {successMessage && (

Â  Â  Â  Â  Â  \<div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">

Â  Â  Â  Â  Â  Â  {successMessage}

Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  )}



Â  Â  Â  Â  \<section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">

Â  Â  Â  Â  Â  \<StatCard

Â  Â  Â  Â  Â  Â  label="Jogadores"

Â  Â  Â  Â  Â  Â  value={players.length}

Â  Â  Â  Â  Â  Â  description="Atletas no elenco"

Â  Â  Â  Â  Â  />



Â  Â  Â  Â  Â  \<StatCard

Â  Â  Â  Â  Â  Â  label="ComissÃ£o tÃ©cnica"

Â  Â  Â  Â  Â  Â  value={staff.length}

Â  Â  Â  Â  Â  Â  description="Profissionais contratados"

Â  Â  Â  Â  Â  Â  accent="text-purple-400"

Â  Â  Â  Â  Â  />



Â  Â  Â  Â  Â  \<StatCard

Â  Â  Â  Â  Â  Â  label="CA mÃ©dio"

Â  Â  Â  Â  Â  Â  value={averageCa || "-"}

Â  Â  Â  Â  Â  Â  description={averageAge ? \`Idade mÃ©dia: ${averageAge} anos\` : "Idade mÃ©dia nÃ£o disponÃ­vel"}

Â  Â  Â  Â  Â  Â  accent="text-green-400"

Â  Â  Â  Â  Â  />



Â  Â  Â  Â  Â  \<StatCard

Â  Â  Â  Â  Â  Â  label="PatrimÃ´nio esportivo"

Â  Â  Â  Â  Â  Â  value={money(totalSquadValue + totalStaffValue)}

Â  Â  Â  Â  Â  Â  description="Elenco e comissÃ£o"

Â  Â  Â  Â  Â  Â  accent="text-green-400"

Â  Â  Â  Â  Â  />

Â  Â  Â  Â  \</section>



Â  Â  Â  Â  \<section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">

Â  Â  Â  Â  Â  \<a

Â  Â  Â  Â  Â  Â  href="#elenco"

Â  Â  Â  Â  Â  Â  className="rounded-2xl border border-blue-700 bg-blue-600 p-6 transition hover:-translate-y-1 hover:bg-blue-500"

Â  Â  Â  Â  Â  >

Â  Â  Â  Â  Â  Â  \<span className="text-3xl">ðŸ‘¥\</span>

Â  Â  Â  Â  Â  Â  \<h2 className="mt-4 text-xl font-black">Ver time\</h2>

Â  Â  Â  Â  Â  Â  \<p className="mt-2 text-sm text-blue-100">

Â  Â  Â  Â  Â  Â  Â  Visualizar jogadores do clube.

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \</a>



Â  Â  Â  Â  Â  \<a

Â  Â  Â  Â  Â  Â  href="#staff"

Â  Â  Â  Â  Â  Â  className="rounded-2xl border border-purple-700 bg-purple-600 p-6 transition hover:-translate-y-1 hover:bg-purple-500"

Â  Â  Â  Â  Â  >

Â  Â  Â  Â  Â  Â  \<span className="text-3xl">ðŸ“‹\</span>

Â  Â  Â  Â  Â  Â  \<h2 className="mt-4 text-xl font-black">ComissÃ£o tÃ©cnica\</h2>

Â  Â  Â  Â  Â  Â  \<p className="mt-2 text-sm text-purple-100">

Â  Â  Â  Â  Â  Â  Â  Visualizar os profissionais.

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  \</a>

Â  Â  Â  Â  \</section>



Â  Â  Â  Â  \<section id="elenco" className="mt-16 scroll-mt-24">

Â  Â  Â  Â  Â  \<div>

Â  Â  Â  Â  Â  Â  \<p className="font-bold uppercase tracking-widest text-blue-400">

Â  Â  Â  Â  Â  Â  Â  Elenco principal

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \<h2 className="mt-2 text-4xl font-black">Jogadores do clube\</h2>

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  {players.length === 0 ? (

Â  Â  Â  Â  Â  Â  \<div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

Â  Â  Â  Â  Â  Â  Â  \<div className="text-6xl">âš½\</div>

Â  Â  Â  Â  Â  Â  Â  \<h3 className="mt-5 text-3xl font-black">Elenco vazio\</h3>

Â  Â  Â  Â  Â  Â  Â  \<p className="mt-3 text-zinc-400">

Â  Â  Â  Â  Â  Â  Â  Â  Este clube ainda nÃ£o contratou jogadores.

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  ) : (

Â  Â  Â  Â  Â  Â  \<div className="mt-10 space-y-14">

Â  Â  Â  Â  Â  Â  Â  {playerSections.map((section) => (

Â  Â  Â  Â  Â  Â  Â  Â  \<section key={section.key}>

Â  Â  Â  Â  Â  Â  Â  Â  Â  \<div className="mb-6 flex items-center gap-4">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-black text-blue-400">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  {section.abbreviation}

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \</span>



Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<h3 className="text-3xl font-black">{section.title}\</h3>



Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<span className="font-bold text-zinc-500">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  {section.players.length}

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \</span>

Â  Â  Â  Â  Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  Â  Â  Â  Â  \<div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-2">

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  {section.players.map((player) => (

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  \<PlayerCardCompact key={player.id} player={player} />

Â  Â  Â  Â  Â  Â  Â  Â  Â  Â  ))}

Â  Â  Â  Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  Â  Â  Â  \</section>

Â  Â  Â  Â  Â  Â  Â  ))}

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  )}

Â  Â  Â  Â  \</section>



Â  Â  Â  Â  \<section id="staff" className="mt-16 scroll-mt-24">

Â  Â  Â  Â  Â  \<div>

Â  Â  Â  Â  Â  Â  \<p className="font-bold uppercase tracking-widest text-purple-400">

Â  Â  Â  Â  Â  Â  Â  Staff

Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \<h2 className="mt-2 text-4xl font-black">ComissÃ£o tÃ©cnica\</h2>

Â  Â  Â  Â  Â  \</div>



Â  Â  Â  Â  Â  {staff.length === 0 ? (

Â  Â  Â  Â  Â  Â  \<div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

Â  Â  Â  Â  Â  Â  Â  \<div className="text-6xl">ðŸ‘”\</div>

Â  Â  Â  Â  Â  Â  Â  \<h3 className="mt-5 text-3xl font-black">ComissÃ£o vazia\</h3>

Â  Â  Â  Â  Â  Â  Â  \<p className="mt-3 text-zinc-400">

Â  Â  Â  Â  Â  Â  Â  Â  Este clube ainda nÃ£o contratou profissionais.

Â  Â  Â  Â  Â  Â  Â  \</p>

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  ) : (

Â  Â  Â  Â  Â  Â  \<div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-2">

Â  Â  Â  Â  Â  Â  Â  {staff.map((member) => (

Â  Â  Â  Â  Â  Â  Â  Â  \<StaffCardCompact

Â  Â  Â  Â  Â  Â  Â  Â  Â  key={member.id}

Â  Â  Â  Â  Â  Â  Â  Â  Â  member={member}

Â  Â  Â  Â  Â  Â  Â  Â  Â  onRelease={releaseStaff}

Â  Â  Â  Â  Â  Â  Â  Â  Â  releasing={releasingStaffId === member.id}

Â  Â  Â  Â  Â  Â  Â  Â  Â  canRelease={Boolean(currentUserId && team.manager_id === currentUserId)}

Â  Â  Â  Â  Â  Â  Â  Â  />

Â  Â  Â  Â  Â  Â  Â  ))}

Â  Â  Â  Â  Â  Â  \</div>

Â  Â  Â  Â  Â  )}

Â  Â  Â  Â  \</section>

Â  Â  Â  \</div>

Â  Â  \</main>

Â  );

}

