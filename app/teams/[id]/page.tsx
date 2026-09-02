"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  city: string | null;
  stadium: string | null;
  budget: number | null;
  manager_id: string | null;
  manager_name: string | null;
  logo_url: string | null;
};

type Player = {
  id: number;
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  ca: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
};

type Coach = {
  id: number;
  name: string;
  age: number | null;
  role: string | null;
  nationality: string | null;
  ca: number | null;
  pa: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
  hired_at: string | null;
};

type PlayerAuction = {
  id: number;
  player_id: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  closed_at: string | null;
  players: {
    name: string;
    position: string | null;
  } | null;
};

type StaffAuction = {
  id: number;
  coach_id: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  closed_at: string | null;
  coaches: {
    name: string;
    role: string | null;
  } | null;
};

type PositionGroup =
  | "goalkeepers"
  | "defenders"
  | "midfielders"
  | "attackers"
  | "others";

type PlayerSection = {
  key: PositionGroup;
  title: string;
  abbreviation: string;
  players: Player[];
};

type RecentSigning = {
  id: string;
  type: "player" | "staff";
  name: string;
  role: string;
  amount: number;
  closedAt: string | null;
};

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function normalizeText(value: string | null | undefined) {
  return (value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function getPositionGroup(
  position: string | null
): PositionGroup {
  const normalized = normalizeText(position);

  const goalkeeperTerms = [
    "gk",
    "gol",
    "goleiro",
    "goalkeeper",
    "guarda-redes",
    "guarda redes",
  ];

  const defenderTerms = [
    "dc",
    "cb",
    "zag",
    "zagueiro",
    "defensor",
    "defender",
    "central defender",
    "dl",
    "dr",
    "ld",
    "le",
    "lb",
    "rb",
    "lateral",
    "left back",
    "right back",
    "ala",
    "wb",
  ];

  const midfielderTerms = [
    "dm",
    "mc",
    "cm",
    "vol",
    "volante",
    "mei",
    "meia",
    "meio",
    "meio-campista",
    "meio campista",
    "midfielder",
    "am",
    "ml",
    "mr",
    "aml",
    "amr",
  ];

  const attackerTerms = [
    "ata",
    "st",
    "ca",
    "cf",
    "fw",
    "pe",
    "pd",
    "lw",
    "rw",
    "atacante",
    "avancado",
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

  return "Não foi possível carregar as informações do clube.";
}

function formatDate(value: string | null) {
  if (!value) {
    return "Data não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function PlayerCard({
  player,
}: {
  player: Player;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-1 hover:border-green-500/60">
      <div className="relative h-48 overflow-hidden bg-zinc-800">
        {player.image_url ? (
          <img
            src={player.image_url}
            alt={player.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500">
            <span className="text-6xl">⚽</span>

            <span className="mt-3 text-sm">
              Sem imagem
            </span>
          </div>
        )}

        <div className="absolute right-4 top-4 rounded-xl border border-green-500/30 bg-zinc-950/90 px-3 py-2 text-center backdrop-blur">
          <p className="text-[10px] font-black uppercase text-zinc-500">
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

        <h3 className="mt-1 text-2xl font-black">
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

        <div className="mt-5 flex items-end justify-between gap-4 border-t border-zinc-800 pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Valor estimado
            </p>

            <p className="mt-1 font-black text-green-400">
              {money(player.value)}
            </p>
          </div>

          <Link
            href={`/players/${player.id}`}
            className="rounded-lg border border-zinc-700 px-3 py-2 text-sm font-bold transition hover:border-green-500 hover:text-green-400"
          >
            Ver jogador
          </Link>
        </div>
      </div>
    </article>
  );
}

function StaffCard({
  member,
}: {
  member: Coach;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-1 hover:border-purple-500/60">
      <div className="relative h-48 overflow-hidden bg-zinc-800">
        {member.image_url ? (
          <img
            src={member.image_url}
            alt={member.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center text-zinc-500">
            <span className="text-6xl">👔</span>

            <span className="mt-3 text-sm">
              Sem imagem
            </span>
          </div>
        )}

        <div className="absolute right-4 top-4 rounded-xl border border-green-500/30 bg-zinc-950/90 px-3 py-2 text-center backdrop-blur">
          <p className="text-[10px] font-black uppercase text-zinc-500">
            CA
          </p>

          <p className="text-xl font-black leading-none text-green-400">
            {member.ca ?? "-"}
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="font-bold text-purple-400">
          {member.role || "Comissão técnica"}
        </p>

        <h3 className="mt-1 text-2xl font-black">
          {member.name}
        </h3>

        <p className="mt-3 text-zinc-400">
          {member.nationality ||
            "Nacionalidade não informada"}
        </p>

        <p className="mt-1 text-sm text-zinc-500">
          {member.age !== null
            ? `${member.age} anos`
            : "Idade não informada"}
        </p>

        <div className="mt-5 grid grid-cols-2 gap-4 border-t border-zinc-800 pt-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              PA
            </p>

            <p className="mt-1 font-black">
              {member.pa ?? "-"}
            </p>
          </div>

          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
              Valor
            </p>

            <p className="mt-1 font-black text-green-400">
              {money(member.value)}
            </p>
          </div>
        </div>
      </div>
    </article>
  );
}

export default function TeamPage() {
  const params = useParams();

  const rawTeamId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const teamId = Number(rawTeamId);

  const [team, setTeam] =
    useState<Team | null>(null);

  const [players, setPlayers] =
    useState<Player[]>([]);

  const [staff, setStaff] =
    useState<Coach[]>([]);

  const [
    playerAuctions,
    setPlayerAuctions,
  ] = useState<PlayerAuction[]>([]);

  const [
    staffAuctions,
    setStaffAuctions,
  ] = useState<StaffAuction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadTeam = useCallback(async () => {
    if (
      !Number.isInteger(teamId) ||
      teamId <= 0
    ) {
      setTeam(null);
      setPlayers([]);
      setStaff([]);
      setPlayerAuctions([]);
      setStaffAuctions([]);
      setErrorMessage(
        "Identificador do clube inválido."
      );
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select(`
          id,
          name,
          city,
          stadium,
          budget,
          manager_id,
          manager_name,
          logo_url
        `)
        .eq("id", teamId)
        .maybeSingle();

      if (teamError) {
        throw teamError;
      }

      if (!teamData) {
        setTeam(null);
        setPlayers([]);
        setStaff([]);
        setPlayerAuctions([]);
        setStaffAuctions([]);
        return;
      }

      const loadedTeam = teamData as Team;

      setTeam(loadedTeam);

      const [
        {
          data: playersData,
          error: playersError,
        },
        {
          data: staffData,
          error: staffError,
        },
        {
          data: playerHistoryData,
          error: playerHistoryError,
        },
        {
          data: staffHistoryData,
          error: staffHistoryError,
        },
      ] = await Promise.all([
        supabase
          .from("players")
          .select(`
            id,
            name,
            age,
            position,
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
          }),

        supabase
          .from("coaches")
          .select(`
            id,
            name,
            age,
            role,
            nationality,
            ca,
            pa,
            value,
            image_url,
            team_id,
            hired_at
          `)
          .eq("team_id", loadedTeam.id)
          .order("ca", {
            ascending: false,
            nullsFirst: false,
          })
          .order("name", {
            ascending: true,
          }),

        supabase
          .from("auctions")
          .select(`
            id,
            player_id,
            current_bid,
            winner_team_id,
            closed_at,
            players (
              name,
              position
            )
          `)
          .eq("status", "closed")
          .eq("winner_team_id", loadedTeam.id)
          .order("closed_at", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(5),

        supabase
          .from("staff_auctions")
          .select(`
            id,
            coach_id,
            current_bid,
            winner_team_id,
            closed_at,
            coaches (
              name,
              role
            )
          `)
          .eq("status", "closed")
          .eq("winner_team_id", loadedTeam.id)
          .order("closed_at", {
            ascending: false,
            nullsFirst: false,
          })
          .limit(5),
      ]);

      if (playersError) {
        throw playersError;
      }

      if (staffError) {
        throw staffError;
      }

      if (playerHistoryError) {
        throw playerHistoryError;
      }

      if (staffHistoryError) {
        throw staffHistoryError;
      }

      setPlayers(
        (playersData || []) as Player[]
      );

      setStaff(
        (staffData || []) as Coach[]
      );

      setPlayerAuctions(
        (playerHistoryData || []).map((item: any) => ({
          ...item,
          players: Array.isArray(item.players)
            ? item.players[0] ?? null
            : item.players ?? null,
        })) as PlayerAuction[]
      );

      setStaffAuctions(
        (staffHistoryData || []).map((item: any) => ({
          ...item,
          coaches: Array.isArray(item.coaches)
            ? item.coaches[0] ?? null
            : item.coaches ?? null,
        })) as StaffAuction[]
      );
    } catch (error) {
      console.error(
        "Erro ao carregar clube:",
        error
      );

      setErrorMessage(
        getErrorMessage(error)
      );
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    loadTeam();
  }, [loadTeam]);

  useEffect(() => {
    if (
      !Number.isInteger(teamId) ||
      teamId <= 0
    ) {
      return;
    }

    const channel = supabase
      .channel(`team-page-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
          filter: `id=eq.${teamId}`,
        },
        () => {
          loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaches",
          filter: `team_id=eq.${teamId}`,
        },
        () => {
          loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "auctions",
          filter: `winner_team_id=eq.${teamId}`,
        },
        () => {
          loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_auctions",
          filter: `winner_team_id=eq.${teamId}`,
        },
        () => {
          loadTeam();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [teamId, loadTeam]);

  const totalSquadValue = useMemo(
    () =>
      players.reduce(
        (total, player) =>
          total +
          Number(player.value || 0),
        0
      ),
    [players]
  );

  const totalStaffValue = useMemo(
    () =>
      staff.reduce(
        (total, member) =>
          total +
          Number(member.value || 0),
        0
      ),
    [staff]
  );

  const averageCa = useMemo(() => {
    const validPlayers = players.filter(
      (player) => player.ca !== null
    );

    if (validPlayers.length === 0) {
      return 0;
    }

    return Math.round(
      validPlayers.reduce(
        (total, player) =>
          total + Number(player.ca || 0),
        0
      ) / validPlayers.length
    );
  }, [players]);

  const averageAge = useMemo(() => {
    const validPlayers = players.filter(
      (player) => player.age !== null
    );

    if (validPlayers.length === 0) {
      return 0;
    }

    return Math.round(
      validPlayers.reduce(
        (total, player) =>
          total + Number(player.age || 0),
        0
      ) / validPlayers.length
    );
  }, [players]);

  const playerSections =
    useMemo<PlayerSection[]>(() => {
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

      players.forEach((player) => {
        grouped[
          getPositionGroup(
            player.position
          )
        ].push(player);
      });

      const sections: PlayerSection[] = [
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

      return sections.filter(
        (section) =>
          section.players.length > 0
      );
    }, [players]);

  const recentSignings =
    useMemo<RecentSigning[]>(() => {
      const playerItems: RecentSigning[] =
        playerAuctions.map(
          (auction) => ({
            id: `player-${auction.id}`,
            type: "player",
            name:
              auction.players?.name ||
              `Jogador #${auction.player_id}`,
            role:
              auction.players?.position ||
              "Jogador",
            amount: Number(
              auction.current_bid || 0
            ),
            closedAt: auction.closed_at,
          })
        );

      const staffItems: RecentSigning[] =
        staffAuctions.map(
          (auction) => ({
            id: `staff-${auction.id}`,
            type: "staff",
            name:
              auction.coaches?.name ||
              `Profissional #${auction.coach_id}`,
            role:
              auction.coaches?.role ||
              "Comissão técnica",
            amount: Number(
              auction.current_bid || 0
            ),
            closedAt: auction.closed_at,
          })
        );

      return [
        ...playerItems,
        ...staffItems,
      ]
        .sort((first, second) => {
          const firstDate = first.closedAt
            ? new Date(
                first.closedAt
              ).getTime()
            : 0;

          const secondDate = second.closedAt
            ? new Date(
                second.closedAt
              ).getTime()
            : 0;

          return secondDate - firstDate;
        })
        .slice(0, 6);
    }, [playerAuctions, staffAuctions]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-semibold text-zinc-400">
            Carregando clube...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <div className="text-6xl">
            🏟️
          </div>

          <h1 className="mt-5 text-4xl font-black">
            Clube não encontrado
          </h1>

          <p className="mt-3 text-zinc-400">
            O clube solicitado não existe ou não está disponível.
          </p>

          {errorMessage && (
            <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
              {errorMessage}
            </div>
          )}

          <Link
            href="/teams"
            className="mt-8 inline-block rounded-xl bg-green-600 px-7 py-4 font-black transition hover:bg-green-500"
          >
            Voltar para clubes
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/teams"
          className="font-bold text-green-400 transition hover:text-green-300"
        >
          ← Voltar para clubes
        </Link>

        <section className="mt-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900">
          <div className="flex flex-col gap-8 p-8 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-zinc-700 bg-zinc-950">
                {team.logo_url ? (
                  <img
                    src={team.logo_url}
                    alt={`Escudo do ${team.name}`}
                    className="h-full w-full object-contain p-3"
                  />
                ) : (
                  <span className="text-6xl">
                    ⚽
                  </span>
                )}
              </div>

              <div>
                <p className="font-bold uppercase tracking-widest text-green-400">
                  Perfil do clube
                </p>

                <h1 className="mt-2 text-4xl font-black md:text-6xl">
                  {team.name}
                </h1>

                <p className="mt-3 text-lg text-zinc-400">
                  Manager:{" "}
                  <span className="font-bold text-white">
                    {team.manager_name ||
                      "Não informado"}
                  </span>
                </p>

                {(team.city ||
                  team.stadium) && (
                  <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-zinc-500">
                    {team.city && (
                      <span>
                        📍 {team.city}
                      </span>
                    )}

                    {team.stadium && (
                      <span>
                        🏟️ {team.stadium}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-6 lg:min-w-72">
              <p className="text-sm font-bold uppercase tracking-wider text-zinc-400">
                Orçamento disponível
              </p>

              <p className="mt-2 text-3xl font-black text-green-400">
                {money(team.budget)}
              </p>
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Jogadores
            </p>

            <p className="mt-3 text-4xl font-black">
              {players.length}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Atletas no elenco
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Comissão técnica
            </p>

            <p className="mt-3 text-4xl font-black text-purple-400">
              {staff.length}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Profissionais contratados
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              CA médio
            </p>

            <p className="mt-3 text-4xl font-black text-green-400">
              {averageCa || "-"}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Idade média:{" "}
              {averageAge
                ? `${averageAge} anos`
                : "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Patrimônio esportivo
            </p>

            <p className="mt-3 text-2xl font-black text-green-400">
              {money(
                totalSquadValue +
                  totalStaffValue
              )}
            </p>

            <p className="mt-2 text-sm text-zinc-500">
              Elenco e comissão
            </p>
          </div>
        </section>

        <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
          <Link
            href="/squad"
            className="rounded-2xl border border-blue-700 bg-blue-600 p-6 transition hover:-translate-y-1 hover:bg-blue-500"
          >
            <span className="text-3xl">
              👥
            </span>

            <h2 className="mt-4 text-xl font-black">
              Meu elenco
            </h2>

            <p className="mt-2 text-sm text-blue-100">
              Visualizar todos os jogadores.
            </p>
          </Link>

          <Link
            href="/staff"
            className="rounded-2xl border border-purple-700 bg-purple-600 p-6 transition hover:-translate-y-1 hover:bg-purple-500"
          >
            <span className="text-3xl">
              📋
            </span>

            <h2 className="mt-4 text-xl font-black">
              Comissão técnica
            </h2>

            <p className="mt-2 text-sm text-purple-100">
              Visualizar os profissionais.
            </p>
          </Link>

          <Link
            href="/transfers"
            className="rounded-2xl border border-green-700 bg-green-600 p-6 transition hover:-translate-y-1 hover:bg-green-500"
          >
            <span className="text-3xl">
              ✍️
            </span>

            <h2 className="mt-4 text-xl font-black">
              Contratações
            </h2>

            <p className="mt-2 text-sm text-green-100">
              Ver os contratados atuais.
            </p>
          </Link>

          <Link
            href="/history"
            className="rounded-2xl border border-yellow-600 bg-yellow-500 p-6 text-black transition hover:-translate-y-1 hover:bg-yellow-400"
          >
            <span className="text-3xl">
              📊
            </span>

            <h2 className="mt-4 text-xl font-black">
              Histórico
            </h2>

            <p className="mt-2 text-sm text-yellow-950">
              Conferir compras e valores.
            </p>
          </Link>
        </section>

        <section className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-bold uppercase tracking-widest text-blue-400">
                Elenco principal
              </p>

              <h2 className="mt-2 text-4xl font-black">
                Jogadores do clube
              </h2>
            </div>

            <Link
              href="/squad"
              className="font-bold text-green-400 transition hover:text-green-300"
            >
              Ver elenco completo →
            </Link>
          </div>

          {players.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <div className="text-6xl">
                ⚽
              </div>

              <h3 className="mt-5 text-3xl font-black">
                Elenco vazio
              </h3>

              <p className="mt-3 text-zinc-400">
                Este clube ainda não contratou jogadores.
              </p>

              <Link
                href="/auctions"
                className="mt-7 inline-block rounded-xl bg-green-600 px-6 py-3 font-black transition hover:bg-green-500"
              >
                Ver leilões
              </Link>
            </div>
          ) : (
            <div className="mt-10 space-y-14">
              {playerSections.map(
                (section) => (
                  <section
                    key={section.key}
                  >
                    <div className="mb-6 flex items-center gap-4">
                      <span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-black text-blue-400">
                        {section.abbreviation}
                      </span>

                      <h3 className="text-3xl font-black">
                        {section.title}
                      </h3>

                      <span className="font-bold text-zinc-500">
                        {section.players.length}
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
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-bold uppercase tracking-widest text-purple-400">
                Staff
              </p>

              <h2 className="mt-2 text-4xl font-black">
                Comissão técnica
              </h2>
            </div>

            <Link
              href="/staff"
              className="font-bold text-green-400 transition hover:text-green-300"
            >
              Ver comissão completa →
            </Link>
          </div>

          {staff.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <div className="text-6xl">
                👔
              </div>

              <h3 className="mt-5 text-3xl font-black">
                Comissão vazia
              </h3>

              <p className="mt-3 text-zinc-400">
                Este clube ainda não contratou profissionais.
              </p>

              <Link
                href="/staff-auctions"
                className="mt-7 inline-block rounded-xl bg-green-600 px-6 py-3 font-black transition hover:bg-green-500"
              >
                Ver leilões
              </Link>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {staff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                />
              ))}
            </div>
          )}
        </section>

        <section className="mt-16">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="font-bold uppercase tracking-widest text-green-400">
                Mercado
              </p>

              <h2 className="mt-2 text-4xl font-black">
                Últimas contratações
              </h2>
            </div>

            <Link
              href="/history"
              className="font-bold text-green-400 transition hover:text-green-300"
            >
              Ver histórico completo →
            </Link>
          </div>

          {recentSignings.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <p className="text-zinc-400">
                Nenhuma contratação registrada para este clube.
              </p>
            </div>
          ) : (
            <div className="mt-7 space-y-4">
              {recentSignings.map(
                (signing) => (
                  <article
                    key={signing.id}
                    className="flex flex-col gap-5 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex items-center gap-4">
                      <div
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ${
                          signing.type ===
                          "player"
                            ? "bg-blue-500/10"
                            : "bg-purple-500/10"
                        }`}
                      >
                        <span className="text-2xl">
                          {signing.type ===
                          "player"
                            ? "⚽"
                            : "👔"}
                        </span>
                      </div>

                      <div>
                        <p
                          className={`text-sm font-bold uppercase ${
                            signing.type ===
                            "player"
                              ? "text-blue-400"
                              : "text-purple-400"
                          }`}
                        >
                          {signing.type ===
                          "player"
                            ? "Jogador"
                            : "Comissão técnica"}
                        </p>

                        <h3 className="mt-1 text-xl font-black">
                          {signing.name}
                        </h3>

                        <p className="mt-1 text-sm text-zinc-500">
                          {signing.role} •{" "}
                          {formatDate(
                            signing.closedAt
                          )}
                        </p>
                      </div>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
                        Valor pago
                      </p>

                      <p className="mt-1 text-xl font-black text-green-400">
                        {money(signing.amount)}
                      </p>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        <section className="mt-16 rounded-3xl border border-zinc-800 bg-zinc-900 p-7 md:p-9">
          <div className="flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="font-bold uppercase tracking-widest text-green-400">
                Próxima contratação
              </p>

              <h2 className="mt-2 text-3xl font-black">
                Reforce o clube
              </h2>

              <p className="mt-3 max-w-2xl text-zinc-400">
                Use o orçamento disponível para disputar novos jogadores e profissionais.
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/auctions"
                className="rounded-xl bg-green-600 px-6 py-4 text-center font-black transition hover:bg-green-500"
              >
                Leilões de jogadores
              </Link>

              <Link
                href="/staff-auctions"
                className="rounded-xl border border-zinc-700 bg-zinc-950 px-6 py-4 text-center font-black transition hover:border-purple-500 hover:text-purple-400"
              >
                Leilões da comissão
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}