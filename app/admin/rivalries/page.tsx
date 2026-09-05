"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  manager_name: string | null;
  logo_url: string | null;
  rival_1_id: number | null;
  rival_2_id: number | null;
  rival_3_id: number | null;
};

export default function AdminRivalriesPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadRivalries =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        router.replace("/login");
        return;
      }

      const {
        data: hasAdminAccess,
        error: adminError,
      } =
        await supabase.rpc(
          "is_site_master"
        );

      if (
        adminError ||
        hasAdminAccess !== true
      ) {
        console.error(
          "Erro ao verificar acesso administrativo:",
          adminError,
          hasAdminAccess
        );

        router.replace(
          "/dashboard"
        );

        return;
      }

      setIsAdmin(true);

      const {
        data,
        error,
      } =
        await supabase
          .from("teams")
          .select(`
            id,
            name,
            manager_name,
            logo_url,
            rival_1_id,
            rival_2_id,
            rival_3_id
          `)
          .order(
            "name",
            {
              ascending: true,
            }
          );

      if (error) {
        console.error(error);

        setErrorMessage(
          error.message ||
            "Erro ao carregar rivalidades."
        );

        setLoading(false);
        return;
      }

      setTeams(
        (data || []) as Team[]
      );

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadRivalries();
  }, [loadRivalries]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const channel =
      supabase
        .channel(
          "admin-rivalries"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "teams",
          },
          () => {
            loadRivalries();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    isAdmin,
    loadRivalries,
  ]);

  const teamsById =
    useMemo(() => {
      const map =
        new Map<
          number,
          Team
        >();

      teams.forEach(
        (team) => {
          map.set(
            team.id,
            team
          );
        }
      );

      return map;
    }, [teams]);

  const completedCount =
    useMemo(
      () =>
        teams.filter(
          (team) =>
            team.rival_1_id &&
            team.rival_2_id &&
            team.rival_3_id
        ).length,
      [teams]
    );

  const pendingCount =
    teams.length -
    completedCount;

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando rivalidades...
        </p>
      </main>
    );
  }

  if (!isAdmin) {
    return null;
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">

          <div>

            <p className="font-bold uppercase tracking-widest text-red-400">
              Administração
            </p>

            <h1 className="mt-2 text-5xl font-black md:text-6xl">
              Rivalidades
            </h1>

            <p className="mt-3 max-w-3xl text-lg text-zinc-400">
              Consulte os 3 rivais definidos por cada equipe da FriendZone League FM.
            </p>

          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:border-zinc-500 hover:bg-zinc-800"
          >
            ← Voltar para Administração
          </Link>

        </div>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid gap-4 sm:grid-cols-3">

          <StatCard
            label="Clubes"
            value={teams.length}
          />

          <StatCard
            label="Com 3 rivais"
            value={completedCount}
            valueClass="text-green-400"
          />

          <StatCard
            label="Pendentes"
            value={pendingCount}
            valueClass={
              pendingCount > 0
                ? "text-yellow-400"
                : "text-zinc-300"
            }
          />

        </section>

        <section className="mt-10">

          <div className="flex items-center justify-between gap-4">

            <div>

              <p className="text-sm font-black uppercase tracking-widest text-zinc-500">
                FriendZone League FM
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Rivais por equipe
              </h2>

            </div>

            <span className="rounded-full border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black text-zinc-300">
              {teams.length} clubes
            </span>

          </div>

          <div className="mt-6 grid gap-5 lg:grid-cols-2">

            {teams.map(
              (team) => {
                const rivalIds = [
                  team.rival_1_id,
                  team.rival_2_id,
                  team.rival_3_id,
                ];

                const rivals =
                  rivalIds.map(
                    (id) =>
                      id
                        ? teamsById.get(
                            id
                          ) ??
                          null
                        : null
                  );

                const completed =
                  rivals.every(
                    (rival) =>
                      rival !== null
                  );

                return (
                  <article
                    key={team.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                  >

                    <div className="flex items-start justify-between gap-4">

                      <div className="flex min-w-0 items-center gap-4">

                        <TeamLogo
                          team={team}
                          size="large"
                        />

                        <div className="min-w-0">

                          <p className="truncate text-xl font-black uppercase text-white">
                            {team.name}
                          </p>

                          <p className="mt-1 truncate text-sm text-zinc-500">
                            Presidente:{" "}
                            <span className="font-bold text-zinc-300">
                              {team.manager_name ||
                                "Não definido"}
                            </span>
                          </p>

                        </div>

                      </div>

                      <span
                        className={`shrink-0 rounded-full border px-3 py-2 text-xs font-black ${
                          completed
                            ? "border-green-500/30 bg-green-500/10 text-green-400"
                            : "border-yellow-500/30 bg-yellow-500/10 text-yellow-400"
                        }`}
                      >
                        {completed
                          ? "3/3 DEFINIDOS"
                          : `${rivals.filter(Boolean).length}/3 DEFINIDOS`}
                      </span>

                    </div>

                    <div className="mt-5 grid gap-3 sm:grid-cols-3">

                      {rivals.map(
                        (
                          rival,
                          index
                        ) => (
                          <RivalCard
                            key={
                              `${team.id}-rival-${index + 1}`
                            }
                            rival={rival}
                            number={
                              index + 1
                            }
                          />
                        )
                      )}

                    </div>

                  </article>
                );
              }
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

function TeamLogo({
  team,
  size = "small",
}: {
  team: {
    name: string;
    logo_url: string | null;
  };
  size?: "small" | "large";
}) {
  const className =
    size === "large"
      ? "h-14 w-14"
      : "h-10 w-10";

  return (
    <div
      className={`flex ${className} shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-950`}
    >
      {team.logo_url ? (
        <img
          src={team.logo_url}
          alt={`Escudo do ${team.name}`}
          className="h-full w-full object-contain p-1.5"
        />
      ) : (
        <span className="text-xl">
          🛡️
        </span>
      )}
    </div>
  );
}

function RivalCard({
  rival,
  number,
}: {
  rival: Team | null;
  number: number;
}) {
  if (!rival) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-700 bg-zinc-950/60 p-4">

        <p className="text-[10px] font-black uppercase tracking-widest text-zinc-600">
          Rival {number}
        </p>

        <p className="mt-3 text-sm font-black text-zinc-500">
          Não definido
        </p>

      </div>
    );
  }

  return (
    <div className="rounded-xl border border-red-500/20 bg-zinc-950 p-4">

      <p className="text-[10px] font-black uppercase tracking-widest text-red-400">
        Rival {number}
      </p>

      <div className="mt-3 flex items-center gap-3">

        <TeamLogo
          team={rival}
        />

        <div className="min-w-0">

          <p className="truncate text-sm font-black uppercase text-white">
            {rival.name}
          </p>

          <p className="mt-0.5 text-[10px] font-bold uppercase tracking-wider text-zinc-600">
            Rivalidade
          </p>

        </div>

      </div>

    </div>
  );
}

function StatCard({
  label,
  value,
  valueClass = "",
}: {
  label: string;
  value: number;
  valueClass?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

      <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
        {label}
      </p>

      <p
        className={`mt-2 text-3xl font-black ${valueClass}`}
      >
        {value}
      </p>

    </div>
  );
}
