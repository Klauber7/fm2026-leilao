"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

const COMPETITION = "friendzone_cup";

type ImageRecord = {
  competition: string;
  slot: string;
  image_url: string;
  storage_path: string;
  updated_at?: string;
};

type PublicSection = {
  slot: string;
  title: string;
  subtitle: string;
};

const PUBLIC_SECTIONS: PublicSection[] = [
  {
    slot: "first_round",
    title: "Primeira Eliminatória",
    subtitle: "Confrontos e resultados da primeira fase.",
  },
  {
    slot: "round_of_16",
    title: "Oitavas de Final",
    subtitle: "Confrontos e resultados das oitavas de final.",
  },
  {
    slot: "quarterfinals",
    title: "Quartas de Final",
    subtitle: "Confrontos e resultados das quartas de final.",
  },
  {
    slot: "semifinals",
    title: "Semifinais",
    subtitle: "Confrontos e resultados das semifinais.",
  },
  {
    slot: "final",
    title: "Final",
    subtitle: "Resultado da grande final da FriendZone Cup.",
  },
  {
    slot: "top_scorer",
    title: "Artilheiros",
    subtitle: "Principais goleadores da competição.",
  },
  {
    slot: "best_player",
    title: "Classificação Média",
    subtitle: "Melhores médias dos jogadores na FriendZone Cup.",
  },
  {
    slot: "money_first_round",
    title: "Pagamento da Primeira Fase",
    subtitle: "Premiação em dinheiro referente à primeira fase.",
  },
  {
    slot: "money_round_of_16",
    title: "Pagamento das Oitavas de Final",
    subtitle: "Premiação em dinheiro referente às oitavas.",
  },
  {
    slot: "money_quarterfinals",
    title: "Pagamento das Quartas de Final",
    subtitle: "Premiação em dinheiro referente às quartas.",
  },
  {
    slot: "money_semifinals",
    title: "Pagamento das Semifinais",
    subtitle: "Premiação em dinheiro referente às semifinais.",
  },
  {
    slot: "money_final",
    title: "Pagamento da Final",
    subtitle: "Premiação em dinheiro referente à final.",
  },
];

export default function FriendZoneCupPage() {
  const [loading, setLoading] = useState(true);
  const [images, setImages] = useState<ImageRecord[]>([]);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    loadImages();
  }, []);

  async function loadImages() {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("competition_images")
        .select(
          "competition, slot, image_url, storage_path, updated_at"
        )
        .eq("competition", COMPETITION);

      if (error) {
        console.error(
          "Erro ao carregar imagens da FriendZone Cup:",
          error
        );
        setErrorMessage(
          "Não foi possível carregar as publicações da FriendZone Cup."
        );
        return;
      }

      setImages((data || []) as ImageRecord[]);
    } catch (error) {
      console.error(error);
      setErrorMessage(
        "Erro inesperado ao carregar a FriendZone Cup."
      );
    } finally {
      setLoading(false);
    }
  }

  const imagesBySlot = useMemo(() => {
    const map = new Map<string, ImageRecord>();

    for (const image of images) {
      map.set(image.slot, image);
    }

    return map;
  }, [images]);

  const publishedSections = useMemo(() => {
    return PUBLIC_SECTIONS.filter((section) =>
      imagesBySlot.has(section.slot)
    );
  }, [imagesBySlot]);

  return (
    <main className="min-h-screen bg-[#08090b] text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-10">
        <header className="border-b border-zinc-800 pb-8">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-6xl">
            🏆 FriendZone Cup
          </h1>

          <p className="mt-4 max-w-3xl text-zinc-400">
            Resultados, destaques, artilharia e premiações
            oficiais da FriendZone Cup.
          </p>
        </header>

        {loading && (
          <div className="py-20 text-center text-zinc-400">
            Carregando FriendZone Cup...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading &&
          !errorMessage &&
          publishedSections.length === 0 && (
            <div className="py-20 text-center">
              <p className="text-lg font-bold text-zinc-300">
                Nenhuma publicação disponível ainda.
              </p>

              <p className="mt-2 text-zinc-500">
                As imagens publicadas pelo administrador
                aparecerão aqui automaticamente.
              </p>
            </div>
          )}

        {!loading &&
          !errorMessage &&
          publishedSections.length > 0 && (
            <div className="mt-10 space-y-12">
              {publishedSections.map((section) => {
                const image = imagesBySlot.get(section.slot);

                if (!image) {
                  return null;
                }

                return (
                  <section
                    key={section.slot}
                    className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950"
                  >
                    <div className="border-b border-zinc-800 px-5 py-5 md:px-7">
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-400">
                        FriendZone Cup
                      </p>

                      <h2 className="mt-1 text-2xl font-black md:text-3xl">
                        {section.title}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-400 md:text-base">
                        {section.subtitle}
                      </p>
                    </div>

                    <div className="bg-black">
                      <img
                        src={image.image_url}
                        alt={section.title}
                        className="mx-auto block h-auto w-full object-contain"
                      />
                    </div>
                  </section>
                );
              })}
            </div>
          )}
      </div>
    </main>
  );
}