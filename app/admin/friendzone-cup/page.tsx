"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

const COMPETITION = "friendzone_cup";

type Slot =
  | "first_round"
  | "round_of_16"
  | "quarterfinals"
  | "semifinals"
  | "final"
  | "top_scorer"
  | "best_player"
  | "money_first_round"
  | "money_round_of_16"
  | "money_quarterfinals"
  | "money_semifinals"
  | "money_final";

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
    title: "1ª Eliminatória",
    description: "Resultados da primeira eliminatória.",
    icon: "⚽",
  },
  {
    slot: "round_of_16",
    title: "Oitavas de Final",
    description: "Resultados das oitavas de final.",
    icon: "🔵",
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
    description: "Resultado da grande final.",
    icon: "🏆",
  },
  {
    slot: "top_scorer",
    title: "Artilharia",
    description: "Artilheiros da FriendZone Cup.",
    icon: "⚽",
  },
  {
    slot: "best_player",
    title: "Melhor Jogador",
    description: "Melhores jogadores da FriendZone Cup.",
    icon: "⭐",
  },

  {
    slot: "money_first_round",
    title: "Premiação — 1ª Eliminatória",
    description:
      "Premiação em dinheiro referente à primeira eliminatória.",
    icon: "💰",
  },
  {
    slot: "money_round_of_16",
    title: "Premiação — Oitavas de Final",
    description:
      "Premiação em dinheiro referente às oitavas de final.",
    icon: "💰",
  },
  {
    slot: "money_quarterfinals",
    title: "Premiação — Quartas de Final",
    description:
      "Premiação em dinheiro referente às quartas de final.",
    icon: "💰",
  },
  {
    slot: "money_semifinals",
    title: "Premiação — Semifinal",
    description:
      "Premiação em dinheiro referente às semifinais.",
    icon: "💰",
  },
  {
    slot: "money_final",
    title: "Premiação — Final",
    description:
      "Premiação em dinheiro referente à final da FriendZone Cup.",
    icon: "💰",
  },
];

export default function FriendZoneCupAdminPage() {
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

      const role = roleData as string | null;

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
      setMessage("Erro ao carregar imagens.");
      return;
    }

    const mapped: Partial<Record<Slot, ImageRecord>> = {};

    (data || []).forEach((item) => {
      const record = item as ImageRecord;
      mapped[record.slot as Slot] = record;
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
        await supabase.storage
          .from("competitions")
          .remove([storagePath]);

        setMessage(
          `Erro ao salvar: ${dbError.message}`
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

      setFiles((prev) => {
        const next = { ...prev };
        delete next[slot];
        return next;
      });

      await loadImages();

      setMessage("Imagem publicada com sucesso.");
    } catch (error) {
      console.error(error);
      setMessage("Erro inesperado ao publicar.");
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

    if (
      !window.confirm(
        "Tem certeza que deseja remover esta imagem?"
      )
    ) {
      return;
    }

    try {
      setUploading((prev) => ({
        ...prev,
        [slot]: true,
      }));

      const { error } = await supabase
        .from("competition_images")
        .delete()
        .eq("competition", COMPETITION)
        .eq("slot", slot);

      if (error) {
        setMessage(error.message);
        return;
      }

      if (current.storage_path) {
        await supabase.storage
          .from("competitions")
          .remove([current.storage_path]);
      }

      await loadImages();

      setMessage("Imagem removida.");
    } finally {
      setUploading((prev) => ({
        ...prev,
        [slot]: false,
      }));
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Carregando...
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        Acesso negado.
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-10">
        <button
          onClick={() => router.push("/admin")}
          className="mb-6 rounded-xl border border-slate-700 bg-slate-900 px-4 py-2"
        >
          ← Voltar ao Admin
        </button>

        <h1 className="text-4xl font-black">
          🏆 FriendZone Cup
        </h1>

        <p className="mt-3 text-slate-400">
          Resultados, estatísticas e premiação em dinheiro
          por fase.
        </p>

        {message && (
          <div className="mt-6 rounded-xl border border-cyan-500/30 bg-cyan-500/10 p-4">
            {message}
          </div>
        )}

        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {SECTIONS.map((section) => {
            const currentImage = images[section.slot];
            const selectedFile = files[section.slot];
            const isUploading =
              uploading[section.slot] === true;

            return (
              <section
                key={section.slot}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-900"
              >
                <div className="p-6">
                  <h2 className="text-xl font-bold">
                    {section.icon} {section.title}
                  </h2>

                  <p className="mt-2 text-sm text-slate-400">
                    {section.description}
                  </p>
                </div>

                {currentImage && (
                  <div className="bg-black">
                    <img
                      src={currentImage.image_url}
                      alt={section.title}
                      className="max-h-[500px] w-full object-contain"
                    />
                  </div>
                )}

                <div className="space-y-4 p-6">
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) =>
                      handleFileChange(
                        section.slot,
                        e.target.files?.[0]
                      )
                    }
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 p-3"
                  />

                  <button
                    onClick={() =>
                      uploadImage(section.slot)
                    }
                    disabled={!selectedFile || isUploading}
                    className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:opacity-40"
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
                      className="w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-bold text-red-400"
                    >
                      Remover
                    </button>
                  )}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}