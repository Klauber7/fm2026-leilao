"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
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

function AuctionTimer({
  endsAt,
  status,
}: {
  endsAt: string;
  status: string;
}) {
  const [timeLeft, setTimeLeft] =
    useState("00:00:00");

  useEffect(() => {
    function updateTimer() {
      if (status !== "active") {
        setTimeLeft("00:00:00");
        return;
      }

      const difference =
        new Date(endsAt).getTime() -
        Date.now();

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
  }, [endsAt, status]);

  return (
    <span
      className={
        timeLeft === "00:00:00"
          ? "text-red-400"
          : "text-yellow-400"
      }
    >
      {timeLeft}
    </span>
  );
}

export default function StaffAuctionsPage() {
  const [auctions, setAuctions] =
    useState<StaffAuction[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [errorMessage, setErrorMessage] =
    useState("");

  const loadAuctions =
    useCallback(async () => {
      const { data, error } =
        await supabase
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
          .order("status", {
            ascending: false,
          })
          .order("ends_at", {
            ascending: true,
          });

      if (error) {
        console.error(error);
        setErrorMessage(error.message);
        setLoading(false);
        return;
      }

      setAuctions(
        (data || []).map((item: any) => ({
          ...item,
          coaches: Array.isArray(item.coaches)
            ? item.coaches[0] ?? null
            : item.coaches ?? null,
        })) as StaffAuction[]
      );

      setErrorMessage("");
      setLoading(false);
    }, []);

  const closeExpiredAuctions =
    useCallback(async () => {
      const expired = auctions.filter(
        (auction) =>
          auction.status === "active" &&
          new Date(
            auction.ends_at
          ).getTime() <= Date.now()
      );

      if (expired.length === 0) {
        return;
      }

      await Promise.all(
        expired.map(async (auction) => {
          const { error } =
            await supabase.rpc(
              "close_expired_staff_auction",
              {
                staff_auction_id_input:
                  auction.id,
              }
            );

          if (error) {
            console.error(
              error.message
            );
          }
        })
      );

      await loadAuctions();
    }, [auctions, loadAuctions]);

  useEffect(() => {
    loadAuctions();

    const channel = supabase
      .channel("staff-auctions-list")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_auctions",
        },
        loadAuctions
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "staff_bids",
        },
        loadAuctions
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [loadAuctions]);

  useEffect(() => {
    if (auctions.length === 0) {
      return;
    }

    closeExpiredAuctions();

    const timer = window.setInterval(
      closeExpiredAuctions,
      5000
    );

    return () =>
      window.clearInterval(timer);
  }, [
    auctions,
    closeExpiredAuctions,
  ]);

  const activeAuctions =
    auctions.filter(
      (auction) =>
        auction.status === "active"
    );

  const finishedAuctions =
    auctions.filter(
      (auction) =>
        auction.status !== "active"
    );

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        Carregando leilões da comissão...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-10">
      <div className="mx-auto max-w-7xl">
        <p className="font-bold uppercase tracking-widest text-green-400">
          FriendZone League FM
        </p>

        <h1 className="mt-2 text-5xl font-black md:text-6xl">
          Leilões da Comissão
        </h1>

        <p className="mt-3 text-lg text-zinc-400">
          Dispute treinadores e membros
          da comissão técnica.
        </p>

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {errorMessage}
          </div>
        )}

        <section className="mt-12">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-3xl font-black">
              Leilões ativos
            </h2>

            <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 font-bold text-green-400">
              {activeAuctions.length}
            </span>
          </div>

          {activeAuctions.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">
              <p className="text-zinc-400">
                Nenhum leilão ativo no
                momento.
              </p>

              <Link
                href="/coaches"
                className="mt-5 inline-block font-bold text-green-400"
              >
                Ver profissionais
              </Link>
            </div>
          ) : (
            <div className="mt-6 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {activeAuctions.map(
                (auction) => (
                  <article
                    key={auction.id}
                    className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900"
                  >
                    <div className="h-44 bg-zinc-800">
                      {auction.coaches
                        ?.image_url ? (
                        <img
                          src={
                            auction.coaches
                              .image_url
                          }
                          alt={
                            auction.coaches
                              .name
                          }
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-6xl">
                          👔
                        </div>
                      )}
                    </div>

                    <div className="p-6">
                      <p className="font-bold text-green-400">
                        {auction.coaches
                          ?.role ||
                          "Comissão técnica"}
                      </p>

                      <h3 className="mt-2 text-2xl font-black">
                        {auction.coaches
                          ?.name ||
                          `Leilão #${auction.id}`}
                      </h3>

                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="rounded-xl bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">
                            Lance atual
                          </p>

                          <p className="mt-1 font-black text-green-400">
                            {money(
                              auction.current_bid ??
                                auction.starting_value
                            )}
                          </p>
                        </div>

                        <div className="rounded-xl bg-zinc-950 p-4">
                          <p className="text-sm text-zinc-500">
                            Tempo
                          </p>

                          <p className="mt-1 font-black">
                            <AuctionTimer
                              endsAt={
                                auction.ends_at
                              }
                              status={
                                auction.status
                              }
                            />
                          </p>
                        </div>
                      </div>

                      <Link
                        href={`/staff-auctions/${auction.id}`}
                        className="mt-6 block rounded-xl bg-green-600 py-3 text-center font-black transition hover:bg-green-500"
                      >
                        Abrir leilão
                      </Link>
                    </div>
                  </article>
                )
              )}
            </div>
          )}
        </section>

        {finishedAuctions.length >
          0 && (
          <section className="mt-16">
            <h2 className="text-3xl font-black">
              Encerrados
            </h2>

            <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {finishedAuctions.map(
                (auction) => (
                  <Link
                    key={auction.id}
                    href={`/staff-auctions/${auction.id}`}
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
                  >
                    <p className="text-sm font-bold text-red-400">
                      {auction.status ===
                      "cancelled"
                        ? "CANCELADO"
                        : "ENCERRADO"}
                    </p>

                    <h3 className="mt-3 text-xl font-black">
                      {auction.coaches
                        ?.name ||
                        `Leilão #${auction.id}`}
                    </h3>

                    <p className="mt-3 text-green-400 font-black">
                      {money(
                        auction.current_bid ??
                          auction.starting_value
                      )}
                    </p>
                  </Link>
                )
              )}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}