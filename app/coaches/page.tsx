"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Coach = {
  id: number;
  unique_id: string | null;
  name: string;
  age: number | null;
  nationality: string | null;
  role: string | null;
  ca: number | null;
  cp: number | null;
  preferred_formation: string | null;
  value: number | null;
  team_id: number | null;
};

type Team = {
  id: number;
  name: string;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
};

const PAGE_SIZE = 50;

const STAFF_ROLES = [
  "Treinador",
  "Adjunto",
  "Preparador",
  "Preparador físico",
  "Treinador de goleiros",
  "Fisioterapeuta",
  "Analista",
];

function cleanSearch(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[,%_()]/g, " ")
    .replace(/\s+/g, " ");
}

function formatMoney(value: number | null) {
  if (value === null || value === undefined) return "R$ 0,00";

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function getCAColor(ca: number | null) {
  if (!ca) return "text-zinc-300";
  if (ca >= 170) return "text-emerald-400";
  if (ca >= 150) return "text-lime-400";
  if (ca >= 130) return "text-yellow-300";
  return "text-zinc-200";
}

export default function CoachesPage() {
  const [coaches, setCoaches] = useState<Coach[]>([]);
  const [myTeam, setMyTeam] = useState<Team | null>(null);

  const [cartIds, setCartIds] = useState<Set<number>>(new Set());
  const [cartLoadingId, setCartLoadingId] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const [cartMessage, setCartMessage] = useState("");

  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [minCA, setMinCA] = useState("");
  const [maxCA, setMaxCA] = useState("");
  const [minCP, setMinCP] = useState("");
  const [maxCP, setMaxCP] = useState("");

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [currentWindow, setCurrentWindow] = useState<TransferWindow | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(cleanSearch(search));
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const resolveMyTeam = useCallback(async (): Promise<Team | null> => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return null;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("manager_id", user.id)
      .limit(1)
      .maybeSingle();

    if (teamError || !teamData) {
      if (teamError) {
        console.error("Erro ao identificar clube:", teamError);
      }
      return null;
    }

    const team = teamData as Team;
    setMyTeam(team);
    return team;
  }, []);

  const loadCart = useCallback(async () => {
    const team = await resolveMyTeam();

    if (!team) {
      setMyTeam(null);
      setCartIds(new Set());
      return;
    }

    const { data, error } = await supabase
      .from("staff_shopping_list")
      .select("coach_id")
      .eq("team_id", team.id);

    if (error) {
      console.error("Erro ao carregar lista de staff:", error);
      setCartIds(new Set());
      return;
    }

    setCartIds(
      new Set((data || []).map((row: any) => Number(row.coach_id)))
    );
  }, [resolveMyTeam]);

  const loadTransferWindow = useCallback(async () => {
    const { data, error } = await supabase
      .from("transfer_windows")
      .select(`
        id,
        window_number,
        name,
        status
      `)
      .eq("status", "open")
      .order("window_number", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error("Erro ao carregar janela:", error);
      setCurrentWindow(null);
      return;
    }

    setCurrentWindow(
      data ? (data as TransferWindow) : null
    );
  }, []);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("coaches")
      .select(
        `
        id,
        unique_id,
        name,
        age,
        nationality,
        role,
        ca,
        cp,
        preferred_formation,
        value,
        value,
        team_id
        `,
        {
          count: "exact",
        }
      )
      .is("team_id", null);

    if (roleFilter !== "all") {
      query = query.eq("role", roleFilter);
    }

    if (debouncedSearch) {
      query = query.ilike(
        "search_text",
        `%${debouncedSearch}%`
      );
    }

    if (minCA) {
      query = query.gte("ca", Number(minCA));
    }

    if (maxCA) {
      query = query.lte("ca", Number(maxCA));
    }

    if (minCP) {
      query = query.gte("cp", Number(minCP));
    }

    if (maxCP) {
      query = query.lte("cp", Number(maxCP));
    }

    const { data, error, count } = await query
      .order("ca", {
        ascending: false,
        nullsFirst: false,
      })
      .order("cp", {
        ascending: false,
        nullsFirst: false,
      })
      .order("name", {
        ascending: true,
      })
      .range(from, to);

    if (error) {
      console.error("Erro ao carregar staffs:", error);
      setErrorMessage(error.message);
      setCoaches([]);
      setTotal(0);
    } else {
      setCoaches((data || []) as Coach[]);
      setTotal(count || 0);
    }

    setLoading(false);
  }, [
    page,
    roleFilter,
    debouncedSearch,
    minCA,
    maxCA,
    minCP,
    maxCP,
  ]);

  useEffect(() => {
    loadTransferWindow();
    loadCoaches();
  }, [loadTransferWindow, loadCoaches]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    const channel = supabase
      .channel("coaches-market")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "coaches",
        },
        () => loadCoaches()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadCoaches]);

  useEffect(() => {
    const channel = supabase
      .channel("coaches-transfer-window")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfer_windows",
        },
        () => loadTransferWindow()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadTransferWindow]);

  useEffect(() => {
    if (!myTeam) return;

    const channel = supabase
      .channel(`staff-cart-${myTeam.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_shopping_list",
          filter: `team_id=eq.${myTeam.id}`,
        },
        loadCart
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myTeam, loadCart]);

  async function toggleCart(coach: Coach) {
    const team = myTeam ?? (await resolveMyTeam());

    if (!team) {
      setCartMessage(
        "Não foi possível identificar seu clube. Atualize a página ou confirme se sua conta está vinculada a um time."
      );
      return;
    }

    setCartLoadingId(coach.id);
    setCartMessage("");

    const isInCart = cartIds.has(coach.id);

    if (isInCart) {
      const { error } = await supabase
        .from("staff_shopping_list")
        .delete()
        .eq("team_id", team.id)
        .eq("coach_id", coach.id);

      if (error) {
        setCartMessage("Não foi possível remover o treinador da lista.");
        setCartLoadingId(null);
        return;
      }

      setCartIds((current) => {
        const next = new Set(current);
        next.delete(coach.id);
        return next;
      });

      setCartMessage(`${coach.name} foi removido da sua lista.`);
    } else {
      const { error } = await supabase
        .from("staff_shopping_list")
        .insert({
          team_id: team.id,
          coach_id: coach.id,
        });

      if (error) {
        if (error.code === "23505") {
          await loadCart();
          setCartMessage(`${coach.name} já está na sua lista.`);
        } else {
          setCartMessage("Não foi possível adicionar o treinador à lista.");
        }

        setCartLoadingId(null);
        return;
      }

      setCartIds((current) => {
        const next = new Set(current);
        next.add(coach.id);
        return next;
      });

      setCartMessage(`${coach.name} foi adicionado à sua lista.`);
    }

    setCartLoadingId(null);
  }

  function handleSearch() {
    setPage(1);
    loadCoaches();
  }

  function clearFilters() {
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setMinCA("");
    setMaxCA("");
    setMinCP("");
    setMaxCP("");
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const marketOpen =
    Boolean(
      currentWindow
    );

  const pageNumbers = useMemo(() => {
    const first = Math.max(1, page - 2);
    const last = Math.min(totalPages, first + 4);
    const adjustedFirst = Math.max(1, last - 4);

    return Array.from(
      { length: last - adjustedFirst + 1 },
      (_, index) => adjustedFirst + index
    );
  }, [page, totalPages]);

  return (
    <main className="min-h-screen bg-zinc-950 px-3 py-6 text-white sm:px-4 md:px-6 lg:px-8">
      <div className="mx-auto max-w-[1800px]">
        <div className="mb-6">
          <p className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
            FriendZone League FM
          </p>

          <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-black sm:text-4xl">
                Comissão Técnica
              </h1>

              <p className="mt-2 text-sm text-zinc-400">
                Treinadores disponíveis organizados pelo maior CA.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-400">
                {total.toLocaleString("pt-BR")} treinadores
              </div>

              <Link
                href="/staff-shopping-list"
                className="rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2 text-sm font-black text-zinc-200 transition hover:border-green-500/40 hover:text-green-300"
              >
                🛒 Lista ({cartIds.size})
              </Link>
            </div>
          </div>
        </div>

        {errorMessage && (
          <div className="mb-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {errorMessage}
          </div>
        )}

        {cartMessage && (
          <div className="mb-5 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-sm text-green-300">
            {cartMessage}
          </div>
        )}

        {/* FILTROS */}
        <div className="mb-6 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") handleSearch();
              }}
              placeholder="Nome, nacionalidade ou tática"
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500 sm:col-span-2"
            />

            <select
              value={roleFilter}
              onChange={(event) => {
                setRoleFilter(event.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-green-500"
            >
              <option value="all">Todas as funções</option>

              {STAFF_ROLES.map((role) => (
                <option key={role} value={role}>
                  {role}
                </option>
              ))}
            </select>

            <input
              type="number"
              placeholder="CA mínimo"
              value={minCA}
              onChange={(event) => setMinCA(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CA máximo"
              value={maxCA}
              onChange={(event) => setMaxCA(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CP mínimo"
              value={minCP}
              onChange={(event) => setMinCP(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CP máximo"
              value={maxCP}
              onChange={(event) => setMaxCP(event.target.value)}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />
          </div>

          <div className="mt-3 flex gap-2">
            <button
              type="button"
              onClick={handleSearch}
              className="rounded-lg bg-green-700 px-5 py-2 text-sm font-black text-white hover:bg-green-600"
            >
              Buscar
            </button>

            <button
              type="button"
              onClick={clearFilters}
              className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-black text-zinc-200 hover:bg-zinc-700"
            >
              Limpar
            </button>
          </div>
        </div>

        {/* CARDS */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
            Carregando treinadores...
          </div>
        ) : coaches.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
            Nenhum treinador encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {coaches.map((coach) => {
              const isInCart = cartIds.has(coach.id);

              return (
                <div
                  key={coach.id}
                  className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-md"
                >
                  {/* ID */}
                  <div className="mb-3 text-[12px] font-bold text-zinc-400">
                    ID do treinador -{" "}
                    <span className="font-black text-zinc-200">
                      {coach.unique_id || coach.id}
                    </span>
                  </div>

                  <Link href={`/coaches/${coach.id}`} className="block">
                    {/* NOME */}
                    <div className="mt-4 text-[14px] font-black text-white group-hover:text-green-300">
                      {coach.name} - {coach.age ?? "-"} anos
                    </div>

                    {/* FUNÇÃO */}
                    <div className="mt-3 text-[13px] font-black text-green-400">
                      {coach.role || "Treinador"}
                    </div>

                    {/* CA */}
                    <div className="mt-3 text-sm font-black text-zinc-200">
                      CA -{" "}
                      <span className={getCAColor(coach.ca)}>
                        {coach.ca ?? "-"}
                      </span>
                    </div>

                    {/* CP */}
                    <div className="mt-2 text-sm font-black text-zinc-200">
                      CP -{" "}
                      <span className="text-sky-400">
                        {coach.cp ?? "-"}
                      </span>
                    </div>

                    {/* TÁTICA PREFERIDA */}
                    <div className="mt-3 text-[13px] font-semibold text-zinc-200">
                      Tática preferida
                    </div>

                    <div className="mt-1 min-h-[38px] text-[13px] font-medium text-zinc-400">
                      {coach.preferred_formation?.trim() || "Não informada"}
                    </div>

                    {/* NACIONALIDADE */}
                    <div className="mt-3 text-[13px] font-semibold text-zinc-200">
                      Nacionalidade
                    </div>

                    <div className="mt-1 text-[13px] font-medium text-zinc-400">
                      {coach.nationality || "-"}
                    </div>
                  </Link>

                  {/* BOTÃO DE LANCE */}
                  {marketOpen ? (
                    <Link
                      href={`/coaches/${coach.id}`}
                      className="mt-4 block w-full rounded-lg bg-green-600 px-3 py-2 text-center text-[12px] font-black text-white transition hover:bg-green-500"
                    >
                      DAR LANCE —{" "}
                      {formatMoney(
                        coach.value
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

                  {/* LISTA */}
                  <button
                    type="button"
                    disabled={cartLoadingId === coach.id}
                    onClick={() => toggleCart(coach)}
                    className={`mt-2 w-full rounded-lg px-3 py-2 text-[12px] font-black transition disabled:cursor-not-allowed disabled:opacity-50 ${
                      isInCart
                        ? "border border-green-500/40 bg-green-500/10 text-green-300 hover:bg-green-500/20"
                        : "border border-zinc-700 bg-zinc-950 text-zinc-200 hover:border-green-500/40 hover:text-green-300"
                    }`}
                  >
                    {cartLoadingId === coach.id
                      ? "SALVANDO..."
                      : isInCart
                      ? "✓ NA LISTA — REMOVER"
                      : "🛒 ADICIONAR À LISTA"}
                  </button>

                  {/* VALOR */}
                  <div className="mt-4 border-t border-zinc-800 pt-3">
                    <div className="text-[12px] font-black uppercase text-red-400">
                      VALOR
                    </div>

                    <div className="mt-1 text-[13px] font-medium text-red-300">
                      {formatMoney(coach.value)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* PAGINAÇÃO */}
        <div className="mt-6 flex items-center justify-between rounded-2xl border border-zinc-800 bg-zinc-900 p-3 shadow-lg">
          <button
            type="button"
            disabled={page === 1 || loading}
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            Anterior
          </button>

          <div className="hidden items-center gap-2 md:flex">
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`min-w-10 rounded-lg px-3 py-2 text-sm font-black ${
                  pageNumber === page
                    ? "bg-green-600 text-white"
                    : "bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                }`}
              >
                {pageNumber}
              </button>
            ))}
          </div>

          <div className="text-sm font-semibold text-zinc-400 md:hidden">
            Página{" "}
            <span className="font-black text-white">{page}</span> de{" "}
            <span className="font-black text-white">{totalPages}</span>
          </div>

          <button
            type="button"
            disabled={page >= totalPages || loading}
            onClick={() => setPage((current) => current + 1)}
            className="rounded-lg bg-zinc-800 px-5 py-2 text-sm font-bold text-zinc-200 hover:bg-zinc-700 disabled:opacity-40"
          >
            Próxima
          </button>
        </div>
      </div>
    </main>
  );
}
