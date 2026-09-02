"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Coach = {
  id: number;
  name: string;
  role: string | null;
  nationality: string | null;
  age: number | null;
  ca: number | null;
  pa: number | null;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
  hired_at: string | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
};

type StaffGroup =
  | "manager"
  | "assistant"
  | "technical"
  | "attack"
  | "defense"
  | "fitness"
  | "goalkeeping"
  | "medical"
  | "analysis"
  | "others";

type FilterGroup = "all" | StaffGroup;

type SortOption =
  | "ca-desc"
  | "ca-asc"
  | "pa-desc"
  | "name-asc"
  | "age-asc"
  | "age-desc"
  | "value-desc";

type StaffSection = {
  key: StaffGroup;
  title: string;
  abbreviation: string;
  description: string;
  members: Coach[];
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

  return "Não foi possível carregar a comissão técnica.";
}

function getStaffGroup(role: string | null): StaffGroup {
  const normalized = normalizeText(role);

  if (
    normalized.includes("head coach") ||
    normalized.includes("manager") ||
    normalized === "treinador" ||
    normalized.includes("treinador principal")
  ) {
    return "manager";
  }

  if (
    normalized.includes("assistant") ||
    normalized.includes("assistente")
  ) {
    return "assistant";
  }

  if (
    normalized.includes("technical") ||
    normalized.includes("tecnico") ||
    normalized.includes("técnico")
  ) {
    return "technical";
  }

  if (
    normalized.includes("attack") ||
    normalized.includes("ataque") ||
    normalized.includes("offensive") ||
    normalized.includes("ofensivo")
  ) {
    return "attack";
  }

  if (
    normalized.includes("defense") ||
    normalized.includes("defence") ||
    normalized.includes("defesa") ||
    normalized.includes("defensive") ||
    normalized.includes("defensivo")
  ) {
    return "defense";
  }

  if (
    normalized.includes("fitness") ||
    normalized.includes("physical") ||
    normalized.includes("preparador fisico") ||
    normalized.includes("preparação física") ||
    normalized.includes("preparacao fisica")
  ) {
    return "fitness";
  }

  if (
    normalized.includes("goalkeeper") ||
    normalized.includes("goalkeeping") ||
    normalized.includes("goleiro") ||
    normalized.includes("guarda-redes")
  ) {
    return "goalkeeping";
  }

  if (
    normalized.includes("physio") ||
    normalized.includes("fisioterapeuta") ||
    normalized.includes("doctor") ||
    normalized.includes("medico") ||
    normalized.includes("médico")
  ) {
    return "medical";
  }

  if (
    normalized.includes("analyst") ||
    normalized.includes("analista") ||
    normalized.includes("performance")
  ) {
    return "analysis";
  }

  return "others";
}

