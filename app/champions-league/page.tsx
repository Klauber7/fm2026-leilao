"use client";

import { useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

type CompetitionImage = {
  competition: string;
  slot: string;
  image_url: string;
  storage_path?: string | null;
  updated_at?: string | null;
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export default function ChampionsLeaguePage() {
  const [images, setImages] = useState<CompetitionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    setLoading(true);
    setError("");

    const { data, error } = await supabase
      .from("competition_images")
      .select("*")
      .eq("competition", "champions_league")
      .order("updated_at", { ascending: true });

    if (error) {
      console.error(error);
      setError(error.message);
      setLoading(false);
      return;
    }

    setImages((data ?? []) as CompetitionImage[]);
    setLoading(false);
  }

  function getImage(slot: string) {
    return images.find((img) => img.slot === slot);
  }

  const firstRound = getImage("first_round");
  const moneyFirstRound = getImage("money_first_round");
  const moneyQuarterfinals = getImage("money_quarterfinals");
  const topScorer = getImage("top_scorer");
  const bestPlayer = getImage("best_player");

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090d] text-white flex items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-green-400" />
          <p className="text-gray-400">
            Carregando Champions Cup...
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090d] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}
        <section className="mb-10 rounded-3xl border border-white/10 bg-[#0d1017] p-7 md:p-10">
          <p className="mb-2 text-sm font-black tracking-[0.3em] text-green-400">
            FRIENDZONE LEAGUE FM
          </p>

          <div className="flex items-center gap-4">
            <div className="text-5xl">
              ⭐
            </div>

            <div>
              <h1 className="text-3xl font-black md:text-5xl">
                FriendZone Champions League
              </h1>

              <p className="mt-2 text-gray-400">
                Resultados, estatísticas e premiações
              </p>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-8 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>
        )}

        {/* PRIMEIRA FASE */}
        <SectionTitle
          emoji="🏆"
          title="Primeira Fase"
        />

        <ImageCard
          image={firstRound}
          title="Resultados"
        />

        {/* ARTILHEIROS */}
        <div className="mt-12">
          <SectionTitle
            emoji="⚽"
            title="Artilheiros"
          />

          <ImageCard
            image={topScorer}
            title="Artilheiros da Champions Cup"
          />
        </div>

        {/* MELHOR JOGADOR */}
        <div className="mt-12">
          <SectionTitle
            emoji="⭐"
            title="Melhor Jogador"
          />

          <ImageCard
            image={bestPlayer}
            title="Classificação Média / Melhor Jogador"
          />
        </div>

        {/* PREMIAÇÕES */}
        <div className="mt-12">
          <SectionTitle
            emoji="💰"
            title="Premiações"
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">

            <ImageCard
              image={moneyFirstRound}
              title="Pagamento das Oitavas de Final"
            />

            <ImageCard
              image={moneyQuarterfinals}
              title="Pagamento das Quartas de Final"
            />

          </div>
        </div>

      </div>
    </main>
  );
}

function SectionTitle({
  emoji,
  title,
}: {
  emoji: string;
  title: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/5 text-xl">
        {emoji}
      </div>

      <h2 className="text-2xl font-black">
        {title}
      </h2>
    </div>
  );
}

function ImageCard({
  image,
  title,
}: {
  image?: CompetitionImage;
  title: string;
}) {
  if (!image?.image_url) {
    return (
      <div className="rounded-2xl border border-white/10 bg-[#10131d] p-6">
        <h3 className="mb-4 font-bold">
          {title}
        </h3>

        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10">
          <p className="text-gray-500">
            Ainda não publicado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#10131d]">

      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="font-bold">
          {title}
        </h3>
      </div>

      <img
        src={image.image_url}
        alt={title}
        className="h-auto w-full object-contain"
      />

    </div>
  );
}