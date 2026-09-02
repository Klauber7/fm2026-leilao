"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

import Link from "next/link";

import { supabase } from "@/lib/supabase";

type Player = {
  id: number;
  unique_id: string;
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  club: string | null;
  ca: number | null;
  cp: number | null;
  value: number | null;
  salary: string | null;
  image_url: string | null;
  category: string[] | null;
  team_id: number | null;
};

type Team = {
  id: number;
  name: string;
  manager_id: string | null;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
};

const PAGE_SIZE = 50;

const categories = [
  "Todos",
  "Goleiro",
  "Zagueiro",
  "Lateral",
  "Volante",
  "Meia Armador",
  "Ponta",
  "Atacante",
];

function formatMoney(
  value: number | null
) {
  if (
    value === null ||
    value === undefined
  ) {
    return "R$ 0,00";
  }

  return new Intl.NumberFormat(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  ).format(value);
}

function getCategoryLabel(
  category: string
) {
  switch (category) {
    case "Todos":
      return "Todos";

    case "Goleiro":
      return "Goleiros";

    case "Zagueiro":
      return "Zagueiros";

    case "Lateral":
      return "Laterais";

    case "Volante":
      return "Volantes";

    case "Meia Armador":
      return "Meias";

    case "Ponta":
      return "Pontas";

    case "Atacante":
      return "Atacantes";

    default:
      return category;
  }
}

function getInitials(
  name: string
) {
  return name
    .split(" ")
    .slice(0, 2)
    .map(
      (part) =>
        part
          .charAt(0)
          .toUpperCase()
    )
    .join("");
}

function getCAColor(
  ca: number | null
) {
  if (!ca) {
    return "text-zinc-300";
  }

  if (ca >= 170) {
    return "text-emerald-400";
  }

  if (ca >= 150) {
    return "text-lime-400";
  }

  if (ca >= 130) {
    return "text-yellow-300";
  }

  return "text-zinc-200";
}

