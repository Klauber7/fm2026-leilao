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
  budget: number | null;
  manager_name: string | null;
  manager_id: string | null;
  players_count: number;
};

type PlayerTeamRow = {
  team_id: number | null;
};

export default function AdminTeamsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [isAdmin, setIsAdmin] =
    useState(false);

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [search, setSearch] =
    useState("");

  const [
    editingBudgetId,
    setEditingBudgetId,
  ] =
    useState<number | null>(
      null
    );

  const [
    budgetValue,
    setBudgetValue,
  ] =
    useState("");

  const [
    processingId,
    setProcessingId,
  ] =
    useState<number | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadTeams =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        router.replace(
          "/login"
        );
        return;
      }

      const {
        data: adminData,
        error: adminError,
      } =
        await supabase
          .from("admin_users")
          .select("user_id")
          .eq(
            "user_id",
            user.id
          )
          .maybeSingle();

      if (
        adminError ||
        !adminData
      ) {
        router.replace(
          "/dashboard"
        );
        return;
      }

      setIsAdmin(true);

      const [
        teamsResult,
        playersResult,
      ] =
        await Promise.all([
          supabase
            .from("teams")
            .select(`
              id,
              name,
              budget,
              manager_name,
              manager_id
            `)
            .order(
              "name",
              {
                ascending:
                  true,
              }
            ),

          supabase
            .from("players")
            .select(
              "team_id"
            )
            .not(
              "team_id",
              "is",
              null
            ),
        ]);

      if (
        teamsResult.error
      ) {
        console.error(
          teamsResult.error
        );

        setError(
          "Não foi possível carregar os clubes."
        );

        setLoading(false);
        return;
      }

      if (
        playersResult.error
      ) {
        console.error(
          playersResult.error
        );
      }

      const countMap =
        new Map<
          number,
          number
        >();

      for (
        const row of
        (playersResult.data ||
          []) as PlayerTeamRow[]
      ) {
        if (
          row.team_id ===
          null
        ) {
          continue;
        }

        const id =
          Number(
            row.team_id
          );

        countMap.set(
          id,
          (countMap.get(id) ||
            0) + 1
        );
      }

      const hydrated =
        (
          teamsResult.data ||
          []
        ).map(
          (team: any) => ({
            id:
              Number(
                team.id
              ),
            name:
              String(
                team.name ||
                  `Clube #${team.id}`
              ),
            budget:
              team.budget !==
              null
                ? Number(
                    team.budget
                  )
                : 0,
            manager_name:
              team.manager_name ||
              null,
            manager_id:
              team.manager_id ||
              null,
            players_count:
              countMap.get(
                Number(
                  team.id
                )
              ) || 0,
          })
        ) as Team[];

      setTeams(
        hydrated
      );

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    const channel =
      supabase
        .channel(
          "admin-teams"
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
            loadTeams();
          }
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "players",
          },
          () => {
            loadTeams();
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
    loadTeams,
  ]);

  const filteredTeams =
    useMemo(() => {
      const query =
        search
          .trim()
          .toLowerCase();

      if (!query) {
        return teams;
      }

      return teams.filter(
        (team) =>
          team.name
            .toLowerCase()
            .includes(query) ||
          (
            team.manager_name ||
            ""
          )
            .toLowerCase()
            .includes(query)
      );
    }, [
      teams,
      search,
    ]);

  const totalBudget =
    useMemo(
      () =>
        teams.reduce(
          (
            total,
            team
          ) =>
            total +
            Number(
              team.budget ||
                0
            ),
          0
        ),
      [teams]
    );

  function money(
    value:
      | number
      | null
      | undefined
  ) {
    return `R$ ${Number(
      value || 0
    ).toLocaleString(
      "pt-BR"
    )}`;
  }

  function startBudgetEdit(
    team: Team
  ) {
    setEditingBudgetId(
      team.id
    );

    setBudgetValue(
      String(
        Number(
          team.budget ||
            0
        )
      )
    );

    setError("");
    setMessage("");
  }

  async function saveBudget(
    team: Team
  ) {
    const parsed =
      Number(
        budgetValue
          .replace(
            /\./g,
            ""
          )
          .replace(
            ",",
            "."
          )
      );

    if (
      !Number.isFinite(
        parsed
      ) ||
      parsed < 0
    ) {
      setError(
        "Digite um saldo válido."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Alterar o saldo de ${team.name} para ${money(parsed)}?`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      team.id
    );
    setError("");
    setMessage("");

    const {
      error:
        updateError,
    } =
      await supabase
        .from("teams")
        .update({
          budget:
            parsed,
        })
        .eq(
          "id",
          team.id
        );

    if (updateError) {
      console.error(
        updateError
      );

      setError(
        "Não foi possível alterar o saldo do clube."
      );

      setProcessingId(
        null
      );

      return;
    }

    setMessage(
      `Saldo de ${team.name} atualizado para ${money(parsed)}.`
    );

    setEditingBudgetId(
      null
    );

    setProcessingId(
      null
    );

    await loadTeams();
  }

  async function releaseManager(
    team: Team
  ) {
    if (
      !team.manager_id
    ) {
      return;
    }

    const confirmed =
      window.confirm(
        `Liberar o presidente de ${team.name}?\n\nA equipe continuará existindo, mas ficará sem presidente.`
      );

    if (!confirmed) {
      return;
    }

    setProcessingId(
      team.id
    );
    setError("");
    setMessage("");

    const {
      error:
        updateError,
    } =
      await supabase
        .from("teams")
        .update({
          manager_id:
            null,
          manager_name:
            null,
        })
        .eq(
          "id",
          team.id
        );

    if (updateError) {
      console.error(
        updateError
      );

      setError(
        "Não foi possível liberar o presidente."
      );

      setProcessingId(
        null
      );

      return;
    }

    setMessage(
      `${team.name} agora está sem presidente.`
    );

    setProcessingId(
      null
    );

    await loadTeams();
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
        <p className="font-bold text-zinc-400">
          Carregando clubes...
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

        <div className="mb-8 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              Administração
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              🏟️ Clubes
            </h1>

            <p className="mt-3 text-zinc-400">
              Controle os clubes, presidentes, saldos e elencos da liga.
            </p>
          </div>

          <Link
            href="/admin"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 text-center font-black transition hover:bg-zinc-800"
          >
            ← Administração
          </Link>
        </div>

        <section className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Clubes
            </p>

            <p className="mt-2 text-3xl font-black">
              {teams.length}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Com presidente
            </p>

            <p className="mt-2 text-3xl font-black text-green-400">
              {
                teams.filter(
                  (team) =>
                    Boolean(
                      team.manager_id
                    )
                ).length
              }
            </p>
          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Dinheiro na liga
            </p>

            <p className="mt-2 text-2xl font-black text-blue-400">
              {money(
                totalBudget
              )}
            </p>
          </div>
        </section>

        <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <label className="block text-sm font-black text-zinc-300">
            Buscar clube ou presidente
          </label>

          <input
            type="text"
            value={search}
            onChange={(
              event
            ) =>
              setSearch(
                event.target.value
              )
            }
            placeholder="Ex: BOTAFOGO ou KAKA"
            className="mt-3 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none transition focus:border-green-500"
          />
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 font-bold text-green-300">
            {message}
          </div>
        )}

        <section className="mt-8 space-y-4">
          {filteredTeams.map(
            (team) => {
              const editing =
                editingBudgetId ===
                team.id;

              const processing =
                processingId ===
                team.id;

              return (
                <article
                  key={
                    team.id
                  }
                  className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                >
                  <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr_1fr_auto] lg:items-center">

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Clube #{team.id}
                      </p>

                      <h2 className="mt-1 text-2xl font-black">
                        {team.name}
                      </h2>

                      <p className="mt-2 text-sm text-zinc-400">
                        Presidente:{" "}
                        <strong className="text-white">
                          {team.manager_name ||
                            "Sem presidente"}
                        </strong>
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Elenco
                      </p>

                      <p className="mt-1 text-2xl font-black">
                        {team.players_count}
                      </p>

                      <p className="text-sm text-zinc-500">
                        jogador(es)
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                        Saldo
                      </p>

                      {!editing ? (
                        <p className="mt-1 text-2xl font-black text-green-400">
                          {money(
                            team.budget
                          )}
                        </p>
                      ) : (
                        <div className="mt-2">
                          <input
                            type="text"
                            value={
                              budgetValue
                            }
                            disabled={
                              processing
                            }
                            onChange={(
                              event
                            ) =>
                              setBudgetValue(
                                event.target.value
                              )
                            }
                            className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 font-bold outline-none focus:border-green-500"
                          />
                        </div>
                      )}
                    </div>

                    <div className="flex min-w-[190px] flex-col gap-2">
                      {!editing ? (
                        <button
                          type="button"
                          disabled={
                            processing
                          }
                          onClick={() =>
                            startBudgetEdit(
                              team
                            )
                          }
                          className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:opacity-50"
                        >
                          Ajustar saldo
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            disabled={
                              processing
                            }
                            onClick={() =>
                              saveBudget(
                                team
                              )
                            }
                            className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:opacity-50"
                          >
                            Salvar saldo
                          </button>

                          <button
                            type="button"
                            disabled={
                              processing
                            }
                            onClick={() => {
                              setEditingBudgetId(
                                null
                              );
                              setBudgetValue(
                                ""
                              );
                            }}
                            className="rounded-xl border border-zinc-700 px-4 py-3 font-black text-zinc-300 transition hover:bg-zinc-800"
                          >
                            Cancelar
                          </button>
                        </>
                      )}

                      {team.manager_id && (
                        <button
                          type="button"
                          disabled={
                            processing
                          }
                          onClick={() =>
                            releaseManager(
                              team
                            )
                          }
                          className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
                        >
                          Liberar presidente
                        </button>
                      )}
                    </div>

                  </div>
                </article>
              );
            }
          )}
        </section>

        {filteredTeams.length ===
          0 && (
          <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
            Nenhum clube encontrado.
          </div>
        )}

      </div>
    </main>
  );
}
