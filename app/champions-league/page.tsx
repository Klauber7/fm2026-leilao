"use client";

import { useEffect, useMemo, useState } from "react";
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

function normalizeSlot(slot: string) {
  return slot
    .toLowerCase()
    .trim()
    .replaceAll("-", "_")
    .replaceAll(" ", "_");
}

function getNumberFromSlot(slot: string) {
  const match = slot.match(/\d+/);
  return match ? Number(match[0]) : 999;
}

function isRoundSlot(slot: string) {
  const s = normalizeSlot(slot);

  return (
    s.startsWith("round_") ||
    s.startsWith("rodada_") ||
    s.startsWith("matchday_") ||
    /^round\d+$/.test(s) ||
    /^rodada\d+$/.test(s)
  );
}

function isPrizeSlot(slot: string) {
  const s = normalizeSlot(slot);

  return (
    s.startsWith("prize_") ||
    s.startsWith("premiacao_") ||
    s.startsWith("premiação_") ||
    s.startsWith("payment_") ||
    s.startsWith("pagamento_")
  );
}

function findByAliases(
  images: CompetitionImage[],
  aliases: string[]
): CompetitionImage | undefined {
  return images.find((image) =>
    aliases.includes(normalizeSlot(image.slot))
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
        <h3 className="mb-4 text-lg font-bold text-white">{title}</h3>

        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed border-white/10 bg-black/20">
          <p className="text-sm text-gray-500">
            Ainda não publicado
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#10131d]">
      <div className="border-b border-white/10 px-5 py-4">
        <h3 className="text-lg font-bold text-white">{title}</h3>
      </div>

      <div className="bg-black">
        <img
          src={image.image_url}
          alt={title}
          className="h-auto w-full object-contain"
        />
      </div>
    </div>
  );
}