export default function PlayersPage() {
  const [
    players,
    setPlayers,
  ] =
    useState<Player[]>([]);

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<TransferWindow | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    selectedCategory,
    setSelectedCategory,
  ] =
    useState("Todos");

  const [
    minCA,
    setMinCA,
  ] =
    useState("");

  const [
    maxCA,
    setMaxCA,
  ] =
    useState("");

  const [
    minCP,
    setMinCP,
  ] =
    useState("");

  const [
    maxCP,
    setMaxCP,
  ] =
    useState("");

  const [
    minAge,
    setMinAge,
  ] =
    useState("");

  const [
    maxAge,
    setMaxAge,
  ] =
    useState("");

  const [
    nationality,
    setNationality,
  ] =
    useState("");

  const [
    page,
    setPage,
  ] =
    useState(1);

  const [
    total,
    setTotal,
  ] =
    useState(0);

  const [
    myTeam,
    setMyTeam,
  ] =
    useState<Team | null>(null);

  const [
    shoppingListIds,
    setShoppingListIds,
  ] =
    useState<Set<number>>(
      new Set()
    );

  const [
    shoppingLoadingId,
    setShoppingLoadingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    shoppingMessage,
    setShoppingMessage,
  ] =
    useState("");

  /*
    CARREGA CLUBE DO PRESIDENTE
    E LISTA DE COMPRAS
  */

  const loadShoppingList =
    useCallback(async () => {
      const {
        data: { user },
        error: authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        setMyTeam(null);
        setShoppingListIds(
          new Set()
        );
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } =
        await supabase
          .from("teams")
          .select(`
            id,
            name,
            manager_id
          `)
          .eq(
            "manager_id",
            user.id
          )
          .maybeSingle();

      if (
        teamError ||
        !teamData
      ) {
        if (teamError) {
          console.error(
            "Erro ao identificar clube:",
            teamError
          );
        }

        setMyTeam(null);
        setShoppingListIds(
          new Set()
        );
        return;
      }

      setMyTeam(
        teamData as Team
      );

      const {
        data: listData,
        error: listError,
      } =
        await supabase
          .from(
            "player_shopping_list"
          )
          .select(
            "player_id"
          )
          .eq(
            "team_id",
            teamData.id
          );

      if (listError) {
        console.error(
          "Erro ao carregar lista de compras:",
          listError
        );

        setShoppingListIds(
          new Set()
        );
        return;
      }

      setShoppingListIds(
        new Set(
          (listData || []).map(
            (row: any) =>
              Number(
                row.player_id
              )
          )
        )
      );
    }, []);

  async function toggleShoppingList(
    player: Player
  ) {
    if (!myTeam) {
      setShoppingMessage(
        "Não foi possível identificar o seu clube."
      );
      return;
    }

    setShoppingLoadingId(
      player.id
    );
    setShoppingMessage("");

    const isSaved =
      shoppingListIds.has(
        player.id
      );

    if (isSaved) {
      const {
        error,
      } =
        await supabase
          .from(
            "player_shopping_list"
          )
          .delete()
          .eq(
            "team_id",
            myTeam.id
          )
          .eq(
            "player_id",
            player.id
          );

      if (error) {
        console.error(
          "Erro ao remover da lista:",
          error
        );

        setShoppingMessage(
          "Não foi possível remover o jogador da lista."
        );

        setShoppingLoadingId(
          null
        );
        return;
      }

      setShoppingListIds(
        (current) => {
          const next =
            new Set(current);

          next.delete(
            player.id
          );

          return next;
        }
      );

      setShoppingMessage(
        `${player.name} foi removido da sua lista de compras.`
      );
    } else {
      const {
        error,
      } =
        await supabase
          .from(
            "player_shopping_list"
          )
          .insert({
            team_id:
              myTeam.id,

            player_id:
              player.id,
          });

      if (error) {
        console.error(
          "Erro ao adicionar à lista:",
          error
        );

        if (
          String(
            error.message || ""
          )
            .toLowerCase()
            .includes(
              "duplicate"
            )
        ) {
          await loadShoppingList();

          setShoppingMessage(
            `${player.name} já está na sua lista de compras.`
          );
        } else {
          setShoppingMessage(
            "Não foi possível adicionar o jogador à lista."
          );
        }

        setShoppingLoadingId(
          null
        );
        return;
      }

      setShoppingListIds(
        (current) => {
          const next =
            new Set(current);

          next.add(
            player.id
          );

          return next;
        }
      );

      setShoppingMessage(
        `${player.name} foi adicionado à sua lista de compras.`
      );
    }

    setShoppingLoadingId(
      null
    );
  }

  /*
    CARREGA STATUS
    DA JANELA
  */

  const loadTransferWindow =
    useCallback(async () => {
      const {
        data,
        error,
      } =
        await supabase
          .from(
            "transfer_windows"
          )
          .select(`
            id,
            window_number,
            name,
            status
          `)
          .eq(
            "status",
            "open"
          )
          .order(
            "window_number",
            {
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (error) {
        console.error(
          "Erro ao carregar janela:",
          error
        );

        setCurrentWindow(
          null
        );

        return;
      }

      setCurrentWindow(
        data
          ? (data as TransferWindow)
          : null
      );
    }, []);

  /*
    CARREGA JOGADORES
  */

  const loadPlayers =
    useCallback(
      async (
        resetPage = false
      ) => {
        setLoading(true);

        const currentPage =
          resetPage
            ? 1
            : page;

        if (
          resetPage &&
          page !== 1
        ) {
          setPage(1);

          setLoading(false);

          return;
        }

        const from =
          (currentPage - 1) *
          PAGE_SIZE;

        const to =
          from +
          PAGE_SIZE -
          1;

        let query =
          supabase
            .from(
              "players"
            )
            .select(
              `
              id,
              unique_id,
              name,
              age,
              position,
              nationality,
              club,
              ca,
              cp,
              value,
              salary,
              image_url,
              category,
              team_id
              `,
              {
                count:
                  "exact",
              }
            )
            .order(
              "ca",
              {
                ascending:
                  false,
                nullsFirst:
                  false,
              }
            )
            .order(
              "cp",
              {
                ascending:
                  false,
                nullsFirst:
                  false,
              }
            )
            .order(
              "name",
              {
                ascending:
                  true,
              }
            );

        /*
          MERCADO:
          SÓ JOGADORES
          SEM TEAM_ID
        */

        query =
          query.is(
            "team_id",
            null
          );

        if (
          selectedCategory !==
          "Todos"
        ) {
          query =
            query.contains(
              "category",
              [
                selectedCategory,
              ]
            );
        }

        if (
          search.trim()
        ) {
          query =
            query.ilike(
              "name",
              `%${search.trim()}%`
            );
        }

        if (
          nationality.trim()
        ) {
          query =
            query.ilike(
              "nationality",
              `%${nationality.trim()}%`
            );
        }

        if (minCA) {
          query =
            query.gte(
              "ca",
              Number(
                minCA
              )
            );
        }

        if (maxCA) {
          query =
            query.lte(
              "ca",
              Number(
                maxCA
              )
            );
        }

        if (minCP) {
          query =
            query.gte(
              "cp",
              Number(
                minCP
              )
            );
        }

        if (maxCP) {
          query =
            query.lte(
              "cp",
              Number(
                maxCP
              )
            );
        }

        if (minAge) {
          query =
            query.gte(
              "age",
              Number(
                minAge
              )
            );
        }

        if (maxAge) {
          query =
            query.lte(
              "age",
              Number(
                maxAge
              )
            );
        }

        query =
          query.range(
            from,
            to
          );

        const {
          data,
          error,
          count,
        } =
          await query;

        if (error) {
          console.error(
            "Erro ao carregar jogadores:",
            error
          );

          setPlayers([]);

          setTotal(0);
        } else {
          setPlayers(
            (data as Player[]) ||
              []
          );

          setTotal(
            count ||
              0
          );
        }

        setLoading(false);
      },
      [
        page,
        selectedCategory,
        search,
        nationality,
        minCA,
        maxCA,
        minCP,
        maxCP,
        minAge,
        maxAge,
      ]
    );

  /*
    LOAD INICIAL
  */

  useEffect(() => {
    loadTransferWindow();

    loadPlayers();

    loadShoppingList();

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    page,
    selectedCategory,
  ]);

  /*
    REALTIME DA JANELA
  */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "players-transfer-window"
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "transfer_windows",
          },
          () => {
            loadTransferWindow();
          }
        )
        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    loadTransferWindow,
  ]);

  /*
    CATEGORIA
  */

  function handleCategory(
    category: string
  ) {
    setSelectedCategory(
      category
    );

    if (
      page !== 1
    ) {
      setPage(1);
    }
  }

  /*
    BUSCAR
  */

  async function handleSearch() {
    if (
      page !== 1
    ) {
      setPage(1);

      return;
    }

    await loadPlayers();
  }

  /*
    LIMPAR
  */

  function clearFilters() {
    setSearch("");

    setMinCA("");

    setMaxCA("");

    setMinCP("");

    setMaxCP("");

    setMinAge("");

    setMaxAge("");

    setNationality("");

    setSelectedCategory(
      "Todos"
    );

    setPage(1);

    setTimeout(
      () => {
        loadPlayers(
          true
        );
      },
      100
    );
  }

  const totalPages =
    Math.max(
      1,
      Math.ceil(
        total /
          PAGE_SIZE
      )
    );

  const marketOpen =
    Boolean(
      currentWindow
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      <div className="mx-auto max-w-[1550px] px-4 py-5">

        {/* CABEÇALHO */}

        <div className="mb-5">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">

            <div>

              <h1 className="text-4xl font-black text-white">
                Jogadores
              </h1>

              <p className="mt-1 text-sm text-zinc-400">
                {total.toLocaleString(
                  "pt-BR"
                )}{" "}
                jogadores encontrados
              </p>

            </div>

            <Link
              href="/transfers/shopping-list"
              className="inline-flex items-center justify-center rounded-xl border border-indigo-500/30 bg-indigo-500/10 px-5 py-3 text-sm font-black text-indigo-300 transition hover:bg-indigo-500/20"
            >
              🛒 Minha Lista ({shoppingListIds.size})
            </Link>

          </div>

        </div>

        {/* STATUS DO MERCADO */}

        {marketOpen ? (
          <div className="mb-4 rounded-xl border border-green-500/40 bg-green-500/10 p-4">

            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="font-black text-green-400">
                  🟢 LEILÕES DE JOGADORES ABERTOS
                </p>

                <p className="mt-1 text-xs text-zinc-300">
                  Jogadores disponíveis no Mercado podem receber o primeiro lance.
                </p>

              </div>

              <span className="rounded-lg border border-green-500/30 px-3 py-1 text-xs font-black text-green-400">
                JANELA{" "}
                {
                  currentWindow
                    ?.window_number
                }
              </span>

            </div>

          </div>
        ) : (
          <div className="mb-4 rounded-xl border border-red-500/40 bg-red-500/10 p-4">

            <div className="flex items-start gap-3">

              <span className="text-2xl">
                🔒
              </span>

              <div>

                <p className="font-black text-red-400">
                  MERCADO FECHADO
                </p>

                <p className="mt-1 text-xs text-zinc-300">
                  A janela de transferências está fechada. Nenhum jogador pode receber lance neste momento.
                </p>

              </div>

            </div>

          </div>
        )}

        {shoppingMessage && (
          <div className="mb-4 rounded-xl border border-indigo-500/30 bg-indigo-500/10 p-4 text-sm font-bold text-indigo-200">
            {shoppingMessage}
          </div>
        )}

        {/* CATEGORIAS */}

        <div className="mb-4 overflow-x-auto">

          <div className="flex min-w-max gap-2">

            {categories.map(
              (
                category
              ) => {
                const active =
                  selectedCategory ===
                  category;

                return (
                  <button
                    key={
                      category
                    }
                    type="button"
                    onClick={() =>
                      handleCategory(
                        category
                      )
                    }
                    className={`rounded-lg px-4 py-2 text-sm font-bold transition ${
                      active
                        ? "bg-indigo-700 text-white"
                        : "border border-zinc-800 bg-zinc-900 text-zinc-300 hover:bg-zinc-800"
                    }`}
                  >
                    {getCategoryLabel(
                      category
                    )}
                  </button>
                );
              }
            )}

          </div>

        </div>

        {/* FILTROS */}

        <div className="mb-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-4 shadow-lg">

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">

            <input
              type="text"
              placeholder="Buscar jogador..."
              value={
                search
              }
              onChange={(
                event
              ) =>
                setSearch(
                  event.target.value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  handleSearch();
                }
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="text"
              placeholder="Nacionalidade"
              value={
                nationality
              }
              onChange={(
                event
              ) =>
                setNationality(
                  event.target.value
                )
              }
              onKeyDown={(
                event
              ) => {
                if (
                  event.key ===
                  "Enter"
                ) {
                  handleSearch();
                }
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="CA mínimo"
              value={
                minCA
              }
              onChange={(
                event
              ) =>
                setMinCA(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="CA máximo"
              value={
                maxCA
              }
              onChange={(
                event
              ) =>
                setMaxCA(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="CP mínimo"
              value={
                minCP
              }
              onChange={(
                event
              ) =>
                setMinCP(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="CP máximo"
              value={
                maxCP
              }
              onChange={(
                event
              ) =>
                setMaxCP(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="Idade mínima"
              value={
                minAge
              }
              onChange={(
                event
              ) =>
                setMinAge(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

            <input
              type="number"
              placeholder="Idade máxima"
              value={
                maxAge
              }
              onChange={(
                event
              ) =>
                setMaxAge(
                  event.target.value
                )
              }
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-indigo-500"
            />

          </div>

          <div className="mt-3 flex gap-2">

            <button
              type="button"
              onClick={
                handleSearch
              }
              className="rounded-lg bg-indigo-700 px-5 py-2 text-sm font-bold text-white hover:bg-indigo-600"
            >
              Buscar
            </button>

            <button
              type="button"
              onClick={
                clearFilters
              }
              className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700"
            >
              Limpar
            </button>

          </div>

        </div>

        {/* CARDS */}

        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400 shadow-lg">
            Carregando jogadores...
          </div>
        ) : players.length ===
          0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400 shadow-lg">
            Nenhum jogador encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">

            {players.map(
              (
                player
              ) => (
                <div
                  key={
                    player.id
                  }
                  className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-md"
                >

                  {/* ID */}

                  <div className="mb-3 text-[12px] font-bold text-zinc-400">

                    ID do jogador -{" "}

                    <span className="font-black text-zinc-200">
                      {
                        player.unique_id
                      }
                    </span>

                  </div>

                  {/* FOTO */}

                  <Link
                    href={`/players/${player.id}`}
                    className="block"
                  >

                    <div className="flex justify-center">

                      <div className="flex h-[88px] w-[88px] items-center justify-center overflow-hidden rounded-full border-2 border-zinc-700 bg-zinc-800 shadow">

                        {player.image_url ? (
                          <img
                            src={
                              player.image_url
                            }
                            alt={
                              player.name
                            }
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <div className="text-3xl font-black text-zinc-400">
                            {getInitials(
                              player.name
                            )}
                          </div>
                        )}

                      </div>

                    </div>

                    {/* NOME */}

                    <div className="mt-4 text-[14px] font-black text-white group-hover:text-indigo-300">

                      {
                        player.name
                      }{" "}
                      -{" "}
                      {
                        player.age ??
                        "-"
                      }{" "}
                      anos

                    </div>

                    {/* NACIONALIDADE */}

                    <div className="mt-3 text-sm font-medium text-zinc-300">
                      {
                        player.nationality ||
                        "-"
                      }
                    </div>

                    {/* CA */}

                    <div className="mt-3 text-sm font-black text-zinc-200">

                      CA -{" "}

                      <span
                        className={getCAColor(
                          player.ca
                        )}
                      >
                        {
                          player.ca ??
                          "-"
                        }
                      </span>

                    </div>

                    {/* CLUBE */}

                    <div className="mt-3 truncate text-[14px] font-semibold text-zinc-200">
                      {
                        player.club ||
                        "-"
                      }
                    </div>

                    {/* POSIÇÃO */}

                    <div className="mt-2 truncate text-[13px] font-medium text-zinc-400">
                      {
                        player.position ||
                        "-"
                      }
                    </div>

                  </Link>

                  {/* BOTÃO DE LANCE */}

                  {marketOpen ? (
                    <Link
                      href={`/players/${player.id}`}
                      className="mt-4 block w-full rounded-lg bg-green-600 px-3 py-2 text-center text-[12px] font-black text-white transition hover:bg-green-500"
                    >
                      DAR LANCE —{" "}
                      {formatMoney(
                        player.value
                      )}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      disabled
                      className="mt-4 w-full cursor-not-allowed rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-[12px] font-black text-red-400"
                    >
                      🔒 MERCADO FECHADO
                    </button>
                  )}

                  {/* LISTA DE COMPRAS */}

                  <button
                    type="button"
                    disabled={
                      shoppingLoadingId ===
                        player.id ||
                      !myTeam
                    }
                    onClick={() =>
                      toggleShoppingList(
                        player
                      )
                    }
                    className={`mt-2 w-full rounded-lg px-3 py-2 text-[12px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      shoppingListIds.has(
                        player.id
                      )
                        ? "border border-indigo-500/40 bg-indigo-500/10 text-indigo-300 hover:bg-indigo-500/20"
                        : "border border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-indigo-500/40 hover:text-indigo-300"
                    }`}
                  >
                    {shoppingLoadingId ===
                    player.id
                      ? "SALVANDO..."
                      : shoppingListIds.has(
                          player.id
                        )
                      ? "✓ NA LISTA — REMOVER"
                      : "🛒 ADICIONAR À LISTA"}
                  </button>

                  {/* VALOR E SALÁRIO */}

                  <div className="mt-4 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-3">

                    <div>

                      <div className="text-[12px] font-black uppercase text-red-400">
                        Valor
                      </div>

                      <div className="mt-1 text-[13px] font-medium text-red-300">
                        {formatMoney(
                          player.value
                        )}
                      </div>

                    </div>

                    <div>

                      <div className="text-[12px] font-black uppercase text-red-400">
                        Salário
                      </div>

                      <div className="mt-1 text-[13px] font-medium text-red-300">
                        {
                          player.salary ||
                          "R$ 0,00"
                        }
                      </div>

                    </div>

                  </div>

                </div>
              )
            )}

          </div>
        )}

        {/* PAGINAÇÃO */}

        <div className="mt-6 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-lg">

          <button
            type="button"
            disabled={
              page === 1 ||
              loading
            }
            onClick={() =>
              setPage(
                (
                  current
                ) =>
                  Math.max(
                    1,
                    current -
                      1
                  )
              )
            }
            className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            Anterior
          </button>

          <div className="text-sm font-semibold text-zinc-400">

            Página{" "}

            <span className="font-black text-white">
              {page}
            </span>

            {" "}de{" "}

            <span className="font-black text-white">
              {
                totalPages
              }
            </span>

          </div>

          <button
            type="button"
            disabled={
              page >=
                totalPages ||
              loading
            }
            onClick={() =>
              setPage(
                (
                  current
                ) =>
                  current +
                  1
              )
            }
            className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            Próxima
          </button>

        </div>

      </div>

    </main>
  );
}