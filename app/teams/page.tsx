"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  logo_url: string | null;
};

function TeamCard({ team }: { team: Team }) {
  const initial =
    team.name?.trim()?.charAt(0)?.toUpperCase() || "T";

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-[0_0_0_1px_rgba(255,255,255,0.02)] transition hover:-translate-y-0.5 hover:border-zinc-700">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-full w-full object-contain p-1"
                />
              ) : (
                <span className="text-xl font-black text-zinc-500">
                  {initial}
                </span>
              )}
            </div>

            <div className="min-w-0">
              <h2 className="line-clamp-2 text-xl font-black leading-tight text-white">
                {team.name}
              </h2>
            </div>
          </div>

          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-zinc-700 bg-zinc-800/60 text-xl font-black text-zinc-400">
            {initial}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 border-t border-zinc-800 p-4">
        <Link
          href={`/teams/${team.id}#elenco`}
          className="rounded-xl bg-blue-600 px-4 py-3 text-center font-black text-white transition hover:bg-blue-500"
        >
          Ver elenco
        </Link>

        <Link
          href={`/teams/${team.id}#staff`}
          className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-black text-white transition hover:bg-zinc-800"
        >
          Ver staff
        </Link>
      </div>
    </article>
  );
}

export default function TeamsPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTeams = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const { data, error } = await supabase
        .from("teams")
        .select("id, name, logo_url")
        .order("name", { ascending: true });

      if (error) {
        throw error;
      }

      setTeams((data || []) as Team[]);
    } catch (error) {
      console.error("Erro ao carregar times:", error);
      setErrorMessage(
        "Não foi possível carregar os times."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTeams();

    const channel = supabase
      .channel("teams-page-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
        },
        () => {
          void loadTeams();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTeams]);

  return (
    <main className="min-h-screen bg-[#050816] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-3xl font-black md:text-5xl">
            Times FM2026
          </h1>
        </header>

        {loading && (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6 text-zinc-400">
            Carregando times...
          </div>
        )}

        {!loading && errorMessage && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5 font-bold text-red-300">
            {errorMessage}
          </div>
        )}

        {!loading &&
          !errorMessage &&
          teams.length === 0 && (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center text-zinc-400">
              Nenhum time encontrado.
            </div>
          )}

        {!loading &&
          !errorMessage &&
          teams.length > 0 && (
            <section className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
              {teams.map((team) => (
                <TeamCard
                  key={team.id}
                  team={team}
                />
              ))}
            </section>
          )}
      </div>
    </main>
  );
}
