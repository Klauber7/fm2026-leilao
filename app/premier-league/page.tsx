"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type CompetitionImage = {
  competition: string;
  slot: string;
  image_url: string;
  storage_path: string;
  updated_at: string;
};

function getRoundSlot(round: number) {
  return `round_${String(round).padStart(2, "0")}`;
}

function getAwardSlot(round: number) {
  return `award_${String(round).padStart(2, "0")}`;
}

export default function PremierLeaguePage() {
  const [images, setImages] = useState<CompetitionImage[]>([]);
  const [loading, setLoading] = useState(true);

  const loadImages = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("competition_images")
      .select(
        "competition, slot, image_url, storage_path, updated_at"
      )
      .eq("competition", "premier_league");

    if (error) {
      console.error(
        "Erro ao carregar FriendZone Premier League:",
        error
      );
      setLoading(false);
      return;
    }

    setImages((data || []) as CompetitionImage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadImages();

    const channel = supabase
      .channel("premier-league-live")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "competition_images",
          filter: "competition=eq.premier_league",
        },
        () => {
          void loadImages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadImages]);

  const imageMap = useMemo(() => {
    const map = new Map<string, CompetitionImage>();

    for (const item of images) {
      map.set(item.slot, item);
    }

    return map;
  }, [images]);

  function ImageCard({
    slot,
    title,
    subtitle,
    large = false,
  }: {
    slot: string;
    title: string;
    subtitle?: string;
    large?: boolean;
  }) {
    const item = imageMap.get(slot);

    return (
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
        <div className="border-b border-zinc-800 px-5 py-4">
          <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
            FriendZone Premier League
          </p>

          <h2
            className={`mt-1 font-black ${
              large
                ? "text-2xl md:text-3xl"
                : "text-xl md:text-2xl"
            }`}
          >
            {title}
          </h2>

          {subtitle && (
            <p className="mt-1 text-sm text-zinc-500">
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={`flex items-center justify-center bg-zinc-950 ${
            large ? "min-h-[360px]" : "min-h-[260px]"
          }`}
        >
          {item ? (
            <img
              src={item.image_url}
              alt={title}
              className="h-auto max-h-[900px] w-full object-contain"
            />
          ) : (
            <div className="p-8 text-center text-zinc-600">
              <div className="text-5xl">🏆</div>

              <p className="mt-4 font-bold">
                Nenhuma imagem publicada.
              </p>
            </div>
          )}
        </div>
      </section>
    );
  }

  const rounds = Array.from(
    { length: 38 },
    (_, index) => index + 1
  );

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-12">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-6xl">
            🏆 FriendZone Premier League
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Rodadas, classificação, artilharia,
            melhor jogador e premiações da competição.
          </p>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Carregando Premier League...
          </div>
        ) : (
          <div className="space-y-16">
            {/* TABELA */}
            <section>
              <div className="mb-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                  Classificação
                </p>

                <h2 className="mt-1 text-3xl font-black md:text-4xl">
                  📊 Tabela
                </h2>
              </div>

              <ImageCard
                slot="table"
                title="Tabela da Premier League"
                large
              />
            </section>

            {/* DESTAQUES */}
            <section>
              <div className="mb-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                  Destaques
                </p>

                <h2 className="mt-1 text-3xl font-black md:text-4xl">
                  ⭐ Melhores da Competição
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                <ImageCard
                  slot="top_scorer"
                  title="⚽ Artilheiro"
                />

                <ImageCard
                  slot="best_player"
                  title="👑 Melhor Jogador"
                />
              </div>
            </section>

            {/* 38 RODADAS */}
            <section>
              <div className="mb-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                  Temporada
                </p>

                <h2 className="mt-1 text-3xl font-black md:text-4xl">
                  ⚽ 38 Rodadas
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {rounds.map((round) => (
                  <ImageCard
                    key={round}
                    slot={getRoundSlot(round)}
                    title={`Rodada ${round}`}
                  />
                ))}
              </div>
            </section>

            {/* 38 PRÊMIOS */}
            <section>
              <div className="mb-6">
                <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
                  Premiações
                </p>

                <h2 className="mt-1 text-3xl font-black md:text-4xl">
                  🏅 Prêmios das Rodadas
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-8 xl:grid-cols-2">
                {rounds.map((round) => (
                  <ImageCard
                    key={round}
                    slot={getAwardSlot(round)}
                    title={`Prêmio da Rodada ${round}`}
                  />
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </main>
  );
}