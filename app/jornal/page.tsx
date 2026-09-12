"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type JournalSlot =
  | "highlight"
  | "tv_matches"
  | "results"
  | "next_round"
  | "table"
  | "cup"
  | "champions";

type JournalImage = {
  slot: JournalSlot;
  image_url: string;
  storage_path: string;
  updated_at: string;
};

const labels: Record<JournalSlot, string> = {
  highlight: "Destaque da Liga",
  tv_matches: "Confrontos Televisionados",
  results: "Resultados da Rodada",
  next_round: "Próximos Confrontos",
  table: "Tabela",
  cup: "Copa",
  champions: "Champions",
};

export default function JornalPage() {
  const [images, setImages] = useState<Record<JournalSlot, JournalImage | null>>({
    highlight: null,
    tv_matches: null,
    results: null,
    next_round: null,
    table: null,
    cup: null,
    champions: null,
  });

  const [loading, setLoading] = useState(true);

  const loadJournal = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("journal_images")
      .select("slot, image_url, storage_path, updated_at");

    if (error) {
      console.error("Erro ao carregar Jornal:", error);
      setLoading(false);
      return;
    }

    const nextState: Record<JournalSlot, JournalImage | null> = {
      highlight: null,
      tv_matches: null,
      results: null,
      next_round: null,
      table: null,
      cup: null,
      champions: null,
    };

    for (const row of (data || []) as JournalImage[]) {
      if (
        row.slot === "highlight" ||
        row.slot === "tv_matches" ||
        row.slot === "results" ||
        row.slot === "next_round" ||
        row.slot === "table" ||
        row.slot === "cup" ||
        row.slot === "champions"
      ) {
        nextState[row.slot] = row;
      }
    }

    setImages(nextState);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadJournal();

    const channel = supabase
      .channel("journal-public-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "journal_images",
        },
        () => void loadJournal()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadJournal]);

  function ImageSection({
    slot,
    large = false,
    featured = false,
  }: {
    slot: JournalSlot;
    large?: boolean;
    featured?: boolean;
  }) {
    const item = images[slot];

    return (
      <section
        className={
          featured
            ? "rounded-3xl border border-green-500/20 bg-green-500/[0.03] p-4 md:p-6"
            : ""
        }
      >
        <div className="mb-4">
          <p
            className={`text-sm font-black uppercase tracking-[0.2em] ${
              featured ? "text-yellow-400" : "text-green-400"
            }`}
          >
            FriendZone League FM
          </p>

          <h2
            className={`mt-1 font-black ${
              large ? "text-3xl md:text-4xl" : "text-2xl md:text-3xl"
            }`}
          >
            {featured ? "📺 " : ""}
            {labels[slot]}
          </h2>

          {featured && (
            <p className="mt-2 text-sm font-bold uppercase tracking-widest text-zinc-500">
              Jogos em destaque da rodada
            </p>
          )}
        </div>

        <div
          className={`overflow-hidden rounded-3xl border ${
            featured ? "border-yellow-500/30" : "border-zinc-800"
          } bg-zinc-900 ${
            large || featured ? "min-h-[320px]" : "min-h-[240px]"
          }`}
        >
          {item ? (
            <img
              src={item.image_url}
              alt={labels[slot]}
              className="h-auto w-full object-contain"
            />
          ) : (
            <div
              className={`flex ${
                large || featured ? "min-h-[320px]" : "min-h-[240px]"
              } items-center justify-center p-10 text-center text-zinc-500`}
            >
              <div>
                <div className="text-5xl">{featured ? "📺" : "📰"}</div>
                <p className="mt-4 font-bold">
                  Nenhuma imagem publicada ainda.
                </p>
              </div>
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-6xl">
            📰 Jornal FriendZone
          </h1>

          <p className="mt-3 text-zinc-400">
            Destaques, jogos televisionados, resultados, tabela e competições da liga.
          </p>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-zinc-400">
            Carregando jornal...
          </div>
        ) : (
          <div className="space-y-12">
            <ImageSection slot="highlight" large />

            {/* DESTAQUE ESPECIAL LOGO ABAIXO DO DESTAQUE PRINCIPAL */}
            <ImageSection slot="tv_matches" featured />

            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
              <ImageSection slot="results" />
              <ImageSection slot="next_round" />
            </div>

            <div className="grid grid-cols-1 gap-10 xl:grid-cols-2">
              <ImageSection slot="table" />
              <ImageSection slot="cup" />
            </div>

            <ImageSection slot="champions" />
          </div>
        )}
      </div>
    </main>
  );
}
