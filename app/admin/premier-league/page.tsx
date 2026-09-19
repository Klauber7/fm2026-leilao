"use client";

import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type CompetitionImage = {
  competition: string;
  slot: string;
  image_url: string;
  storage_path: string;
  updated_at: string;
};

const COMPETITION = "premier_league";

function getRoundSlot(round: number) {
  return `round_${String(round).padStart(2, "0")}`;
}

function getAwardSlot(round: number) {
  return `award_${String(round).padStart(2, "0")}`;
}

export default function AdminPremierLeaguePage() {
  const [images, setImages] = useState<CompetitionImage[]>([]);
  const [files, setFiles] = useState<Record<string, File | null>>({});
  const [previewUrls, setPreviewUrls] = useState<Record<string, string | null>>(
    {}
  );

  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [authorized, setAuthorized] = useState(false);
  const [selectedRound, setSelectedRound] = useState(1);
  const [selectedAwardRound, setSelectedAwardRound] = useState(1);

  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");

  const rounds = useMemo(
    () => Array.from({ length: 38 }, (_, index) => index + 1),
    []
  );


  const imageMap = useMemo(() => {
    const map = new Map<string, CompetitionImage>();

    for (const image of images) {
      map.set(image.slot, image);
    }

    return map;
  }, [images]);

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

    const { data: adminRole, error: adminError } =
      await supabase.rpc("get_my_admin_role");

    if (
      adminError ||
      (adminRole !== "owner" && adminRole !== "master")
    ) {
      setAuthorized(false);
      setLoading(false);
      return;
    }

    setAuthorized(true);

    const { data, error } = await supabase
      .from("competition_images")
      .select("competition, slot, image_url, storage_path, updated_at")
      .eq("competition", COMPETITION);

    if (error) {
      console.error(error);
      setErrorMessage("Não foi possível carregar as imagens da Premier League.");
      setLoading(false);
      return;
    }

    setImages((data || []) as CompetitionImage[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      Object.values(previewUrls).forEach((url) => {
        if (url) {
          URL.revokeObjectURL(url);
        }
      });
    };
  }, [previewUrls]);

  function handleFileChange(
    slot: string,
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

  async function upload(slot: string) {
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

    setUploadingSlot(slot);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessão expirada.");
      }

      const oldItem = imageMap.get(slot);

      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        (file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg");

      const storagePath =
        `${COMPETITION}/${slot}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("competitions")
        .upload(storagePath, file, {
          cacheControl: "3600",
          upsert: false,
          contentType: file.type,
        });

      if (uploadError) {
        throw uploadError;
      }

      const {
        data: { publicUrl },
      } = supabase.storage.from("competitions").getPublicUrl(storagePath);

      const { error: saveError } = await supabase
        .from("competition_images")
        .upsert(
          {
            competition: COMPETITION,
            slot,
            image_url: publicUrl,
            storage_path: storagePath,
            updated_at: new Date().toISOString(),
            updated_by: user.id,
          },
          {
            onConflict: "competition,slot",
          }
        );

      if (saveError) {
        await supabase.storage.from("competitions").remove([storagePath]);
        throw saveError;
      }

      if (
        oldItem?.storage_path &&
        oldItem.storage_path !== storagePath
      ) {
        await supabase.storage
          .from("competitions")
          .remove([oldItem.storage_path]);
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

      const title =
        slot === "table"
          ? "Tabela"
          : slot === "top_scorer"
            ? "Artilheiro"
            : slot === "best_player"
              ? "Melhor Jogador"
              : slot.startsWith("round_")
                ? `Rodada ${Number(slot.replace("round_", ""))}`
                : slot.startsWith("award_")
                  ? `Premiação da Rodada ${Number(slot.replace("award_", ""))}`
                  : slot;

      setMessage(`${title} atualizado com sucesso.`);

      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar a imagem."
      );
    } finally {
      setUploadingSlot(null);
    }
  }

  function UploadCard({
    slot,
    title,
  }: {
    slot: string;
    title: string;
  }) {
    const currentImage = imageMap.get(slot);
    const preview = previewUrls[slot] || currentImage?.image_url || null;
    const selectedFile = files[slot];

    return (
      <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
        <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr]">
          <div className="flex min-h-[260px] items-center justify-center bg-zinc-950">
            {preview ? (
              <img
                src={preview}
                alt={title}
                className="h-auto max-h-[620px] w-full object-contain"
              />
            ) : (
              <div className="p-8 text-center text-zinc-500">
                <div className="text-5xl">🏆</div>

                <p className="mt-4 font-bold">
                  Nenhuma imagem publicada.
                </p>
              </div>
            )}
          </div>

          <div className="p-6 md:p-8">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-green-400">
              FriendZone Premier League
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {title}
            </h2>

            <label className="mt-6 block">
              <span className="mb-2 block text-sm font-black text-zinc-300">
                Escolher imagem
              </span>

              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) =>
                  handleFileChange(slot, event)
                }
                className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:font-black file:text-white hover:file:bg-green-500"
              />
            </label>

            <button
              type="button"
              disabled={!selectedFile || uploadingSlot !== null}
              onClick={() => void upload(slot)}
              className="mt-5 w-full rounded-xl bg-green-600 px-5 py-4 font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {uploadingSlot === slot
                ? "Enviando..."
                : "Atualizar imagem"}
            </button>

            {currentImage?.updated_at && (
              <p className="mt-4 text-xs font-bold text-zinc-600">
                Última atualização:{" "}
                {new Date(
                  currentImage.updated_at
                ).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-zinc-400">
            Carregando administração da Premier League...
          </div>
        </div>
      </main>
    );
  }

  if (!authorized) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-3xl rounded-3xl border border-red-500/30 bg-red-500/10 p-8">
          <h1 className="text-3xl font-black">
            Acesso negado
          </h1>

          <p className="mt-3 text-red-200">
            Apenas administradores podem gerenciar a Premier League.
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
            🏆 FriendZone Premier League
          </h1>

          <p className="mt-3 text-zinc-400">
            Gerencie as 38 rodadas, tabela, artilheiro,
            melhor jogador e as premiações em dinheiro da competição.
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

        <div className="space-y-16">
          {/* PRINCIPAIS */}
          <section>
            <div className="mb-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                Informações principais
              </p>

              <h2 className="mt-1 text-3xl font-black">
                Premier League
              </h2>
            </div>

            <div className="space-y-8">
              <UploadCard
                slot="table"
                title="Tabela"
              />

              <UploadCard
                slot="top_scorer"
                title="Artilheiro"
              />

              <UploadCard
                slot="best_player"
                title="Melhor Jogador"
              />
            </div>
          </section>

          {/* RODADAS */}
          <section>
            <div className="mb-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
                Temporada
              </p>

              <h2 className="mt-1 text-3xl font-black">
                ⚽ 38 Rodadas
              </h2>

              <p className="mt-2 text-zinc-400">
                Escolha a rodada que deseja publicar ou atualizar.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-zinc-300">
                  Selecionar rodada
                </span>

                <select
                  value={selectedRound}
                  onChange={(event) =>
                    setSelectedRound(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-bold text-white outline-none focus:border-green-500"
                >
                  {rounds.map((round) => (
                    <option key={round} value={round}>
                      Rodada {round}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <UploadCard
              slot={getRoundSlot(selectedRound)}
              title={`Rodada ${selectedRound}`}
            />
          </section>

          {/* PREMIAÇÕES */}
          <section>
            <div className="mb-6">
              <p className="text-sm font-black uppercase tracking-[0.2em] text-yellow-400">
                Premiações
              </p>

              <h2 className="mt-1 text-3xl font-black">
                💰 Premiação por Rodada
              </h2>

              <p className="mt-2 text-zinc-400">
                Escolha a rodada e publique a arte com o valor da premiação em dinheiro.
              </p>
            </div>

            <div className="mb-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <label className="block">
                <span className="mb-2 block text-sm font-black text-zinc-300">
                  Selecionar rodada
                </span>

                <select
                  value={selectedAwardRound}
                  onChange={(event) =>
                    setSelectedAwardRound(Number(event.target.value))
                  }
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-bold text-white outline-none focus:border-yellow-500"
                >
                  {rounds.map((round) => (
                    <option key={round} value={round}>
                      Rodada {round}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <UploadCard
              slot={getAwardSlot(selectedAwardRound)}
              title={`Premiação em Dinheiro — Rodada ${selectedAwardRound}`}
            />
          </section>
        </div>
      </div>
    </main>
  );
}