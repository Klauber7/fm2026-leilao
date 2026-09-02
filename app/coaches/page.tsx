"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

type Coach = {
  id: number;
  name: string;
  nationality: string | null;
  role: string | null;
  team_id: number | null;
};

type Team = {
  id: number;
  name: string;
};

const PAGE_SIZE = 48;

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
    .trim()
    .replace(/[,%_()]/g, " ")
    .replace(/\s+/g, " ");
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
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(cleanSearch(search));
      setPage(1);
    }, 350);

    return () => window.clearTimeout(timer);
  }, [search]);

  const loadCart = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setMyTeam(null);
      setCartIds(new Set());
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("manager_id", user.id)
      .maybeSingle();

    if (teamError || !teamData) {
      setMyTeam(null);
      setCartIds(new Set());
      return;
    }

    setMyTeam(teamData as Team);

    const { data, error } = await supabase
      .from("staff_shopping_list")
      .select("coach_id")
      .eq("team_id", teamData.id);

    if (error) {
      console.error("Erro ao carregar carrinho:", error);
      setCartIds(new Set());
      return;
    }

    setCartIds(
      new Set((data || []).map((row) => Number(row.coach_id)))
    );
  }, []);

  const loadCoaches = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("coaches")
      .select("id, name, nationality, role, team_id", {
        count: "exact",
      })
      .is("team_id", null);

    if (roleFilter !== "all") {
      query = query.eq("role", roleFilter);
    }

    if (debouncedSearch) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,nationality.ilike.%${debouncedSearch}%,role.ilike.%${debouncedSearch}%`
      );
    }

    const { data, error, count } = await query
      .order("name", { ascending: true })
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
  }, [debouncedSearch, page, roleFilter]);

  useEffect(() => {
    loadCoaches();
  }, [loadCoaches]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

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
    if (!myTeam) {
      setCartMessage("Não foi possível identificar o seu clube.");
      return;
    }

    setCartLoadingId(coach.id);
    setCartMessage("");

    const isInCart = cartIds.has(coach.id);

    if (isInCart) {
      const { error } = await supabase
        .from("staff_shopping_list")
        .delete()
        .eq("team_id", myTeam.id)
        .eq("coach_id", coach.id);

      if (error) {
        setCartMessage("Não foi possível remover o staff.");
        setCartLoadingId(null);
        return;
      }

      setCartIds((current) => {
        const next = new Set(current);
        next.delete(coach.id);
        return next;
      });

      setCartMessage(`${coach.name} foi removido do carrinho.`);
    } else {
      const { error } = await supabase
        .from("staff_shopping_list")
        .insert({
          team_id: myTeam.id,
          coach_id: coach.id,
        });

      if (error) {
        if (error.code === "23505") {
          await loadCart();
          setCartMessage(`${coach.name} já está no carrinho.`);
        } else {
          setCartMessage("Não foi possível adicionar o staff.");
        }

        setCartLoadingId(null);
        return;
      }

      setCartIds((current) => {
        const next = new Set(current);
        next.add(coach.id);
        return next;
      });

      setCartMessage(`${coach.name} foi adicionado ao carrinho.`);
    }

    setCartLoadingId(null);
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

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
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-bold uppercase tracking-widest text-green-400">
              FriendZone League FM
            </p>

            <h1 className="mt-2 text-5xl font-black md:text-6xl">
              Comissão Técnica
            </h1>

            <p className="mt-3 text-lg text-zinc-400">
              Consulte os profissionais disponíveis.
            </p>
          </div>

          <Link
            href="/staff-shopping-list"
            className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-6 py-4 text-center font-black text-purple-300 transition hover:bg-purple-500/20"
          >
            🛒 Carrinho de Staff ({cartIds.size})
          </Link>
        </header>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        {cartMessage && (
          <div className="mt-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-5 text-purple-200">
            {cartMessage}
          </div>
        )}

        <section className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-[1fr_300px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, nacionalidade ou função"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 outline-none focus:border-green-500"
          />

          <select
            value={roleFilter}
            onChange={(event) => {
              setRoleFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 outline-none focus:border-green-500"
          >
            <option value="all">Todas as funções</option>

            {STAFF_ROLES.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </section>

        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl font-black">
              Profissionais disponíveis
            </h2>

            <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 font-bold text-green-400">
              {total.toLocaleString("pt-BR")}
            </span>
          </div>

          {loading ? (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
              Carregando staffs...
            </div>
          ) : coaches.length === 0 ? (
            <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              Nenhum profissional encontrado.
            </div>
          ) : (
            <div className="mt-8 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {coaches.map((coach) => {
                const isInCart = cartIds.has(coach.id);

                return (
                  <article
                    key={coach.id}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
                  >
                    <Link href={`/coaches/${coach.id}`} className="block">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-green-500/10 text-3xl">
                        👔
                      </div>

                      <p className="mt-5 font-bold text-green-400">
                        {coach.role || "Comissão técnica"}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {coach.name}
                      </h3>

                      <p className="mt-3 text-zinc-400">
                        {coach.nationality ||
                          "Nacionalidade não informada"}
                      </p>
                    </Link>

                    <button
                      type="button"
                      disabled={cartLoadingId === coach.id || !myTeam}
                      onClick={() => toggleCart(coach)}
                      className={`mt-6 w-full rounded-xl px-4 py-3 font-black transition disabled:opacity-50 ${
                        isInCart
                          ? "border border-purple-500/40 bg-purple-500/10 text-purple-300"
                          : "bg-green-600 text-white hover:bg-green-500"
                      }`}
                    >
                      {cartLoadingId === coach.id
                        ? "SALVANDO..."
                        : isInCart
                        ? "✓ REMOVER DO CARRINHO"
                        : "🛒 ADICIONAR AO CARRINHO"}
                    </button>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {totalPages > 1 && (
          <nav className="mt-12 flex flex-wrap justify-center gap-2">
            <button
              type="button"
              disabled={page === 1 || loading}
              onClick={() =>
                setPage((current) => Math.max(1, current - 1))
              }
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-bold disabled:opacity-40"
            >
              Anterior
            </button>

            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                onClick={() => setPage(pageNumber)}
                className={`min-w-12 rounded-xl border px-4 py-3 font-black ${
                  pageNumber === page
                    ? "border-green-500 bg-green-600"
                    : "border-zinc-700 bg-zinc-900"
                }`}
              >
                {pageNumber}
              </button>
            ))}

            <button
              type="button"
              disabled={page === totalPages || loading}
              onClick={() =>
                setPage((current) =>
                  Math.min(totalPages, current + 1)
                )
              }
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-4 py-3 font-bold disabled:opacity-40"
            >
              Próxima
            </button>
          </nav>
        )}
      </div>
    </main>
  );
}