"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Coach = {
  id: number;
  name: string;
  nationality: string | null;
  role: string | null;
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
};

function money(value: number | null | undefined) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getErrorMessage(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error
  ) {
    return String(
      (
        error as {
          message: unknown;
        }
      ).message
    );
  }

  return "Ocorreu um erro inesperado.";
}

export default function CoachDetailPage() {
  const params = useParams();
  const coachId = Number(params.id);

  const [coach, setCoach] = useState<Coach | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [isInCart, setIsInCart] = useState(false);

  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setErrorMessage("");

    if (!Number.isInteger(coachId) || coachId <= 0) {
      setErrorMessage("Número de profissional inválido.");
      setLoading(false);
      return;
    }

    try {
      const {
        data: coachData,
        error: coachError,
      } = await supabase
        .from("coaches")
        .select(`
          id,
          name,
          nationality,
          role,
          age,
          ca,
          pa,
          value,
          image_url,
          team_id,
          hired_at
        `)
        .eq("id", coachId)
        .maybeSingle();

      if (coachError) {
        throw coachError;
      }

      const loadedCoach =
        (coachData as Coach | null) ?? null;

      setCoach(loadedCoach);

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser();

      if (userError) {
        throw userError;
      }

      if (!user) {
        setTeam(null);
        setIsInCart(false);
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } = await supabase
        .from("teams")
        .select("id, name")
        .eq("manager_id", user.id)
        .maybeSingle();

      if (teamError) {
        throw teamError;
      }

      const loadedTeam =
        (teamData as Team | null) ?? null;

      setTeam(loadedTeam);

      if (!loadedTeam) {
        setIsInCart(false);
        return;
      }

      const {
        data: cartData,
        error: cartError,
      } = await supabase
        .from("staff_shopping_list")
        .select("id")
        .eq("team_id", loadedTeam.id)
        .eq("coach_id", coachId)
        .maybeSingle();

      if (cartError) {
        throw cartError;
      }

      setIsInCart(Boolean(cartData));
    } catch (error) {
      console.error(error);
      setErrorMessage(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [coachId]);

  useEffect(() => {
    loadPage();

    const coachChannel = supabase
      .channel(`coach-detail-${coachId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "coaches",
          filter: `id=eq.${coachId}`,
        },
        () => {
          loadPage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(coachChannel);
    };
  }, [coachId, loadPage]);

  useEffect(() => {
    if (!team) return;

    const cartChannel = supabase
      .channel(`coach-detail-cart-${team.id}-${coachId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_shopping_list",
          filter: `team_id=eq.${team.id}`,
        },
        () => {
          loadPage();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(cartChannel);
    };
  }, [team, coachId, loadPage]);

  async function toggleCart() {
    if (!coach) {
      setErrorMessage("Profissional não encontrado.");
      return;
    }

    if (!team) {
      setErrorMessage(
        "Você precisa possuir um clube para adicionar profissionais ao carrinho."
      );
      return;
    }

    if (coach.team_id !== null) {
      setErrorMessage(
        "Este profissional já foi contratado."
      );
      return;
    }

    setCartLoading(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      if (isInCart) {
        const { error } = await supabase
          .from("staff_shopping_list")
          .delete()
          .eq("team_id", team.id)
          .eq("coach_id", coach.id);

        if (error) {
          throw error;
        }

        setIsInCart(false);

        setSuccessMessage(
          `${coach.name} foi removido do carrinho.`
        );
      } else {
        const { error } = await supabase
          .from("staff_shopping_list")
          .insert({
            team_id: team.id,
            coach_id: coach.id,
          });

        if (error) {
          if (error.code === "23505") {
            setIsInCart(true);

            setSuccessMessage(
              `${coach.name} já está no seu carrinho.`
            );

            return;
          }

          throw error;
        }

        setIsInCart(true);

        setSuccessMessage(
          `${coach.name} foi adicionado ao carrinho.`
        );
      }
    } catch (error) {
      const message = getErrorMessage(error);

      console.error(error);
      setErrorMessage(message);
    } finally {
      setCartLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        Carregando profissional...
      </main>
    );
  }

  if (!coach) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
        <div className="mx-auto max-w-5xl">
          <Link
            href="/coaches"
            className="font-bold text-green-400"
          >
            ← Voltar
          </Link>

          <h1 className="mt-8 text-4xl font-black">
            Profissional não encontrado
          </h1>

          {errorMessage && (
            <p className="mt-4 text-red-400">
              {errorMessage}
            </p>
          )}
        </div>
      </main>
    );
  }

  const isAvailable = coach.team_id === null;

  const belongsToMyTeam =
    coach.team_id !== null &&
    coach.team_id === team?.id;

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/coaches"
            className="font-bold text-green-400 hover:text-green-300"
          >
            ← Voltar ao mercado
          </Link>

          {team && (
            <Link
              href="/staff-shopping-list"
              className="rounded-xl border border-purple-500/40 bg-purple-500/10 px-5 py-3 text-center font-black text-purple-300 hover:bg-purple-500/20"
            >
              🛒 Ver Carrinho
            </Link>
          )}
        </div>

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

        <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="h-96 bg-zinc-800">
              {coach.image_url ? (
                <img
                  src={coach.image_url}
                  alt={coach.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full items-center justify-center text-8xl">
                  👔
                </div>
              )}
            </div>
          </div>

          <div>
            <div className="flex flex-col gap-5 md:flex-row md:items-start md:justify-between">
              <div>
                <p className="font-bold uppercase tracking-widest text-green-400">
                  {coach.role || "Comissão técnica"}
                </p>

                <h1 className="mt-2 text-5xl font-black md:text-6xl">
                  {coach.name}
                </h1>

                <p className="mt-4 text-lg text-zinc-400">
                  {coach.nationality ||
                    "Nacionalidade não informada"}{" "}
                  • {coach.age ?? "-"} anos
                </p>
              </div>

              {isAvailable ? (
                <span className="rounded-xl border border-green-500 px-5 py-3 font-black text-green-400">
                  DISPONÍVEL
                </span>
              ) : (
                <span className="rounded-xl border border-red-500 px-5 py-3 font-black text-red-400">
                  CONTRATADO
                </span>
              )}
            </div>

            <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-3">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  CA
                </p>

                <p className="mt-2 text-4xl font-black text-green-400">
                  {coach.ca ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  PA
                </p>

                <p className="mt-2 text-4xl font-black">
                  {coach.pa ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  Valor
                </p>

                <p className="mt-2 text-2xl font-black text-green-400">
                  {money(coach.value)}
                </p>
              </div>
            </section>

            <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
              <h2 className="text-2xl font-black">
                Seleção de Staff
              </h2>

              {team ? (
                <>
                  <div className="mt-5">
                    <p className="text-zinc-400">
                      Seu clube
                    </p>

                    <p className="mt-1 text-xl font-black">
                      {team.name}
                    </p>
                  </div>

                  {isAvailable && (
                    <>
                      <button
                        type="button"
                        onClick={toggleCart}
                        disabled={cartLoading}
                        className={`mt-7 w-full rounded-xl py-4 font-black transition disabled:opacity-50 ${
                          isInCart
                            ? "border border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                            : "bg-green-600 text-white hover:bg-green-500"
                        }`}
                      >
                        {cartLoading
                          ? "SALVANDO..."
                          : isInCart
                          ? "✓ REMOVER DO CARRINHO"
                          : "🛒 ADICIONAR AO CARRINHO"}
                      </button>

                      {isInCart && (
                        <Link
                          href="/staff-shopping-list"
                          className="mt-4 block w-full rounded-xl border border-purple-500/40 bg-purple-500/10 px-6 py-4 text-center font-black text-purple-300 hover:bg-purple-500/20"
                        >
                          IR PARA O CARRINHO →
                        </Link>
                      )}
                    </>
                  )}

                  {belongsToMyTeam && (
                    <div className="mt-7 rounded-xl border border-green-500/30 bg-green-500/10 p-5 text-center font-bold text-green-400">
                      Este profissional pertence ao seu clube.
                    </div>
                  )}

                  {!isAvailable &&
                    !belongsToMyTeam && (
                      <div className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-center text-red-300">
                        Este profissional já pertence a outro clube.
                      </div>
                    )}
                </>
              ) : (
                <div className="mt-6">
                  <p className="text-zinc-400">
                    Você precisa possuir um clube para adicionar profissionais
                    ao carrinho.
                  </p>

                  <Link
                    href="/teams"
                    className="mt-5 inline-block rounded-xl bg-green-600 px-6 py-3 font-black"
                  >
                    Ir para clubes
                  </Link>
                </div>
              )}
            </section>
          </div>
        </section>
      </div>
    </main>
  );
}