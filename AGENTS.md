<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
page.tsx
"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  async function handleLogin() {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Login realizado!");
    }
  }

  async function handleRegister() {
    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      alert(error.message);
    } else {
      alert("Conta criada!");
    }
  }

  return (
    <main className="min-h-screen bg-zinc-900 text-white flex items-center justify-center">
      <div className="bg-zinc-800 p-8 rounded-2xl w-full max-w-md">
        <h1 className="text-3xl font-bold mb-6">
          Login do Clube
        </h1>

        <input
          type="email"
          placeholder="Seu email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full p-3 rounded bg-zinc-700 mb-4"
        />

        <input
          type="password"
          placeholder="Sua senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 rounded bg-zinc-700 mb-6"
        />

        <button
          onClick={handleLogin}
          className="w-full bg-green-500 p-3 rounded font-bold mb-3"
        >
          Entrar
        </button>

        <button
          onClick={handleRegister}
          className="w-full bg-blue-500 p-3 rounded font-bold"
        >
          Criar conta
        </button>
      </div>
    </main>
  );
}