"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Coach = {
  name: string;
  role: string | null;
  nationality: string | null;
  age: number | null;
  ca: number | null;
  pa: number | null;
  image_url: string | null;
};

type StaffAuction = {
  id: number;
  coach_id: number;
  starting_value: number;
  current_bid: number | null;
  winner_team_id: number | null;
  status: string;
  ends_at: string;
  coaches: Coach | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
};

type StaffBid = {
  id: number;
  staff_auction_id: number;
  coach_id: number;
  team_id: number;
  team_name: string;
  amount: number;
  created_at: string;
};

function money(
  value: number | null | undefined
) {
  return Number(value || 0).toLocaleString(
    "pt-BR",
    {
      style: "currency",
      currency: "BRL",
      maximumFractionDigits: 0,
    }
  );
}

function formatTime(milliseconds: number) {
  if (milliseconds <= 0) {
    return "00:00:00";
  }

  const totalSeconds = Math.floor(
    milliseconds / 1000
  );

  const hours = String(
    Math.floor(totalSeconds / 3600)
  ).padStart(2, "0");

  const minutes = String(
    Math.floor(
      (totalSeconds % 3600) / 60
    )
  ).padStart(2, "0");

  const seconds = String(
    totalSeconds % 60
  ).padStart(2, "0");

  return `${hours}:${minutes}:${seconds}`;
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

export default function StaffAuctionDetailPage() {
  const params = useParams();
  const auctionId = Number(params.id);

  const [auction, setAuction] =
    useState<StaffAuction | null>(null);

  const [team, setTeam] =
    useState<Team | null>(null);

  const [bids, setBids] =
    useState<StaffBid[]>([]);

  const [bidAmount, setBidAmount] =
    useState("");

  const [timeLeft, setTimeLeft] =
    useState("00:00:00");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [closing, setClosing] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadPage =
    useCallback(async () => {
      try {
        const {
          data: auctionData,
          error: auctionError,
        } = await supabase
          .from("staff_auctions")
          .select(`
            id,
            coach_id,
            starting_value,
            current_bid,
            winner_team_id,
            status,
            ends_at,
            coaches (
              name,
              role,
              nationality,
              age,
              ca,
              pa,
              image_url
            )
          `)
          .eq("id", auctionId)
          .maybeSingle();

        if (auctionError) {
          throw auctionError;
        }

        const loadedAuction =
          auctionData as StaffAuction | null;

        setAuction(loadedAuction);

        if (loadedAuction) {
          const {
            data: bidsData,
            error: bidsError,
          } = await supabase
            .from("staff_bids")
            .select("*")
            .eq(
              "staff_auction_id",
              loadedAuction.id
            )
            .order("created_at", {
              ascending: false,
            });

          if (bidsError) {
            throw bidsError;
          }

          setBids(
            (bidsData ||
              []) as StaffBid[]
          );
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (user) {
          const {
            data: teamData,
            error: teamError,
          } = await supabase
            .from("teams")
            .select(
              "id, name, budget"
            )
            .eq(
              "manager_id",
              user.id
            )
            .maybeSingle();

          if (teamError) {
            throw teamError;
          }

          setTeam(
            teamData as Team | null
          );
        } else {
          setTeam(null);
        }

        setErrorMessage("");
      } catch (error) {
        console.error(error);

        setErrorMessage(
          getErrorMessage(error)
        );
      } finally {
        setLoading(false);
      }
    }, [auctionId]);

  const closeAuction =
    useCallback(async () => {
      if (closing) {
        return;
      }

      setClosing(true);

      const { error } =
        await supabase.rpc(
          "close_expired_staff_auction",
          {
            staff_auction_id_input:
              auctionId,
          }
        );

      if (error) {
        setErrorMessage(
          error.message
        );
      }

      await loadPage();
      setClosing(false);
    }, [
      auctionId,
      closing,
      loadPage,
    ]);

  useEffect(() => {
    loadPage();

    const channel = supabase
      .channel(
        `staff-auction-${auctionId}`
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_auctions",
          filter: `id=eq.${auctionId}`,
        },
        loadPage
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_bids",
          filter:
            `staff_auction_id=eq.${auctionId}`,
        },
        loadPage
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [auctionId, loadPage]);

  useEffect(() => {
    function updateTimer() {
      if (
        !auction ||
        auction.status !== "active"
      ) {
        setTimeLeft("00:00:00");
        return;
      }

      const difference =
        new Date(
          auction.ends_at
        ).getTime() - Date.now();

      if (difference <= 0) {
        setTimeLeft("00:00:00");

        if (!closing) {
          closeAuction();
        }

        return;
      }

      setTimeLeft(
        formatTime(difference)
      );
    }

    updateTimer();

    const timer = window.setInterval(
      updateTimer,
      1000
    );

    return () =>
      window.clearInterval(timer);
  }, [
    auction,
    closing,
    closeAuction,
  ]);

  const currentValue = useMemo(
    () =>
      Number(
        auction?.current_bid ??
          auction?.starting_value ??
          0
      ),
    [
      auction?.current_bid,
      auction?.starting_value,
    ]
  );

  const leader = bids.find(
    (bid) =>
      bid.team_id ===
        auction?.winner_team_id &&
      Number(bid.amount) ===
        Number(auction?.current_bid)
  );

  async function placeBid() {
    if (!auction) {
      return;
    }

    if (!team) {
      alert(
        "Você precisa possuir um clube."
      );
      return;
    }

    const amount = Number(bidAmount);

    if (
      !Number.isFinite(amount) ||
      amount <= currentValue
    ) {
      alert(
        `O lance precisa ser maior que ${money(
          currentValue
        )}.`
      );

      return;
    }

    setSaving(true);
    setErrorMessage("");

    const { error } =
      await supabase.rpc(
        "place_staff_bid",
        {
          staff_auction_id_input:
            auction.id,
          amount_input: amount,
        }
      );

    if (error) {
      setErrorMessage(error.message);
      alert(error.message);
      setSaving(false);
      return;
    }

    setBidAmount("");
    await loadPage();
    setSaving(false);
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        Carregando leilão...
      </main>
    );
  }

  if (!auction) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        Leilão não encontrado.
      </main>
    );
  }

  const isActive =
    auction.status === "active";

  const isClosed =
    auction.status === "closed";

  const isCancelled =
    auction.status === "cancelled";

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <Link
          href="/staff-auctions"
          className="font-bold text-green-400"
        >
          ← Voltar aos leilões
        </Link>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[380px_1fr]">
          <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">
            <div className="h-96 bg-zinc-800">
              {auction.coaches
                ?.image_url ? (
                <img
                  src={
                    auction.coaches
                      .image_url
                  }
                  alt={
                    auction.coaches.name
                  }
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
            <div className="flex flex-col justify-between gap-5 md:flex-row">
              <div>
                <p className="font-bold uppercase tracking-widest text-green-400">
                  {auction.coaches
                    ?.role ||
                    "Comissão técnica"}
                </p>

                <h1 className="mt-2 text-5xl font-black">
                  {auction.coaches
                    ?.name ||
                    "Profissional"}
                </h1>

                <p className="mt-3 text-zinc-400">
                  {auction.coaches
                    ?.nationality || "-"}{" "}
                  •{" "}
                  {auction.coaches
                    ?.age ?? "-"}{" "}
                  anos
                </p>
              </div>

              <span
                className={`h-fit rounded-xl border px-5 py-3 font-black ${
                  isActive
                    ? "border-green-500 text-green-400"
                    : isCancelled
                    ? "border-orange-500 text-orange-400"
                    : "border-red-500 text-red-400"
                }`}
              >
                {isActive
                  ? "ATIVO"
                  : isCancelled
                  ? "CANCELADO"
                  : "ENCERRADO"}
              </span>
            </div>

            <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  Tempo
                </p>

                <p className="mt-2 text-3xl font-black text-yellow-400">
                  {timeLeft}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  CA
                </p>

                <p className="mt-2 text-3xl font-black">
                  {auction.coaches
                    ?.ca ?? "-"}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  Lance atual
                </p>

                <p className="mt-2 text-2xl font-black text-green-400">
                  {money(currentValue)}
                </p>
              </div>

              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
                <p className="text-zinc-400">
                  Líder
                </p>

                <p className="mt-2 text-xl font-black">
                  {leader?.team_name ||
                    "Sem líder"}
                </p>
              </div>
            </section>

            {isActive && (
              <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-7">
                <h2 className="text-3xl font-black">
                  Dar lance
                </h2>

                <p className="mt-2 text-zinc-400">
                  Cada lance reinicia o
                  relógio para 1 hora.
                </p>

                <div className="mt-6 flex flex-col gap-4 md:flex-row">
                  <input
                    type="number"
                    value={bidAmount}
                    onChange={(event) =>
                      setBidAmount(
                        event.target.value
                      )
                    }
                    placeholder="Valor do lance"
                    className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-green-500"
                  />

                  <button
                    type="button"
                    onClick={placeBid}
                    disabled={
                      saving ||
                      closing ||
                      !team
                    }
                    className="rounded-xl bg-green-600 px-8 py-4 font-black disabled:bg-zinc-700"
                  >
                    {saving
                      ? "Enviando..."
                      : "Enviar lance"}
                  </button>
                </div>

                <p className="mt-4 text-zinc-400">
                  Seu clube:{" "}
                  <span className="font-bold text-white">
                    {team?.name ||
                      "Sem clube"}
                  </span>
                </p>

                <p className="mt-1 text-green-400">
                  Orçamento:{" "}
                  {money(team?.budget)}
                </p>
              </section>
            )}

            {isClosed && (
              <section className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">
                <p className="font-bold uppercase text-green-400">
                  Leilão encerrado
                </p>

                <h2 className="mt-3 text-4xl font-black">
                  {leader?.team_name ||
                    "Sem vencedor"}
                </h2>

                {leader && (
                  <p className="mt-3 text-green-400 font-black">
                    {money(
                      auction.current_bid
                    )}
                  </p>
                )}
              </section>
            )}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
          <h2 className="text-3xl font-black">
            Histórico de lances
          </h2>

          {bids.length === 0 ? (
            <p className="mt-6 text-zinc-500">
              Nenhum lance enviado.
            </p>
          ) : (
            <div className="mt-6 space-y-4">
              {bids.map((bid) => (
                <div
                  key={bid.id}
                  className="flex items-center justify-between border-b border-zinc-800 pb-4"
                >
                  <div>
                    <p className="font-black">
                      {bid.team_name}
                    </p>

                    <p className="mt-1 text-sm text-zinc-500">
                      {new Date(
                        bid.created_at
                      ).toLocaleString(
                        "pt-BR"
                      )}
                    </p>
                  </div>

                  <p className="text-xl font-black text-green-400">
                    {money(bid.amount)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}