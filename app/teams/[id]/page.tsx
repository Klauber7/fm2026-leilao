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

function getPositionGroup(
  position: string | null
): PositionGroup {
  const normalized = normalizeText(position)
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ",")
    .trim();

  if (!normalized) {
    return "others";
  }

  // Goleiros
  if (
    normalized === "gk" ||
    normalized === "gr" ||
    normalized === "gol" ||
    normalized.includes("goleiro") ||
    normalized.includes("goalkeeper") ||
    normalized.includes("guarda-redes") ||
    normalized.includes("guarda redes")
  ) {
    return "goalkeepers";
  }

  // Atacantes / pontas
  if (
    normalized === "st" ||
    normalized === "cf" ||
    normalized === "fw" ||
    normalized === "ata" ||
    normalized === "pl" ||
    normalized.includes("atacante") ||
    normalized.includes("avancado") ||
    normalized.includes("striker") ||
    normalized.includes("forward") ||
    normalized.includes("centroavante") ||
    normalized.includes("ponta") ||
    normalized.includes("winger") ||
    normalized === "rw" ||
    normalized === "lw" ||
    normalized === "pd" ||
    normalized === "pe" ||
    normalized.includes("amr") ||
    normalized.includes("aml") ||
    normalized.includes("mo (d)") ||
    normalized.includes("mo (e)") ||
    normalized.includes("mo (de)") ||
    normalized.includes("mo (ed)")
  ) {
    return "attackers";
  }

  // Meio-campistas
  if (
    normalized === "dm" ||
    normalized === "dmc" ||
    normalized === "md" ||
    normalized === "mc" ||
    normalized === "cm" ||
    normalized === "am" ||
    normalized === "amc" ||
    normalized.includes("volante") ||
    normalized.includes("meio") ||
    normalized.includes("midfielder") ||
    normalized.includes("meia") ||
    normalized.includes("attacking midfielder") ||
    normalized.includes("m (c)") ||
    normalized.includes("m (d)") ||
    normalized.includes("m (e)") ||
    normalized.includes("m (dc)") ||
    normalized.includes("m (ec)") ||
    normalized.includes("m (dec)") ||
    normalized.includes("m/mo") ||
    normalized.includes("mo (c)") ||
    normalized.includes("mo (dc)") ||
    normalized.includes("mo (ec)") ||
    normalized.includes("mo (dec)") ||
    normalized.includes("mo (de)") ||
    normalized.includes("mo (ed)")
  ) {
    return "midfielders";
  }

  // Defensores / laterais
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
    normalized.includes("lateral") ||
    normalized.includes("left back") ||
    normalized.includes("right back") ||
    normalized.includes("wing back") ||
    normalized.includes("d (c)") ||
    normalized.includes("d (d)") ||
    normalized.includes("d (e)") ||
    normalized.includes("d (dc)") ||
    normalized.includes("d (ec)") ||
    normalized.includes("d (dec)") ||
    normalized.includes("d (de)") ||
    normalized.includes("d (ed)") ||
    normalized.includes("d/da") ||
    normalized.includes("da (d)") ||
    normalized.includes("da (e)") ||
    normalized.includes("da (de)") ||
    normalized.includes("da (ed)")
  ) {
    return "defenders";
  }

  return "others";
}

function getPositionBadge(position: string | null) {
  const group = getPositionGroup(position);

  if (group === "goalkeepers") return "GK";
  if (group === "defenders") return "DEF";
  if (group === "midfielders") return "MID";
  if (group === "attackers") return "ATA";

  const normalized = normalizeText(position);

  if (normalized.includes("d/da") || normalized.includes("da (")) {
    return "LAT";
  }

  if (
    normalized.includes("mo (d)") ||
    normalized.includes("mo (e)") ||
    normalized.includes("ponta") ||
    normalized === "rw" ||
    normalized === "lw" ||
    normalized === "pd" ||
    normalized === "pe"
  ) {
    return "EXT";
  }

  return "OUT";
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

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return "?";
  }

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

