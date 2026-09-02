"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useState,
} from "react";
import { supabase } from "@/lib/supabase";

type Player = {
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  ca: number | null;
};

type Auction = {
  id: number;
  player_id: number | null;
  item_type: string | null;
  starting_value: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  status: string | null;
  ends_at: string | null;
  players: Player | null;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
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

function formatTime(ms: number) {
  if (ms <= 0) {
    return "00:00:00";
  }

  const totalSeconds =
    Math.floor(ms / 1000);

  const hours = String(
    Math.floor(
      totalSeconds / 3600
    )
  ).padStart(2, "0");

  const minutes = String(
    Math.floor(
      (totalSeconds % 3600) /
        60
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
  marketOpen,
}: {
  endsAt: string | null;
  status: string | null;
  marketOpen: boolean;
}) {
  const [
    timeLeft,
    setTimeLeft,
  ] = useState("00:00:00");

  useEffect(() => {
    function updateTimer() {
      /*
        MERCADO FECHADO
        = RELÃ“GIO VISUAL PARADO
      */

      if (!marketOpen) {
        setTimeLeft("PAUSADO");
        return;
      }

      if (
        !endsAt ||
        status !== "active"
      ) {
        setTimeLeft("00:00:00");
        return;
      }

      const difference =
        new Date(
          endsAt
        ).getTime() -
        Date.now();

      setTimeLeft(
        formatTime(
          difference
        )
      );
    }

    updateTimer();

    const timer =
      window.setInterval(
        updateTimer,
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    endsAt,
    status,
    marketOpen,
  ]);

  if (!marketOpen) {
    return (
      <span className="text-red-400">
        PAUSADO
      </span>
    );
  }

  return (
    <span
      className={
        timeLeft ===
        "00:00:00"
          ? "text-red-400"
          : "text-yellow-400"
      }
    >
      {timeLeft}
    </span>
  );
}

export default function AuctionsPage() {
  const [
    auctions,
    setAuctions,
  ] =
    useState<Auction[]>([]);

  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<TransferWindow | null>(
      null
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState("");

  /*
    CARREGAR LEILÃ•ES
    + JANELA
  */

  const loadAuctions =
    useCallback(async () => {
      try {
        setLoading(true);

        const [
          auctionsResult,
          windowResult,
        ] =
          await Promise.all([
            supabase
              .from("auctions")
              .select(`
                id,
                player_id,
                item_type,
                starting_value,
                current_bid,
                winner_team_id,
                status,
                ends_at,
                players (
                  name,
                  age,
                  position,
                  nationality,
                  ca
                )
              `)
              .order(
                "status",
                {
                  ascending:
                    false,
                }
              )
              .order(
                "ends_at",
                {
                  ascending:
                    true,
                }
              ),

            supabase
              .from(
                "transfer_windows"
              )
              .select(`
                id,
                window_number,
                name,
                status
              `)
              .eq(
                "status",
                "open"
              )
              .order(
                "window_number",
                {
                  ascending:
                    false,
                }
              )
              .limit(1)
              .maybeSingle(),
          ]);

        if (
          auctionsResult.error
        ) {
          throw auctionsResult.error;
        }

        if (
          windowResult.error
        ) {
          throw windowResult.error;
        }

        setAuctions(
          (auctionsResult.data || []).map((item: any) => ({
            ...item,
            players: Array.isArray(item.players)
              ? item.players[0] ?? null
              : item.players ?? null,
          })) as Auction[]
        );

        setCurrentWindow(
          windowResult.data
            ? (windowResult.data as TransferWindow)
            : null
        );

        setErrorMessage("");
      } catch (error) {
        console.error(
          error
        );

        if (
          typeof error ===
            "object" &&
          error !== null &&
          "message" in
            error
        ) {
          setErrorMessage(
            String(
              (
                error as {
                  message:
                    unknown;
                }
              ).message
            )
          );
        } else {
          setErrorMessage(
            "Erro ao carregar leilÃµes."
          );
        }
      } finally {
        setLoading(false);
      }
    }, []);

  /*
    ENCERRAR LEILÃ•ES
    EXPIRADOS

    SOMENTE QUANDO
    O MERCADO ESTÃ ABERTO
  */

  const closeExpiredAuctions =
    useCallback(
      async (
        auctionList: Auction[]
      ) => {
        /*
          SEM JANELA =
          NÃƒO ENCERRA AUTOMATICAMENTE
        */

        if (!currentWindow) {
          return;
        }

        const expiredAuctions =
          auctionList.filter(
            (
              auction
            ) =>
              auction.status ===
                "active" &&
              auction.ends_at &&
              new Date(
                auction.ends_at
              ).getTime() <=
                Date.now()
          );

        if (
          expiredAuctions.length ===
          0
        ) {
          return;
        }

        await Promise.all(
          expiredAuctions.map(
            async (
              auction
            ) => {
              const {
                error,
              } =
                await supabase.rpc(
                  "close_expired_auction",
                  {
                    auction_id_input:
                      auction.id,
                  }
                );

              if (error) {
                console.error(
                  `Erro ao encerrar leilÃ£o ${auction.id}:`,
                  error.message
                );
              }
            }
          )
        );

        await loadAuctions();
      },
      [
        currentWindow,
        loadAuctions,
      ]
    );

  /*
    PRIMEIRO LOAD
  */

  useEffect(() => {
    loadAuctions();
  }, [loadAuctions]);

  /*
    REALTIME
  */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          "auctions-list"
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auctions",
          },
          () => {
            loadAuctions();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "bids",
          },
          () => {
            loadAuctions();
          }
        )

        /*
          JANELA ABRIU /
          FECHOU
        */

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "transfer_windows",
          },
          () => {
            loadAuctions();
          }
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [loadAuctions]);

  /*
    CHECK EXPIRADOS
  */

  useEffect(() => {
    if (
      auctions.length ===
      0
    ) {
      return;
    }

    /*
      MERCADO FECHADO:
      NÃƒO PROCESSA
    */

    if (!currentWindow) {
      return;
    }

    closeExpiredAuctions(
      auctions
    );

    const timer =
      window.setInterval(
        () => {
          closeExpiredAuctions(
            auctions
          );
        },
        5000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    auctions,
    currentWindow,
    closeExpiredAuctions,
  ]);

  const activeAuctions =
    auctions.filter(
      (
        auction
      ) =>
        auction.status ===
        "active"
    );

  const closedAuctions =
    auctions.filter(
      (
        auction
      ) =>
        auction.status ===
          "closed" ||
        auction.status ===
          "cancelled"
    );

  const marketOpen =
    Boolean(
      currentWindow
    );

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <p className="text-zinc-300">
          Carregando leilÃµes...
        </p>
      </main>
    );
  }

  /*
    ERRO
  */

  if (errorMessage) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">

        <h1 className="text-3xl font-black text-red-500">
          Erro ao carregar leilÃµes
        </h1>

        <p className="mt-3 text-zinc-300">
          {errorMessage}
        </p>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-12 text-white md:px-8">

      <div className="mx-auto max-w-7xl">

        <p className="font-bold uppercase tracking-widest text-green-400">
          FriendZone League FM
        </p>

        <h1 className="mt-2 text-5xl font-black md:text-6xl">
          LeilÃµes
        </h1>

        <p className="mt-3 text-lg text-zinc-400 md:text-xl">
          Dispute jogadores para montar seu elenco.
        </p>

        {/* STATUS DA JANELA */}

        {marketOpen ? (
          <div className="mt-8 rounded-2xl border border-green-500/30 bg-green-500/10 p-5">

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

              <div>

                <p className="font-black text-green-400">
                  ðŸŸ¢ MERCADO ABERTO
                </p>

                <p className="mt-1 text-sm text-zinc-300">
                  Janela{" "}
                  {
                    currentWindow
                      ?.window_number
                  }{" "}
                  estÃ¡ aberta. Os leilÃµes estÃ£o liberados.
                </p>

              </div>

              <span className="rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-400">
                JANELA{" "}
                {
                  currentWindow
                    ?.window_number
                }
              </span>

            </div>

          </div>
        ) : (
          <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/10 p-6">

            <div className="flex items-start gap-4">

              <div className="text-3xl">
                ðŸ”’
              </div>

              <div>

                <p className="text-xl font-black text-red-400">
                  MERCADO FECHADO
                </p>

                <p className="mt-2 text-zinc-300">
                  A janela de transferÃªncias estÃ¡ fechada. Os leilÃµes estÃ£o pausados e nenhum clube pode enviar novos lances.
                </p>

              </div>

            </div>

          </div>
        )}

        {/* ATIVOS */}

        <section className="mt-12">

          <div className="flex items-center justify-between">

            <h2 className="text-3xl font-black">
              LeilÃµes ativos
            </h2>

            <span
              className={`rounded-xl border px-4 py-2 font-bold ${
                marketOpen
                  ? "border-green-500/30 bg-green-500/10 text-green-400"
                  : "border-red-500/30 bg-red-500/10 text-red-400"
              }`}
            >
              {
                activeAuctions.length
              }{" "}
              ativos
            </span>

          </div>

          {activeAuctions.length ===
          0 ? (
            <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900 p-8">

              <p className="text-zinc-300">
                Nenhum leilÃ£o ativo no momento.
              </p>

            </div>
          ) : (
            <div className="mt-6 grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {activeAuctions.map(
                (
                  auction
                ) => {
                  const currentValue =
                    auction.current_bid ??
                    auction.starting_value ??
                    0;

                  return (
                    <article
                      key={
                        auction.id
                      }
                      className={`flex flex-col rounded-2xl border bg-zinc-900 p-6 ${
                        marketOpen
                          ? "border-zinc-800"
                          : "border-red-500/20 opacity-80"
                      }`}
                    >

                      <div className="flex items-center justify-between gap-4">

                        <p
                          className={`font-bold ${
                            marketOpen
                              ? "text-green-400"
                              : "text-red-400"
                          }`}
                        >
                          Jogador
                        </p>

                        <span
                          className={`rounded-lg border px-3 py-1 text-xs font-black ${
                            marketOpen
                              ? "border-green-500/40 text-green-400"
                              : "border-red-500/40 text-red-400"
                          }`}
                        >
                          {marketOpen
                            ? "ATIVO"
                            : "PAUSADO"}
                        </span>

                      </div>

                      <h3 className="mt-4 text-2xl font-black">
                        {auction.players
                          ?.name ||
                          `LeilÃ£o #${auction.id}`}
                      </h3>

                      <p className="mt-2 text-zinc-400">
                        {auction.players
                          ?.position ||
                          "-"}{" "}
                        â€¢{" "}
                        {auction.players
                          ?.age ||
                          "-"}{" "}
                        anos
                      </p>

                      <div className="mt-5 grid grid-cols-2 gap-3">

                        <div className="rounded-xl bg-zinc-950 p-4">

                          <p className="text-sm text-zinc-500">
                            Lance atual
                          </p>

                          <p className="mt-1 text-lg font-black text-green-400">
                            {money(
                              currentValue
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
                              marketOpen={
                                marketOpen
                              }
                            />

                          </p>

                        </div>

                      </div>

                      <Link
                        href={`/auctions/${auction.id}`}
                        className={`mt-6 block w-full rounded-xl py-3 text-center font-bold transition ${
                          marketOpen
                            ? "bg-green-600 hover:bg-green-500"
                            : "border border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/15"
                        }`}
                      >
                        {marketOpen
                          ? "Abrir leilÃ£o"
                          : "Ver leilÃ£o pausado"}
                      </Link>

                    </article>
                  );
                }
              )}

            </div>
          )}

        </section>

        {/* ENCERRADOS */}

        {closedAuctions.length >
          0 && (
          <section className="mt-16">

            <h2 className="text-3xl font-black">
              LeilÃµes encerrados
            </h2>

            <div className="mt-6 grid gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">

              {closedAuctions.map(
                (
                  auction
                ) => (
                  <article
                    key={
                      auction.id
                    }
                    className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6"
                  >

                    <p className="text-sm font-bold text-red-400">
                      {auction.status ===
                      "cancelled"
                        ? "CANCELADO"
                        : "ENCERRADO"}
                    </p>

                    <h3 className="mt-3 text-xl font-black">
                      {auction.players
                        ?.name ||
                        `LeilÃ£o #${auction.id}`}
                    </h3>

                    <p className="mt-4 font-black text-green-400">
                      {money(
                        auction.current_bid ??
                          auction.starting_value
                      )}
                    </p>

                    <Link
                      href={`/auctions/${auction.id}`}
                      className="mt-5 block rounded-xl border border-zinc-700 py-3 text-center font-bold transition hover:border-zinc-500"
                    >
                      Ver resultado
                    </Link>

                  </article>
                )
              )}

            </div>

          </section>
        )}

      </div>

    </main>
  );
}