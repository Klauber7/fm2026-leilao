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
      (term) => normalized === term || normalized.includes(term)
    )
  ) {
    return "goalkeepers";
  }

  if (
    defenderTerms.some(
      (term) => normalized === term || normalized.includes(term)
    )
  ) {
    return "defenders";
  }

  if (
    midfielderTerms.some(
      (term) => normalized === term || normalized.includes(term)
    )
  ) {
    return "midfielders";
  }

  if (
    attackerTerms.some(
      (term) => normalized === term || normalized.includes(term)
    )
  ) {
    return "attackers";
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
  const refund = Number(player.value || 0) * 0.25;

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/80 transition hover:border-zinc-700">
      <Link
        href={`/players/${player.id}`}
        className="block p-3"
      >
        <div className="flex items-start gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg border border-zinc-700 bg-zinc-800 text-xl font-black text-zinc-500">
            {player.name.charAt(0).toUpperCase()}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-black uppercase text-green-400">
              {player.position || "Sem posição"}
            </p>

            <h3 className="mt-0.5 line-clamp-2 text-base font-black leading-tight text-white">
              {player.name}
            </h3>

            <p className="mt-1 text-xs text-zinc-400">
              {player.age ?? "-"} anos
            </p>

            <p className="mt-0.5 truncate text-xs text-zinc-500">
              {player.nationality || "Nacionalidade não informada"}
            </p>
          </div>

          <div className="shrink-0 rounded-lg border border-green-500/30 bg-green-500/10 px-2 py-1.5 text-center">
            <p className="text-[10px] font-bold uppercase leading-none text-zinc-400">
              CA
            </p>
            <p className="mt-1 text-lg font-black leading-none text-green-400">
              {player.ca ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-3 border-t border-zinc-800 pt-2.5">
          <p className="text-[11px] text-zinc-500">
            Valor estimado
          </p>
          <p className="mt-0.5 text-sm font-black text-green-400">
            {money(player.value)}
          </p>
        </div>
      </Link>

      <div className="border-t border-red-500/20 bg-red-500/[0.04] px-3 py-2.5">
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-wider text-red-400">
              Dispensa
            </p>
            <p className="mt-1 text-[11px] text-zinc-400">
              Você recebe 25%
            </p>
            <p className="mt-0.5 text-sm font-black text-yellow-400">
              {money(refund)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onRelease(player)}
            disabled={releasing}
            className="shrink-0 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-xs font-black text-red-300 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {releasing ? "..." : "Dispensar"}
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
    if (releasingPlayerId !== null) {
      return;
    }

    const refund = Number(player.value || 0) * 0.25;

    const confirmed = window.confirm(
      `Dispensar ${player.name}?\n\n` +
        `Valor do jogador: ${money(player.value)}\n` +
        `Valor devolvido ao clube (25%): ${money(refund)}\n\n` +
        "O jogador voltará ao mercado com o valor normal dele."
    );

    if (!confirmed) {
      return;
    }

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

  const sections = useMemo<SquadSection[]>(() => {
    const grouped: Record<PositionGroup, Player[]> = {
      goalkeepers: [],
      defenders: [],
      midfielders: [],
      attackers: [],
      others: [],
    };

    players.forEach((player) => {
      const group = getPositionGroup(player.position);
      grouped[group].push(player);
    });

    const allSections: SquadSection[] = [
      {
        key: "goalkeepers",
        title: "Goleiros",
        abbreviation: "GK",
        players: grouped.goalkeepers,
      },
      {
        key: "defenders",
        title: "Defensores",
        abbreviation: "DEF",
        players: grouped.defenders,
      },
      {
        key: "midfielders",
        title: "Meio-campistas",
        abbreviation: "MID",
        players: grouped.midfielders,
      },
      {
        key: "attackers",
        title: "Atacantes",
        abbreviation: "ATA",
        players: grouped.attackers,
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
            Escolha ou crie seu clube para começar a montar o elenco.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
              {errorMessage}
            </div>
          )}

          <Link
            href="/teams"
            className="mt-8 inline-block rounded-xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500"
          >
            Ir para clubes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-5 py-8 text-white md:px-8">
      <div className="mx-auto max-w-[1600px]">
        <header>
          <p className="text-xs font-bold uppercase tracking-widest text-green-400">
            Meu elenco
          </p>

          <div className="mt-1.5 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-4xl font-black md:text-5xl">
                {team.name}
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                Jogadores contratados pelo clube.
              </p>
            </div>

            <Link
              href="/auctions"
              className="rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-black transition hover:bg-green-500"
            >
              Buscar jogadores
            </Link>
          </div>
        </header>

        {errorMessage && (
          <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="mt-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {successMessage}
          </div>
        )}

        <section className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Jogadores</p>
            <p className="mt-1 text-2xl font-black">{players.length}</p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">CA médio</p>
            <p className="mt-1 text-2xl font-black text-green-400">
              {averageCa || "-"}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Valor do elenco</p>
            <p className="mt-1 text-lg font-black text-green-400">
              {money(totalValue)}
            </p>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs text-zinc-400">Orçamento disponível</p>
            <p className="mt-1 text-lg font-black text-green-400">
              {money(team.budget)}
            </p>
          </div>
        </section>

        {players.length === 0 ? (
          <section className="mt-8 rounded-xl border border-zinc-800 bg-zinc-900 p-8 text-center">
            <h2 className="text-2xl font-black">
              Elenco vazio
            </h2>

            <p className="mt-2 text-sm text-zinc-400">
              Seu clube ainda não contratou nenhum jogador.
            </p>

            <Link
              href="/auctions"
              className="mt-5 inline-block rounded-lg bg-green-600 px-5 py-3 text-sm font-black transition hover:bg-green-500"
            >
              Participar dos leilões
            </Link>
          </section>
        ) : (
          <div className="mt-8 space-y-9">
            {sections.map((section) => (
              <section key={section.key}>
                <div className="mb-3 flex items-center gap-3">
                  <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-2.5 py-1.5 text-xs font-black text-green-400">
                    {section.abbreviation}
                  </span>

                  <h2 className="text-2xl font-black">
                    {section.title}
                  </h2>

                  <span className="text-sm font-bold text-zinc-500">
                    {section.players.length}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6">
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
