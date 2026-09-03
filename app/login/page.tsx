"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [recovering, setRecovering] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      alert("Preencha email e senha.");
      return;
    }

    setLoading(true);

    try {
      await supabase.auth.signOut();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        alert("Email ou senha incorretos.");
        return;
      }

      if (!data.user) {
        alert("Não foi possível identificar o usuário.");
        return;
      }

      const { data: team, error: teamError } =
        await supabase
          .from("teams")
          .select("id")
          .eq("manager_id", data.user.id)
          .maybeSingle();

      if (teamError) {
        console.error(
          "Erro ao verificar clube:",
          teamError
        );

        alert(
          "Login realizado, mas ocorreu um erro ao verificar sua equipe."
        );

        return;
      }

      if (team) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      alert(
        "Sua conta ainda não está vinculada a um clube. Entre em contato com a administração."
      );

      await supabase.auth.signOut();
    } finally {
      setLoading(false);
    }
  }

  async function handleForgotPassword() {
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      alert(
        "Digite seu email primeiro e depois clique em Esqueci minha senha."
      );
      return;
    }

    setRecovering(true);

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const { error } =
        await supabase.auth.resetPasswordForEmail(
          cleanEmail,
          {
            redirectTo,
          }
        );

      if (error) {
        console.error(
          "Erro ao enviar recuperação:",
          error
        );

        alert(
          "Não foi possível enviar o email de recuperação."
        );

        return;
      }

      alert(
        "Email de recuperação enviado! Abra o email e clique no link para criar uma nova senha."
      );
    } finally {
      setRecovering(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 pt-24">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h1 className="text-4xl font-black mb-2 text-center">
          FriendZone FM
        </h1>

        <p className="text-zinc-400 text-center mb-8">
          Acesso do Presidente
        </p>

        <input
          type="email"
          placeholder="Seu email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          disabled={loading || recovering}
          className="w-full p-4 rounded-xl bg-zinc-800 border border-zinc-700 mb-4 outline-none focus:border-green-500 disabled:opacity-50"
        />

        <input
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) =>
            setPassword(e.target.value)
          }
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleLogin();
            }
          }}
          disabled={loading || recovering}
          className="w-full p-4 rounded-xl bg-zinc-800 border border-zinc-700 mb-3 outline-none focus:border-green-500 disabled:opacity-50"
        />

        <div className="mb-6 text-right">
          <button
            type="button"
            onClick={handleForgotPassword}
            disabled={loading || recovering}
            className="text-sm font-bold text-green-400 hover:text-green-300 disabled:opacity-50"
          >
            {recovering
              ? "Enviando..."
              : "Esqueci minha senha"}
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading || recovering}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 p-4 rounded-xl font-bold"
        >
          {loading
            ? "Entrando..."
            : "Entrar"}
        </button>

        <p className="mt-6 text-center text-xs text-zinc-500">
          Contas são criadas e vinculadas aos clubes pela administração.
        </p>
      </div>
    </main>
  );
}
