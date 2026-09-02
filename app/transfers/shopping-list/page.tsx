"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_id: string | null;
};

type Player = {
  id: number;
  name: string;
  position: string | null;
  age: number | null;
  nationality: string | null;
  ca: number | null;
  value: number | null;
  team_id: number | null;
};

type ShoppingListRow = {
  id: number;
  team_id: number;
  player_id: number;
  created_at: string;
};

type ShoppingPlayer = ShoppingListRow & {
  player: Player | null;
  current_team: Team | null;
};

type SortOption =
  | "recent"
  | "name"
  | "ca_desc"
  | "value_desc"
  | "value_asc";

export default function ShoppingListPage() {
  const router = useRouter();

  const [myTeam, setMyTeam] =
    useState<Team | null>(null);

  const [items, setItems] =
    useState<ShoppingPlayer[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [removingId, setRemovingId] =
    useState<number | null>(null);

  const [search, setSearch] =
    useState("");

  const [sort, setSort] =
    useState<SortOption>("recent");

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const loadShoppingList =
    useCallback(async () => {
      setLoading(true);
      setError("");

      /*
        1. LOGIN
      */

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        router.replace("/login");
        return;
      }

      /*
        2. IDENTIFICA O CLUBE
      */

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          budget,
          manager_id
        `)
        .eq(
          "manager_id",
          user.id
        )
        .single();

      if (
        teamError ||
        !teamData
      ) {
        console.error(
          teamError
        );

        setError(
          "Não foi possível identificar o seu clube."
        );

        setLoading(false);
        return;
      }

      setMyTeam(
        teamData as Team
      );

      /*
        3. CARREGA A LISTA
      */

      const {
        data: listRows,
        error: listError,
      } = await supabase
        .from(
          "player_shopping_list"
        )
        .select(`
          id,
          team_id,
          player_id,
          created_at
        `)
        .eq(
          "team_id",
          teamData.id
        )
        .order(
          "created_at",
          {
            ascending: false,
          }
        );

      if (listError) {
        console.error(
          listError
        );

        setError(
          "Não foi possível carregar sua lista de compras."
        );

        setLoading(false);
        return;
      }

      /*
        4. CARREGA DADOS ATUAIS
        DOS JOGADORES.

        SEMPRE BUSCA O VALOR ATUAL,
        CA ATUAL E CLUBE ATUAL.
      */

      const hydrated =
        await Promise.all(
          (
            listRows || []
          ).map(
            async (
              row: ShoppingListRow
            ) => {
              const {
                data: playerData,
                error:
                  playerError,
              } =
                await supabase
                  .from(
                    "players"
                  )
                  .select(`
                    id,
                    name,
                    position,
                    age,
                    nationality,
                    ca,
                    value,
                    team_id
                  `)
                  .eq(
                    "id",
                    row.player_id
                  )
                  .maybeSingle();

              if (
                playerError
              ) {
                console.error(
                  playerError
                );
              }

              let currentTeam:
                Team | null =
                null;

              if (
                playerData
                  ?.team_id
              ) {
                const {
                  data:
                    currentTeamData,
                } =
                  await supabase
                    .from(
                      "teams"
                    )
                    .select(`
                      id,
                      name,
                      budget,
                      manager_id
                    `)
                    .eq(
                      "id",
                      playerData.team_id
                    )
                    .maybeSingle();

                currentTeam =
                  currentTeamData ||
                  null;
              }

              return {
                ...row,

                player:
                  playerData ||
                  null,

                current_team:
                  currentTeam,
              };
            }
          )
        );

      setItems(
        hydrated as ShoppingPlayer[]
      );

      setLoading(false);
    }, [router]);

  useEffect(() => {
    loadShoppingList();
  }, [loadShoppingList]);

  /*
    TEMPO REAL
  */

  useEffect(() => {
    if (!myTeam) {
      return;
    }

    const channel =
      supabase
        .channel(
          `shopping-list-${myTeam.id}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table:
              "player_shopping_list",
            filter:
              `team_id=eq.${myTeam.id}`,
          },
          () => {
            loadShoppingList();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "UPDATE",
            schema: "public",
            table: "players",
          },
          () => {
            loadShoppingList();
          }
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    myTeam,
    loadShoppingList,
  ]);

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

  function dateTime(
    value:
      | string
      | null
      | undefined
  ) {
    if (!value) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString(
      "pt-BR"
    );
  }

  /*
    REMOVER DA LISTA
  */

  async function removeItem(
    item: ShoppingPlayer
  ) {
    const playerName =
      item.player?.name ||
      "este jogador";

    const confirmed =
      window.confirm(
        `Remover ${playerName} da sua lista de compras?`
      );

    if (!confirmed) {
      return;
    }

    setRemovingId(
      item.id
    );

    setError("");
    setMessage("");

    const {
      error: removeError,
    } = await supabase
      .from(
        "player_shopping_list"
      )
      .delete()
      .eq(
        "id",
        item.id
      );

    if (removeError) {
      console.error(
        removeError
      );

      setError(
        "Não foi possível remover o jogador da lista."
      );

      setRemovingId(null);
      return;
    }

    setMessage(
      `${playerName} foi removido da sua lista de compras.`
    );

    await loadShoppingList();

    setRemovingId(null);
  }

  /*
    FILTRAGEM E ORDENAÇÃO
  */

  const filteredItems =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      const filtered =
        items.filter(
          (item) => {
            const player =
              item.player;

            if (!player) {
              return false;
            }

            const text =
              [
                player.name,
                player.position,
                player.nationality,
                item
                  .current_team
                  ?.name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase();

            return (
              !term ||
              text.includes(term)
            );
          }
        );

      return filtered.sort(
        (a, b) => {
          const playerA =
            a.player;

          const playerB =
            b.player;

          if (
            !playerA ||
            !playerB
          ) {
            return 0;
          }

          if (
            sort === "name"
          ) {
            return playerA.name.localeCompare(
              playerB.name
            );
          }

          if (
            sort ===
            "ca_desc"
          ) {
            return (
              Number(
                playerB.ca ||
                  0
              ) -
              Number(
                playerA.ca ||
                  0
              )
            );
          }

          if (
            sort ===
            "value_desc"
          ) {
            return (
              Number(
                playerB.value ||
                  0
              ) -
              Number(
                playerA.value ||
                  0
              )
            );
          }

          if (
            sort ===
            "value_asc"
          ) {
            return (
              Number(
                playerA.value ||
                  0
              ) -
              Number(
                playerB.value ||
                  0
              )
            );
          }

          return (
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
          );
        }
      );
    }, [
      items,
      search,
      sort,
    ]);

  const totalValue =
    useMemo(() => {
      return items.reduce(
        (
          total,
          item
        ) =>
          total +
          Number(
            item.player
              ?.value ||
              0
          ),
        0
      );
    }, [items]);

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando lista de compras...
          </div>

        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              FriendZone League FM
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              🛒 Lista de Compras
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Salve jogadores que você pretende contratar e acompanhe o CA, valor e clube atual antes de fazer uma proposta.
            </p>

            {myTeam && (
              <p className="mt-3 text-sm font-bold text-zinc-500">
                Lista de{" "}
                <span className="text-white">
                  {myTeam.name}
                </span>
              </p>
            )}

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/players"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:bg-zinc-800"
            >
              ← Mercado
            </Link>

            <Link
              href="/transfers/negotiations"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:bg-zinc-800"
            >
              Negociações
            </Link>

          </div>

        </div>

        {/* RESUMO */}

        <section className="mt-10 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Jogadores salvos
            </p>

            <p className="mt-3 text-4xl font-black">
              {items.length}
            </p>

          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Valor atual total
            </p>

            <p className="mt-3 text-2xl font-black text-green-400">
              {money(
                totalValue
              )}
            </p>

          </div>


          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Orçamento do clube
            </p>

            <p className="mt-3 text-2xl font-black text-blue-400">
              {money(
                myTeam?.budget
              )}
            </p>

          </div>

        </section>

        {/* MENSAGENS */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {message}
          </div>
        )}

        {/* FILTROS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <div className="grid gap-4 md:grid-cols-[1fr_280px]">

            <div>

              <label className="mb-2 block text-sm font-black text-zinc-300">
                Buscar jogador
              </label>

              <input
                value={search}
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Nome, posição, nacionalidade ou clube..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-black text-zinc-300">
                Ordenar por
              </label>

              <select
                value={sort}
                onChange={(
                  event
                ) =>
                  setSort(
                    event.target
                      .value as SortOption
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              >

                <option value="recent">
                  Adicionados recentemente
                </option>

                <option value="name">
                  Nome
                </option>

                <option value="ca_desc">
                  Maior CA
                </option>

                <option value="value_desc">
                  Maior valor
                </option>

                <option value="value_asc">
                  Menor valor
                </option>

              </select>

            </div>

          </div>

        </section>

        {/* LISTA */}

        <section className="mt-8">

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <h2 className="text-2xl font-black">
              Jogadores desejados
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {filteredItems.length} resultado(s)
            </span>

          </div>

          {filteredItems.length ===
          0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

              <p className="text-5xl">
                🛒
              </p>

              <h3 className="mt-5 text-2xl font-black">
                Sua lista está vazia
              </h3>

              <p className="mx-auto mt-3 max-w-xl text-zinc-500">
                Vá até o mercado, encontre um jogador e adicione-o à sua lista de compras.
              </p>

              <Link
                href="/players"
                className="mt-6 inline-block rounded-xl bg-green-500 px-6 py-3 font-black text-black transition hover:bg-green-400"
              >
                Ver mercado
              </Link>

            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">

              {filteredItems.map(
                (item) => {
                  const player =
                    item.player;

                  if (!player) {
                    return null;
                  }

                  const currentValue =
                    Number(
                      player.value ||
                        0
                    );


                  const isOwnPlayer =
                    player.team_id ===
                    myTeam?.id;

                  return (
                    <article
                      key={item.id}
                      className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                    >

                      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">

                        <div className="min-w-0 flex-1">

                          <div className="flex flex-wrap items-center gap-2">

                            <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-black text-green-400">
                              NA LISTA
                            </span>

                            {isOwnPlayer && (
                              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black text-blue-400">
                                SEU ELENCO
                              </span>
                            )}

                          </div>

                          <h3 className="mt-4 break-words text-2xl font-black">
                            {player.name}
                          </h3>

                          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-400">

                            <span>
                              {player.position ||
                                "Posição -"}
                            </span>

                            {player.age !==
                              null && (
                              <span>
                                {player.age} anos
                              </span>
                            )}

                            {player.nationality && (
                              <span>
                                {player.nationality}
                              </span>
                            )}

                            {player.ca !==
                              null && (
                              <span className="font-black text-white">
                                CA {player.ca}
                              </span>
                            )}

                          </div>

                          <div className="mt-5">

                            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                              Clube atual
                            </p>

                            <p className="mt-1 font-black">
                              {item.current_team
                                ?.name ||
                                "Sem clube"}
                            </p>

                          </div>

                          <p className="mt-5 text-xs text-zinc-600">
                            Adicionado em{" "}
                            {dateTime(
                              item.created_at
                            )}
                          </p>

                        </div>

                        <div className="w-full rounded-xl border border-zinc-800 bg-zinc-950 p-5 lg:w-[270px]">

                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            Valor atual
                          </p>

                          <p className="mt-2 text-2xl font-black text-white">
                            {money(
                              currentValue
                            )}
                          </p>

                          <p className="mt-3 text-xs text-zinc-600">
                            O valor da negociação é livre entre os clubes.
                          </p>

                        </div>

                      </div>

                      <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-3">

                        <Link
                          href={`/players/${player.id}`}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-black transition hover:bg-zinc-800"
                        >
                          Ver jogador
                        </Link>

                        {isOwnPlayer ? (
                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-xl bg-zinc-700 px-4 py-3 font-black text-zinc-400"
                          >
                            Já é seu jogador
                          </button>
                        ) : (
                          <Link
                            href={`/transfers/negotiations/new?playerId=${player.id}&sellerTeamId=${player.team_id || ""}`}
                            className="rounded-xl bg-green-500 px-4 py-3 text-center font-black text-black transition hover:bg-green-400"
                          >
                            Fazer proposta
                          </Link>
                        )}

                        <button
                          type="button"
                          disabled={
                            removingId ===
                            item.id
                          }
                          onClick={() =>
                            removeItem(
                              item
                            )
                          }
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingId ===
                          item.id
                            ? "Removendo..."
                            : "Remover"}
                        </button>

                      </div>

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  );
}
