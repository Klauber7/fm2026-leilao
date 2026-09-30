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
  unique_id: string | null;
  name: string;
  age: number | null;
  role: string | null;
  nationality: string | null;
  ca: number | null;
  cp: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
  hired_at: string | null;
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

function getPositionGroup(position: string | null): PositionGroup {
  const normalized = normalizeText(position);

  if (
    normalized === "gk" ||
    normalized === "gr" ||
    normalized.includes("goleiro") ||
    normalized.includes("goalkeeper")
  ) {
    return "goalkeepers";
  }

  if (
    normalized === "dc" ||
    normalized === "cb" ||
    normalized === "dl" ||
    normalized === "dr" ||
    normalized === "ld" ||
    normalized === "le" ||
    normalized === "lb" ||
    normalized === "rb" ||
    normalized.includes("zag") ||
    normalized.includes("zagueiro") ||
    normalized.includes("defensor") ||
    normalized.includes("defender") ||
    normalized.includes("lateral")
  ) {
    return "defenders";
  }

  if (
    normalized === "dm" ||
    normalized === "dmc" ||
    normalized === "mc" ||
    normalized === "cm" ||
    normalized === "am" ||
    normalized === "amc" ||
    normalized.includes("volante") ||
    normalized.includes("meio") ||
    normalized.includes("midfielder") ||
    normalized.includes("meia")
  ) {
    return "midfielders";
  }

  if (
    normalized === "st" ||
    normalized === "cf" ||
    normalized === "fw" ||
    normalized === "rw" ||
    normalized === "lw" ||
    normalized === "pd" ||
    normalized === "pe" ||
    normalized.includes("atacante") ||
    normalized.includes("striker") ||
    normalized.includes("forward") ||
    normalized.includes("centroavante") ||
    normalized.includes("ponta") ||
    normalized.includes("winger")
  ) {
    return "attackers";
  }

  return "others";
}

function getPositionBadge(position: string | null) {
  const group = getPositionGroup(position);

  if (group === "goalkeepers") return "GK";
  if (group === "defenders") return "DEF";
  if (group === "midfielders") return "MID";
  if (group === "attackers") return "ATA";

  return "OUT";
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) return "?";

  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase();
  }

  return `${parts[0].charAt(0)}${parts[1].charAt(0)}`.toUpperCase();
}

function StatCard({
  label,
  value,
  description,
  accent = "text-white",
}: {
  label: string;
  value: string | number;
  description: string;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
      <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
        {label}
      </p>

      <p className={`mt-3 text-4xl font-black ${accent}`}>
        {value}
      </p>

      <p className="mt-2 text-sm text-zinc-500">
        {description}
      </p>
    </div>
  );
}

