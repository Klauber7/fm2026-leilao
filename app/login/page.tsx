"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const router = useRouter();

  const [managerName, setManagerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      alert("Preencha email e senha.");
      return;
    }

    setLoading(true);

    try {
      // Remove qualquer sessão antiga antes de entrar
      await supabase.auth.signOut();

      const { data, error } =
        await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

      if (error) {
        alert(error.message);
        return;
      }

      if (!data.user) {
        alert("Não foi possível identificar o usuário.");
        return;
      }

      // Verifica se ESTE usuário já possui clube
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

      // Se já possui clube
      if (team) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      // Se ainda não possui clube
      router.replace("/choose-team");
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister() {
    if (
      !managerName.trim() ||
      !email.trim() ||
      !password
    ) {
      alert("Preencha nome, email e senha.");
      return;
    }

    if (password.length < 6) {
      alert(
        "A senha precisa ter pelo menos 6 caracteres."
      );
      return;
    }

    setLoading(true);

    try {
      // MUITO IMPORTANTE:
      // encerra qualquer conta anterior antes do cadastro
      await supabase.auth.signOut();

      const { data, error } =
        await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              manager_name: managerName.trim(),
            },
          },
        });

      if (error) {
        alert(error.message);
        return;
      }

      if (!data.user) {
        alert(
          "Não foi possível criar a conta."
        );
        return;
      }

      /*
        IMPORTANTE:

        Se o Supabase estiver configurado sem confirmação
        de email, o signUp pode fazer login automaticamente.

        Por isso fazemos signOut aqui novamente.

        Assim uma conta recém-criada nunca herda ou mantém
        uma sessão anterior.
      */

      await supabase.auth.signOut();

      alert(
        "Conta criada com sucesso! Agora faça login."
      );

      setManagerName("");
      setPassword("");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-zinc-950 text-white flex items-center justify-center px-4 pt-24">
      <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-2xl w-full max-w-md shadow-2xl">
        <h1 className="text-4xl font-black mb-2 text-center">
          FriendZone FM
        </h1>

        <p className="text-zinc-400 text-center mb-8">
          Login do Manager
        </p>

        <input
          type="text"
          placeholder="Nome do manager"
          value={managerName}
          onChange={(e) =>
            setManagerName(e.target.value)
          }
          disabled={loading}
          className="w-full p-4 rounded-xl bg-zinc-800 border border-zinc-700 mb-4 outline-none focus:border-green-500 disabled:opacity-50"
        />

        <input
          type="email"
          placeholder="Seu email"
          value={email}
          onChange={(e) =>
            setEmail(e.target.value)
          }
          disabled={loading}
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
          disabled={loading}
          className="w-full p-4 rounded-xl bg-zinc-800 border border-zinc-700 mb-6 outline-none focus:border-green-500 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-green-600 hover:bg-green-700 disabled:bg-zinc-600 p-4 rounded-xl font-bold mb-3"
        >
          {loading
            ? "Carregando..."
            : "Entrar"}
        </button>

        <button
          type="button"
          onClick={handleRegister}
          disabled={loading}
          className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-zinc-600 p-4 rounded-xl font-bold"
        >
          {loading
            ? "Carregando..."
            : "Criar conta"}
        </button>
      </div>
    </main>
  );
}