"use client";

import { ChangeEvent, useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type JournalImage = {
  slot: "highlight";
  image_url: string;
  storage_path: string;
  updated_at: string;
};

export default function AdminJornalPage() {
  const [image, setImage] = useState<JournalImage | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
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
      .select("slot, image_url, storage_path, updated_at")
      .eq("slot", "highlight")
      .maybeSingle();

    if (error) {
      setErrorMessage("Não foi possível carregar a imagem atual.");
      setLoading(false);
      return;
    }

    setImage((data as JournalImage | null) ?? null);
    setLoading(false);
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  useEffect(() => {
    return () => {
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
    };
  }, [previewUrl]);

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const selectedFile = event.target.files?.[0] || null;

    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }

    setFile(selectedFile);
    setPreviewUrl(selectedFile ? URL.createObjectURL(selectedFile) : null);
    setMessage("");
    setErrorMessage("");
  }

  async function upload() {
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

    setUploading(true);
    setMessage("");
    setErrorMessage("");

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        throw new Error("Sessão expirada.");
      }

      const extension =
        file.name.split(".").pop()?.toLowerCase() ||
        (file.type === "image/png"
          ? "png"
          : file.type === "image/webp"
            ? "webp"
            : "jpg");

      const storagePath = `highlight/${Date.now()}-${crypto.randomUUID()}.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("journal")
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
      } = supabase.storage.from("journal").getPublicUrl(storagePath);

      const { error: saveError } = await supabase
        .from("journal_images")
        .upsert(
          {
            slot: "highlight",
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

      if (image?.storage_path && image.storage_path !== storagePath) {
        await supabase.storage.from("journal").remove([image.storage_path]);
      }

      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }

      setFile(null);
      setPreviewUrl(null);
      setMessage("Jornal atualizado com sucesso.");

      await loadData();
    } catch (error) {
      console.error(error);

      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Não foi possível atualizar o Jornal."
      );
    } finally {
      setUploading(false);
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

  const preview = previewUrl || image?.image_url || null;

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-8 md:py-10">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10">
          <p className="text-sm font-black uppercase tracking-[0.22em] text-green-400">
            Administração
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            📰 Jornal
          </h1>

          <p className="mt-3 text-zinc-400">
            Escolha uma foto para publicar no Jornal.
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

        <section className="overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr]">
            <div className="flex min-h-[320px] items-center justify-center bg-zinc-950">
              {preview ? (
                <img
                  src={preview}
                  alt="Jornal"
                  className="h-auto max-h-[720px] w-full object-contain"
                />
              ) : (
                <div className="p-8 text-center text-zinc-500">
                  <div className="text-5xl">📰</div>
                  <p className="mt-3 font-bold">
                    Nenhuma imagem publicada.
                  </p>
                </div>
              )}
            </div>

            <div className="p-6 md:p-8">
              <p className="text-sm font-black uppercase tracking-widest text-green-400">
                Jornal FriendZone
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Jornal
              </h2>

              <p className="mt-3 text-zinc-400">
                Esta é a única imagem exibida na página do Jornal.
              </p>

              <label className="mt-7 block">
                <span className="mb-2 block text-sm font-black text-zinc-300">
                  Escolher foto
                </span>

                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={handleFileChange}
                  className="block w-full rounded-xl border border-zinc-700 bg-zinc-950 p-3 text-sm text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-green-600 file:px-4 file:py-2 file:font-black file:text-white hover:file:bg-green-500"
                />
              </label>

              <button
                type="button"
                disabled={!file || uploading}
                onClick={() => void upload()}
                className="mt-5 w-full rounded-xl bg-green-600 px-5 py-4 font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:opacity-40"
              >
                {uploading ? "Enviando..." : "Atualizar Jornal"}
              </button>

              {image?.updated_at && (
                <p className="mt-4 text-xs font-bold text-zinc-600">
                  Última atualização:{" "}
                  {new Date(image.updated_at).toLocaleString("pt-BR")}
                </p>
              )}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}