function PlayerCardCompact({
  player,
}: {
  player: Player;
}) {
  return (
    <Link
      href={`/players/${player.id}`}
      className="block cursor-pointer overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95 transition hover:-translate-y-1 hover:border-blue-500/60 hover:bg-zinc-900"
    >
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800">
            {player.image_url ? (
              <img
                src={player.image_url}
                alt={player.name}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-sm font-black text-zinc-300">
                {getPositionBadge(player.position)}
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-wide text-green-400">
              {player.position || "Sem posição"}
            </p>

            <h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">
              {player.name}
            </h3>

            <p className="mt-1 text-base text-zinc-300">
              {player.age !== null
                ? `${player.age} anos`
                : "Idade não informada"}
            </p>

            <p className="text-base text-zinc-500">
              {player.nationality || "Nacionalidade não informada"}
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
              CA
            </p>

            <p className="text-4xl font-black leading-none text-green-400">
              {player.ca ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Valor estimado
          </p>

          <p className="mt-1 text-3xl font-black text-green-400">
            {money(player.value)}
          </p>

          <div className="mt-4 rounded-xl bg-blue-600 px-4 py-3 text-center font-black text-white transition hover:bg-blue-500">
            VER ATRIBUTOS COMPLETOS →
          </div>
        </div>
      </div>
    </Link>
  );
}

function StaffCard({
  member,
}: {
  member: Coach;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-lg font-black text-zinc-300">
            {member.image_url ? (
              <img
                src={member.image_url}
                alt={member.name}
                className="h-full w-full object-cover"
              />
            ) : (
              getInitials(member.name)
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-black uppercase tracking-wide text-purple-400">
              {member.role || "Staff"}
            </p>

            <h3 className="mt-1 text-2xl font-black text-white">
              {member.name}
            </h3>

            <p className="mt-1 text-zinc-400">
              {member.age !== null
                ? `${member.age} anos`
                : "Idade não informada"}
            </p>

            <p className="text-zinc-500">
              {member.nationality || "Nacionalidade não informada"}
            </p>
          </div>

          <div className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-4 py-2 text-center">
            <p className="text-[11px] font-black uppercase text-zinc-400">
              CA
            </p>

            <p className="text-3xl font-black text-purple-400">
              {member.ca ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Valor
          </p>

          <p className="mt-1 text-2xl font-black text-green-400">
            {money(member.value)}
          </p>
        </div>
      </div>
    </article>
  );
}

export default function TeamPage() {
  const params = useParams();

  const rawId = params?.id;

  const teamId = Array.isArray(rawId)
    ? Number(rawId[0])
    : Number(rawId);

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [staff, setStaff] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  const loadTeam = useCallback(async () => {
    if (!teamId || Number.isNaN(teamId)) {
      setErrorMessage("Identificador do clube inválido.");
      setLoading(false);
      return;
    }

    setLoading(true);
    setErrorMessage("");

    try {
      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select(
          "id,name,city,stadium,budget,manager_id,manager_name,logo_url"
        )
        .eq("id", teamId)
        .single();

      if (teamError) {
        throw teamError;
      }

      setTeam(teamData as Team);

      const [playersResult, staffResult] =
        await Promise.all([
          supabase
            .from("players")
            .select(
              "id,name,age,position,nationality,ca,value,image_url,team_id"
            )
            .eq("team_id", teamId)
            .order("ca", {
              ascending: false,
            }),

          supabase
            .from("coaches")
            .select(
              "id,unique_id,name,age,role,nationality,ca,cp,value,image_url,team_id,hired_at"
            )
            .eq("team_id", teamId)
            .order("ca", {
              ascending: false,
            }),
        ]);

      if (playersResult.error) {
        throw playersResult.error;
      }

      if (staffResult.error) {
        throw staffResult.error;
      }

      setPlayers(
        (playersResult.data || []) as Player[]
      );

      setStaff(
        (staffResult.data || []) as Coach[]
      );
    } catch (error) {
      console.error(error);

      setErrorMessage(
        "Não foi possível carregar as informações do clube."
      );
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadTeam();
  }, [loadTeam]);

  const totalSquadValue = useMemo(() => {
    return players.reduce(
      (total, player) =>
        total + Number(player.value || 0),
      0
    );
  }, [players]);

  const averageCa = useMemo(() => {
    const valid = players.filter(
      (player) => player.ca !== null
    );

    if (valid.length === 0) {
      return 0;
    }

    return Math.round(
      valid.reduce(
        (total, player) =>
          total + Number(player.ca || 0),
        0
      ) / valid.length
    );
  }, [players]);

  const averageAge = useMemo(() => {
    const valid = players.filter(
      (player) => player.age !== null
    );

    if (valid.length === 0) {
      return 0;
    }

    return Math.round(
      valid.reduce(
        (total, player) =>
          total + Number(player.age || 0),
        0
      ) / valid.length
    );
  }, [players]);

  const playerSections = useMemo(() => {
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
        getPositionGroup(player.position)
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
      (section) => section.players.length > 0
    );
  }, [players]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 text-white">
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
        <div className="w-full max-w-xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <h1 className="text-4xl font-black">
            Clube não encontrado
          </h1>

          {errorMessage && (
            <p className="mt-4 text-red-400">
              {errorMessage}
            </p>
          )}

          <Link
            href="/teams"
            className="mt-8 inline-block rounded-xl bg-green-600 px-6 py-3 font-black"
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

        <section className="mt-8 rounded-3xl border border-zinc-800 bg-zinc-900 p-7">
          <div className="flex flex-col gap-6 md:flex-row md:items-center">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-950 p-3">
              {team.logo_url ? (
                <img
                  src={team.logo_url}
                  alt={team.name}
                  className="h-full w-full object-contain"
                />
              ) : (
                <span className="text-4xl font-black text-zinc-500">
                  {getInitials(team.name)}
                </span>
              )}
            </div>

            <div>
              <p className="font-black uppercase tracking-widest text-green-400">
                Perfil do clube
              </p>

              <h1 className="mt-2 text-5xl font-black">
                {team.name}
              </h1>

              <p className="mt-3 text-xl text-zinc-300">
                Presidente:{" "}
                <span className="font-black text-white">
                  {team.manager_name ||
                    "Sem presidente"}
                </span>
              </p>

              {team.city && (
                <p className="mt-2 text-zinc-500">
                  {team.city}
                </p>
              )}
            </div>
          </div>
        </section>

        {errorMessage && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard
            label="Jogadores"
            value={players.length}
            description="Atletas no elenco"
          />

          <StatCard
            label="Comissão técnica"
            value={staff.length}
            description="Profissionais contratados"
            accent="text-purple-400"
          />

          <StatCard
            label="CA médio"
            value={averageCa || "-"}
            description={
              averageAge
                ? `Idade média: ${averageAge} anos`
                : "Idade média não disponível"
            }
            accent="text-green-400"
          />

          <StatCard
            label="Valor do elenco"
            value={money(totalSquadValue)}
            description="Valor estimado dos jogadores"
            accent="text-green-400"
          />
        </section>

        <section
          id="elenco"
          className="mt-14"
        >
          <p className="font-bold uppercase tracking-widest text-blue-400">
            Elenco principal
          </p>

          <h2 className="mt-2 text-4xl font-black">
            Jogadores do clube
          </h2>

          <p className="mt-3 text-zinc-400">
            Clique em qualquer jogador para abrir
            todos os atributos.
          </p>

          {players.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
              Este clube ainda não possui jogadores.
            </div>
          ) : (
            <div className="mt-10 space-y-12">
              {playerSections.map(
                (section) => (
                  <section key={section.key}>
                    <div className="mb-5 flex items-center gap-4">
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

                    <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                      {section.players.map(
                        (player) => (
                          <PlayerCardCompact
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

        <section
          id="staff"
          className="mt-16"
        >
          <p className="font-bold uppercase tracking-widest text-purple-400">
            Staff
          </p>

          <h2 className="mt-2 text-4xl font-black">
            Comissão técnica
          </h2>

          {staff.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center text-zinc-400">
              Este clube ainda não possui profissionais.
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-2">
              {staff.map((member) => (
                <StaffCard
                  key={member.id}
                  member={member}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}