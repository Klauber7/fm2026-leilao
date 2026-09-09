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

type StaffAuction = {
  id: number;
  coach_id: number;
  status: string | null;
  starting_value: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  ends_at: string | null;
};

type CartItem = CartRow & {
  coach: Coach | null;
  auction: StaffAuction | null;
  leadingTeamName: string | null;
};

function formatMoney(value: number | null | undefined) {
  if (value == null) return "—";

  const amount = Number(value);

  if (amount >= 1_000_000) {
    const millions = amount / 1_000_000;
    return `€${millions.toLocaleString("pt-BR", {
      minimumFractionDigits: millions % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 2,
    })}M`;
  }

  if (amount >= 1_000) {
    const thousands = amount / 1_000;
    return `€${thousands.toLocaleString("pt-BR", {
      minimumFractionDigits: thousands % 1 === 0 ? 0 : 1,
      maximumFractionDigits: 1,
    })}K`;
  }

  return `€${amount.toLocaleString("pt-BR")}`;
}

function getNextBid(auction: StaffAuction | null) {
  if (!auction) return null;

  const base = Math.max(
    Number(auction.current_bid || 0),
    Number(auction.starting_value || 0)
  );

  if (base <= 0) return null;

  return Math.ceil(base * 1.15);
}

function getRemainingTime(endsAt: string | null, now: number) {
  if (!endsAt) return "Sem leilão";

  const diff = new Date(endsAt).getTime() - now;

  if (diff <= 0) return "Encerrado";

  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(2, "0")}`;
}

export default function StaffShoppingListPage() {
  const router = useRouter();

  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);

  const [loading, setLoading] = useState(true);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [biddingAuctionId, setBiddingAuctionId] = useState<number | null>(null);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [now, setNow] = useState(Date.now());

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

    const coachIds = cartRows.map((row) => Number(row.coach_id));

    const [{ data: coaches, error: coachesError }, { data: auctions, error: auctionsError }] =
      await Promise.all([
        supabase
          .from("coaches")
          .select("id, name, role, nationality, team_id")
          .in("id", coachIds),

        supabase
          .from("staff_auctions")
          .select(
            "id, coach_id, status, starting_value, current_bid, winner_team_id, ends_at, created_at"
          )
          .in("coach_id", coachIds)
          .order("created_at", { ascending: false }),
      ]);

    if (coachesError) {
      setError(coachesError.message);
      setLoading(false);
      return;
    }

    if (auctionsError) {
      setError(auctionsError.message);
      setLoading(false);
      return;
    }

    const coachMap = new Map(
      (coaches || []).map((coach) => [Number(coach.id), coach])
    );

    // Mantém somente o leilão mais recente de cada profissional.
    const auctionMap = new Map<number, StaffAuction>();

    for (const rawAuction of auctions || []) {
      const coachId = Number(rawAuction.coach_id);

      if (!auctionMap.has(coachId)) {
        auctionMap.set(coachId, {
          id: Number(rawAuction.id),
          coach_id: coachId,
          status: rawAuction.status,
          starting_value:
            rawAuction.starting_value == null
              ? null
              : Number(rawAuction.starting_value),
          current_bid:
            rawAuction.current_bid == null ? null : Number(rawAuction.current_bid),
          winner_team_id:
            rawAuction.winner_team_id == null
              ? null
              : Number(rawAuction.winner_team_id),
          ends_at: rawAuction.ends_at,
        });
      }
    }

    const winnerTeamIds = Array.from(
      new Set(
        Array.from(auctionMap.values())
          .map((auction) => auction.winner_team_id)
          .filter((id): id is number => id != null)
      )
    );

    let teamNameMap = new Map<number, string>();

    if (winnerTeamIds.length > 0) {
      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("id, name")
        .in("id", winnerTeamIds);

      if (teamsError) {
        setError(teamsError.message);
        setLoading(false);
        return;
      }

      teamNameMap = new Map(
        (teams || []).map((team) => [Number(team.id), String(team.name)])
      );
    }

    setItems(
      cartRows.map((row) => {
        const coachId = Number(row.coach_id);
        const auction = auctionMap.get(coachId) || null;

        return {
          ...(row as CartRow),
          coach: (coachMap.get(coachId) as Coach) || null,
          auction,
          leadingTeamName:
            auction?.winner_team_id != null
              ? teamNameMap.get(auction.winner_team_id) || null
              : null,
        };
      })
    );

    setLoading(false);
  }, [router]);

  useEffect(() => {
    loadCart();
  }, [loadCart]);

  // Relógio da tela.
  useEffect(() => {
    const interval = window.setInterval(() => {
      setNow(Date.now());
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  // Atualiza automaticamente se a lista, o staff ou qualquer leilão de staff mudar.
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
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_auctions",
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
      `Remover ${item.coach?.name || "este staff"} da Lista Preferencial?`
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

    setMessage("Staff removido da Lista Preferencial.");
    setRemovingId(null);
  }

  async function coverBid(item: CartItem) {
    if (!item.auction) return;

    const nextBid = getNextBid(item.auction);

    if (!nextBid) {
      setError("Não foi possível calcular o próximo lance.");
      return;
    }

    const confirmed = window.confirm(
      `Cobrir o lance de ${item.coach?.name || "este staff"} com ${formatMoney(
        nextBid
      )}?`
    );

    if (!confirmed) return;

    setBiddingAuctionId(item.auction.id);
    setError("");
    setMessage("");

    try {
      const { error: bidError } = await supabase.rpc("place_staff_bid", {
        staff_auction_id_input: item.auction.id,
        amount_input: nextBid,
      });

      if (bidError) {
        const text = bidError.message || "";

        if (text.includes("INSUFFICIENT_AVAILABLE_BUDGET")) {
          throw new Error("Saldo disponível insuficiente para este lance.");
        }

        if (text.includes("TRANSFER_WINDOW_CLOSED")) {
          throw new Error("O mercado está fechado.");
        }

        if (
          text.includes("AUCTION_EXPIRED") ||
          text.includes("AUCTION_NOT_ACTIVE")
        ) {
          throw new Error("Este leilão não está mais ativo.");
        }

        if (text.includes("BID_TOO_LOW")) {
          await loadCart();
          throw new Error(
            "Outro clube deu um lance antes de você. A lista foi atualizada."
          );
        }

        throw bidError;
      }

      setMessage(
        `Lance de ${formatMoney(nextBid)} enviado para ${
          item.coach?.name || "o staff"
        }.`
      );

      await loadCart();
    } catch (err) {
      console.error("Erro ao cobrir lance de staff:", err);

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível realizar o lance."
      );
    } finally {
      setBiddingAuctionId(null);
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

  const activeAuctionCount = items.filter((item) => {
    if (!item.auction) return false;

    return (
      item.auction.status === "active" &&
      !!item.auction.ends_at &&
      new Date(item.auction.ends_at).getTime() > now
    );
  }).length;

  const leadingCount = items.filter(
    (item) =>
      item.auction?.winner_team_id != null &&
      item.auction.winner_team_id === myTeam?.id
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
              Lista Preferencial de Staff
            </h1>

            <p className="mt-3 text-zinc-400">
              Acompanhe somente os profissionais que interessam ao{" "}
              {myTeam?.name || "seu clube"} e cubra lances sem sair desta página.
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
          <section className="mt-8 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 text-sm font-bold text-purple-300">
                {items.length} na lista
              </span>

              <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-bold text-green-400">
                {activeAuctionCount} em leilão
              </span>

              <span className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-2 text-sm font-bold text-yellow-300">
                {leadingCount} sendo vencido{leadingCount === 1 ? "" : "s"} por você
              </span>
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
            <h2 className="text-3xl font-black">Selecionados</h2>

            <span className="rounded-xl border border-purple-500/30 bg-purple-500/10 px-4 py-2 font-black text-purple-300">
              {filteredItems.length}
            </span>
          </div>

          {loading ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center text-zinc-400">
              Carregando Lista Preferencial...
            </div>
          ) : items.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-12 text-center">
              <p className="text-6xl">⭐</p>

              <h3 className="mt-5 text-3xl font-black">
                Lista Preferencial vazia
              </h3>

              <p className="mt-3 text-zinc-400">
                Adicione profissionais que você deseja acompanhar.
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
              <h3 className="text-2xl font-black">Nenhum resultado</h3>

              <p className="mt-3 text-zinc-400">
                Nenhum profissional corresponde à sua busca.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-5 md:grid-cols-2">
              {filteredItems.map((item) => {
                const coach = item.coach;

                if (!coach) return null;

                const auction = item.auction;
                const nextBid = getNextBid(auction);

                const isAuctionActive =
                  auction?.status === "active" &&
                  !!auction.ends_at &&
                  new Date(auction.ends_at).getTime() > now;

                const myTeamIsLeading =
                  auction?.winner_team_id != null &&
                  auction.winner_team_id === myTeam?.id;

                const displayedCurrentBid =
                  auction?.current_bid != null
                    ? Number(auction.current_bid)
                    : auction?.starting_value != null
                    ? Number(auction.starting_value)
                    : null;

                return (
                  <article
                    key={item.id}
                    className={`rounded-2xl border p-6 ${
                      myTeamIsLeading
                        ? "border-green-500/40 bg-green-500/5"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-purple-500/10 text-3xl">
                        👔
                      </div>

                      {myTeamIsLeading ? (
                        <span className="rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs font-black text-green-400">
                          VOCÊ ESTÁ GANHANDO
                        </span>
                      ) : isAuctionActive ? (
                        <span className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs font-black text-yellow-300">
                          EM LEILÃO
                        </span>
                      ) : (
                        <span className="rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-2 text-xs font-black text-zinc-300">
                          SEM LEILÃO ATIVO
                        </span>
                      )}
                    </div>

                    <p className="mt-5 font-black text-purple-400">
                      {coach.role || "Comissão técnica"}
                    </p>

                    <h3 className="mt-2 text-2xl font-black">{coach.name}</h3>

                    <p className="mt-3 text-zinc-400">
                      {coach.nationality || "Nacionalidade não informada"}
                    </p>

                    <div className="mt-6 grid grid-cols-2 gap-3">
                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Último lance
                        </p>

                        <p className="mt-2 text-lg font-black text-white">
                          {auction
                            ? formatMoney(displayedCurrentBid)
                            : "Sem lance"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Quem está ganhando
                        </p>

                        <p
                          className={`mt-2 text-lg font-black ${
                            myTeamIsLeading ? "text-green-400" : "text-white"
                          }`}
                        >
                          {auction?.winner_team_id
                            ? item.leadingTeamName || "Clube não identificado"
                            : "Sem lances"}
                        </p>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Tempo restante
                        </p>

                        <p
                          className={`mt-2 text-lg font-black ${
                            isAuctionActive ? "text-yellow-300" : "text-zinc-400"
                          }`}
                        >
                          {getRemainingTime(auction?.ends_at || null, now)}
                        </p>
                      </div>

                      <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4">
                        <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                          Próximo lance +15%
                        </p>

                        <p className="mt-2 text-lg font-black text-purple-300">
                          {nextBid ? formatMoney(nextBid) : "—"}
                        </p>
                      </div>
                    </div>

                    {isAuctionActive && nextBid && !myTeamIsLeading && (
                      <button
                        type="button"
                        onClick={() => coverBid(item)}
                        disabled={biddingAuctionId === auction?.id}
                        className="mt-4 w-full rounded-xl bg-green-600 px-5 py-4 text-center font-black text-white transition hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                      >
                        {biddingAuctionId === auction?.id
                          ? "ENVIANDO LANCE..."
                          : `COBRIR LANCE — ${formatMoney(nextBid)}`}
                      </button>
                    )}

                    {myTeamIsLeading && isAuctionActive && (
                      <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-center font-black text-green-400">
                        Seu clube está com o maior lance.
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
                          biddingAuctionId === auction?.id
                        }
                        onClick={() => removeItem(item)}
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {removingId === item.id ? "Removendo..." : "Remover"}
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
