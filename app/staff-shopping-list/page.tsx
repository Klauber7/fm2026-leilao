"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
};

type Coach = {
  id: number;
  name: string;
  role: string | null;
  nationality: string | null;
  team_id: number | null;
};

type CartRow = {
  id: number;
  team_id: number;
  coach_id: number;
  created_at: string;
};

type CartItem = CartRow & {
  coach: Coach | null;
};

export default function StaffShoppingListPage() {
  const router = useRouter();

  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [finalizing, setFinalizing] = useState(false);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadCart = useCallback(async () => {
    setLoading(true);
    setError("");

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name")
      .eq("manager_id", user.id)
      .maybeSingle();

    if (teamError || !teamData) {
      setError("Não foi possível identificar o seu clube.");
      setLoading(false);
      return;
    }

    setMyTeam(teamData as Team);

    const { data: cartRows, error: cartError } = await supabase
      .from("staff_shopping_list")
      .select("id, team_id, coach_id, created_at")
      .eq("team_id", teamData.id)
      .order("created_at", { ascending: false });

    if (cartError) {
      setError(cartError.message);
      setLoading(false);
      return;
    }

    if (!cartRows || cartRows.length === 0) {
      setItems([]);
      setLoading(false);
      return;
    }

    const coachIds = cartRows.map((row) => row.coach_id);

    const { data: coaches, error: coachesError } = await supabase
      .from("coaches")
      .select("id, name, role, nationality, team_id")
      .in("id", coachIds);

    if (coachesError) {
      setError(coachesError.message);
      setLoading(false);
      return;
    }

    const coachMap = new Map(
      (coaches || []).map((coach) => [Number(coach.id), coach])
    );

    setItems(
      cartRows.map((row) => ({
        ...(row as CartRow),
        coach: (coachMap.get(Number(row.coach_id)) as Coach) || null,
      }))
    );

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  useEffect(() => {
    if (!myTeam) return;

    const channel = supabase
      .channel(`staff-shopping-list-${myTeam.id}`)
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
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coaches",
        },
        loadCart
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [myTeam, loadCart]);

  async function removeItem(item: CartItem) {
    const confirmed = window.confirm(
      `Remover ${item.coach?.name || "este staff"} do carrinho?`
    );

    if (!confirmed) return;

    setRemovingId(item.id);
    setError("");
    setMessage("");

    const { error: removeError } = await supabase
      .from("staff_shopping_list")
      .delete()
      .eq("id", item.id);

    if (removeError) {
      setError("Não foi possível remover o staff.");
      setRemovingId(null);
      return;
    }

    setItems((current) =>
      current.filter((currentItem) => currentItem.id !== item.id)
    );

    setMessage("Staff removido do carrinho.");
    setRemovingId(null);
  }

  async function finalizeHiring() {
    if (!myTeam) {
      setError("Não foi possível identificar o seu clube.");
      return;
    }

    if (items.length === 0) {
      setError("Seu carrinho está vazio.");
      return;
    }

    const availableItems = items.filter(
      (item) => item.coach && item.coach.team_id === null
    );

    if (availableItems.length === 0) {
      setError(
        "Nenhum profissional do carrinho está disponível para contratação."
      );
      return;
    }

    const confirmed = window.confirm(
      `Confirmar a contratação de ${
        availableItems.length
      } profissional${availableItems.length === 1 ? "" : "is"} pelo ${
        myTeam.name
      }?`
    );

    if (!confirmed) return;

    setFinalizing(true);
    setError("");
    setMessage("");

    try {
      const coachIds = availableItems.map((item) => item.coach_id);

      /*
       * Confere novamente no banco quais staffs continuam disponíveis.
       * Isso evita contratar alguém que outro presidente acabou
       * de contratar antes da confirmação.
       */
      const { data: stillAvailable, error: availabilityError } = await supabase
        .from("coaches")
        .select("id")
        .in("id", coachIds)
        .is("team_id", null);

      if (availabilityError) {
        throw availabilityError;
      }

      const availableIds = (stillAvailable || []).map((coach) =>
        Number(coach.id)
      );

      if (availableIds.length === 0) {
        setError(
          "Os profissionais selecionados não estão mais disponíveis."
        );

        await loadCart();
        return;
      }

      /*
       * Coloca todos os staffs disponíveis no clube.
       */
      const { error: hiringError } = await supabase
        .from("coaches")
        .update({
          team_id: myTeam.id,
          hired_at: new Date().toISOString(),
        })
        .in("id", availableIds)
        .is("team_id", null);

      if (hiringError) {
        throw hiringError;
      }

      /*
       * Remove do carrinho os staffs que foram contratados.
       */
      const { error: clearCartError } = await supabase
        .from("staff_shopping_list")
        .delete()
        .eq("team_id", myTeam.id)
        .in("coach_id", availableIds);

      if (clearCartError) {
        throw clearCartError;
      }

      /*
       * Também remove do carrinho qualquer staff que já
       * tenha sido contratado por outro clube.
       */
      const unavailableIds = coachIds.filter(
        (id) => !availableIds.includes(Number(id))
      );

      if (unavailableIds.length > 0) {
        await supabase
          .from("staff_shopping_list")
          .delete()
          .eq("team_id", myTeam.id)
          .in("coach_id", unavailableIds);
      }

      if (unavailableIds.length > 0) {
        setMessage(
          `${availableIds.length} profissional${
            availableIds.length === 1 ? "" : "is"
          } contratado${
            availableIds.length === 1 ? "" : "s"
          } pelo ${myTeam.name}. ${
            unavailableIds.length
          } profissional${
            unavailableIds.length === 1 ? "" : "is"
          } não estava${
            unavailableIds.length === 1 ? "" : "m"
          } mais disponível${
            unavailableIds.length === 1 ? "" : "is"
          }.`
        );
      } else {
        setMessage(
          `${availableIds.length} profissional${
            availableIds.length === 1 ? "" : "is"
          } contratado${
            availableIds.length === 1 ? "" : "s"
          } com sucesso pelo ${myTeam.name}.`
        );
      }

      await loadCart();
    } catch (error) {
      console.error("Erro ao finalizar contratação:", error);

      setError(
        "Não foi possível finalizar a contratação. Tente novamente."
      );
    } finally {
      setFinalizing(false);
    }
  }

  const roles = useMemo(() => {
    return Array.from(
      new Set(
        items
          .map((item) => item.coach?.role)
          .filter((role): role is string => Boolean(role))
      )
    ).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [items]);

  const filteredItems = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      if (!item.coach) return false;

      const matchesSearch =
        !term ||
        item.coach.name.toLowerCase().includes(term) ||
        (item.coach.role || "").toLowerCase().includes(term) ||
        (item.coach.nationality || "").toLowerCase().includes(term);

      const matchesRole =
        roleFilter === "all" || item.coach.role === roleFilter;

      return matchesSearch && matchesRole;
    });
  }, [items, search, roleFilter]);

  const availableCount = items.filter(
    (item) => item.coach && item.coach.team_id === null
  ).length;

  const unavailableCount = items.filter(
    (item) => item.coach && item.coach.team_id !== null
  ).length;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-bold uppercase tracking-widest text-purple-400">
              FriendZone League FM
            </p>

            <h1 className="mt-2 text-5xl font-black">
              Carrinho de Staff
            </h1>

            <p className="mt-3 text-zinc-400">
              Profissionais selecionados pelo {myTeam?.name || "seu clube"}.
            </p>
          </div>

          <Link
            href="/coaches"
            className="rounded-xl bg-green-600 px-6 py-3 text-center font-black hover:bg-green-500"
          >
            + Adicionar profissionais
          </Link>
        </header>

        {error && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5 text-green-300">
            {message}
          </div>
        )}

        {!loading && items.length > 0 && (
          <section className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-6">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <p className="text-sm font-black uppercase tracking-widest text-green-400">
                  Comissão selecionada
                </p>

                <h2 className="mt-2 text-3xl font-black">
                  {items.length} profissional
                  {items.length === 1 ? "" : "is"} no carrinho
                </h2>

                <div className="mt-4 flex flex-wrap gap-3">
                  <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400">
                    {availableCount} disponível
                    {availableCount === 1 ? "" : "is"}
                  </span>

                  {unavailableCount > 0 && (
                    <span className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-bold text-red-400">
                      {unavailableCount} indisponível
                      {unavailableCount === 1 ? "" : "is"}
                    </span>
                  )}
                </div>

                <p className="mt-4 text-zinc-400">
                  Confirme abaixo para adicionar os profissionais disponíveis
                  ao {myTeam?.name}.
                </p>
              </div>

              <button
                type="button"
                onClick={finalizeHiring}
                disabled={finalizing || availableCount === 0}
                className="rounded-xl bg-green-600 px-8 py-4 text-lg font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
              >
                {finalizing
                  ? "FINALIZANDO..."
                  : "FINALIZAR CONTRATAÇÃO"}
              </button>
            </div>
          </section>
        )}

        <section className="mt-10 grid gap-4 md:grid-cols-[1fr_280px]">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Nome, função ou nacionalidade"
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 outline-none focus:border-purple-500"
          />

          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-4 outline-none focus:border-purple-500"
          >
            <option value="all">Todas as funções</option>

            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </section>

        <section className="mt-10">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-black">
              Selecionados
            </h2>

            <span className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 font-black text-purple-300">
              {filteredItems.length}
            </span>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
              Carregando carrinho...
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <p className="text-6xl">
                🛒
              </p>

              <h3 className="mt-5 text-3xl font-black">
                Carrinho vazio
              </h3>

              <p className="mt-3 text-zinc-400">
                Adicione profissionais disponíveis no mercado.
              </p>

              <Link
                href="/coaches"
                className="mt-7 inline-block rounded-xl bg-green-600 px-6 py-3 font-black hover:bg-green-500"
              >
                Ver staffs
              </Link>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <h3 className="text-2xl font-black">
                Nenhum resultado
              </h3>

              <p className="mt-3 text-zinc-400">
                Nenhum profissional corresponde à sua busca.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filteredItems.map((item) => {
                const coach = item.coach;

                if (!coach) return null;

                const isAvailable = coach.team_id === null;

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-6 ${
                      isAvailable
                        ? "border-zinc-800 bg-zinc-900"
                        : "border-red-500/30 bg-red-500/5"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
                        👔
                      </div>

                      {isAvailable ? (
                        <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-black text-green-400">
                          DISPONÍVEL
                        </span>
                      ) : (
                        <span className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-black text-red-400">
                          INDISPONÍVEL
                        </span>
                      )}
                    </div>

                    <p className="mt-5 font-black text-purple-400">
                      {coach.role || "Comissão técnica"}
                    </p>

                    <h3 className="mt-2 text-2xl font-black">
                      {coach.name}
                    </h3>

                    <p className="mt-3 text-zinc-400">
                      {coach.nationality ||
                        "Nacionalidade não informada"}
                    </p>

                    {!isAvailable && (
                      <div className="mt-5 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-300">
                        Este profissional já foi contratado por outro clube e
                        não poderá ser confirmado.
                      </div>
                    )}

                    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-6">
                      <Link
                        href={`/coaches/${coach.id}`}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-black hover:border-purple-500"
                      >
                        Ver staff
                      </Link>

                      <button
                        type="button"
                        disabled={
                          removingId === item.id ||
                          finalizing
                        }
                        onClick={() => removeItem(item)}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {removingId === item.id
                          ? "Removendo..."
                          : "Remover"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}