"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { STAFF_ATTRIBUTE_GROUPS } from "@/app/components/StaffAttributes";

type Coach = {
  id: number;
  unique_id: string | null;
  name: string;
  age: number | null;
  nationality: string | null;
  role: string | null;
  ca: number | null;
  cp: number | null;
  attributes: Record<string, number | null> | null;
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
const STAFF_HIGHLIGHTS: Record<string, string[]> = {
  "Treinador": ["Conhecimento Tático", "Motivação", "Gestão de Pessoas"],
  "Treinador Adjunto Principal": ["Conhecimento Tático", "Treino Tático", "Motivação"],
  "Preparador": ["Treino Ataque", "Treino Defesa", "Treino Técnico"],
  "Preparador Físico": ["Treino Físico", "Motivação", "Trabalho c/ Jovens"],
  "Treinador de Goleiros": ["Treino Guarda-Redes", "GR Manejo*", "GR Distribuição*"],
  "Fisioterapeuta": ["Fisioterapia", "Ciência Desportiva", "Profissionalismo"],
  "Preparador de Bolas Paradas": ["Treino Bolas Paradas", "Conhecimento Tático", "Treino Tático"],
  "Analista de Desempenho": ["Análise de Dados", "Avaliar Capacidade", "Avaliar Potencial"],
  "Cientista Desportivo": ["Ciência Desportiva", "Treino Físico", "Profissionalismo"],
};
const FORMATIONS = ["3-4-2-1", "4-2-2-2", "4-2-3-1", "4-2-4", "4-3-3", "4-4-2", "5-2-1-2", "5-2-2-1", "5-2-3", "5-3-2"];
const ATTRIBUTE_KEYS = new Set<string>(STAFF_ATTRIBUTE_GROUPS.flatMap(({ keys }) => [...keys]));
const ATTRIBUTE_SCORES = Array.from({ length: 20 }, (_, index) => index + 1);
const SORT_OPTIONS = [
  { value: "ca", label: "Maior CA", column: "ca", ascending: false },
  { value: "cp", label: "Maior CP", column: "cp", ascending: false },
  { value: "price", label: "Menor valor", column: "value", ascending: true },
  { value: "age", label: "Mais jovens", column: "age", ascending: true },
];
const FILTER_FIELD = "w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-green-500";

type AttributeFilter = { key: string; min: number };

const STAFF_MARKET_STATE_KEY = "friendzone-staff-market-state";
const STAFF_MARKET_RETURN_KEY = "friendzone-staff-market-return";

type StaffMarketState = {
  search: string;
  debouncedSearch: string;
  roleFilter: string;
  minCA: string;
  maxCA: string;
  minCP: string;
  maxCP: string;
  formation: string;
  maxValue: string;
  sort: string;
  attributeFilters: AttributeFilter[];
  page: number;
  scrollY: number;
  focusedCoachId?: number;
  focusedOffsetY?: number;
};

const STAFF_ROLES = [
  "Treinador",
  "Treinador Adjunto Principal",
  "Preparador",
  "Preparador Físico",
  "Treinador de Goleiros",
  "Fisioterapeuta",
  "Preparador de Bolas Paradas",
  "Analista de Desempenho",
  "Cientista Desportivo",
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

  const [formation, setFormation] = useState("");
  const [maxValue, setMaxValue] = useState("");
  const [sort, setSort] = useState("ca");
  const [attributeFilters, setAttributeFilters] = useState<AttributeFilter[]>([]);
  const latestRequest = useRef(0);

  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [currentWindow, setCurrentWindow] = useState<TransferWindow | null>(null);

  const [marketStateReady, setMarketStateReady] = useState(false);
  const restoreScrollYRef = useRef(0);
  const shouldRestoreScrollRef = useRef(false);
  const restoreFocusRef = useRef<{ id: number; offsetY: number } | null>(null);
  const leavingForProfileRef = useRef(false);
  const restoreScrollDoneRef = useRef(false);
  const skipNextSearchResetRef = useRef(false);
  const skipNextStateSaveRef = useRef(true);

  const saveMarketState = useCallback((focusedCoachId?: number) => {
    if (
      typeof window === "undefined" ||
      !marketStateReady ||
      !restoreScrollDoneRef.current ||
      (leavingForProfileRef.current && focusedCoachId === undefined)
    ) {
      return;
    }
    if (focusedCoachId !== undefined) {
      leavingForProfileRef.current = true;
    }
    const focusedCard = focusedCoachId !== undefined
      ? document.getElementById(`market-coach-${focusedCoachId}`)
      : null;

    const state: StaffMarketState = {
      search,
      debouncedSearch,
      roleFilter,
      minCA,
      maxCA,
      minCP,
      maxCP,
      formation,
      maxValue,
      sort,
      attributeFilters,
      page,
      scrollY: window.scrollY,
      ...(focusedCard && focusedCoachId !== undefined
        ? {
            focusedCoachId,
            focusedOffsetY: focusedCard.getBoundingClientRect().top,
          }
        : {}),
    };

    const serialized = JSON.stringify(state);

    sessionStorage.setItem(
      STAFF_MARKET_STATE_KEY,
      serialized
    );

    localStorage.setItem(
      STAFF_MARKET_STATE_KEY,
      serialized
    );
  }, [
    marketStateReady,
    search,
    debouncedSearch,
    roleFilter,
    minCA,
    maxCA,
    minCP,
    maxCP,
    formation,
    maxValue,
    sort,
    attributeFilters,
    page,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      shouldRestoreScrollRef.current =
        sessionStorage.getItem(STAFF_MARKET_RETURN_KEY) === "1";
      const raw =
        sessionStorage.getItem(STAFF_MARKET_STATE_KEY) ||
        localStorage.getItem(STAFF_MARKET_STATE_KEY);

      if (raw) {
        const saved = JSON.parse(raw) as Partial<StaffMarketState>;

        if (typeof saved.search === "string") {
          setSearch(saved.search);
          setDebouncedSearch(
            typeof saved.debouncedSearch === "string"
              ? saved.debouncedSearch
              : cleanSearch(saved.search)
          );
          skipNextSearchResetRef.current = true;
        }
        if (typeof saved.roleFilter === "string") {
          setRoleFilter(saved.roleFilter);
        }
        if (typeof saved.minCA === "string") setMinCA(saved.minCA);
        if (typeof saved.maxCA === "string") setMaxCA(saved.maxCA);
        if (typeof saved.minCP === "string") setMinCP(saved.minCP);
        if (typeof saved.maxCP === "string") setMaxCP(saved.maxCP);
        if (typeof saved.formation === "string" && FORMATIONS.includes(saved.formation)) {
          setFormation(saved.formation);
        }
        if (typeof saved.maxValue === "string" && /^\d+(\.\d+)?$/.test(saved.maxValue)) {
          setMaxValue(saved.maxValue);
        }
        if (typeof saved.sort === "string" && SORT_OPTIONS.some(({ value }) => value === saved.sort)) {
          setSort(saved.sort);
        }
        if (Array.isArray(saved.attributeFilters)) {
          setAttributeFilters(saved.attributeFilters.filter(
            (filter) => filter && (!filter.key || ATTRIBUTE_KEYS.has(filter.key)) && ATTRIBUTE_SCORES.includes(filter.min)
          ).slice(0, 3));
        }
        if (
          typeof saved.page === "number" &&
          Number.isFinite(saved.page) &&
          saved.page > 0
        ) {
          setPage(saved.page);
        }
        if (
          typeof saved.scrollY === "number" &&
          Number.isFinite(saved.scrollY)
        ) {
          restoreScrollYRef.current = saved.scrollY;
        }
        if (
          typeof saved.focusedCoachId === "number" &&
          typeof saved.focusedOffsetY === "number" &&
          Number.isFinite(saved.focusedOffsetY)
        ) {
          restoreFocusRef.current = {
            id: saved.focusedCoachId,
            offsetY: saved.focusedOffsetY,
          };
        }
      }
    } catch (error) {
      console.error(
        "Erro ao restaurar estado do mercado de staff:",
        error
      );
    } finally {
      skipNextStateSaveRef.current = true;
      setMarketStateReady(true);
    }
  }, []);

  useEffect(() => {
    if (!marketStateReady || typeof window === "undefined") {
      return;
    }

    const handleScroll = () => {
      saveMarketState();
    };

    const handlePageHide = () => {
      saveMarketState();
    };

    if (skipNextStateSaveRef.current) {
      skipNextStateSaveRef.current = false;
    } else {
      saveMarketState();
    }

    window.addEventListener("scroll", handleScroll, { passive: true });
    window.addEventListener("pagehide", handlePageHide);

    return () => {
      window.removeEventListener("scroll", handleScroll);
      window.removeEventListener("pagehide", handlePageHide);
    };
  }, [marketStateReady, saveMarketState]);

  useEffect(() => {
    if (
      !marketStateReady ||
      loading ||
      restoreScrollDoneRef.current ||
      typeof window === "undefined"
    ) {
      return;
    }

    if (!shouldRestoreScrollRef.current) {
      restoreScrollDoneRef.current = true;
      return;
    }
    const targetY = Math.max(0, restoreScrollYRef.current);
    let frame = 0;
    let attempts = 0;

    const restorePosition = () => {
      const maxY = Math.max(
        0,
        document.documentElement.scrollHeight - window.innerHeight
      );
      const focus = restoreFocusRef.current;
      const card = focus
        ? document.getElementById(`market-coach-${focus.id}`)
        : null;

      // Espera a lista e a paginação carregarem antes de restaurar a tela.
      if (!card && maxY < targetY && attempts < 120) {
        attempts += 1;
        frame = window.requestAnimationFrame(restorePosition);
        return;
      }

      const cardY = card && focus
        ? window.scrollY + card.getBoundingClientRect().top - focus.offsetY
        : targetY;
      window.scrollTo({
        top: Math.min(Math.max(0, cardY), maxY),
        behavior: "instant",
      });
      restoreScrollDoneRef.current = true;
      shouldRestoreScrollRef.current = false;
      sessionStorage.removeItem(STAFF_MARKET_RETURN_KEY);
    };

    frame = window.requestAnimationFrame(() => {
      frame = window.requestAnimationFrame(restorePosition);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [marketStateReady, loading, coaches.length]);

  useEffect(() => {
    if (!marketStateReady) {
      return;
    }

    const timer = window.setTimeout(() => {
      setDebouncedSearch(cleanSearch(search));

      if (skipNextSearchResetRef.current) {
        skipNextSearchResetRef.current = false;
      } else {
        setPage(1);
      }
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search, marketStateReady]);

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
    const request = ++latestRequest.current;
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
        attributes,
        preferred_formation,
        value,
        team_id
        `,
        {
          count: "exact",
        }
      )
      .is("team_id", null)
      .eq("market_active", true);

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

    if (formation) {
      query = query.ilike("preferred_formation", `${formation}%`);
    }

    if (maxValue !== "" && Number.isFinite(Number(maxValue)) && Number(maxValue) >= 0) {
      query = query.lte("value", Number(maxValue));
    }

    for (const { key, min } of attributeFilters) {
      if (key) {
        query = query.in(`attributes->>"${key}"`, ATTRIBUTE_SCORES.slice(min - 1));
      }
    }

    const ordering = SORT_OPTIONS.find(({ value }) => value === sort) ?? SORT_OPTIONS[0];
    const { data, error, count } = await query
      .order(ordering.column, { ascending: ordering.ascending, nullsFirst: false })
      .order(ordering.column === "cp" ? "ca" : "cp", { ascending: false, nullsFirst: false })
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .range(from, to);

    if (request !== latestRequest.current) return;

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
    formation,
    maxValue,
    sort,
    attributeFilters,
  ]);

  useEffect(() => {
    if (!marketStateReady) {
      return;
    }

    loadTransferWindow();
    loadCoaches();
  }, [marketStateReady, loadTransferWindow, loadCoaches]);

  useEffect(() => {
    if (!marketStateReady) {
      return;
    }

    loadCart();
  }, [marketStateReady, loadCart]);

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
        setCartMessage("Não foi possível remover o profissional da lista.");
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
          setCartMessage("Não foi possível adicionar o profissional à lista.");
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
    const nextSearch =
      cleanSearch(search);

    setDebouncedSearch(
      nextSearch
    );

    if (page !== 1) {
      setPage(1);
    }
  }

  function clearFilters() {
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STAFF_MARKET_STATE_KEY);
      localStorage.removeItem(STAFF_MARKET_STATE_KEY);
      restoreScrollYRef.current = 0;
      restoreFocusRef.current = null;
      leavingForProfileRef.current = false;
      shouldRestoreScrollRef.current = false;
      sessionStorage.removeItem(STAFF_MARKET_RETURN_KEY);
      restoreScrollDoneRef.current = true;
    }

    skipNextSearchResetRef.current = false;
    setSearch("");
    setDebouncedSearch("");
    setRoleFilter("all");
    setMinCA("");
    setMaxCA("");
    setMinCP("");
    setMaxCP("");
    setFormation("");
    setMaxValue("");
    setSort("ca");
    setAttributeFilters([]);
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
                Encontre profissionais do save por função, formação, atributos e orçamento.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-400">
                {total.toLocaleString("pt-BR")} profissionais
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
              onChange={(event) => { setMinCA(event.target.value); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CA máximo"
              value={maxCA}
              onChange={(event) => { setMaxCA(event.target.value); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CP mínimo"
              value={minCP}
              onChange={(event) => { setMinCP(event.target.value); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />

            <input
              type="number"
              placeholder="CP máximo"
              value={maxCP}
              onChange={(event) => { setMaxCP(event.target.value); setPage(1); }}
              className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none placeholder:text-zinc-500 focus:border-green-500"
            />
          </div>

          <div className="mt-4 grid gap-3 border-t border-zinc-800 pt-4 sm:grid-cols-3">
            <label className="space-y-1 text-sm text-zinc-300">
              <span>Formação favorita</span>
              <select className={FILTER_FIELD} value={formation} onChange={(event) => {
                setFormation(event.target.value);
                setPage(1);
              }}>
                <option value="">Todas as formações</option>
                {FORMATIONS.map((item) => <option key={item}>{item}</option>)}
              </select>
            </label>
            <label className="space-y-1 text-sm text-zinc-300">
              <span>Valor máximo (R$)</span>
              <input className={FILTER_FIELD} type="number" min="0" step="any" placeholder="Ex. 5000000"
                value={maxValue} onChange={(event) => { setMaxValue(event.target.value); setPage(1); }} />
            </label>
            <label className="space-y-1 text-sm text-zinc-300">
              <span>Ordenar por</span>
              <select className={FILTER_FIELD} value={sort} onChange={(event) => {
                setSort(event.target.value);
                setPage(1);
              }}>
                {SORT_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </label>
          </div>

          <fieldset className="mt-4 space-y-2">
            <legend className="text-sm font-bold text-zinc-200">Atributos mínimos</legend>
            <p className="text-xs text-zinc-400">
              Combine até três atributos. O profissional precisa atingir todas as notas escolhidas.
            </p>
            {attributeFilters.map((filter, index) => (
              <div key={index} className="grid max-w-xl grid-cols-[minmax(0,1fr)_5rem_auto] gap-2">
                <select className={FILTER_FIELD} aria-label={`Atributo ${index + 1}`} value={filter.key}
                  onChange={(event) => {
                    const key = event.target.value;
                    setAttributeFilters((current) => current.map((item, i) => i === index ? { ...item, key } : item));
                    setPage(1);
                  }}>
                  <option value="">Escolha um atributo</option>
                  {STAFF_ATTRIBUTE_GROUPS.map(({ title, keys }) => (
                    <optgroup key={title} label={title}>
                      {keys.map((key) => (
                        <option key={key} value={key}
                          disabled={attributeFilters.some((item, i) => i !== index && item.key === key)}>
                          {key}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <select className={FILTER_FIELD} aria-label={`Nota mínima do atributo ${index + 1}`} value={filter.min}
                  onChange={(event) => {
                    const min = Number(event.target.value);
                    setAttributeFilters((current) => current.map((item, i) => i === index ? { ...item, min } : item));
                    setPage(1);
                  }}>
                  {ATTRIBUTE_SCORES.map((score) => <option key={score}>{score}</option>)}
                </select>
                <button type="button" aria-label={`Remover atributo ${index + 1}`}
                  className="rounded-lg px-2 text-xs text-zinc-300 hover:bg-zinc-800"
                  onClick={() => {
                    setAttributeFilters((current) => current.filter((_, i) => i !== index));
                    setPage(1);
                  }}>
                  Remover
                </button>
              </div>
            ))}
            {attributeFilters.length < 3 && (
              <button type="button" className="rounded-lg border border-zinc-700 px-3 py-2 text-sm text-green-300 hover:bg-zinc-800"
                onClick={() => setAttributeFilters((current) => [...current, { key: "", min: 15 }])}>
                + Adicionar atributo
              </button>
            )}
          </fieldset>

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

        {/* ACESSO RÁPIDO POR FUNÇÃO */}
        <div className="mb-6 flex flex-wrap gap-2" aria-label="Filtrar por função">
          <button type="button" onClick={() => { setRoleFilter("all"); setPage(1); }}
            className={`rounded-full border px-3 py-2 text-xs font-bold transition ${roleFilter === "all" ? "border-green-500 bg-green-500/20 text-green-300" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-green-500/50"}`}>
            Todas as funções
          </button>
          {STAFF_ROLES.map((role) => (
            <button key={role} type="button" onClick={() => { setRoleFilter(role); setPage(1); }}
              className={`rounded-full border px-3 py-2 text-xs font-bold transition ${roleFilter === role ? "border-green-500 bg-green-500/20 text-green-300" : "border-zinc-700 bg-zinc-900 text-zinc-300 hover:border-green-500/50"}`}>
              {role}
            </button>
          ))}
        </div>

        {/* CARDS */}
        {loading ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
            Carregando profissionais...
          </div>
        ) : coaches.length === 0 ? (
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
            Nenhum profissional encontrado.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
            {coaches.map((coach) => {
              const isInCart = cartIds.has(coach.id);
              const highlights = [...new Set([
                ...attributeFilters.map(({ key }) => key).filter(Boolean),
                ...(STAFF_HIGHLIGHTS[coach.role || ""] || ["Conhecimento Tático", "Motivação", "Determinação"]),
              ])].slice(0, 3);

              return (
                <div
                  key={coach.id}
                  id={`market-coach-${coach.id}`}
                  className="group overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900 p-4 shadow-md"
                >
                  {/* ID */}
                  <div className="mb-3 text-[12px] font-bold text-zinc-400">
                    ID do profissional -{" "}
                    <span className="font-black text-zinc-200">
                      {coach.unique_id || coach.id}
                    </span>
                  </div>

                  <Link
                    href={`/coaches/${coach.id}`}
                    onClick={() => {
                      saveMarketState(coach.id);
                      sessionStorage.setItem(STAFF_MARKET_RETURN_KEY, "1");
                    }}
                    className="block"
                  >
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

                    {/* ATRIBUTOS DA FUNÇÃO */}
                    <div className="mt-3 grid grid-cols-3 gap-1.5">
                      {highlights.map((key) => (
                        <div key={key} className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-1.5 py-2 text-center">
                          <div className="text-[10px] font-black text-sky-300">{coach.attributes?.[key] ?? "–"}</div>
                          <div className="mt-1 line-clamp-2 text-[9px] leading-tight text-zinc-400">{key.replace(/\*$/, "")}</div>
                        </div>
                      ))}
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
                      onClick={() => {
                        saveMarketState(coach.id);
                        sessionStorage.setItem(STAFF_MARKET_RETURN_KEY, "1");
                      }}
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
