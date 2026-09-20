"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

const COMPETITION = "champions_league";

type Slot =
  | "first_round"
  | "quarterfinals"
  | "semifinals"
  | "final"
  | "top_scorer"
  | "best_player"
  | "awards";

type ImageRecord = {
  competition: string;
  slot: string;
  image_url: string;
  storage_path: string;
  updated_at?: string;
  updated_by?: string | null;
};

const SECTIONS: {
  slot: Slot;
  title: string;
  description: string;
  icon: string;
}[] = [
  {
    slot: "first_round",
    title: "Primeira Eliminatória",
    description: "Resultados da primeira fase eliminatória da Champions Cup.",
    icon: "⚽",
  },
  {
    slot: "quarterfinals",
    title: "Quartas de Final",
    description: "Resultados das quartas de final.",
    icon: "🔥",
  },
  {
    slot: "semifinals",
    title: "Semifinal",
    description: "Resultados das semifinais.",
    icon: "⚔️",
  },
  {
    slot: "final",
    title: "Final",
    description: "Resultado da grande final da Champions Cup.",
    icon: "🏆",
  },
  {
    slot: "top_scorer",
    title: "Artilharia",
    description: "Classificação dos artilheiros da Champions Cup.",
    icon: "⚽",
  },
  {
    slot: "best_player",
    title: "Melhor Jogador",
    description: "Ranking ou destaque do melhor jogador da Champions Cup.",
    icon: "⭐",
  },
  {
    slot: "awards",
    title: "Premiação",
    description: "Premiações oficiais da Champions Cup.",
    icon: "💰",
  },
];

export default function ChampionsLeagueAdminPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);

  const [images, setImages] = useState<
    Partial<Record<Slot, ImageRecord>>
  >({});

  const [files, setFiles] = useState<
    Partial<Record<Slot, File>>
  >({});

  const [uploading, setUploading] = useState<
    Partial<Record<Slot, boolean>>
  >({});

  const [message, setMessage] = useState("");

  useEffect(() => {
    checkAccess();
  }, []);

  async function checkAccess() {
    try {
      setLoading(true);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError || !user) {
        router.push("/login");
        return;
      }

      const { data: roleData, error: roleError } =
        await supabase.rpc("get_my_admin_role");

      if (roleError) {
        console.error(roleError);
        setAuthorized(false);
        return;
      }

      const role =
        typeof roleData === "string"
          ? roleData
          : roleData?.role ?? null;

      if (role !== "owner" && role !== "master") {
        setAuthorized(false);
        return;
      }

      setAuthorized(true);

      await loadImages();
    } catch (error) {
      console.error(error);
      setAuthorized(false);
    } finally {
      setLoading(false);
    }
  }

  async function loadImages() {
    const { data, error } = await supabase
      .from("competition_images")
      .select("*")
      .eq("competition", COMPETITION);

    if (error) {
      console.error(error);
      return;
    }

    const mapped: Partial<Record<Slot, ImageRecord>> = {};

    (data || []).forEach((item: ImageRecord) => {
      mapped[item.slot as Slot] = item;
    });

    setImages(mapped);
  }

  function handleFileChange(
    slot: Slot,
    file: File | undefined
  ) {
    if (!file) return;

    setFiles((prev) => ({
      ...prev,
      [slot]: file,
    }));
  }

  async function uploadImage(slot: Slot) {
    const file = files[slot];

    if (!file) {
      setMessage("Selecione uma imagem primeiro.");
      return;
    }

    try {
      setUploading((prev) => ({
        ...prev,
        [slot]: true,
      }));

      setMessage("");

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setMessage("Usuário não autenticado.");
        return;
      }

      const oldImage = images[slot];

      const extension =
        file.name.split(".").pop()?.toLowerCase() || "jpg";

      const filename = `${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 10)}.${extension}`;

      const storagePath = `${COMPETITION}/${slot}/${filename}`;

      const { error: uploadError } = await supabase.storage
        .from("competitions")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
        });

      if (uploadError) {
        console.error(uploadError);
        setMessage(
          `Erro ao enviar imagem: ${uploadError.message}`
        );
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("competitions")
        .getPublicUrl(storagePath);

      const imageUrl = publicUrlData.publicUrl;

      const { error: dbError } = await supabase
        .from("competition_images")
        .upsert(
          {
            competition: COMPETITION,
            slot,
            image_url: imageUrl,
            storage_path: storagePath,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          {
            onConflict: "competition,slot",
          }
        );

      if (dbError) {
        console.error(dbError);

        await supabase.storage
          .from("competitions")
          .remove([storagePath]);

        setMessage(
          `Erro ao salvar no banco: ${dbError.message}`
        );

        return;
      }

      if (
        oldImage?.storage_path &&
        oldImage.storage_path !== storagePath
      ) {
        await supabase.storage
          .from("competitions")
          .remove([oldImage.storage_path]);
      }

      setFiles((prev) => ({
        ...prev,
        [slot]: undefined,
      }));

      await loadImages();

      setMessage("Imagem publicada com sucesso.");
    } catch (error) {
      console.error(error);

      setMessage("Erro inesperado ao publicar imagem.");
    } finally {
      setUploading((prev) => ({
        ...prev,
        [slot]: false,
      }));
    }
  }

  async function removeImage(slot: Slot) {
    const current = images[slot];

    if (!current) return;

    const confirmed = window.confirm(
      "Tem certeza que deseja remover esta imagem?"
    );

    if (!confirmed) return;

    try {
      setUploading((prev) => ({
        ...prev,
        [slot]: true,
      }));

      const { error: deleteDbError } = await supabase
        .from("competition_images")
        .delete()
        .eq("competition", COMPETITION)
        .eq("slot", slot);

      if (deleteDbError) {
        setMessage(deleteDbError.message);
        return;
      }

      if (current.storage_path) {
        await supabase.storage
          .from("competitions")
          .remove([current.storage_path]);
      }

      await loadImages();

      setMessage("Imagem removida com sucesso.");
    } catch (error) {
      console.error(error);

      setMessage("Erro ao remover imagem.");
    } finally {
      setUploading((prev) => ({
        ...prev,
        [slot]: false,
      }));
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-lg text-slate-300">
          Carregando...
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center px-4">
        <div className="max-w-md w-full rounded-2xl border border-red-500/30 bg-red-950/20 p-8 text-center">
          <div className="text-5xl mb-4">🚫</div>

          <h1 className="text-2xl font-bold mb-2">
            Acesso negado
          </h1>

          <p className="text-slate-400">
            Apenas Owner ou Master pode administrar a
            Champions Cup.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-4 py-10">
        <div className="mb-10">
          <button
            onClick={() => router.push("/admin")}
            className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-300 transition hover:border-cyan-500 hover:text-white"
          >
            ← Voltar ao Admin
          </button>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="mb-2 text-sm font-bold uppercase tracking-[0.25em] text-cyan-400">
                FriendZone League FM
              </p>

              <h1 className="text-4xl font-black md:text-5xl">
                🏆 Champions Cup
              </h1>

              <p className="mt-3 max-w-2xl text-slate-400">
                Publique resultados, fases, artilharia,
                melhor jogador e premiações da Champions
                Cup.
              </p>
            </div>

            <button
              onClick={() => router.push("/champions-league")}
              className="rounded-xl bg-cyan-500 px-5 py-3 font-bold text-slate-950 transition hover:bg-cyan-400"
            >
              Ver página pública
            </button>
          </div>
        </div>

        {message && (
          <div className="mb-8 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-5 py-4 text-cyan-100">
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          {SECTIONS.map((section) => {
            const currentImage = images[section.slot];
            const selectedFile = files[section.slot];
            const isUploading =
              uploading[section.slot] === true;

            return (
              <section
                key={section.slot}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-xl"
              >
                <div className="border-b border-slate-800 p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-cyan-500/10 text-2xl">
                      {section.icon}
                    </div>

                    <div>
                      <h2 className="text-xl font-bold">
                        {section.title}
                      </h2>

                      <p className="mt-1 text-sm text-slate-400">
                        {section.description}
                      </p>
                    </div>
                  </div>
                </div>

                {currentImage ? (
                  <div className="bg-black">
                    <img
                      src={currentImage.image_url}
                      alt={section.title}
                      className="max-h-[500px] w-full object-contain"
                    />
                  </div>
                ) : (
                  <div className="flex h-52 items-center justify-center bg-slate-950/60">
                    <div className="text-center">
                      <div className="mb-2 text-4xl">
                        🖼️
                      </div>

                      <p className="text-sm text-slate-500">
                        Nenhuma imagem publicada
                      </p>
                    </div>
                  </div>
                )}

                <div className="space-y-4 p-6">
                  <label className="block">
                    <span className="mb-2 block text-sm font-semibold text-slate-300">
                      Selecionar imagem
                    </span>

                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) =>
                        handleFileChange(
                          section.slot,
                          e.target.files?.[0]
                        )
                      }
                      className="block w-full rounded-xl border border-slate-700 bg-slate-950 p-3 text-sm text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-cyan-500 file:px-4 file:py-2 file:font-bold file:text-slate-950 hover:file:bg-cyan-400"
                    />
                  </label>

                  {selectedFile && (
                    <div className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-slate-400">
                      Arquivo: {selectedFile.name}
                    </div>
                  )}

                  <div className="flex flex-col gap-3 sm:flex-row">
                    <button
                      onClick={() =>
                        uploadImage(section.slot)
                      }
                      disabled={
                        !selectedFile || isUploading
                      }
                      className="flex-1 rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      {isUploading
                        ? "Publicando..."
                        : currentImage
                        ? "Substituir imagem"
                        : "Publicar imagem"}
                    </button>

                    {currentImage && (
                      <button
                        onClick={() =>
                          removeImage(section.slot)
                        }
                        disabled={isUploading}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-bold text-red-400 transition hover:bg-red-500/20 disabled:opacity-40"
                      >
                        Remover
                      </button>
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