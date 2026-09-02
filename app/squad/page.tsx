"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  id: number;
  name: string;
  position: string | null;
  age: number | null;
  nationality: string | null;
  ca: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
};

type PositionGroup =
  | "goalkeepers"
  | "defenders"
  | "midfielders"
  | "attackers"
  | "others";

type SquadSection = {
  key: PositionGroup;
  title: string;
  abbreviation: string;
  description: string;
  players: Player[];
};

type SortOption =
  | "ca-desc"
  | "ca-asc"
  | "name-asc"
  | "age-asc"
  | "age-desc"
  | "value-desc";

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function normalizePosition(position: string | null) {
  return (position || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPositionGroup(
  position: string | null
): PositionGroup {
  const normalized = normalizePosition(position);

  const goalkeeperTerms = [
    "gk",
    "goalkeeper",
    "goleiro",
    "guarda-redes",
    "guarda redes",
  ];

  const defenderTerms = [
    "dc",
    "cb",
    "defender",
    "defensor",
    "zagueiro",
    "central defender",
    "dl",
    "dr",
    "lb",
    "rb",
    "left back",
    "right back",
    "lateral",
    "ala",
    "wb",
  ];

  const midfielderTerms = [
    "dm",
    "mc",
    "cm",
    "am",
    "midfielder",
    "meio-campista",
    "meio campista",
    "volante",
    "meia",
    "ml",
    "mr",
    "aml",
    "amr",
  ];

  const attackerTerms = [
    "st",
    "cf",
    "fw",
    "attacker",
    "atacante",
    "avancado",
    "avançado",
    "striker",
    "forward",
    "ponta",
  ];

  if (
    goalkeeperTerms.some(
      (term) =>
        normalized === term ||
        normalized.includes(term)
    )
  ) {
    return "goalkeepers";
  }

  if (
    defenderTerms.some(
      (term) =>
        normalized === term ||
        normalized.includes(term)
    )
  ) {
    return "defenders";
  }

  if (
    midfielderTerms.some(
      (term) =>
        normalized === term ||
        normalized.includes(term)
    )
  ) {
    return "midfielders";
  }

  if (
    attackerTerms.some(
      (term) =>
        normalized === term ||
        normalized.includes(term)
    )
  ) {
    return "attackers";
  }

  return "others";
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (error as { message: unknown }).message
    );
  }

  return "Não foi possível carregar o elenco.";
}

function sortPlayers(
  players: Player[],
  sortOption: SortOption
) {
  const sortedPlayers = [...players];

  switch (sortOption) {
    case "ca-asc":
      return sortedPlayers.sort(
        (first, second) =>
          Number(first.ca || 0) -
          Number(second.ca || 0)
      );

    case "name-asc":
      return sortedPlayers.sort((first, second) =>
        first.name.localeCompare(second.name, "pt-BR")
      );

    case "age-asc":
      return sortedPlayers.sort(
        (first, second) =>
          Number(first.age || 999) -
          Number(second.age || 999)
      );

    case "age-desc":
      return sortedPlayers.sort(
        (first, second) =>
          Number(second.age || 0) -
          Number(first.age || 0)
      );

    case "value-desc":
      return sortedPlayers.sort(
        (first, second) =>
          Number(second.value || 0) -
          Number(first.value || 0)
      );

    case "ca-desc":
    default:
      return sortedPlayers.sort((first, second) => {
        const caDifference =
          Number(second.ca || 0) -
          Number(first.ca || 0);

        if (caDifference !== 0) {
          return caDifference;
        }

        return first.name.localeCompare(
          second.name,
          "pt-BR"
        );
      });
  }
}

