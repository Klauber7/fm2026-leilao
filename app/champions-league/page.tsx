"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

const DEFAULT_BRACKET = "/champions/chaveamento-oficial.png";

export default function ChampionsLeaguePage() {
  const [bracketUrl, setBracketUrl] = useState(DEFAULT_BRACKET);

  useEffect(() => {
    let alive = true;
    async function loadBracket() {
      const { data, error } = await supabase
        .from("competition_images")
        .select("image_url")
        .eq("competition", "champions_league")
        .eq("slot", "bracket")
        .maybeSingle();

      if (!error && data?.image_url && alive) {
        setBracketUrl(data.image_url);
      }
    }
    void loadBracket();
    return () => { alive = false; };
  }, []);

  return (
    <main className="min-h-screen bg-[#080c18] text-white px-2 py-6 md:px-6 md:py-10">
      <section className="mx-auto w-full max-w-[1800px]">
        <h1 className="mb-2 text-center text-2xl font-black tracking-wide md:text-4xl">
          🏆 Champions Cup FZ
        </h1>
        <p className="mb-5 text-center text-sm text-slate-400 md:text-base">
          Chaveamento oficial — ida, volta e agregado
        </p>
        <a
          href={bracketUrl}
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Abrir chaveamento completo em tamanho original"
          className="block overflow-hidden rounded-xl border border-sky-700/40 bg-[#09162b] shadow-[0_18px_64px_rgba(0,0,0,0.4)]"
        >
          <img
            src={bracketUrl}
            alt="Chaveamento oficial Champions Cup FZ 2026 — oitavas, quartas, semifinais e final; campeão Oeste Brasil FZ."
            className="block h-auto w-full"
            loading="eager"
          />
        </a>
      </section>
    </main>
  );
}