export default function ChampionsLeaguePage() {
  const [images, setImages] = useState<CompetitionImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadChampionsImages() {
    try {
      setLoading(true);
      setError("");

      const { data, error } = await supabase
        .from("competition_images")
        .select(
          "competition, slot, image_url, storage_path, updated_at"
        )
        .eq("competition", "champions_league")
        .order("updated_at", { ascending: true });

      if (error) {
        console.error(error);
        setError(error.message);
        return;
      }

      setImages((data ?? []) as CompetitionImage[]);
    } catch (err) {
      console.error(err);
      setError(
        err instanceof Error
          ? err.message
          : "Erro ao carregar a Champions Cup."
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadChampionsImages();
  }, []);

  const rounds = useMemo(() => {
    return images
      .filter((image) => isRoundSlot(image.slot))
      .sort(
        (a, b) =>
          getNumberFromSlot(a.slot) -
          getNumberFromSlot(b.slot)
      );
  }, [images]);

  const prizes = useMemo(() => {
    return images
      .filter((image) => isPrizeSlot(image.slot))
      .sort(
        (a, b) =>
          getNumberFromSlot(a.slot) -
          getNumberFromSlot(b.slot)
      );
  }, [images]);

  const classification = useMemo(
    () =>
      findByAliases(images, [
        "table",
        "tabela",
        "classification",
        "classificacao",
        "classificação",
        "standings",
      ]),
    [images]
  );

  const topScorers = useMemo(
    () =>
      findByAliases(images, [
        "top_scorer",
        "top_scorers",
        "artilheiro",
        "artilheiros",
        "goals",
        "gols",
      ]),
    [images]
  );

  const averageRating = useMemo(
    () =>
      findByAliases(images, [
        "average_rating",
        "average_ratings",
        "classificacao_media",
        "classificação_média",
        "classificacao_média",
        "media",
        "ratings",
      ]),
    [images]
  );

  const bestPlayer = useMemo(
    () =>
      findByAliases(images, [
        "best_player",
        "melhor_jogador",
        "player_of_tournament",
        "mvp",
      ]),
    [images]
  );

  const knockout = useMemo(
    () =>
      findByAliases(images, [
        "bracket",
        "chave",
        "chaveamento",
        "mata_mata",
        "knockout",
      ]),
    [images]
  );

  if (loading) {
    return (
      <main className="min-h-screen bg-[#080a0f] px-4 py-10 text-white md:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex min-h-[500px] items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-white/10 border-t-emerald-400" />
              <p className="text-gray-400">
                Carregando Champions Cup...
              </p>
            </div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#080a0f] px-4 pb-20 pt-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        {/* HERO */}
        <section className="relative mb-10 overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-[#0d1220] via-[#0a0d14] to-[#06080c] p-7 md:p-10">
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-blue-500/10 blur-3xl" />
          <div className="absolute -bottom-24 left-20 h-72 w-72 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative z-10">
            <p className="mb-3 text-xs font-black tracking-[0.35em] text-emerald-400 md:text-sm">
              FRIENDZONE LEAGUE FM
            </p>

            <div className="flex items-center gap-4">
              <div className="text-5xl md:text-6xl">⭐</div>

              <div>
                <h1 className="text-3xl font-black tracking-tight md:text-5xl">
                  FriendZone Champions League
                </h1>

                <p className="mt-2 text-sm text-gray-400 md:text-base">
                  Resultados, classificação, estatísticas e premiações.
                </p>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <div className="rounded-full border border-blue-400/20 bg-blue-400/10 px-4 py-2 text-sm font-bold text-blue-300">
                🏆 Champions Cup
              </div>

              <div className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm font-bold text-emerald-300">
                {images.length} publicações
              </div>
            </div>
          </div>
        </section>

        {/* ERRO */}
        {error && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            <p className="font-bold">
              Erro ao carregar a Champions Cup
            </p>
            <p className="mt-1 text-sm">{error}</p>

            <button
              onClick={loadChampionsImages}
              className="mt-4 rounded-lg bg-red-500 px-4 py-2 text-sm font-bold text-white"
            >
              Tentar novamente
            </button>
          </div>
        )}

        {/* CHAVEAMENTO */}
        {knockout && (
          <section className="mb-12">
            <SectionTitle
              emoji="🏆"
              title="Chaveamento"
              subtitle="Caminho até a grande final"
            />

            <ImageCard
              image={knockout}
              title="Chaveamento da Champions Cup"
            />
          </section>
        )}

        {/* RODADAS */}
        <section className="mb-12">
          <SectionTitle
            emoji="⚽"
            title="Jogos"
            subtitle="Resultados da Champions Cup"
          />

          {rounds.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {rounds.map((round, index) => (
                <ImageCard
                  key={`${round.slot}-${index}`}
                  image={round}
                  title={`Rodada ${getNumberFromSlot(
                    round.slot
                  )}`}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="Nenhuma rodada publicada ainda." />
          )}
        </section>

        {/* CLASSIFICAÇÃO */}
        <section className="mb-12">
          <SectionTitle
            emoji="📊"
            title="Classificação"
            subtitle="Situação da competição"
          />

          <ImageCard
            image={classification}
            title="Classificação"
          />
        </section>

        {/* ESTATÍSTICAS */}
        <section className="mb-12">
          <SectionTitle
            emoji="📈"
            title="Estatísticas"
            subtitle="Destaques individuais da competição"
          />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ImageCard
              image={topScorers}
              title="⚽ Artilheiros"
            />

            <ImageCard
              image={averageRating}
              title="⭐ Classificação Média"
            />
          </div>
        </section>

        {/* MELHOR JOGADOR */}
        <section className="mb-12">
          <SectionTitle
            emoji="👑"
            title="Melhor Jogador"
            subtitle="Destaque da Champions Cup"
          />

          <ImageCard
            image={bestPlayer}
            title="Melhor Jogador"
          />
        </section>

        {/* PREMIAÇÕES */}
        <section>
          <SectionTitle
            emoji="💰"
            title="Premiações"
            subtitle="Pagamentos e prêmios da Champions Cup"
          />

          {prizes.length > 0 ? (
            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              {prizes.map((prize, index) => (
                <ImageCard
                  key={`${prize.slot}-${index}`}
                  image={prize}
                  title={`Premiação ${
                    getNumberFromSlot(prize.slot) !== 999
                      ? getNumberFromSlot(prize.slot)
                      : index + 1
                  }`}
                />
              ))}
            </div>
          ) : (
            <EmptyState text="Nenhuma premiação publicada ainda." />
          )}
        </section>
      </div>
    </main>
  );
}

function SectionTitle({
  emoji,
  title,
  subtitle,
}: {
  emoji: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-5 flex items-center gap-3">
      <div className="flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xl">
        {emoji}
      </div>

      <div>
        <h2 className="text-xl font-black text-white md:text-2xl">
          {title}
        </h2>

        {subtitle && (
          <p className="text-sm text-gray-500">
            {subtitle}
          </p>
        )}
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/10 bg-[#0d1017] px-6 py-16 text-center">
      <p className="text-gray-500">{text}</p>
    </div>
  );
}