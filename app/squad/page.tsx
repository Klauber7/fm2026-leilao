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
  | "center_backs"
  | "full_backs"
  | "defensive_midfielders"
  | "central_midfielders"
  | "attacking_midfielders"
  | "wingers"
  | "strikers"
  | "others";

type SquadSection = {
  key: PositionGroup;
  title: string;
  abbreviation: string;
  players: Player[];
};

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

function getPositionGroup(position: string | null): PositionGroup {
  const p = normalizePosition(position);

  // GOLEIROS
  if (
    ["gk", "goalkeeper", "goleiro", "guarda-redes", "guarda redes"].some(
      (term) => p === term || p.includes(term)
    )
  ) {
    return "goalkeepers";
  }

  // ZAGUEIROS
  if (
    ["dc", "cb", "zagueiro", "central defender", "defesa central"].some(
      (term) => p === term || p.includes(term)
    )
  ) {
    return "center_backs";
  }

  // LATERAIS / ALAS
  if (
    [
      "dl",
      "dr",
      "lb",
      "rb",
      "left back",
      "right back",
      "lateral",
      "ala",
      "wb",
      "wing back",
    ].some((term) => p === term || p.includes(term))
  ) {
    return "full_backs";
  }

  // VOLANTES
  if (
    ["dm", "dmc", "volante", "defensive midfielder", "medio defensivo"].some(
      (term) => p === term || p.includes(term)
    )
  ) {
    return "defensive_midfielders";
  }

  // MEIAS ARMADORES
  if (
    [
      "am",
      "amc",
      "meia armador",
      "meia-atacante",
      "meia atacante",
      "attacking midfielder",
    ].some((term) => p === term || p.includes(term))
  ) {
    return "attacking_midfielders";
  }

  // PONTAS
  if (
    [
      "aml",
      "amr",
      "ml",
      "mr",
      "ponta",
      "winger",
      "left winger",
      "right winger",
      "extremo",
    ].some((term) => p === term || p.includes(term))
  ) {
    return "wingers";
  }

  // ATACANTES
  if (
    ["st", "cf", "fw", "atacante", "avancado", "striker", "forward"].some(
      (term) => p === term || p.includes(term)
    )
  ) {
    return "strikers";
  }

  // MEIO-CAMPISTAS
  if (
    [
      "mc",
      "cm",
      "meio-campista",
      "meio campista",
      "midfielder",
      "central midfielder",
    ].some((term) => p === term || p.includes(term))
  ) {
    return "central_midfielders";
  }

  return "others";
}

