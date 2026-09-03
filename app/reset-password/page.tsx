"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [canReset, setCanReset] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function prepareSession() {
      try {
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } =
            await supabase.auth.exchangeCodeForSession(code);

          if (error) throw error;

          window.history.replaceState(
            {},
            document.title,
            "/reset-password"
          );
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        setCanReset(Boolean(session));
      } catch (err) {
        console.error(err);
        setError(
          "Link inválido ou expirado. Solicite um novo e-mail de recuperação."
        );
      } finally {
        setChecking(false);
      }
    }

    prepareSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN"
      ) {
        setCanReset(Boolean(session));
        setChecking(false);
        setError("");
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");
    setMessage("");

    if (password.length < 8) {
      setError("A senha precisa ter pelo menos 8 caracteres.");
      return;
    }

    if (password !== confirmPassword) {
      setError("As senhas não são iguais.");
      return;
    }

    if (!canReset) {
      setError(
        "O link de recuperação não está válido. Solicite um novo e-mail."
      );
      return;
    }

    setLoading(true);

    const { error: updateError } =
      await supabase.auth.updateUser({
        password,
      });

    if (updateError) {
      console.error(updateError);
      setError(
        "Não foi possível alterar a senha. O link pode ter expirado."
      );
      setLoading(false);
      return;
    }

    setMessage("Senha alterada com sucesso!");

    await supabase.auth.signOut();

    setTimeout(() => {
      router.replace("/login");
      router.refresh();
    }, 1500);
  }

  if (checking) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <p className="text-zinc-400">
          Validando link de recuperação...
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 py-12 text-white">
      <div className="w-full max-w-md rounded-3xl border border-zinc-800 bg-zinc-900 p-8 shadow-2xl">
        <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
          FriendZone League FM
        </p>

        <h1 className="mt-3 text-3xl font-black">
          Redefinir senha
        </h1>

        <p className="mt-2 text-zinc-400">
          Digite sua nova senha abaixo.
        </p>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {message}
          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="mt-8 space-y-5"
        >
          <div>
            <label className="mb-2 block text-sm font-bold text-zinc-300">
              Nova senha
            </label>

            <input
              type="password"
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
              placeholder="Digite a nova senha"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-green-500"
              required
            />
          </div>

          <div>
            <label className="mb-2 block text-sm font-bold text-zinc-300">
              Confirmar nova senha
            </label>

            <input
              type="password"
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
              placeholder="Digite novamente"
              className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-green-500"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading || !canReset}
            className="w-full rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading
              ? "ALTERANDO..."
              : "ALTERAR SENHA"}
          </button>
        </form>
      </div>
    </main>
  );
}
