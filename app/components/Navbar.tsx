"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

export default function Navbar() {
  const router = useRouter();

  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    checkAdmin();
  }, []);

  async function checkAdmin() {
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setIsAdmin(false);
      return;
    }

    const { data, error } = await supabase
      .from("admin_users")
      .select("user_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Erro ao verificar admin:", error);
      setIsAdmin(false);
      return;
    }

    setIsAdmin(Boolean(data));
  }

  async function handleLogout() {
    const { error } = await supabase.auth.signOut();

    if (error) {
      alert("Erro ao sair da conta.");
      return;
    }

    router.push("/login");
    router.refresh();
  }

  return (
    <aside className="fixed left-0 top-0 z-50 hidden h-screen w-72 border-r border-zinc-800 bg-zinc-950 text-white lg:block">
      <div className="flex h-full flex-col p-6">

        {/* LOGO */}
        <Link href="/dashboard" className="mb-10 block">
          <h1 className="text-2xl font-black leading-tight">
            <span className="text-green-400">
              FriendZone
            </span>

            <br />

            League FM
          </h1>
        </Link>

        {/* MENU */}
        <nav className="space-y-2 text-sm font-bold text-zinc-300">

          {/* DASHBOARD */}
          <Link
            href="/dashboard"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🏠 Dashboard
          </Link>

          {/* MERCADO DE JOGADORES */}
          <Link
            href="/players"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🌍 Mercado de Jogadores
          </Link>

          {/* MERCADO DE TREINADORES */}
          <Link
            href="/coaches"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🧥 Mercado de Treinadores
          </Link>

          {/* BID */}
          <Link
            href="/bid"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            📢 BID
          </Link>

          {/* ELENCO */}
          <Link
            href="/squad"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            ⚽ Elenco
          </Link>

          {/* COMISSÃO TÉCNICA */}
          <Link
            href="/staff"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            👨‍💼 Comissão Técnica
          </Link>

          {/* LEILÕES DE JOGADORES */}
          <Link
            href="/auctions"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🔥 Leilões de Jogadores
          </Link>

          {/* LEILÃO DA COMISSÃO */}
          <Link
            href="/staff-auctions"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🔨 Leilão da Comissão
          </Link>

          {/* CONTRATAÇÕES */}
          <Link
            href="/transfers"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            📄 Contratações
          </Link>

          {/* HISTÓRICO */}
          <Link
            href="/history"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            📊 Histórico
          </Link>

          {/* CLUBES */}
          <Link
            href="/teams"
            className="block rounded-xl px-4 py-3 hover:bg-zinc-900 hover:text-green-400"
          >
            🏟️ Clubes
          </Link>

          {/* ADMINISTRAÇÃO */}
          {isAdmin && (
            <>
              <div className="my-3 border-t border-zinc-800" />

              <Link
                href="/admin"
                className="block rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-red-400 transition hover:bg-red-500/10 hover:text-red-300"
              >
                ⚙️ Administração
              </Link>
            </>
          )}
        </nav>

        {/* SAIR */}
        <div className="mt-auto">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl bg-red-600 px-4 py-3 text-center text-sm font-black text-white hover:bg-red-500"
          >
            Sair
          </button>
        </div>

      </div>
    </aside>
  );
}