function sortStaff(
  members: Coach[],
  sortOption: SortOption
) {
  const sortedMembers = [...members];

  switch (sortOption) {
    case "ca-asc":
      return sortedMembers.sort(
        (first, second) =>
          Number(first.ca || 0) -
          Number(second.ca || 0)
      );

    case "pa-desc":
      return sortedMembers.sort(
        (first, second) =>
          Number(second.pa || 0) -
          Number(first.pa || 0)
      );

    case "name-asc":
      return sortedMembers.sort((first, second) =>
        first.name.localeCompare(second.name, "pt-BR")
      );

    case "age-asc":
      return sortedMembers.sort(
        (first, second) =>
          Number(first.age ?? 999) -
          Number(second.age ?? 999)
      );

    case "age-desc":
      return sortedMembers.sort(
        (first, second) =>
          Number(second.age || 0) -
          Number(first.age || 0)
      );

    case "value-desc":
      return sortedMembers.sort(
        (first, second) =>
          Number(second.value || 0) -
          Number(first.value || 0)
      );

    case "ca-desc":
    default:
      return sortedMembers.sort((first, second) => {
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

function formatDate(value: string | null) {
  if (!value) {
    return "Data não informada";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Data não informada";
  }

  return date.toLocaleDateString("pt-BR");
}

function StaffCard({
  member,
}: {
  member: Coach;
}) {
  return (
    <article className="group overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900 transition duration-200 hover:-translate-y-1 hover:border-purple-500/60">
      <div className="relative h-52 overflow-hidden bg-zinc-800">
        {member.image_url ? (
          <img
            src={member.image_url}
            alt={member.name}
            className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="flex h-full flex-col items-center justify-center">
            <span className="text-6xl">👔</span>

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
            {member.ca ?? "-"}
          </p>
        </div>
      </div>

      <div className="p-5">
        <p className="font-bold text-purple-400">
          {member.role || "Comissão técnica"}
        </p>

        <h3 className="mt-1 break-words text-2xl font-black leading-tight">
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

        <div className="mt-5 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-4">
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

        <p className="mt-4 text-xs text-zinc-600">
          Contratado em {formatDate(member.hired_at)}
        </p>
      </div>
    </article>
  );
}

export default function StaffPage() {
  const [team, setTeam] =
    useState<Team | null>(null);

  const [staff, setStaff] =
    useState<Coach[]>([]);

  const [searchTerm, setSearchTerm] =
    useState("");

  const [selectedGroup, setSelectedGroup] =
    useState<FilterGroup>("all");

  const [sortOption, setSortOption] =
    useState<SortOption>("ca-desc");

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadStaff = useCallback(async () => {
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
        setStaff([]);
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
        setStaff([]);
        return;
      }

      const loadedTeam = teamData as Team;

      setTeam(loadedTeam);

      const {
        data: staffData,
        error: staffError,
      } = await supabase
        .from("coaches")
        .select(`
          id,
          name,
          role,
          nationality,
          age,
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
        });

      if (staffError) {
        throw staffError;
      }

      setStaff(
        (staffData || []) as Coach[]
      );
    } catch (error) {
      console.error(
        "Erro ao carregar comissão técnica:",
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
    loadStaff();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(() => {
      loadStaff();
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [loadStaff]);

  useEffect(() => {
    if (!team?.id) {
      return;
    }

    const channel = supabase
      .channel(`staff-${team.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaches",
          filter: `team_id=eq.${team.id}`,
        },
        () => {
          loadStaff();
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
          loadStaff();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [team?.id, loadStaff]);

  const totalValue = useMemo(
    () =>
      staff.reduce(
        (total, member) =>
          total + Number(member.value || 0),
        0
      ),
    [staff]
  );

  const averageCa = useMemo(() => {
    const validMembers = staff.filter(
      (member) => member.ca !== null
    );

    if (validMembers.length === 0) {
      return 0;
    }

    const totalCa = validMembers.reduce(
      (total, member) =>
        total + Number(member.ca || 0),
      0
    );

    return Math.round(
      totalCa / validMembers.length
    );
  }, [staff]);

  const averagePa = useMemo(() => {
    const validMembers = staff.filter(
      (member) => member.pa !== null
    );

    if (validMembers.length === 0) {
      return 0;
    }

    const totalPa = validMembers.reduce(
      (total, member) =>
        total + Number(member.pa || 0),
      0
    );

    return Math.round(
      totalPa / validMembers.length
    );
  }, [staff]);

  const groupCounts = useMemo(() => {
    const counts: Record<StaffGroup, number> = {
      manager: 0,
      assistant: 0,
      technical: 0,
      attack: 0,
      defense: 0,
      fitness: 0,
      goalkeeping: 0,
      medical: 0,
      analysis: 0,
      others: 0,
    };

    staff.forEach((member) => {
      const group = getStaffGroup(member.role);
      counts[group] += 1;
    });

    return counts;
  }, [staff]);

  const filteredStaff = useMemo(() => {
    const normalizedSearch =
      normalizeText(searchTerm);

    const filtered = staff.filter((member) => {
      const matchesGroup =
        selectedGroup === "all" ||
        getStaffGroup(member.role) ===
          selectedGroup;

      if (!matchesGroup) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const searchableText = normalizeText(
        [
          member.name,
          member.role,
          member.nationality,
          member.age?.toString(),
          member.ca?.toString(),
          member.pa?.toString(),
        ]
          .filter(Boolean)
          .join(" ")
      );

      return searchableText.includes(
        normalizedSearch
      );
    });

    return sortStaff(filtered, sortOption);
  }, [
    staff,
    searchTerm,
    selectedGroup,
    sortOption,
  ]);

  const sections = useMemo<StaffSection[]>(() => {
    const grouped: Record<
      StaffGroup,
      Coach[]
    > = {
      manager: [],
      assistant: [],
      technical: [],
      attack: [],
      defense: [],
      fitness: [],
      goalkeeping: [],
      medical: [],
      analysis: [],
      others: [],
    };

    filteredStaff.forEach((member) => {
      const group = getStaffGroup(member.role);
      grouped[group].push(member);
    });

    const allSections: StaffSection[] = [
      {
        key: "manager",
        title: "Treinadores",
        abbreviation: "TEC",
        description:
          "Treinadores principais responsáveis pelo time.",
        members: grouped.manager,
      },
      {
        key: "assistant",
        title: "Assistentes",
        abbreviation: "ASS",
        description:
          "Assistentes dos treinadores principais.",
        members: grouped.assistant,
      },
      {
        key: "technical",
        title: "Treinadores técnicos",
        abbreviation: "TÉC",
        description:
          "Profissionais responsáveis pelo desenvolvimento técnico.",
        members: grouped.technical,
      },
      {
        key: "attack",
        title: "Treinadores de ataque",
        abbreviation: "ATA",
        description:
          "Especialistas no desenvolvimento ofensivo.",
        members: grouped.attack,
      },
      {
        key: "defense",
        title: "Treinadores de defesa",
        abbreviation: "DEF",
        description:
          "Especialistas na organização defensiva.",
        members: grouped.defense,
      },
      {
        key: "fitness",
        title: "Preparadores físicos",
        abbreviation: "FIS",
        description:
          "Responsáveis pelo condicionamento físico.",
        members: grouped.fitness,
      },
      {
        key: "goalkeeping",
        title: "Treinadores de goleiros",
        abbreviation: "GK",
        description:
          "Especialistas no treinamento dos goleiros.",
        members: grouped.goalkeeping,
      },
      {
        key: "medical",
        title: "Departamento médico",
        abbreviation: "MED",
        description:
          "Fisioterapeutas e profissionais médicos.",
        members: grouped.medical,
      },
      {
        key: "analysis",
        title: "Analistas",
        abbreviation: "ANA",
        description:
          "Analistas de desempenho e observação.",
        members: grouped.analysis,
      },
      {
        key: "others",
        title: "Outros profissionais",
        abbreviation: "OUT",
        description:
          "Profissionais ainda sem categoria definida.",
        members: grouped.others,
      },
    ];

    return allSections.filter(
      (section) => section.members.length > 0
    );
  }, [filteredStaff]);

  const mainFilters: Array<{
    key: FilterGroup;
    label: string;
    count: number;
  }> = [
    {
      key: "all",
      label: "Todos",
      count: staff.length,
    },
    {
      key: "manager",
      label: "Treinadores",
      count: groupCounts.manager,
    },
    {
      key: "assistant",
      label: "Assistentes",
      count: groupCounts.assistant,
    },
    {
      key: "fitness",
      label: "Preparadores físicos",
      count: groupCounts.fitness,
    },
    {
      key: "medical",
      label: "Departamento médico",
      count: groupCounts.medical,
    },
  ];

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-zinc-700 border-t-green-400" />

          <p className="mt-4 font-semibold text-zinc-400">
            Carregando comissão técnica...
          </p>
        </div>
      </main>
    );
  }

  if (!team) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-white">
        <div className="w-full max-w-2xl rounded-3xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-purple-500/10 text-4xl">
            👔
          </div>

          <p className="mt-6 font-bold uppercase tracking-widest text-purple-400">
            Comissão técnica
          </p>

          <h1 className="mt-3 text-4xl font-black">
            Você ainda não possui um clube
          </h1>

          <p className="mt-4 text-zinc-400">
            Escolha um clube para começar a montar sua comissão técnica.
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
          <p className="font-bold uppercase tracking-widest text-purple-400">
            FriendZone League FM
          </p>

          <div className="mt-2 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-5xl font-black md:text-6xl">
                Comissão técnica
              </h1>

              <p className="mt-3 text-lg text-zinc-400">
                Profissionais contratados pelo{" "}
                <span className="font-bold text-white">
                  {team.name}
                </span>
                .
              </p>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/staff-auctions"
                className="rounded-xl bg-green-600 px-6 py-3 text-center font-black transition hover:bg-green-500"
              >
                Buscar profissionais
              </Link>

              <Link
                href="/history"
                className="rounded-xl border border-zinc-700 bg-zinc-900 px-6 py-3 text-center font-black transition hover:border-purple-500 hover:text-purple-400"
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
              Profissionais
            </p>

            <p className="mt-3 text-4xl font-black">
              {staff.length}
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
              PA médio
            </p>

            <p className="mt-3 text-4xl font-black text-purple-400">
              {averagePa || "-"}
            </p>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <p className="text-sm font-bold uppercase tracking-wider text-zinc-500">
              Valor da comissão
            </p>

            <p className="mt-3 text-2xl font-black text-green-400">
              {money(totalValue)}
            </p>
          </div>
        </section>

        <section className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {mainFilters.map((filter) => (
            <button
              key={filter.key}
              type="button"
              onClick={() =>
                setSelectedGroup(filter.key)
              }
              className={`rounded-2xl border p-5 text-left transition ${
                selectedGroup === filter.key
                  ? "border-purple-500 bg-purple-500/10"
                  : "border-zinc-800 bg-zinc-900 hover:border-zinc-700"
              }`}
            >
              <p className="text-xs font-black uppercase tracking-wider text-zinc-500">
                {filter.label}
              </p>

              <p className="mt-2 text-3xl font-black">
                {filter.count}
              </p>
            </button>
          ))}
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end">
            <div className="flex-1">
              <label
                htmlFor="staff-search"
                className="mb-2 block text-sm font-bold text-zinc-400"
              >
                Buscar profissional
              </label>

              <input
                id="staff-search"
                type="text"
                value={searchTerm}
                onChange={(event) =>
                  setSearchTerm(event.target.value)
                }
                placeholder="Nome, função, nacionalidade, idade, CA ou PA"
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition placeholder:text-zinc-600 focus:border-purple-500"
              />
            </div>

            <div className="lg:w-72">
              <label
                htmlFor="staff-group"
                className="mb-2 block text-sm font-bold text-zinc-400"
              >
                Categoria
              </label>

              <select
                id="staff-group"
                value={selectedGroup}
                onChange={(event) =>
                  setSelectedGroup(
                    event.target.value as FilterGroup
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-purple-500"
              >
                <option value="all">
                  Todos
                </option>

                <option value="manager">
                  Treinadores
                </option>

                <option value="assistant">
                  Assistentes
                </option>

                <option value="technical">
                  Treinadores técnicos
                </option>

                <option value="attack">
                  Treinadores de ataque
                </option>

                <option value="defense">
                  Treinadores de defesa
                </option>

                <option value="fitness">
                  Preparadores físicos
                </option>

                <option value="goalkeeping">
                  Treinadores de goleiros
                </option>

                <option value="medical">
                  Departamento médico
                </option>

                <option value="analysis">
                  Analistas
                </option>

                <option value="others">
                  Outros
                </option>
              </select>
            </div>

            <div className="lg:w-64">
              <label
                htmlFor="staff-sort"
                className="mb-2 block text-sm font-bold text-zinc-400"
              >
                Ordenar por
              </label>

              <select
                id="staff-sort"
                value={sortOption}
                onChange={(event) =>
                  setSortOption(
                    event.target.value as SortOption
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none transition focus:border-purple-500"
              >
                <option value="ca-desc">
                  Maior CA
                </option>

                <option value="ca-asc">
                  Menor CA
                </option>

                <option value="pa-desc">
                  Maior PA
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
            {filteredStaff.length} profissional
            {filteredStaff.length === 1
              ? ""
              : "is"}{" "}
            encontrado
            {filteredStaff.length === 1
              ? ""
              : "s"}
            .
          </p>
        </section>

        {staff.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center md:p-14">
            <div className="text-6xl">👔</div>

            <h2 className="mt-5 text-3xl font-black">
              Comissão vazia
            </h2>

            <p className="mt-3 text-zinc-400">
              Seu clube ainda não contratou nenhum profissional.
            </p>

            <Link
              href="/staff-auctions"
              className="mt-7 inline-block rounded-xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500"
            >
              Participar dos leilões
            </Link>
          </section>
        ) : filteredStaff.length === 0 ? (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
            <div className="text-5xl">🔎</div>

            <h2 className="mt-5 text-3xl font-black">
              Nenhum profissional encontrado
            </h2>

            <p className="mt-3 text-zinc-400">
              Altere a busca ou selecione outra categoria.
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
                    <span className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-2 text-sm font-black text-purple-400">
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
                    {section.members.length} profissional
                    {section.members.length === 1
                      ? ""
                      : "is"}
                  </span>
                </div>

                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {section.members.map((member) => (
                    <StaffCard
                      key={member.id}
                      member={member}
                    />
                  ))}
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
                Saldo atual para jogadores e novos profissionais.
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