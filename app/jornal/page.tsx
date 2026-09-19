"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type JournalImage = {
  slot: "highlight";
  image_url: string;
  storage_path: string;
  updated_at: string;
};

export default function JornalPage() {
  const [image, setImage] = useState<JournalImage | null>(null);
  const [loading, setLoading] = useState(true);

  const loadJournal = useCallback(async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("journal_images")
      .select("slot, image_url, storage_path, updated_at")
      .eq("slot", "highlight")
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar Jornal:", error);
      setLoading(false);
      return;
    }

    setImage((data as JournalImage | null) ?? null);
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
          filter: "slot=eq.highlight",
        },
        () => void loadJournal()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadJournal]);

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10 text-center">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-6xl">
            📰 Jornal
          </h1>
        </header>

        {loading ? (
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Carregando jornal...
          </div>
        ) : (
          <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
            {image ? (
              <img
                src={image.image_url}
                alt="Jornal"
                className="h-auto w-full object-contain"
              />
            ) : (
              <div className="flex min-h-[320px] items-center justify-center p-10 text-center text-zinc-500">
                <div>
                  <div className="text-5xl">📰</div>
                  <p className="mt-4 font-bold">
                    Nenhuma imagem publicada ainda.
                  </p>
                </div>
              </div>
            )}
          </section>
        )}
      </div>
    </main>
  );
}