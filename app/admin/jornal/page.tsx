"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
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

const slotConfig: Array<{
  slot: JournalSlot;
  title: string;
  description: string;
  featured?: boolean;
}> = [
  {
    slot: "highlight",
    title: "Destaque da Liga",
    description: "Imagem principal do Jornal FriendZone.",
  },
  {
    slot: "tv_matches",
    title: "Confrontos Televisionados",
    description: "Arte especial com os jogos televisionados da rodada.",
    featured: true,
  },
  {
    slot: "results",
    title: "Resultados da Rodada",
    description: "Arte com os resultados da rodada mais recente.",
  },
  {
    slot: "next_round",
    title: "Próximos Confrontos",
    description: "Arte com os jogos da próxima rodada.",
  },
  {
    slot: "table",
    title: "Tabela",
    description: "Arte com a classificação atual da liga.",
  },
  {
    slot: "cup",
    title: "Copa",
    description: "Arte com informações da Copa.",
  },
  {
    slot: "champions",
    title: "Champions",
    description: "Arte com informações da Champions.",
  },
];

export default function AdminJornalPage() {
  const [images, setImages] = useState<Record<JournalSlot, JournalImage | null>>({
    highlight: null,
    tv_matches: null,
    results: null,
    next_round: null,
    table: null,
    cup: null,
    champions: null,
  });

  const [files, setFiles] = useState<Record<JournalSlot, File | null>>({
    highlight: null,
    tv_matches: null,
    results: null,
    next_round: null,
    table: null,
    cup: null,
    champions: null,
  });

  const [previewUrls, setPreviewUrls] = useState<Record<JournalSlot, string | null>>({
    highlight: null,
    tv_matches: null,
    results: null,
    next_round: null,
    table: null,
    cup: null,
    champions: null,
  });

  const [uploading, setUploading] = useState<JournalSlot | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const loadData = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    const { data: adminRow, error: adminError } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !adminRow) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    const { data, error } = await supabase
      .from("journal_images")
      .select("slot, image_url, storage_path, updated_at");

    if (error) {
      setErrorMessage("Não foi possível carregar as imagens atuais.");
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
    void loadData();

    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [loadData]);

  function handleFileChange(
    slot: JournalSlot,
    event: ChangeEvent<HTMLInputElement>
  ) {
    const file = event.target.files?.[0] || null;

    setFiles((current) => ({
      ...current,
      [slot]: file,
    }));

    setPreviewUrls((current) => {
      if (current[slot]) {
        URL.revokeObjectURL(current[slot] as string);
      }

      return {
        ...current,
        [slot]: file ? URL.createObjectURL(file) : null,
      };
    });

    setMessage("");
    setErrorMessage("");
  }

  async function upload(slot: JournalSlot) {
    const file = files[slot];

    if (!file) {
      setErrorMessage("Escolha uma imagem antes de atualizar.");
      return;
    }

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErrorMessage("Use uma imagem JPG, PNG ou WEBP.");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setErrorMessage("A imagem deve ter no máximo 10 MB.");
      return;
    }

    setUploading(slot);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessão expirada.");
      }

      const oldItem = images[slot];

      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        (file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg");

      const storagePath = `${slot}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("journal")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("journal").getPublicUrl(storagePath);

      const { error: saveError } = await supabase
        .from("journal_images")
        .upsert(
          {
            slot,
            image_url: publicUrl,
            storage_path: storagePath,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          {
            onConflict: "slot",
          }
        );

      if (saveError) {
        await supabase.storage.from("journal").remove([storagePath]);
        throw saveError;
      }

      if (oldItem?.storage_path && oldItem.storage_path !== storagePath) {
        await supabase.storage.from("journal").remove([oldItem.storage_path]);
      }

      if (previewUrls[slot]) {
        URL.revokeObjectURL(previewUrls[slot] as string);
      }

      setFiles((current) => ({
        ...current,
        [slot]: null,
      }));

      setPreviewUrls((current) => ({
        ...current,
        [slot]: null,
      }));

      setMessage(`${slotConfig.find((item) => item.slot === slot)?.title || "Imagem"} atualizada com sucesso.`);
      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a imagem."
      );
    } finally {
      setUploading(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando Jornal...
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-black">Acesso negado</h1>
          <p className="mt-3 text-red-200">
            Apenas administradores podem atualizar o Jornal FriendZone.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-7xl">
        <header className="mb-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            Administração
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            📰 Gerenciar Jornal
          </h1>

          <p className="mt-3 text-zinc-400">
            Escolha a arte pronta e clique em Atualizar imagem.
          </p>
        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 font-bold text-green-300">
            {message}
          </div>
        )}

        {errorMessage && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-300">
            {errorMessage}
          </div>
        )}

        <div className="space-y-8">
          {slotConfig.map(({ slot, title, description, featured }) => {
            const preview = previewUrls[slot] || images[slot]?.image_url || null;

            return (
              <section
                key={slot}
                className={`overflow-hidden rounded-3xl border ${
                  featured
                    ? "border-yellow-500/40 bg-yellow-500/[0.04]"
                    : "border-zinc-800 bg-zinc-900"
                }`}
              >
                <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
                  <div className="flex min-h-[280px] items-center justify-center bg-zinc-950">
                    {preview ? (
                      <img
                        src={preview}
                        alt={title}
                        className="h-auto max-h-[560px] w-full object-contain"
                      />
                    ) : (
                      <div className="p-8 text-center text-zinc-500">
                        <div className="text-5xl">{featured ? "📺" : "🖼️"}</div>
                        <p className="mt-3 font-bold">
                          Nenhuma imagem publicada.
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="p-6 md:p-8">
                    <p
                      className={`text-sm font-black uppercase tracking-widest ${
                        featured ? "text-yellow-400" : "text-green-400"
                      }`}
                    >
                      {featured ? "Destaque Especial" : "Jornal FriendZone"}
                    </p>

                    <h2 className="mt-2 text-3xl font-black">
                      {featured ? "📺 " : ""}
                      {title}
                    </h2>

                    <p className="mt-3 text-zinc-400">
                      {description}
                    </p>

                    <label className="mt-7 block">
                      <span className="mb-2 block text-sm font-black text-zinc-300">
                        Escolher imagem
                      </span>

                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => handleFileChange(slot, event)}
                        className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:font-black file:text-white hover:file:bg-green-500"
                      />
                    </label>

                    <button
                      type="button"
                      disabled={!files[slot] || uploading !== null}
                      onClick={() => void upload(slot)}
                      className={`mt-5 w-full rounded-xl px-5 py-4 font-black text-white transition disabled:cursor-not-allowed disabled:opacity-40 ${
                        featured
                          ? "bg-yellow-600 hover:bg-yellow-500"
                          : "bg-green-600 hover:bg-green-500"
                      }`}
                    >
                      {uploading === slot
                        ? "Enviando..."
                        : "Atualizar imagem"}
                    </button>

                    {images[slot]?.updated_at && (
                      <p className="mt-4 text-xs font-bold text-zinc-600">
                        Última atualização:{" "}
                        {new Date(images[slot]!.updated_at).toLocaleString("pt-BR")}
                      </p>
                    )}
                  </div>
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