function BestPlayerCard({
  player,
}: {
  player: Player | null;
}) {
  return (
    <div className="rounded-2xl border border-yellow-500/20 bg-gradient-to-r from-zinc-900 to-zinc-950 p-5">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-yellow-400">
        Melhor jogador do elenco
      </p>

      {!player ? (
        <div className="mt-4 rounded-xl border border-zinc-800 bg-zinc-900/70 p-4 text-sm text-zinc-400">
          Nenhum jogador disponível.
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-yellow-500/20 bg-zinc-800">
              {player.image_url ? (
                <img
                  src={player.image_url}
                  alt={player.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <span className="text-xl font-black text-yellow-400">
                  ★
                </span>
              )}
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-yellow-400">
                Maior CA do elenco
              </p>

              <h2 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">
                {player.name}
              </h2>

              <p className="mt-1 text-sm text-zinc-400">
                {player.position || "Sem posição"}
                {player.age !== null ? ` · ${player.age} anos` : ""}
                {player.nationality ? ` · ${player.nationality}` : ""}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 lg:min-w-[260px]">
            <div className="rounded-2xl border border-yellow-500/20 bg-black/30 px-4 py-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                CA
              </p>
              <p className="mt-1 text-3xl font-black text-yellow-400">
                {player.ca ?? "-"}
              </p>
            </div>

            <div className="rounded-2xl border border-green-500/20 bg-black/30 px-4 py-3 text-center">
              <p className="text-[11px] font-black uppercase tracking-widest text-zinc-500">
                Valor
              </p>
              <p className="mt-1 text-xl font-black text-green-400">
                {money(player.value)}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function PlayerCardCompact({
  player,
}: {
  player: Player;
}) {
  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-2xl font-black text-zinc-400">
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
        </div>
      </div>
    </article>
  );
}

function StaffCardCompact({
  member,
  onRelease,
  releasing,
  canRelease,
}: {
  member: Coach;
  onRelease: (member: Coach) => void;
  releasing: boolean;
  canRelease: boolean;
}) {
  const refundPreview = Number(member.value || 0) * 0.5;

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900/95">
      <div className="p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700 bg-zinc-800 text-2xl font-black text-zinc-400">
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

            <h3 className="mt-1 line-clamp-2 text-2xl font-black leading-tight text-white">
              {member.name}
            </h3>

            <p className="mt-1 text-base text-zinc-300">
              {member.age !== null
                ? `${member.age} anos`
                : "Idade não informada"}
            </p>

            <p className="text-base text-zinc-500">
              {member.nationality || "Nacionalidade não informada"}
            </p>
          </div>

          <div className="shrink-0 rounded-xl border border-green-500/40 bg-green-500/10 px-4 py-2 text-center">
            <p className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
              CA
            </p>
            <p className="text-4xl font-black leading-none text-green-400">
              {member.ca ?? "-"}
            </p>
          </div>
        </div>

        <div className="mt-5 border-t border-zinc-800 pt-4">
          <p className="text-sm text-zinc-500">
            Valor estimado
          </p>
          <p className="mt-1 text-3xl font-black text-green-400">
            {money(member.value)}
          </p>
        </div>
      </div>

      {canRelease && (
        <div className="border-t border-red-500/30 bg-red-500/5 px-4 py-3">
          <p className="text-sm font-black uppercase tracking-wide text-red-400">
            Dispensa
          </p>
          <p className="mt-1 text-sm text-zinc-300">
            Você recebe 50%
          </p>
          <div className="mt-1 flex items-center justify-between gap-3">
            <p className="text-2xl font-black text-yellow-400">
              {money(refundPreview)}
            </p>

            <button
              type="button"
              disabled={releasing}
              onClick={() => onRelease(member)}
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-2 font-black text-red-200 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {releasing ? "Dispensando..." : "Dispensar"}
            </button>
          </div>
        </div>
      )}
    </article>
  );
}

export default function TeamPage() {
  const params = useParams();

  const rawTeamId = Array.isArray(params.id)
    ? params.id[0]
    : params.id;

  const teamId = Number(rawTeamId);

  const [team, setTeam] = useState<Team | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [staff, setStaff] = useState<Coach[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [releasingStaffId, setReleasingStaffId] = useState<number | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadTeam = useCallback(async () => {
    if (!Number.isInteger(teamId) || teamId <= 0) {
      setTeam(null);
      setPlayers([]);
      setStaff([]);
      setErrorMessage("Identificador do clube inválido.");
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setErrorMessage("");

      const { data: authData } = await supabase.auth.getUser();
      setCurrentUserId(authData.user?.id ?? null);

      const { data: teamData, error: teamError } = await supabase
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
        setLoading(false);
        return;
      }

      const loadedTeam = teamData as Team;
      setTeam(loadedTeam);

      const [playersResult, staffResult] = await Promise.all([
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
          .order("name", { ascending: true }),

        supabase
          .from("coaches")
          .select(`
            id,
            unique_id,
            name,
            age,
            role,
            nationality,
            ca,
            cp,
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
          .order("name", { ascending: true }),
      ]);

      if (playersResult.error) {
        throw playersResult.error;
      }

      if (staffResult.error) {
        throw staffResult.error;
      }

      setPlayers((playersResult.data || []) as Player[]);
      setStaff((staffResult.data || []) as Coach[]);
    } catch (error) {
      console.error(error);
      setErrorMessage(getErrorMessage(error));
      setTeam(null);
      setPlayers([]);
      setStaff([]);
    } finally {
      setLoading(false);
    }
  }, [teamId]);

  useEffect(() => {
    void loadTeam();

    const channel = supabase
      .channel(`team-page-${teamId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "teams",
        },
        () => {
          void loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "players",
        },
        () => {
          void loadTeam();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaches",
        },
        () => {
          void loadTeam();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTeam, teamId]);

  async function releaseStaff(member: Coach) {
    if (releasingStaffId !== null) {
      return;
    }

    const confirmed = window.confirm(
      `Dispensar ${member.name}?\n\n` +
        `O clube receberá 50% do valor realmente pago por esse profissional.\n\n` +
        `O staff voltará ao Mercado de Treinadores pelo seu preço normal: ${money(member.value)}.`
    );

    if (!confirmed) {
      return;
    }

    setReleasingStaffId(member.id);
    setErrorMessage("");
    setSuccessMessage("");

    const { data, error } = await supabase.rpc("release_staff", {
      p_coach_id: member.id,
    });

    if (error) {
      const message = String(error.message || "");

      if (message.includes("STAFF_NOT_OWNED")) {
        setErrorMessage("Esse profissional não pertence ao seu clube.");
      } else if (message.includes("TEAM_NOT_FOUND")) {
        setErrorMessage("Não foi possível localizar seu clube.");
      } else if (message.includes("STAFF_NOT_FOUND")) {
        setErrorMessage("Profissional não encontrado.");
      } else if (message.includes("NOT_AUTHENTICATED")) {
        setErrorMessage("Sua sessão expirou. Entre novamente.");
      } else {
        setErrorMessage("Não foi possível dispensar o profissional.");
      }

      setReleasingStaffId(null);
      return;
    }

    const returnedRefund =
      data && typeof data === "object" && "refund" in data
        ? Number((data as { refund?: number }).refund || 0)
        : 0;

    setSuccessMessage(
      `${member.name} foi dispensado. ${money(returnedRefund)} foram devolvidos ao orçamento do clube.`
    );

    await loadTeam();
    setReleasingStaffId(null);
  }

  const totalSquadValue = useMemo(
    () => players.reduce((total, player) => total + Number(player.value || 0), 0),
    [players]
  );

  const totalStaffValue = useMemo(
    () => staff.reduce((total, member) => total + Number(member.value || 0), 0),
    [staff]
  );

  const averageCa = useMemo(() => {
    const validPlayers = players.filter((player) => player.ca !== null);

    if (validPlayers.length === 0) {
      return 0;
    }

    return Math.round(
      validPlayers.reduce((total, player) => total + Number(player.ca || 0), 0) /
        validPlayers.length
    );
  }, [players]);

  const averageAge = useMemo(() => {
    const validPlayers = players.filter((player) => player.age !== null);

    if (validPlayers.length === 0) {
      return 0;
    }

    return Math.round(
      validPlayers.reduce((total, player) => total + Number(player.age || 0), 0) /
        validPlayers.length
    );
  }, [players]);

  const bestPlayer = useMemo(() => {
    if (players.length === 0) {
      return null;
    }

    return [...players].sort((a, b) => {
      const caDifference = Number(b.ca || 0) - Number(a.ca || 0);
      if (caDifference !== 0) {
        return caDifference;
      }

      return Number(b.value || 0) - Number(a.value || 0);
    })[0];
  }, [players]);

  const playerSections = useMemo<PlayerSection[]>(() => {
    const grouped: Record<PositionGroup, Player[]> = {
      goalkeepers: [],
      defenders: [],
      midfielders: [],
      attackers: [],
      others: [],
    };

    players.forEach((player) => {
      grouped[getPositionGroup(player.position)].push(player);
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

    return sections.filter((section) => section.players.length > 0);
  }, [players]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />
          <p className="mt-4 font-semibold text-zinc-400">Carregando clube...</p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <div className="text-6xl">🏟️</div>
          <h1 className="mt-5 text-4xl font-black">Clube não encontrado</h1>
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

        <section className="mt-8 grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
          <div className="rounded-3xl border border-zinc-800 bg-zinc-900 p-7">
            <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div className="flex min-w-0 items-center gap-5">
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

                <div className="min-w-0">
                  <p className="text-xl font-black uppercase tracking-[0.18em] text-green-400">
                    Perfil do clube
                  </p>

                  <h1 className="mt-2 text-5xl font-black leading-none md:text-6xl">
                    {team.name}
                  </h1>

                  <p className="mt-4 text-3xl text-zinc-300">
                    Manager: <span className="font-black text-white">{team.manager_name || "Sem presidente"}</span>
                  </p>
                </div>
              </div>
            </div>
          </div>

          <BestPlayerCard player={bestPlayer} />
        </section>

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
            description={averageAge ? `Idade média: ${averageAge} anos` : "Idade média não disponível"}
            accent="text-green-400"
          />

          <StatCard
            label="Patrimônio esportivo"
            value={money(totalSquadValue + totalStaffValue)}
            description="Elenco e comissão"
            accent="text-green-400"
          />
        </section>

        <section className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-2">
          <a
            href="#elenco"
            className="rounded-2xl border border-blue-700 bg-blue-600 p-6 transition hover:-translate-y-1 hover:bg-blue-500"
          >
            <span className="text-3xl">👥</span>
            <h2 className="mt-4 text-xl font-black">Ver time</h2>
            <p className="mt-2 text-sm text-blue-100">
              Visualizar jogadores do clube.
            </p>
          </a>

          <a
            href="#staff"
            className="rounded-2xl border border-purple-700 bg-purple-600 p-6 transition hover:-translate-y-1 hover:bg-purple-500"
          >
            <span className="text-3xl">📋</span>
            <h2 className="mt-4 text-xl font-black">Comissão técnica</h2>
            <p className="mt-2 text-sm text-purple-100">
              Visualizar os profissionais.
            </p>
          </a>
        </section>

        <section id="elenco" className="mt-16 scroll-mt-24">
          <div>
            <p className="font-bold uppercase tracking-widest text-blue-400">
              Elenco principal
            </p>
            <h2 className="mt-2 text-4xl font-black">Jogadores do clube</h2>
          </div>

          {players.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <div className="text-6xl">⚽</div>
              <h3 className="mt-5 text-3xl font-black">Elenco vazio</h3>
              <p className="mt-3 text-zinc-400">
                Este clube ainda não contratou jogadores.
              </p>
            </div>
          ) : (
            <div className="mt-10 space-y-14">
              {playerSections.map((section) => (
                <section key={section.key}>
                  <div className="mb-6 flex items-center gap-4">
                    <span className="rounded-xl border border-blue-500/30 bg-blue-500/10 px-3 py-2 text-sm font-black text-blue-400">
                      {section.abbreviation}
                    </span>

                    <h3 className="text-3xl font-black">{section.title}</h3>

                    <span className="font-bold text-zinc-500">
                      {section.players.length}
                    </span>
                  </div>

                  <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-2">
                    {section.players.map((player) => (
                      <PlayerCardCompact key={player.id} player={player} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </section>

        <section id="staff" className="mt-16 scroll-mt-24">
          <div>
            <p className="font-bold uppercase tracking-widest text-purple-400">
              Staff
            </p>
            <h2 className="mt-2 text-4xl font-black">Comissão técnica</h2>
          </div>

          {staff.length === 0 ? (
            <div className="mt-7 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <div className="text-6xl">👔</div>
              <h3 className="mt-5 text-3xl font-black">Comissão vazia</h3>
              <p className="mt-3 text-zinc-400">
                Este clube ainda não contratou profissionais.
              </p>
            </div>
          ) : (
            <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-2">
              {staff.map((member) => (
                <StaffCardCompact
                  key={member.id}
                  member={member}
                  onRelease={releaseStaff}
                  releasing={releasingStaffId === member.id}
                  canRelease={Boolean(currentUserId && team.manager_id === currentUserId)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