function PlayerCard({
  player,
}: {
  player: Player;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-1 hover:border-green-500/60">
      <div className="relative h-52 w-full overflow-hidden bg-zinc-800">
        {player.image_url ? (
          <img
            src={player.image_url}
            alt={player.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center">
            <span className="text-6xl">⚽</span>

            <span className="mt-3 text-sm font-semibold text-zinc-500">
              Sem imagem
            </span>
          </div>
        )}

        <div className="absolute right-4 top-4 rounded-xl border border-green-400/40 bg-zinc-950/90 px-3 py-2 text-center backdrop-blur">
          <p className="text-[10px] font-black uppercase tracking-wider text-zinc-400">
            CA
          </p>

          <p className="text-xl font-black leading-none text-green-400">
            {player.ca ?? "-"}
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="font-bold text-green-400">
          {player.position || "Sem posição"}
        </p>

        <h3 className="mt-1 break-words text-2xl font-black leading-tight">
          {player.name}
        </h3>

        <p className="mt-3 text-zinc-400">
          {player.nationality ||
            "Nacionalidade não informada"}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          {player.age !== null
            ? `${player.age} anos`
            : "Idade não informada"}
        </p>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Valor estimado
          </p>

          <p className="mt-1 text-lg font-black text-green-400">
            {money(player.value)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function SquadPage() {
  const [team, setTeam] =
    useState<Team | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedGroup, setSelectedGroup] =
    useState<"all" | PositionGroup>("all");

  const [sortOption, setSortOption] =
    useState<SortOption>("ca-desc");

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadSquad = useCallback(async () => {
    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setTeam(null);
        setPlayers([]);
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select("id, name, budget")
        .eq("manager_id", user.id)
        .maybeSingle();

      if (teamError) {
        throw teamError;
      }

      if (!teamData) {
        setTeam(null);
        setPlayers([]);
        return;
      }

      const loadedTeam = teamData as Team;

      setTeam(loadedTeam);

      const {
        data: squadPlayers,
        error: playersError,
      } = await supabase
        .from("players")
        .select(`
          id,
          name,
          position,
          age,
          nationality,
          ca,
          value,
          image_url,
          team_id
        `)
        .eq("team_id", loadedTeam.id)
        .order("ca", {
          ascending: false,
          nullsFirst: false,
        })
        .order("name", {
          ascending: true,
        });

      if (playersError) {
        throw playersError;
      }

      setPlayers(
        (squadPlayers || []) as Player[]
      );
    } catch (error) {
      console.error(
        "Erro ao carregar elenco:",
        error
      );

      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSquad();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadSquad();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadSquad]);

  useEffect(() => {
    if (!team?.id) {
      return;
    }

    const channel = supabase
      .channel(`squad-${team.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `team_id=eq.${team.id}`,
        },
        () => {
          loadSquad();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "teams",
          filter: `id=eq.${team.id}`,
        },
        () => {
          loadSquad();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team?.id, loadSquad]);

  const totalValue = useMemo(
    () =>
      players.reduce(
        (total, player) =>
          total +
          Number(player.value || 0),
        0
      ),
    [players]
  );

  const averageCa = useMemo(() => {
    const playersWithCa = players.filter(
      (player) => player.ca !== null
    );

    if (playersWithCa.length === 0) {
      return 0;
    }

    const totalCa = playersWithCa.reduce(
      (total, player) =>
        total + Number(player.ca || 0),
      0
    );

    return Math.round(
      totalCa / playersWithCa.length
    );
  }, [players]);

  const averageAge = useMemo(() => {
    const playersWithAge = players.filter(
      (player) => player.age !== null
    );

    if (playersWithAge.length === 0) {
      return 0;
    }

    const totalAge = playersWithAge.reduce(
      (total, player) =>
        total + Number(player.age || 0),
      0
    );

    return Math.round(
      totalAge / playersWithAge.length
    );
  }, [players]);

  const positionCounts = useMemo(() => {
    const counts: Record<PositionGroup, number> = {
      goalkeepers: 0,
      defenders: 0,
      midfielders: 0,
      attackers: 0,
      others: 0,
    };

    players.forEach((player) => {
      const group = getPositionGroup(
        player.position
      );

      counts[group] += 1;
    });

    return counts;
  }, [players]);

  const filteredPlayers = useMemo(() => {
    const normalizedSearch = searchTerm
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    const filtered = players.filter((player) => {
      const matchesGroup =
        selectedGroup === "all" ||
        getPositionGroup(player.position) ===
          selectedGroup;

      if (!matchesGroup) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = [
        player.name,
        player.position,
        player.nationality,
        player.age?.toString(),
        player.ca?.toString(),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      return searchableText.includes(
        normalizedSearch
      );
    });

    return sortPlayers(filtered, sortOption);
  }, [
    players,
    searchTerm,
    selectedGroup,
    sortOption,
  ]);

  const sections = useMemo<SquadSection[]>(() => {
    const grouped: Record<
      PositionGroup,
      Player[]
    > = {
      goalkeepers: [],
      defenders: [],
      midfielders: [],
      attackers: [],
      others: [],
    };

    filteredPlayers.forEach((player) => {
      const group = getPositionGroup(
        player.position
      );

      grouped[group].push(player);
    });

    const allSections: SquadSection[] = [
      {
        key: "goalkeepers",
        title: "Goleiros",
        abbreviation: "GK",
        description:
          "Responsáveis pela proteção do gol.",
        players: grouped.goalkeepers,
      },
      {
        key: "defenders",
        title: "Defensores",
        abbreviation: "DEF",
        description:
          "Zagueiros, laterais e alas defensivos.",
        players: grouped.defenders,
      },
      {
        key: "midfielders",
        title: "Meio-campistas",
        abbreviation: "MID",
        description:
          "Volantes, meias centrais e armadores.",
        players: grouped.midfielders,
      },
      {
        key: "attackers",
        title: "Atacantes",
        abbreviation: "ATA",
        description:
          "Pontas, centroavantes e jogadores ofensivos.",
        players: grouped.attackers,
      },
      {
        key: "others",
        title: "Outros jogadores",
        abbreviation: "OUT",
        description:
          "Jogadores ainda sem grupo de posição definido.",
        players: grouped.others,
      },
    ];

    return allSections.filter(
      (section) => section.players.length > 0
    );
  }, [filteredPlayers]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-semibold text-zinc-400">
            Carregando elenco...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-500/10 text-4xl">
            ⚽
          </div>

          <p className="mt-6 font-bold uppercase tracking-widest text-green-400">
            Meu elenco
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Você ainda não possui um clube
          </h1>

          <p className="mt-4 text-zinc-400">
            Escolha um clube para começar a montar seu elenco.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
              {errorMessage}
            </div>
          )}

          <Link
            href="/choose-team"
            className="mt-8 inline-block rounded-xl bg-green-600 px-8 py-4 font-black transition hover:bg-green-500"
          >
            Escolher clube
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="font-bold uppercase tracking-widest text-green-400">
            FriendZone League FM
          </p>

          <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-black md:text-6xl">
                Meu elenco
              </h1>

              <p className="mt-3 text-lg text-zinc-400">
                Jogadores contratados pelo{" "}
                <span className="font-bold text-white">
                  {team.name}
                </span>
                .
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auctions"
                className="rounded-xl bg-green-600 px-6 py-3 text-center font-black transition hover:bg-green-500"
              >
                Buscar jogadores
              </Link>

              <Link
                href="/history"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-center font-black transition hover:border-green-500 hover:text-green-400"
              >
                Ver histórico
              </Link>
            </div>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Jogadores
            </p>

            <p className="mt-3 text-4xl font-black">
              {players.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              CA médio
            </p>

            <p className="mt-3 text-4xl font-black text-green-400">
              {averageCa || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Idade média
            </p>

            <p className="mt-3 text-4xl font-black text-blue-400">
              {averageAge
                ? `${averageAge} anos`
                : "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Valor do elenco
            </p>

            <p className="mt-3 text-2xl font-black text-green-400">
              {money(totalValue)}
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          <button
            type="button"
            onClick={() =>
              setSelectedGroup("all")
            }
            className={`rounded-2xl border p-5 text-left transition ${
              selectedGroup === "all"
                ? "border-green-500 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Todos
            </p>

            <p className="mt-2 text-3xl font-black">
              {players.length}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedGroup("goalkeepers")
            }
            className={`rounded-2xl border p-5 text-left transition ${
              selectedGroup === "goalkeepers"
                ? "border-green-500 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Goleiros
            </p>

            <p className="mt-2 text-3xl font-black">
              {positionCounts.goalkeepers}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedGroup("defenders")
            }
            className={`rounded-2xl border p-5 text-left transition ${
              selectedGroup === "defenders"
                ? "border-green-500 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Defensores
            </p>

            <p className="mt-2 text-3xl font-black">
              {positionCounts.defenders}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedGroup("midfielders")
            }
            className={`rounded-2xl border p-5 text-left transition ${
              selectedGroup === "midfielders"
                ? "border-green-500 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Meio-campistas
            </p>

            <p className="mt-2 text-3xl font-black">
              {positionCounts.midfielders}
            </p>
          </button>

          <button
            type="button"
            onClick={() =>
              setSelectedGroup("attackers")
            }
            className={`rounded-2xl border p-5 text-left transition ${
              selectedGroup === "attackers"
                ? "border-green-500 bg-green-500/10"
                : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
            }`}
          >
            <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
              Atacantes
            </p>

            <p className="mt-2 text-3xl font-black">
              {positionCounts.attackers}
            </p>
          </button>
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center">
            <div className="flex-1">
              <label
                htmlFor="squad-search"
                className="mb-2 block text-sm font-bold text-zinc-400"
              >
                Buscar jogador
              </label>

              <input
                id="squad-search"
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(
                    event.target.value
                  )
                }
                placeholder="Nome, posição, nacionalidade, idade ou CA"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-green-500"
              />
            </div>

            <div className="lg:w-72">
              <label
                htmlFor="squad-sort"
                className="mb-2 block text-sm font-bold text-zinc-400"
              >
                Ordenar por
              </label>

              <select
                id="squad-sort"
                value={sortOption}
                onChange={(event) =>
                  setSortOption(
                    event.target
                      .value as SortOption
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-green-500"
              >
                <option value="ca-desc">
                  Maior CA
                </option>

                <option value="ca-asc">
                  Menor CA
                </option>

                <option value="name-asc">
                  Nome
                </option>

                <option value="age-asc">
                  Mais jovens
                </option>

                <option value="age-desc">
                  Mais velhos
                </option>

                <option value="value-desc">
                  Maior valor
                </option>
              </select>
            </div>
          </div>

          <p className="mt-4 text-sm text-zinc-500">
            {filteredPlayers.length} jogador
            {filteredPlayers.length === 1
              ? ""
              : "es"}{" "}
            encontrado
            {filteredPlayers.length === 1
              ? ""
              : "s"}
            .
          </p>
        </section>

        {players.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center md:p-14">
            <div className="text-6xl">⚽</div>

            <h2 className="mt-5 text-3xl font-black">
              Elenco vazio
            </h2>

            <p className="mt-3 text-zinc-400">
              Seu clube ainda não contratou nenhum jogador.
            </p>

            <Link
              href="/auctions"
              className="mt-7 inline-block rounded-xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500"
            >
              Participar dos leilões
            </Link>
          </section>
        ) : filteredPlayers.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <div className="text-5xl">🔎</div>

            <h2 className="mt-5 text-3xl font-black">
              Nenhum jogador encontrado
            </h2>

            <p className="mt-3 text-zinc-400">
              Altere a busca ou selecione outro grupo de posição.
            </p>

            <button
              type="button"
              onClick={() => {
                setSearchTerm("");
                setSelectedGroup("all");
                setSortOption("ca-desc");
              }}
              className="mt-7 rounded-xl bg-green-600 px-6 py-3 font-black transition hover:bg-green-500"
            >
              Limpar filtros
            </button>
          </section>
        ) : (
          <div className="mt-14 space-y-14">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-black text-green-400">
                      {section.abbreviation}
                    </span>

                    <div>
                      <h2 className="text-3xl font-black">
                        {section.title}
                      </h2>

                      <p className="mt-1 text-sm text-zinc-500">
                        {section.description}
                      </p>
                    </div>
                  </div>

                  <span className="font-bold text-zinc-500">
                    {section.players.length} jogador
                    {section.players.length === 1
                      ? ""
                      : "es"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.players.map(
                    (player) => (
                      <PlayerCard
                        key={player.id}
                        player={player}
                      />
                    )
                  )}
                </div>
              </section>
            ))}
          </div>
        )}

        <section className="mt-16 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
          <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                Finanças
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Orçamento disponível
              </h2>

              <p className="mt-2 text-zinc-400">
                Saldo atual para futuras contratações.
              </p>
            </div>

            <p className="text-3xl font-black text-green-400 md:text-4xl">
              {money(team.budget)}
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}