function PlayerCard({
  player,
  releasing,
  onRelease,
}: {
  player: Player;
  releasing: boolean;
  onRelease: (player: Player) => void;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition hover:border-green-500/50">
      {/* Tudo aqui abre o perfil */}
      <Link
        href={`/players/${player.id}`}
        className="block transition hover:bg-zinc-800/20"
      >
        <div className="h-52 w-full bg-zinc-800">
          {player.image_url ? (
            <img
              src={player.image_url}
              alt={player.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full flex-col items-center justify-center text-zinc-500">
              <span className="text-5xl font-black">
                {player.name.charAt(0).toUpperCase()}
              </span>

              <span className="mt-2 text-sm">
                Sem imagem
              </span>
            </div>
          )}
        </div>

        <div className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-black text-green-400">
                {player.position || "Sem posição"}
              </p>

              <h3 className="mt-1 break-words text-xl font-black leading-tight">
                {player.name}
              </h3>

              <p className="mt-2 text-zinc-400">
                {player.age ?? "-"} anos
              </p>
            </div>

            <div className="shrink-0 rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-center">
              <p className="text-xs font-bold uppercase text-zinc-400">
                CA
              </p>

              <p className="text-xl font-black leading-none text-green-400">
                {player.ca ?? "-"}
              </p>
            </div>
          </div>

          <p className="mt-2 text-sm text-zinc-500">
            {player.nationality || "Nacionalidade não informada"}
          </p>

          <div className="mt-5 border-t border-zinc-800 pt-4">
            <p className="text-sm text-zinc-500">
              Valor estimado
            </p>

            <p className="mt-1 font-black text-green-400">
              {money(player.value)}
            </p>

            <p className="mt-4 text-xs font-black uppercase tracking-wider text-zinc-500">
              Clique para abrir o perfil →
            </p>
          </div>
        </div>
      </Link>

      {/* Botão fora do Link para não navegar quando dispensar */}
      <div className="border-t border-zinc-800 p-5 pt-4">
        <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
            Dispensa
          </p>

          <p className="mt-2 text-sm text-zinc-300">
            Você recebe 25% do valor:
          </p>

          <p className="mt-1 font-black text-yellow-400">
            {money(Number(player.value || 0) * 0.25)}
          </p>

          <button
            type="button"
            onClick={() => onRelease(player)}
            disabled={releasing}
            className="mt-4 w-full rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {releasing ? "Dispensando..." : "Dispensar jogador"}
          </button>
        </div>
      </div>
    </article>
  );
}

export default function SquadPage() {
  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [releasingPlayerId, setReleasingPlayerId] =
    useState<number | null>(null);

  const loadSquad = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) throw userError;

      if (!user) {
        setTeam(null);
        setPlayers([]);
        return;
      }

      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, budget")
        .eq("manager_id", user.id)
        .maybeSingle();

      if (teamError) throw teamError;

      if (!teamData) {
        setTeam(null);
        setPlayers([]);
        return;
      }

      const loadedTeam = teamData as Team;
      setTeam(loadedTeam);

      const { data: squadPlayers, error: playersError } = await supabase
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
        // NÃO ordena mais por CA.
        // A organização por posição é feita abaixo.
        .order("name", {
          ascending: true,
        });

      if (playersError) throw playersError;

      setPlayers((squadPlayers || []) as Player[]);
    } catch (error) {
      console.error("Erro ao carregar elenco:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "message" in error
      ) {
        setErrorMessage(
          String((error as { message: unknown }).message)
        );
      } else {
        setErrorMessage("Não foi possível carregar o elenco.");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSquad();

    const authSubscription =
      supabase.auth.onAuthStateChange(() => {
        loadSquad();
      });

    return () => {
      authSubscription.data.subscription.unsubscribe();
    };
  }, [loadSquad]);

  async function releasePlayer(player: Player) {
    if (releasingPlayerId !== null) return;

    const refund = Number(player.value || 0) * 0.25;

    const confirmed = window.confirm(
      `Dispensar ${player.name}?\n\n` +
        `Valor do jogador: ${money(player.value)}\n` +
        `Valor devolvido ao clube (25%): ${money(refund)}\n\n` +
        "O jogador voltará ao mercado com o valor normal dele."
    );

    if (!confirmed) return;

    setReleasingPlayerId(player.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc(
      "release_player",
      {
        p_player_id: player.id,
      }
    );

    if (error) {
      console.error("Erro ao dispensar jogador:", error);

      const message = String(error.message || "");

      if (message.includes("PLAYER_NOT_OWNED")) {
        setErrorMessage(
          "Esse jogador não pertence mais ao seu clube."
        );
      } else if (message.includes("TEAM_NOT_FOUND")) {
        setErrorMessage(
          "Não foi possível localizar seu clube."
        );
      } else if (message.includes("PLAYER_NOT_FOUND")) {
        setErrorMessage("Jogador não encontrado.");
      } else if (message.includes("NOT_AUTHENTICATED")) {
        setErrorMessage(
          "Sua sessão expirou. Entre novamente."
        );
      } else {
        setErrorMessage(
          "Não foi possível dispensar o jogador."
        );
      }

      setReleasingPlayerId(null);
      return;
    }

    const returnedRefund =
      data &&
      typeof data === "object" &&
      "refund" in data
        ? Number(
            (data as { refund?: number }).refund || 0
          )
        : refund;

    setSuccessMessage(
      `${player.name} foi dispensado. ${money(
        returnedRefund
      )} foram devolvidos ao orçamento do clube.`
    );

    await loadSquad();
    setReleasingPlayerId(null);
  }

  useEffect(() => {
    if (!team?.id) return;

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

  const sections = useMemo<SquadSection[]>(() => {
    const grouped: Record<PositionGroup, Player[]> = {
      goalkeepers: [],
      center_backs: [],
      full_backs: [],
      defensive_midfielders: [],
      central_midfielders: [],
      attacking_midfielders: [],
      wingers: [],
      strikers: [],
      others: [],
    };

    players.forEach((player) => {
      grouped[getPositionGroup(player.position)].push(player);
    });

    // Dentro de cada posição: ordem alfabética, NÃO CA.
    Object.values(grouped).forEach((group) => {
      group.sort((a, b) =>
        a.name.localeCompare(b.name, "pt-BR", {
          sensitivity: "base",
        })
      );
    });

    const allSections: SquadSection[] = [
      {
        key: "goalkeepers",
        title: "Goleiros",
        abbreviation: "GK",
        players: grouped.goalkeepers,
      },
      {
        key: "center_backs",
        title: "Zagueiros",
        abbreviation: "ZAG",
        players: grouped.center_backs,
      },
      {
        key: "full_backs",
        title: "Laterais",
        abbreviation: "LAT",
        players: grouped.full_backs,
      },
      {
        key: "defensive_midfielders",
        title: "Volantes",
        abbreviation: "VOL",
        players: grouped.defensive_midfielders,
      },
      {
        key: "central_midfielders",
        title: "Meio-campistas",
        abbreviation: "MC",
        players: grouped.central_midfielders,
      },
      {
        key: "attacking_midfielders",
        title: "Meias Armadores",
        abbreviation: "MEI",
        players: grouped.attacking_midfielders,
      },
      {
        key: "wingers",
        title: "Pontas",
        abbreviation: "PON",
        players: grouped.wingers,
      },
      {
        key: "strikers",
        title: "Atacantes",
        abbreviation: "ATA",
        players: grouped.strikers,
      },
      {
        key: "others",
        title: "Outros jogadores",
        abbreviation: "OUT",
        players: grouped.others,
      },
    ];

    return allSections.filter(
      (section) => section.players.length > 0
    );
  }, [players]);

  const totalValue = useMemo(
    () =>
      players.reduce(
        (total, player) =>
          total + Number(player.value || 0),
        0
      ),
    [players]
  );

  const averageCa = useMemo(() => {
    const playersWithCa =
      players.filter((player) => player.ca !== null);

    if (playersWithCa.length === 0) return 0;

    const totalCa = playersWithCa.reduce(
      (total, player) =>
        total + Number(player.ca || 0),
      0
    );

    return Math.round(totalCa / playersWithCa.length);
  }, [players]);

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
        <div className="mx-auto max-w-7xl">
          <p className="text-zinc-300">
            Carregando elenco...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
        <div className="mx-auto max-w-4xl">
          <p className="font-bold uppercase tracking-widest text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-3 text-4xl font-black md:text-5xl">
            Você ainda não possui um clube
          </h1>

          <p className="mt-4 text-lg text-zinc-400">
            Entre em contato com a administração.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header>
          <p className="font-bold uppercase tracking-widest text-green-400">
            Meu elenco
          </p>

          <div className="mt-2 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-5xl font-black md:text-6xl">
                {team.name}
              </h1>

              <p className="mt-3 text-lg text-zinc-400">
                Jogadores organizados por posição.
              </p>
            </div>

            <Link
              href="/players"
              className="rounded-xl bg-green-600 px-6 py-3 text-center font-black transition hover:bg-green-500"
            >
              Buscar jogadores
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
            {successMessage}
          </div>
        )}

        <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400">Jogadores</p>
            <p className="mt-2 text-4xl font-black">
              {players.length}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400">CA médio</p>
            <p className="mt-2 text-4xl font-black text-green-400">
              {averageCa || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400">
              Valor do elenco
            </p>
            <p className="mt-2 text-2xl font-black text-green-400">
              {money(totalValue)}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-zinc-400">
              Orçamento disponível
            </p>
            <p className="mt-2 text-2xl font-black text-green-400">
              {money(team.budget)}
            </p>
          </div>
        </section>

        {players.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-center md:p-12">
            <h2 className="text-3xl font-black">
              Elenco vazio
            </h2>
          </section>
        ) : (
          <div className="mt-14 space-y-14">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-6 flex items-center gap-4">
                  <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-3 py-2 text-sm font-black text-green-400">
                    {section.abbreviation}
                  </span>

                  <h2 className="text-3xl font-black">
                    {section.title}
                  </h2>

                  <span className="font-bold text-zinc-500">
                    {section.players.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.players.map((player) => (
                    <PlayerCard
                      key={player.id}
                      player={player}
                      releasing={
                        releasingPlayerId === player.id
                      }
                      onRelease={releasePlayer}
                    />
                  ))}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
