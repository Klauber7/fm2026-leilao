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
  starting_value: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  status: string | null;
  ends_at: string | null;
  closed_at: string | null;
  players: Player | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
};

type Bid = {
  id: number;
  auction_id: number;
  player_id: number;
  team_id: number;
  team_name: string;
  amount: number;
  created_at: string;
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

function extractErrorMessage(
  error: unknown
) {
  if (
    typeof error ===
      "object" &&
    error !== null &&
    "message" in error &&
    typeof (
      error as {
        message?: unknown;
      }
    ).message ===
      "string"
  ) {
    const message = (
      error as {
        message: string;
      }
    ).message;

    if (
      message.includes(
        "TRANSFER_WINDOW_CLOSED"
      )
    ) {
      return "A janela de transferências está fechada.";
    }

    if (
      message.includes(
        "AUCTION_NOT_ACTIVE"
      )
    ) {
      return "Este leilão não está ativo.";
    }

    if (
      message.includes(
        "AUCTION_EXPIRED"
      )
    ) {
      return "O tempo deste leilão acabou.";
    }

    if (
      message.includes(
        "BID_TOO_LOW"
      )
    ) {
      return "O lance precisa ser maior que o lance atual.";
    }

    if (
      message.includes(
        "INSUFFICIENT_AVAILABLE_BUDGET"
      )
    ) {
      return "Seu clube não possui orçamento disponível suficiente.";
    }

    return message;
  }

  return "Ocorreu um erro inesperado.";
}

export default function AuctionDetailPage() {
  const params =
    useParams();

  const auctionId =
    Number(
      params.id
    );

  const [
    auction,
    setAuction,
  ] =
    useState<Auction | null>(
      null
    );

  const [
    team,
    setTeam,
  ] =
    useState<Team | null>(
      null
    );

  const [
    currentWindow,
    setCurrentWindow,
  ] =
    useState<TransferWindow | null>(
      null
    );

  const [
    bids,
    setBids,
  ] =
    useState<Bid[]>([]);

  const [
    committedBudget,
    setCommittedBudget,
  ] = useState(0);

  const [
    bidAmount,
    setBidAmount,
  ] =
    useState("");

  const [
    timeLeft,
    setTimeLeft,
  ] =
    useState("00:00:00");

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    saving,
    setSaving,
  ] =
    useState(false);

  const [
    closing,
    setClosing,
  ] =
    useState(false);

  const [
    errorMessage,
    setErrorMessage,
  ] =
    useState("");

  /*
    CARREGAR
  */

  const loadAuction =
    useCallback(async () => {
      if (
        !Number.isInteger(
          auctionId
        ) ||
        auctionId <= 0
      ) {
        setErrorMessage(
          "Número de leilão inválido."
        );

        setLoading(false);

        return;
      }

      try {
        /*
          AUTH
        */

        const {
          data: {
            user,
          },
        } =
          await supabase.auth.getUser();

        let myTeam:
          Team | null =
          null;

        /*
          CLUBE
        */

        if (user) {
          const {
            data:
              teamData,
            error:
              teamError,
          } =
            await supabase
              .from(
                "teams"
              )
              .select(
                "id, name, budget"
              )
              .eq(
                "manager_id",
                user.id
              )
              .maybeSingle();

          if (
            teamError
          ) {
            throw teamError;
          }

          myTeam =
            (teamData as Team | null) ??
            null;

          setTeam(
            myTeam
          );
        } else {
          setTeam(
            null
          );
        }

        /*
          LEILÃO + JANELA
        */

        const [
          auctionResult,
          windowResult,
        ] =
          await Promise.all([
            supabase
              .from(
                "auctions"
              )
              .select(`
                id,
                player_id,
                starting_value,
                current_bid,
                winner_team_id,
                status,
                ends_at,
                closed_at,
                players (
                  name,
                  age,
                  position,
                  nationality,
                  ca
                )
              `)
              .eq(
                "id",
                auctionId
              )
              .maybeSingle(),

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
          auctionResult.error
        ) {
          throw auctionResult.error;
        }

        if (
          windowResult.error
        ) {
          throw windowResult.error;
        }

        const loadedAuction =
          (auctionResult.data as Auction | null) ??
          null;

        setAuction(
          loadedAuction
        );

        setCurrentWindow(
          windowResult.data
            ? (windowResult.data as TransferWindow)
            : null
        );

        /*
          LANCES
        */

        if (
          loadedAuction
        ) {
          const {
            data:
              bidsData,
            error:
              bidsError,
          } =
            await supabase
              .from("bids")
              .select(`
                id,
                auction_id,
                player_id,
                team_id,
                team_name,
                amount,
                created_at
              `)
              .eq(
                "auction_id",
                loadedAuction.id
              )
              .order(
                "created_at",
                {
                  ascending:
                    false,
                }
              );

          if (
            bidsError
          ) {
            throw bidsError;
          }

          setBids(
            (bidsData ||
              []) as Bid[]
          );
        } else {
          setBids([]);
        }

        /*
          ORÇAMENTO
          COMPROMETIDO
        */

        if (myTeam) {
          const {
            data:
              commitments,
            error:
              commitmentsError,
          } =
            await supabase
              .from(
                "auctions"
              )
              .select(`
                id,
                current_bid
              `)
              .eq(
                "status",
                "active"
              )
              .eq(
                "winner_team_id",
                myTeam.id
              )
              .neq(
                "id",
                auctionId
              );

          if (
            commitmentsError
          ) {
            throw commitmentsError;
          }

          const totalCommitted =
            (
              commitments ||
              []
            ).reduce(
              (
                total,
                currentAuction
              ) =>
                total +
                Number(
                  currentAuction.current_bid ||
                    0
                ),
              0
            );

          setCommittedBudget(
            totalCommitted
          );
        } else {
          setCommittedBudget(
            0
          );
        }

        setErrorMessage("");
      } catch (error) {
        console.error(
          error
        );

        setErrorMessage(
          extractErrorMessage(
            error
          )
        );
      } finally {
        setLoading(false);
      }
    }, [auctionId]);

  /*
    ENCERRAR LEILÃO
  */

  const closeAuction =
    useCallback(async () => {
      /*
        MERCADO FECHADO =
        NÃO ENCERRA
      */

      if (
        !currentWindow
      ) {
        return;
      }

      if (closing) {
        return;
      }

      setClosing(
        true
      );

      try {
        const {
          error,
        } =
          await supabase.rpc(
            "close_expired_auction",
            {
              auction_id_input:
                auctionId,
            }
          );

        if (error) {
          throw error;
        }

        await loadAuction();
      } catch (error) {
        console.error(
          "Erro ao encerrar leilão:",
          error
        );

        setErrorMessage(
          extractErrorMessage(
            error
          )
        );
      } finally {
        setClosing(
          false
        );
      }
    }, [
      auctionId,
      closing,
      currentWindow,
      loadAuction,
    ]);

  /*
    LOAD
  */

  useEffect(() => {
    loadAuction();
  }, [loadAuction]);

  /*
    REALTIME
  */

  useEffect(() => {
    const channel =
      supabase
        .channel(
          `auction-detail-${auctionId}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "auctions",
            filter:
              `id=eq.${auctionId}`,
          },
          () => {
            loadAuction();
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
            filter:
              `auction_id=eq.${auctionId}`,
          },
          () => {
            loadAuction();
          }
        )

        /*
          JANELA
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
            loadAuction();
          }
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    auctionId,
    loadAuction,
  ]);

  const marketOpen =
    Boolean(
      currentWindow
    );

  /*
    TIMER
  */

  useEffect(() => {
    function updateTimer() {
      /*
        MERCADO FECHADO
      */

      if (
        !marketOpen
      ) {
        setTimeLeft(
          "PAUSADO"
        );

        return;
      }

      if (
        !auction?.ends_at ||
        auction.status !==
          "active"
      ) {
        setTimeLeft(
          "00:00:00"
        );

        return;
      }

      const endTime =
        new Date(
          auction.ends_at
        ).getTime();

      const difference =
        endTime -
        Date.now();

      if (
        difference <= 0
      ) {
        setTimeLeft(
          "00:00:00"
        );

        if (
          !closing
        ) {
          closeAuction();
        }

        return;
      }

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
    auction?.ends_at,
    auction?.status,
    closing,
    closeAuction,
    marketOpen,
  ]);

  /*
    VALORES
  */

  const currentValue =
    useMemo(
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

  const availableBudget =
    useMemo(
      () =>
        Math.max(
          Number(
            team?.budget ||
              0
          ) -
            committedBudget,
          0
        ),
      [
        team?.budget,
        committedBudget,
      ]
    );

  const minimumBid =
    currentValue > 0
      ? currentValue + 1
      : 1;

  const isClosed =
    auction?.status ===
    "closed";

  const isCancelled =
    auction?.status ===
    "cancelled";

  const isActive =
    auction?.status ===
    "active";

  const canBid =
    isActive &&
    marketOpen;

  const winningBid =
    bids.find(
      (
        bid
      ) =>
        bid.team_id ===
          auction?.winner_team_id &&
        Number(
          bid.amount
        ) ===
          Number(
            auction?.current_bid
          )
    );

  /*
    DAR LANCE
  */

  async function placeBid() {
    if (!auction) {
      alert(
        "Leilão não encontrado."
      );

      return;
    }

    /*
      VERIFICAÇÃO
      VISUAL
    */

    if (!marketOpen) {
      alert(
        "A janela de transferências está fechada. Nenhum lance pode ser enviado."
      );

      return;
    }

    if (!team) {
      alert(
        "Você precisa criar ou escolher um clube antes de dar um lance."
      );

      return;
    }

    if (!isActive) {
      alert(
        "Este leilão não está ativo."
      );

      return;
    }

    /*
      RECHECK DIRETO
      NO BANCO ANTES
      DO LANCE
    */

    const {
      data:
        openWindow,
      error:
        windowError,
    } =
      await supabase
        .from(
          "transfer_windows"
        )
        .select(
          "id"
        )
        .eq(
          "status",
          "open"
        )
        .limit(1)
        .maybeSingle();

    if (
      windowError
    ) {
      alert(
        "Não foi possível verificar a janela de transferências."
      );

      return;
    }

    if (
      !openWindow
    ) {
      setCurrentWindow(
        null
      );

      alert(
        "A janela de transferências foi fechada. O lance não foi enviado."
      );

      return;
    }

    const amount =
      Number(
        bidAmount
      );

    if (
      !Number.isFinite(
        amount
      ) ||
      amount <= 0
    ) {
      alert(
        "Digite um valor de lance válido."
      );

      return;
    }

    if (
      amount <=
      currentValue
    ) {
      alert(
        `O lance precisa ser maior que ${money(
          currentValue
        )}.`
      );

      return;
    }

    if (
      amount >
      availableBudget
    ) {
      alert(
        `Seu orçamento disponível para novos lances é ${money(
          availableBudget
        )}.`
      );

      return;
    }

    setSaving(
      true
    );

    setErrorMessage(
      ""
    );

    try {
      /*
        A RPC TAMBÉM
        VERIFICA A JANELA.

        DUPLA SEGURANÇA.
      */

      const {
        error,
      } =
        await supabase.rpc(
          "place_auction_bid",
          {
            auction_id_input:
              auction.id,

            amount_input:
              amount,
          }
        );

      if (error) {
        throw error;
      }

      setBidAmount(
        ""
      );

      await loadAuction();
    } catch (error) {
      const message =
        extractErrorMessage(
          error
        );

      console.error(
        "Erro ao registrar lance:",
        error
      );

      setErrorMessage(
        message
      );

      alert(
        message
      );

      /*
        SE O BANCO
        INFORMOU QUE
        FECHOU
      */

      if (
        message.includes(
          "janela de transferências está fechada"
        )
      ) {
        setCurrentWindow(
          null
        );
      }
    } finally {
      setSaving(
        false
      );
    }
  }

  /*
    LOADING
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">
        <p>
          Carregando leilão...
        </p>
      </main>
    );
  }

  /*
    NÃO ENCONTROU
  */

  if (!auction) {
    return (
      <main className="min-h-screen bg-zinc-950 p-10 text-white">

        <Link
          href="/auctions"
          className="font-bold text-green-400"
        >
          ← Voltar para leilões
        </Link>

        <h1 className="mt-8 text-4xl font-black">
          Leilão não encontrado
        </h1>

        {errorMessage && (
          <p className="mt-4 text-red-400">
            {
              errorMessage
            }
          </p>
        )}

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        <Link
          href="/auctions"
          className="inline-block font-bold text-green-400 hover:text-green-300"
        >
          ← Voltar para leilões
        </Link>

        {/* JANELA */}

        {!marketOpen && (
          <div className="mt-8 rounded-2xl border border-red-500/40 bg-red-500/10 p-6">

            <div className="flex items-start gap-4">

              <span className="text-3xl">
                🔒
              </span>

              <div>

                <p className="text-xl font-black text-red-400">
                  MERCADO FECHADO
                </p>

                <p className="mt-2 text-zinc-300">
                  Este leilão está pausado porque a janela de transferências está fechada.
                </p>

                <p className="mt-1 text-sm text-zinc-500">
                  Nenhum clube pode enviar lances enquanto o mercado estiver fechado.
                </p>

              </div>

            </div>

          </div>
        )}

        {marketOpen && (
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">

            <span className="h-2 w-2 rounded-full bg-green-400" />

            <span className="text-sm font-black text-green-400">
              MERCADO ABERTO
            </span>

            <span className="text-sm font-bold text-zinc-300">
              • Janela{" "}
              {
                currentWindow
                  ?.window_number
              }
            </span>

          </div>
        )}

        {/* HEADER */}

        <header className="mt-8 flex flex-col gap-6 md:flex-row md:items-start md:justify-between">

          <div>

            <p className="font-bold uppercase tracking-widest text-green-400">
              Leilão #
              {
                auction.id
              }
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-6xl">
              {auction.players
                ?.name ||
                "Jogador"}
            </h1>

            <p className="mt-3 text-lg text-zinc-400">
              {auction.players
                ?.position ||
                "-"}{" "}
              •{" "}
              {auction.players
                ?.age ||
                "-"}{" "}
              anos •{" "}
              {auction.players
                ?.nationality ||
                "-"}
            </p>

          </div>

          {isClosed && (
            <span className="rounded-xl border border-red-500 px-5 py-3 font-black text-red-400">
              ENCERRADO
            </span>
          )}

          {isCancelled && (
            <span className="rounded-xl border border-orange-500 px-5 py-3 font-black text-orange-400">
              CANCELADO
            </span>
          )}

          {isActive &&
            marketOpen && (
              <span className="rounded-xl border border-green-500 px-5 py-3 font-black text-green-400">
                ATIVO
              </span>
            )}

          {isActive &&
            !marketOpen && (
              <span className="rounded-xl border border-red-500 px-5 py-3 font-black text-red-400">
                🔒 PAUSADO
              </span>
            )}

        </header>

        {/* ERRO */}

        {errorMessage && (
          <div className="mt-8 rounded-2xl border border-red-500/30 bg-red-500/10 p-5 text-red-300">
            {
              errorMessage
            }
          </div>
        )}

        {/* CARDS */}

        <section className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">

          {/* TEMPO */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400">
              Tempo restante
            </p>

            <h2
              className={`mt-2 text-3xl font-black ${
                !marketOpen
                  ? "text-red-400"
                  : isActive
                  ? "text-yellow-400"
                  : "text-red-400"
              }`}
            >
              {marketOpen
                ? timeLeft
                : "PAUSADO"}
            </h2>

          </div>

          {/* CA */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400">
              CA
            </p>

            <h2 className="mt-2 text-4xl font-black">
              {auction.players
                ?.ca ||
                "-"}
            </h2>

          </div>

          {/* LANCE */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400">
              Lance atual
            </p>

            <h2 className="mt-2 text-2xl font-black text-green-400 lg:text-3xl">
              {money(
                currentValue
              )}
            </h2>

          </div>

          {/* LÍDER */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400">
              {isClosed
                ? "Vencedor"
                : "Líder atual"}
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {winningBid
                ?.team_name ||
                "Sem líder"}
            </h2>

          </div>

          {/* CLUBE */}

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

            <p className="text-zinc-400">
              Seu clube
            </p>

            <h2 className="mt-2 text-2xl font-black">
              {team?.name ||
                "Sem clube"}
            </h2>

            <p className="mt-2 font-bold text-green-400">
              Disponível:{" "}
              {money(
                availableBudget
              )}
            </p>

            {committedBudget >
              0 && (
              <p className="mt-2 text-sm text-yellow-400">
                Comprometido:{" "}
                {money(
                  committedBudget
                )}
              </p>
            )}

          </div>

        </section>

        {/* MERCADO FECHADO */}

        {isActive &&
          !marketOpen && (
            <section className="mt-10 rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">

              <p className="text-4xl">
                🔒
              </p>

              <h2 className="mt-4 text-3xl font-black text-red-400">
                Leilão pausado
              </h2>

              <p className="mx-auto mt-3 max-w-2xl text-zinc-300">
                A janela de transferências está fechada. O campo de lance foi bloqueado e o banco também recusará qualquer tentativa de lance.
              </p>

            </section>
          )}

        {/* DAR LANCE */}

        {canBid && (
          <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">

            <h2 className="text-3xl font-black">
              Dar lance
            </h2>

            <p className="mt-2 text-zinc-400">
              Cada novo lance reinicia o relógio para 1 hora.
            </p>

            <p className="mt-1 text-zinc-400">
              Lance mínimo:{" "}

              <span className="font-bold text-green-400">
                {money(
                  minimumBid
                )}
              </span>
            </p>

            <div className="mt-6 flex flex-col gap-4 md:flex-row">

              <input
                type="number"
                min={
                  minimumBid
                }
                step="1"
                value={
                  bidAmount
                }
                onChange={(
                  event
                ) =>
                  setBidAmount(
                    event.target.value
                  )
                }
                onKeyDown={(
                  event
                ) => {
                  if (
                    event.key ===
                    "Enter"
                  ) {
                    placeBid();
                  }
                }}
                placeholder="Digite o valor do lance"
                className="flex-1 rounded-xl border border-zinc-700 bg-zinc-950 p-4 outline-none focus:border-green-500"
              />

              <button
                type="button"
                onClick={
                  placeBid
                }
                disabled={
                  saving ||
                  closing ||
                  !team
                }
                className="rounded-xl bg-green-600 px-6 py-4 font-black transition hover:bg-green-500 disabled:bg-zinc-700 disabled:text-zinc-400 md:w-64"
              >
                {saving
                  ? "Enviando..."
                  : closing
                  ? "Encerrando..."
                  : "Enviar lance"}
              </button>

            </div>

            {!team && (
              <p className="mt-4 text-red-400">
                Você precisa possuir um clube para participar.
              </p>
            )}

          </section>
        )}

        {/* ENCERRADO */}

        {isClosed && (
          <section className="mt-10 rounded-2xl border border-green-500/30 bg-green-500/10 p-8 text-center">

            <p className="font-bold uppercase tracking-widest text-green-400">
              Leilão encerrado
            </p>

            <h2 className="mt-3 text-4xl font-black">
              {winningBid
                ?.team_name ||
                "Sem vencedor"}
            </h2>

            {auction.winner_team_id &&
              auction.current_bid && (
                <p className="mt-4 text-zinc-300">
                  Jogador contratado por{" "}

                  <span className="font-black text-green-400">
                    {money(
                      auction.current_bid
                    )}
                  </span>
                </p>
              )}

          </section>
        )}

        {/* CANCELADO */}

        {isCancelled && (
          <section className="mt-10 rounded-2xl border border-orange-500/30 bg-orange-500/10 p-8 text-center">

            <p className="font-bold uppercase tracking-widest text-orange-400">
              Leilão cancelado
            </p>

            <p className="mt-3 text-zinc-300">
              O leilão foi cancelado e nenhum clube recebeu o jogador.
            </p>

          </section>
        )}

        {/* HISTÓRICO */}

        <section className="mt-10 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">

          <div className="flex items-center justify-between gap-4">

            <h2 className="text-3xl font-black">
              Histórico de lances
            </h2>

            <span className="text-zinc-400">
              {bids.length} lance
              {bids.length ===
              1
                ? ""
                : "s"}
            </span>

          </div>

          {bids.length ===
          0 ? (
            <p className="mt-6 text-zinc-500">
              Nenhum lance enviado ainda.
            </p>
          ) : (
            <div className="mt-6 space-y-4">

              {bids.map(
                (
                  bid,
                  index
                ) => {
                  const isWinningBid =
                    bid.team_id ===
                      auction.winner_team_id &&
                    Number(
                      bid.amount
                    ) ===
                      Number(
                        auction.current_bid
                      );

                  return (
                    <div
                      key={
                        bid.id
                      }
                      className="flex flex-col gap-3 border-b border-zinc-800 pb-4 sm:flex-row sm:items-center sm:justify-between"
                    >

                      <div>

                        <p className="font-black">
                          {
                            bid.team_name
                          }
                        </p>

                        <p className="mt-1 text-sm text-zinc-500">
                          {new Date(
                            bid.created_at
                          ).toLocaleString(
                            "pt-BR"
                          )}
                        </p>

                        {isWinningBid && (
                          <p className="mt-1 text-sm font-bold text-green-400">
                            {isClosed
                              ? "Vencedor"
                              : "Líder atual"}
                          </p>
                        )}

                        {!isWinningBid &&
                          index ===
                            0 &&
                          isActive && (
                            <p className="mt-1 text-sm font-bold text-yellow-400">
                              Último lance
                            </p>
                          )}

                      </div>

                      <p className="text-xl font-black text-green-400">
                        {money(
                          bid.amount
                        )}
                      </p>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  );
}