"use client";

import { useState } from "react";

export default function PlayerPhoto({ name, uniqueId, src, className = "h-12 w-12" }: {
  name: string;
  uniqueId?: string | number | null;
  src?: string | null;
  className?: string;
}) {
  const uid = String(uniqueId ?? "").trim();
  const remote = /^\d+$/.test(uid) ? `https://sortitoutsi.b-cdn.net/uploads/face/face_${uid}.png` : null;
  const candidates = [...new Set([src, remote].filter((url): url is string => !!url && /^https?:\/\//i.test(url)))];
  const [failed, setFailed] = useState<string[]>([]);
  const active = candidates.find(url => !failed.includes(url));
  const reject = () => { if (active) setFailed(previous => [...previous, active]); };
  return <span className={`inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-zinc-700 bg-zinc-800 font-black text-zinc-400 ${className}`}>
    {active ? <img key={active} src={active} alt={name} loading="lazy" decoding="async" referrerPolicy="no-referrer" width={180} height={180} className="h-full w-full object-contain" onError={reject} onLoad={event => { if (event.currentTarget.naturalWidth <= 1 || event.currentTarget.naturalHeight <= 1) reject(); }} /> : <span aria-label={`Foto indisponível: ${name}`}>{name.slice(0, 1).toUpperCase()}</span>}
  </span>;
}
