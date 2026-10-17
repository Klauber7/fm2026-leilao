"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import StaffAttributes from "@/app/components/StaffAttributes";

type Coach = {
  id: number;
  unique_id: string | null;
  name: string;
  nationality: string | null;
  role: string | null;
  age: number | null;
  ca: number | null;
  cp: number | null;
  attributes: Record<string, number | null> | null;
  preferred_formation: string | null;
  original_role: string | null;
  save_club: string | null;
  market_active: boolean;
  value: number | null;
  image_url: string | null;
  team_id: number | null;
  hired_at: string | null;
};

type Team = {
  id: number;
  name: string;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string | null;
  status: string;
};

type StaffAuction = {
  id: number;
  coach_id: number;
  starting_value: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  status: string;
  ends_at: string | null;
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
  const router = useRouter();
  const coachId = Number(
    Array.isArray(params.id) ? params.id[0] : params.id
  );

  const [coach, setCoach] = useState<Coach | null>(null);
  const [team, setTeam] = useState<Team | null>(null);

  const [loading, setLoading] = useState(true);
  const [cartLoading, setCartLoading] = useState(false);
  const [isInCart, setIsInCart] = useState(false);

  const [currentWindow, setCurrentWindow] =
    useState<TransferWindow | null>(null);

  const [activeAuction, setActiveAuction] =
    useState<StaffAuction | null>(null);

  const [startingAuction, setStartingAuction] = useState(false);

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
          unique_id,
          name,
          nationality,
          role,
          age,
          ca,
          cp,
          attributes,
          preferred_formation,
          original_role,
          save_club,
          market_active,
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

      const [windowResult, auctionResult] = await Promise.all([
        supabase
          .from("transfer_windows")
          .select("id, window_number, name, status")
          .eq("status", "open")
          .order("window_number", { ascending: false })
          .limit(1)
          .maybeSingle(),

        supabase
          .from("staff_auctions")
          .select(`
            id,
            coach_id,
            starting_value,
            current_bid,
            winner_team_id,
            status,
            ends_at
          `)
          .eq("coach_id", coachId)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (windowResult.error) {
        console.error("Erro ao carregar janela:", windowResult.error);
        setCurrentWindow(null);
      } else {
        setCurrentWindow(
          windowResult.data
            ? (windowResult.data as TransferWindow)
            : null
        );
      }

      if (auctionResult.error) {
        console.error(
          "Erro ao carregar leilão de staff:",
          auctionResult.error
        );
        setActiveAuction(null);
      } else {
        setActiveAuction(
          auctionResult.data
            ? (auctionResult.data as StaffAuction)
            : null
        );
      }

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
          event: "*",
          schema: "public",
          table: "coaches",
          filter: `id=eq.${coachId}`,
        },
        () => {
          loadPage();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_auctions",
          filter: `coach_id=eq.${coachId}`,
        },
        () => {
          loadPage();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "transfer_windows",
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

    if (coach.team_id !== null || coach.market_active === false) {
      setErrorMessage(
        "Este profissional não está disponível no mercado."
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

  async function handleAuction() {
    if (!coach) {
      setErrorMessage("Profissional não encontrado.");
      return;
    }

    if (!team) {
      setErrorMessage("Você precisa possuir um clube para dar lance.");
      return;
    }

    if (!currentWindow) {
      setErrorMessage("O mercado está fechado.");
      return;
    }

    if (coach.team_id !== null || coach.market_active === false) {
      setErrorMessage("Este profissional não está disponível no mercado.");
      return;
    }

    if (activeAuction) {
      router.push(`/staff-auctions/${activeAuction.id}`);
      return;
    }

    const startingValue = Number(coach.value || 0);

    if (!Number.isFinite(startingValue) || startingValue < 0) {
      setErrorMessage("Este profissional não possui valor válido.");
      return;
    }

    setStartingAuction(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const { data, error } = await supabase.rpc(
        "create_staff_auction",
        {
          coach_id_input: coach.id,
          starting_value_input: startingValue,
        }
      );

      if (error) {
        const { data: existingAuction } = await supabase
          .from("staff_auctions")
          .select("id")
          .eq("coach_id", coach.id)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAuction?.id) {
          router.push(`/staff-auctions/${existingAuction.id}`);
          return;
        }

        throw error;
      }

      let auctionId: number | null = null;

      if (
        data &&
        typeof data === "object" &&
        "auction_id" in data
      ) {
        auctionId = Number(
          (data as { auction_id: number }).auction_id
        );
      }

      if (!auctionId) {
        const {
          data: createdAuction,
          error: createdAuctionError,
        } = await supabase
          .from("staff_auctions")
          .select("id")
          .eq("coach_id", coach.id)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (createdAuctionError) {
          throw createdAuctionError;
        }

        auctionId = createdAuction?.id
          ? Number(createdAuction.id)
          : null;
      }

      if (!auctionId) {
        throw new Error(
          "O leilão foi criado, mas não foi possível localizar o ID."
        );
      }

      router.push(`/staff-auctions/${auctionId}`);
    } catch (error) {
      const message = getErrorMessage(error);
      console.error("Erro ao criar leilão de staff:", error);
      setErrorMessage(message);
    } finally {
      setStartingAuction(false);
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
          <button
            type="button"
            onClick={() => router.back()}
            className="font-bold text-green-400"
          >
            ← Voltar
          </button>

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

  const isAvailable = coach.team_id === null && coach.market_active !== false;

  const belongsToMyTeam =
    coach.team_id !== null &&
    coach.team_id === team?.id;

  const marketOpen = Boolean(currentWindow);

  const compactMoney = (value: number | null) => {
    const amount = Number(value || 0);
    if (amount >= 1000000) {
      return `R$ ${(amount / 1000000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}M`;
    }
    return money(amount);
  };

  const canBid = isAvailable && marketOpen && Boolean(team);

  return (
    <main className="min-h-screen bg-[#07090d] px-3 py-3 text-white sm:px-5 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => router.back()}
            className="rounded-md border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-white transition hover:border-sky-600"
          >
            ← Comissão Técnica
          </button>
          {team && (
            <Link
              href="/staff-shopping-list"
              className="rounded-md border border-sky-900 bg-[#101827] px-3 py-2 text-xs font-bold text-sky-200 hover:text-white"
            >
              🛒 Lista de staff {isInCart ? "✓" : ""}
            </Link>
          )}
        </div>

        <div className={`mb-2 flex flex-wrap items-center justify-between gap-3 rounded-[10px] border px-4 py-3 ${marketOpen && isAvailable ? "border-emerald-700 bg-emerald-950/70" : "border-red-700 bg-red-950/70"}`}>
          <div>
            <p className="text-[13px] font-black">
              {coach.team_id !== null ? "🔒 PROFISSIONAL CONTRATADO" : !isAvailable ? "🔒 FORA DO MERCADO" : marketOpen ? "🟢 LEILÃO ABERTO" : "🔒 LEILÃO FECHADO"}
            </p>
            <p className="mt-0.5 text-[11px] text-zinc-300">
              {coach.team_id !== null
                ? "Profissional já vinculado a uma equipe da FriendZone."
                : !isAvailable
                ? "Cadastro histórico preservado, indisponível para contratação."
                : marketOpen
                ? `Mercado aberto${currentWindow?.name ? ` — ${currentWindow.name}` : ""}.`
                : "Aguarde a abertura do mercado."}
            </p>
          </div>
          <button
            type="button"
            onClick={handleAuction}
            disabled={!canBid || startingAuction}
            className="min-w-52 rounded-lg bg-[#343d50] px-5 py-2.5 text-center text-xs font-black text-white transition enabled:hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {startingAuction ? "ABRINDO LEILÃO..." : activeAuction && canBid ? "ENTRAR NO LEILÃO" : `DAR LANCE — ${compactMoney(coach.value)}`}
          </button>
        </div>

        {errorMessage && (
          <p role="alert" className="mb-2 rounded-lg border border-red-700 bg-red-950/70 p-3 text-sm text-red-200">{errorMessage}</p>
        )}
        {successMessage && (
          <p role="status" className="mb-2 rounded-lg border border-emerald-700 bg-emerald-950/70 p-3 text-sm text-emerald-200">{successMessage}</p>
        )}

        <header className="flex flex-wrap items-center gap-4 rounded-[10px] border border-sky-700 bg-[#020b1c] p-3">
          <div className="flex h-28 w-32 shrink-0 items-center justify-center overflow-hidden rounded-md border border-zinc-700 bg-slate-900 sm:w-44">
            {coach.image_url ? (
              <img src={coach.image_url} alt={coach.name} className="h-full w-full object-cover" />
            ) : (
              <span aria-hidden="true" className="text-5xl">👔</span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-black leading-tight sm:text-3xl lg:text-4xl">{coach.name}</h1>
            <p className="mt-2 text-xs text-zinc-300">
              {coach.age ?? "–"} anos · {coach.nationality || "Nacionalidade não informada"} · {coach.role || "Comissão técnica"} · ID {coach.unique_id || coach.id}
            </p>
            {coach.save_club && (
              <p className="mt-1 text-xs text-zinc-400">Clube no save: {coach.save_club}</p>
            )}
            {coach.preferred_formation && (
              <p className="mt-2 text-xs text-sky-300">⚽ Tática favorita: <strong>{coach.preferred_formation}</strong></p>
            )}
            {coach.original_role && coach.original_role !== coach.role && (
              <p className="mt-1 text-xs text-zinc-500">Outras funções no save: {coach.original_role}</p>
            )}
          </div>

          <div className="ml-auto flex gap-2">
            <div className="min-w-[66px] rounded-lg border border-emerald-600 bg-black/30 px-3 py-2 text-center">
              <p className="text-[11px] font-bold text-emerald-300">CA</p>
              <p className="mt-1 text-2xl font-black text-emerald-400">{coach.ca ?? "–"}</p>
            </div>
            <div className="min-w-[66px] rounded-lg border border-sky-600 bg-black/30 px-3 py-2 text-center">
              <p className="text-[11px] font-bold text-sky-300">CP</p>
              <p className="mt-1 text-2xl font-black text-sky-100">{coach.cp ?? "–"}</p>
            </div>
          </div>
        </header>

        <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-lg border border-slate-700 bg-[#17191d] px-3 py-2">
            <p className="text-[10px] font-black tracking-wide text-zinc-400">VALOR</p>
            <p className="text-base font-black">{compactMoney(coach.value)}</p>
          </div>
          <div className="rounded-lg border border-slate-700 bg-[#17191d] px-3 py-2">
            <p className="text-[10px] font-black tracking-wide text-zinc-400">TÁTICA FAVORITA</p>
            <p className="text-sm font-black">{coach.preferred_formation || "Não informada"}</p>
          </div>
        </div>

        <StaffAttributes attributes={coach.attributes} />

        <section className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-900 bg-[#06121e] px-4 py-4">
          <div>
            <h2 className="text-sm font-black text-white">Leilão e lista de staff</h2>
            <p className="mt-1 text-xs text-zinc-400">
              {belongsToMyTeam ? "Profissional contratado pelo seu clube." :
                coach.team_id !== null ? "Profissional contratado por outro clube." :
                !isAvailable ? "Profissional fora do mercado atual." :
                team ? `Seu clube: ${team.name}` :
                "Vincule uma equipe à sua conta para participar do mercado."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isAvailable && team && (
              <button
                type="button"
                onClick={toggleCart}
                disabled={cartLoading}
                className={`rounded-lg border px-4 py-2.5 text-xs font-bold disabled:opacity-50 ${isInCart ? "border-emerald-600 bg-emerald-950 text-emerald-300" : "border-sky-600 bg-sky-950 text-sky-200"}`}
              >
                {cartLoading ? "SALVANDO..." : isInCart ? "✓ REMOVER DO CARRINHO" : "🛒 ADICIONAR À LISTA"}
              </button>
            )}
            {isInCart && (
              <Link href="/staff-shopping-list" className="rounded-lg bg-[#2c3647] px-4 py-2.5 text-xs font-black text-white hover:bg-sky-700">
                VER CARRINHO →
              </Link>
            )}
            {!team && (
              <Link href="/teams" className="rounded-lg bg-sky-700 px-4 py-2.5 text-xs font-black text-white hover:bg-sky-600">
                VER CLUBES
              </Link>
            )}
          </div>
        </section>
        <p className="mt-3 text-xs text-zinc-500">Atributos e preço extraídos do save FZ26. Tendências representam preferências táticas, não uma nota geral de qualidade. * Nomenclatura provisória do arquivo.</p>
      </div>
    </main>
  );
}
