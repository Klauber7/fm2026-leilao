"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

import Link from "next/link";
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
  value?: number | null;
  ca?: number | null;
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
  status: string;
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
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

function getNextBid(auction: StaffAuction | null) {
  if (!auction) {
    return null;
  }

  const base = Math.max(
    Number(auction.current_bid || 0),
    Number(auction.starting_value || 0)
  );

  if (base <= 0) {
    return null;
  }

  return Math.ceil(base * 1.15);
}

function getRemainingTime(
  endsAt: string | null,
  now: number
) {
  if (!endsAt) {
    return "Sem leilão";
  }

  const diff =
    new Date(endsAt).getTime() -
    now;

  if (diff <= 0) {
    return "Encerrado";
  }

  const totalSeconds =
    Math.floor(diff / 1000);

  const hours =
    Math.floor(
      totalSeconds / 3600
    );

  const minutes =
    Math.floor(
      (totalSeconds % 3600) /
        60
    );

  const seconds =
    totalSeconds % 60;

  return `${String(hours).padStart(
    2,
    "0"
  )}:${String(minutes).padStart(
    2,
    "0"
  )}:${String(seconds).padStart(
    2,
    "0"
  )}`;
}

function getErrorMessage(error: unknown) {
  const text =
    error instanceof Error
      ? error.message
      : String(
          (
            error as {
              message?: string;
            }
          )?.message || error
        );

  if (
    text.includes(
      "NOT_AUTHENTICATED"
    )
  ) {
    return "Você precisa estar conectado.";
  }

  if (
    text.includes(
      "TRANSFER_WINDOW_CLOSED"
    )
  ) {
    return "O mercado está fechado.";
  }

  if (
    text.includes(
      "TEAM_NOT_FOUND"
    )
  ) {
    return "Não foi possível identificar o seu clube.";
  }

  if (
    text.includes(
      "INSUFFICIENT_AVAILABLE_BUDGET"
    )
  ) {
    return "Saldo disponível insuficiente.";
  }

  if (
    text.includes(
      "AUCTION_EXPIRED"
    ) ||
    text.includes(
      "AUCTION_NOT_ACTIVE"
    )
  ) {
    return "Este leilão não está mais ativo.";
  }

  if (
    text.includes(
      "BID_TOO_LOW"
    )
  ) {
    return "Outro clube deu um lance antes de você. A lista foi atualizada.";
  }

  return text;
}

export default function StaffShoppingListPage() {
  const router = useRouter();

  const [
    myTeam,
    setMyTeam,
  ] =
    useState<Team | null>(
      null
    );

  const [
    items,
    setItems,
  ] =
    useState<CartItem[]>(
      []
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    removingId,
    setRemovingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    biddingAuctionId,
    setBiddingAuctionId,
  ] =
    useState<number | null>(
      null
    );

  const [
    startingCoachId,
    setStartingCoachId,
  ] =
    useState<number | null>(
      null
    );

  const [
    search,
    setSearch,
  ] =
    useState("");

  const [
    roleFilter,
    setRoleFilter,
  ] =
    useState("all");

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    now,
    setNow,
  ] =
    useState(
      Date.now()
    );

  const [
    marketOpen,
    setMarketOpen,
  ] =
    useState(false);

  /*
  ============================================================
  CARREGAR MERCADO
  ============================================================
  */

  const loadMarketState =
    useCallback(
      async () => {
        const {
          data,
          error:
            marketError,
        } =
          await supabase
            .from(
              "transfer_windows"
            )
            .select(
              "id,status"
            )
            .eq(
              "status",
              "open"
            )
            .limit(1)
            .maybeSingle();

        if (
          marketError
        ) {
          console.error(
            "Erro ao carregar mercado:",
            marketError
          );

          setMarketOpen(
            false
          );

          return;
        }

        setMarketOpen(
          Boolean(data)
        );
      },
      []
    );

  /*
  ============================================================
  CARREGAR LISTA
  ============================================================
  */

  const loadCart =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const {
        data: { user },
      } =
        await supabase.auth.getUser();

      if (!user) {
        router.replace("/login");
        return;
      }

      const {
        data: teamData,
        error: teamError,
      } =
        await supabase
          .from("teams")
          .select(
            "id, name"
          )
          .eq(
            "manager_id",
            user.id
          )
          .maybeSingle();

      if (
        teamError ||
        !teamData
      ) {
        setError(
          "Não foi possível identificar o seu clube."
        );

        setLoading(false);
        return;
      }

      setMyTeam(
        teamData as Team
      );

      const {
        data: cartRows,
        error: cartError,
      } =
        await supabase
          .from(
            "staff_shopping_list"
          )
          .select(
            "id, team_id, coach_id, created_at"
          )
          .eq(
            "team_id",
            teamData.id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (cartError) {
        setError(
          cartError.message
        );

        setLoading(false);
        return;
      }

      if (
        !cartRows ||
        cartRows.length ===
          0
      ) {
        setItems([]);
        setLoading(false);
        return;
      }

      const coachIds =
        cartRows.map(
          (row) =>
            Number(
              row.coach_id
            )
        );

      const [
        {
          data: coaches,
          error:
            coachesError,
        },
        {
          data: auctions,
          error:
            auctionsError,
        },
      ] =
        await Promise.all([
          supabase
            .from("coaches")
            .select(
              "id, name, role, nationality, team_id, value, ca"
            )
            .in(
              "id",
              coachIds
            ),

          supabase
            .from(
              "staff_auctions"
            )
            .select(
              "id, coach_id, status, starting_value, current_bid, winner_team_id, ends_at, created_at"
            )
            .in(
              "coach_id",
              coachIds
            )
            .order(
              "created_at",
              {
                ascending: false,
              }
            ),
        ]);

      if (coachesError) {
        setError(
          coachesError.message
        );

        setLoading(false);
        return;
      }

      if (auctionsError) {
        setError(
          auctionsError.message
        );

        setLoading(false);
        return;
      }

      const coachMap =
        new Map(
          (
            coaches ||
            []
          ).map(
            (coach) => [
              Number(
                coach.id
              ),
              {
                ...coach,
                id: Number(
                  coach.id
                ),
                team_id:
                  coach.team_id ==
                  null
                    ? null
                    : Number(
                        coach.team_id
                      ),
                value:
                  coach.value ==
                  null
                    ? null
                    : Number(
                        coach.value
                      ),
                ca:
                  coach.ca ==
                  null
                    ? null
                    : Number(
                        coach.ca
                      ),
              } as Coach,
            ]
          )
        );

      /*
        Mantém somente o leilão mais recente de cada profissional.
      */

      const auctionMap =
        new Map<
          number,
          StaffAuction
        >();

      for (
        const rawAuction of
        auctions || []
      ) {
        const coachId =
          Number(
            rawAuction.coach_id
          );

        if (
          !auctionMap.has(
            coachId
          )
        ) {
          auctionMap.set(
            coachId,
            {
              id: Number(
                rawAuction.id
              ),

              coach_id:
                coachId,

              status:
                rawAuction.status,

              starting_value:
                rawAuction.starting_value ==
                null
                  ? null
                  : Number(
                      rawAuction.starting_value
                    ),

              current_bid:
                rawAuction.current_bid ==
                null
                  ? null
                  : Number(
                      rawAuction.current_bid
                    ),

              winner_team_id:
                rawAuction.winner_team_id ==
                null
                  ? null
                  : Number(
                      rawAuction.winner_team_id
                    ),

              ends_at:
                rawAuction.ends_at,
            }
          );
        }
      }

      const winnerTeamIds =
        Array.from(
          new Set(
            Array.from(
              auctionMap.values()
            )
              .map(
                (auction) =>
                  auction.winner_team_id
              )
              .filter(
                (
                  id
                ): id is number =>
                  id != null
              )
          )
        );

      let teamNameMap =
        new Map<
          number,
          string
        >();

      if (
        winnerTeamIds.length >
        0
      ) {
        const {
          data: teams,
          error:
            teamsError,
        } =
          await supabase
            .from("teams")
            .select(
              "id, name"
            )
            .in(
              "id",
              winnerTeamIds
            );

        if (teamsError) {
          setError(
            teamsError.message
          );

          setLoading(false);
          return;
        }

        teamNameMap =
          new Map(
            (
              teams ||
              []
            ).map(
              (team) => [
                Number(
                  team.id
                ),
                String(
                  team.name
                ),
              ]
            )
          );
      }

      setItems(
        (
          cartRows as CartRow[]
        ).map((row) => {
          const coachId =
            Number(
              row.coach_id
            );

          const auction =
            auctionMap.get(
              coachId
            ) || null;

          return {
            ...row,

            id: Number(
              row.id
            ),

            team_id:
              Number(
                row.team_id
              ),

            coach_id:
              coachId,

            coach:
              coachMap.get(
                coachId
              ) || null,

            auction,

            leadingTeamName:
              auction?.winner_team_id !=
              null
                ? teamNameMap.get(
                    auction.winner_team_id
                  ) || null
                : null,
          };
        })
      );

      setLoading(false);
    }, [router]);

  /*
  ============================================================
  LOAD
  ============================================================
  */

  useEffect(() => {
    loadCart();
    loadMarketState();
  }, [
    loadCart,
    loadMarketState,
  ]);

  /*
  ============================================================
  RELÓGIO
  ============================================================
  */

  useEffect(() => {
    const interval =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () =>
      window.clearInterval(
        interval
      );
  }, []);

  /*
  ============================================================
  REALTIME
  ============================================================
  */

  useEffect(() => {
    if (!myTeam) {
      return;
    }

    const channel =
      supabase
        .channel(
          `staff-shopping-list-${myTeam.id}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "staff_shopping_list",
            filter:
              `team_id=eq.${myTeam.id}`,
          },
          loadCart
        )

        .on(
          "postgres_changes",
          {
            event:
              "UPDATE",
            schema:
              "public",
            table:
              "coaches",
          },
          loadCart
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "staff_auctions",
          },
          loadCart
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "staff_bids",
          },
          loadCart
        )

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
            loadMarketState();
          }
        )

        .subscribe();

    return () => {
      supabase.removeChannel(
        channel
      );
    };
  }, [
    myTeam,
    loadCart,
    loadMarketState,
  ]);

  /*
  ============================================================
  FECHAR LEILÃO EXPIRADO
  ============================================================
  */

  const closeExpiredAuctions =
    useCallback(
      async () => {
        const expired =
          items.filter(
            (item) =>
              item.auction &&
              item.auction
                .status ===
                "active" &&
              item.auction
                .ends_at &&
              new Date(
                item.auction.ends_at
              ).getTime() <=
                Date.now()
          );

        if (
          expired.length ===
          0
        ) {
          return;
        }

        await Promise.all(
          expired.map(
            async (item) => {
              if (
                !item.auction
              ) {
                return;
              }

              const {
                error:
                  closeError,
              } =
                await supabase.rpc(
                  "close_expired_staff_auction",
                  {
                    staff_auction_id_input:
                      item.auction.id,
                  }
                );

              if (
                closeError
              ) {
                console.error(
                  "Erro ao encerrar leilão de staff:",
                  closeError
                );
              }
            }
          )
        );

        await loadCart();
      },
      [
        items,
        loadCart,
      ]
    );

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          closeExpiredAuctions();
        },
        5000
      );

    return () =>
      window.clearInterval(
        timer
      );
  }, [
    closeExpiredAuctions,
  ]);

  /*
  ============================================================
  REMOVER DA LISTA
  ============================================================
  */

  async function removeItem(
    item: CartItem
  ) {
    const confirmed =
      window.confirm(
        `Remover ${
          item.coach?.name ||
          "este staff"
        } da Lista Preferencial?`
      );

    if (!confirmed) {
      return;
    }

    setRemovingId(
      item.id
    );

    setError("");
    setMessage("");

    const {
      error:
        removeError,
    } =
      await supabase
        .from(
          "staff_shopping_list"
        )
        .delete()
        .eq(
          "id",
          item.id
        );

    if (removeError) {
      setError(
        "Não foi possível remover o staff."
      );

      setRemovingId(null);
      return;
    }

    setItems(
      (current) =>
        current.filter(
          (
            currentItem
          ) =>
            currentItem.id !==
            item.id
        )
    );

    setMessage(
      "Staff removido da Lista Preferencial."
    );

    setRemovingId(null);
  }

  /*
  ============================================================
  PRIMEIRO LANCE DIRETO PELA LISTA
  ============================================================
  */

  async function startAuction(
    item: CartItem
  ) {
    if (!item.coach) {
      return;
    }

    if (!myTeam) {
      setError(
        "Não foi possível identificar o seu clube."
      );
      return;
    }

    if (!marketOpen) {
      setError(
        "O mercado está fechado."
      );
      return;
    }

    if (
      item.coach.team_id !==
      null
    ) {
      setError(
        "Este profissional já foi contratado."
      );
      return;
    }

    const startingValue =
      Number(
        item.coach.value ||
          0
      );

    if (
      !Number.isFinite(
        startingValue
      ) ||
      startingValue <
        0
    ) {
      setError(
        "Este profissional não possui valor válido."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Dar o primeiro lance em ${
          item.coach.name
        } por ${formatMoney(
          startingValue
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setStartingCoachId(
      item.coach.id
    );

    setError("");
    setMessage("");

    try {
      /*
        Cria o leilão.
      */

      const {
        data,
        error:
          createError,
      } =
        await supabase.rpc(
          "create_staff_auction",
          {
            coach_id_input:
              item.coach.id,
            starting_value_input:
              startingValue,
          }
        );

      if (createError) {
        /*
          Se outro clube acabou de abrir
          o mesmo leilão, carregamos e
          deixamos o usuário cobrir pela lista.
        */

        const {
          data:
            existingAuction,
          error:
            existingError,
        } =
          await supabase
            .from(
              "staff_auctions"
            )
            .select(
              "id"
            )
            .eq(
              "coach_id",
              item.coach.id
            )
            .eq(
              "status",
              "active"
            )
            .order(
              "id",
              {
                ascending:
                  false,
              }
            )
            .limit(1)
            .maybeSingle();

        if (
          existingError
        ) {
          throw existingError;
        }

        if (
          existingAuction?.id
        ) {
          await loadCart();

          setMessage(
            "Outro clube iniciou o leilão antes de você. A lista foi atualizada."
          );

          return;
        }

        throw createError;
      }

      /*
        Descobre o ID do leilão criado.
      */

      let auctionId:
        | number
        | null =
        null;

      if (
        data &&
        typeof data ===
          "object" &&
        "auction_id" in data
      ) {
        auctionId =
          Number(
            (
              data as {
                auction_id: number;
              }
            ).auction_id
          );
      }

      if (
        !auctionId ||
        !Number.isFinite(
          auctionId
        )
      ) {
        const {
          data:
            latestAuction,
          error:
            latestError,
        } =
          await supabase
            .from(
              "staff_auctions"
            )
            .select(
              "id"
            )
            .eq(
              "coach_id",
              item.coach.id
            )
            .eq(
              "status",
              "active"
            )
            .order(
              "id",
              {
                ascending:
                  false,
              }
            )
            .limit(1)
            .maybeSingle();

        if (
          latestError
        ) {
          throw latestError;
        }

        if (
          latestAuction?.id
        ) {
          auctionId =
            Number(
              latestAuction.id
            );
        }
      }

      if (!auctionId) {
        throw new Error(
          "Não foi possível identificar o leilão criado."
        );
      }

      /*
        Dá o primeiro lance pelo valor inicial.
        Assim o leilão passa a ter líder,
        lance atual e contador como jogadores.
      */

      const {
        error: bidError,
      } =
        await supabase.rpc(
          "place_staff_bid",
          {
            staff_auction_id_input:
              auctionId,
            amount_input:
              startingValue,
          }
        );

      if (bidError) {
        throw bidError;
      }

      setMessage(
        `Primeiro lance de ${formatMoney(
          startingValue
        )} enviado para ${
          item.coach.name
        }.`
      );

      await loadCart();
    } catch (err) {
      console.error(
        "Erro ao iniciar leilão de staff:",
        err
      );

      setError(
        getErrorMessage(
          err
        )
      );

      await loadCart();
    } finally {
      setStartingCoachId(
        null
      );
    }
  }

  /*
  ============================================================
  COBRIR LANCE
  ============================================================
  */

  async function coverBid(
    item: CartItem
  ) {
    if (!item.auction) {
      return;
    }

    if (!marketOpen) {
      setError(
        "O mercado está fechado."
      );
      return;
    }

    const nextBid =
      getNextBid(
        item.auction
      );

    if (!nextBid) {
      setError(
        "Não foi possível calcular o próximo lance."
      );
      return;
    }

    const confirmed =
      window.confirm(
        `Cobrir o lance de ${
          item.coach?.name ||
          "este staff"
        } com ${formatMoney(
          nextBid
        )}?`
      );

    if (!confirmed) {
      return;
    }

    setBiddingAuctionId(
      item.auction.id
    );

    setError("");
    setMessage("");

    try {
      const {
        error:
          bidError,
      } =
        await supabase.rpc(
          "place_staff_bid",
          {
            staff_auction_id_input:
              item.auction.id,

            amount_input:
              nextBid,
          }
        );

      if (bidError) {
        const text =
          bidError.message ||
          "";

        if (
          text.includes(
            "INSUFFICIENT_AVAILABLE_BUDGET"
          )
        ) {
          throw new Error(
            "Saldo disponível insuficiente para este lance."
          );
        }

        if (
          text.includes(
            "TRANSFER_WINDOW_CLOSED"
          )
        ) {
          throw new Error(
            "O mercado está fechado."
          );
        }

        if (
          text.includes(
            "AUCTION_EXPIRED"
          ) ||
          text.includes(
            "AUCTION_NOT_ACTIVE"
          )
        ) {
          throw new Error(
            "Este leilão não está mais ativo."
          );
        }

        if (
          text.includes(
            "BID_TOO_LOW"
          )
        ) {
          await loadCart();

          throw new Error(
            "Outro clube deu um lance antes de você. A lista foi atualizada."
          );
        }

        throw bidError;
      }

      setMessage(
        `Lance de ${formatMoney(
          nextBid
        )} enviado para ${
          item.coach?.name ||
          "o staff"
        }.`
      );

      await loadCart();
    } catch (err) {
      console.error(
        "Erro ao cobrir lance de staff:",
        err
      );

      setError(
        err instanceof Error
          ? err.message
          : "Não foi possível realizar o lance."
      );
    } finally {
      setBiddingAuctionId(
        null
      );
    }
  }

  /*
  ============================================================
  FILTROS
  ============================================================
  */

  const roles =
    useMemo(() => {
      return Array.from(
        new Set(
          items
            .map(
              (item) =>
                item.coach?.role
            )
            .filter(
              (
                role
              ): role is string =>
                Boolean(role)
            )
        )
      ).sort(
        (a, b) =>
          a.localeCompare(
            b,
            "pt-BR"
          )
      );
    }, [items]);

  const filteredItems =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      return items.filter(
        (item) => {
          if (
            !item.coach
          ) {
            return false;
          }

          const matchesSearch =
            !term ||
            item.coach.name
              .toLowerCase()
              .includes(term) ||
            (
              item.coach.role ||
              ""
            )
              .toLowerCase()
              .includes(term) ||
            (
              item.coach
                .nationality ||
              ""
            )
              .toLowerCase()
              .includes(term) ||
            (
              item.leadingTeamName ||
              ""
            )
              .toLowerCase()
              .includes(term);

          const matchesRole =
            roleFilter ===
              "all" ||
            item.coach.role ===
              roleFilter;

          return (
            matchesSearch &&
            matchesRole
          );
        }
      );
    }, [
      items,
      search,
      roleFilter,
    ]);

  const activeAuctionCount =
    items.filter(
      (item) => {
        if (
          !item.auction
        ) {
          return false;
        }

        return (
          item.auction
            .status ===
            "active" &&
          !!item.auction
            .ends_at &&
          new Date(
            item.auction.ends_at
          ).getTime() >
            now
        );
      }
    ).length;

  const leadingCount =
    items.filter(
      (item) =>
        item.auction
          ?.winner_team_id !=
          null &&
        item.auction
          .winner_team_id ===
          myTeam?.id
    ).length;

  const losingCount =
    items.filter(
      (item) =>
        item.auction
          ?.winner_team_id !=
          null &&
        item.auction
          .winner_team_id !==
          myTeam?.id &&
        item.auction
          .status ===
          "active"
    ).length;

  /*
  ============================================================
  LOADING
  ============================================================
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando Lista Preferencial de Staff...
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-8 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <header>
          <p className="text-sm font-black uppercase tracking-[0.2em] text-purple-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            👨‍💼 Lista Preferencial de Staff
          </h1>

          <p className="mt-3 max-w-3xl text-zinc-400">
            Acompanhe seus profissionais e participe dos leilões diretamente por esta página, sem precisar abrir o perfil do staff.
          </p>
        </header>

        {/* STATUS DO MERCADO */}

        <section className="mt-8">
          {marketOpen ? (
            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">
              <p className="font-black text-green-400">
                🟢 LEILÕES ABERTOS
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                Você pode dar o primeiro lance e cobrir lances diretamente pela Lista Preferencial.
              </p>
            </div>
          ) : (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">
              <p className="font-black text-red-400">
                🔒 MERCADO FECHADO
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                A lista continua disponível, mas novos lances estão bloqueados.
              </p>
            </div>
          )}
        </section>

        {/* RESUMO */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Staff salvo
            </p>

            <p className="mt-3 text-3xl font-black">
              {items.length}
            </p>
          </div>

          <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-yellow-500">
              Leilões ativos
            </p>

            <p className="mt-3 text-3xl font-black text-yellow-400">
              {activeAuctionCount}
            </p>
          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-green-500">
              Você está ganhando
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              {leadingCount}
            </p>
          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">
            <p className="text-xs font-black uppercase tracking-widest text-red-500">
              Você foi superado
            </p>

            <p className="mt-3 text-3xl font-black text-red-400">
              {losingCount}
            </p>
          </div>
        </section>

        {/* MENSAGENS */}

        {error && (
          <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 font-bold text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mt-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 font-bold text-green-300">
            {message}
          </div>
        )}

        {/* FILTROS */}

        <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="grid gap-4 md:grid-cols-[1fr_300px]">

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Buscar staff
              </label>

              <input
                value={search}
                onChange={(event) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Nome, função, nacionalidade ou clube líder..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              />
            </div>

            <div>
              <label className="mb-2 block text-sm font-black text-zinc-300">
                Função
              </label>

              <select
                value={
                  roleFilter
                }
                onChange={(event) =>
                  setRoleFilter(
                    event.target
                      .value
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-purple-500"
              >
                <option value="all">
                  Todas
                </option>

                {roles.map(
                  (role) => (
                    <option
                      key={role}
                      value={role}
                    >
                      {role}
                    </option>
                  )
                )}
              </select>
            </div>

          </div>
        </section>

        {/* LISTA */}

        <section className="mt-8">
          <div className="mb-5 flex items-center justify-between gap-3">
            <h2 className="text-2xl font-black">
              Staff desejado
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {filteredItems.length} resultado(s)
            </span>
          </div>

          {filteredItems.length ===
          0 ? (
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">
              <p className="text-5xl">
                👨‍💼
              </p>

              <h3 className="mt-5 text-2xl font-black">
                Sua lista está vazia
              </h3>

              <p className="mx-auto mt-3 max-w-xl text-zinc-500">
                Vá até o Mercado de Treinadores e adicione profissionais à Lista Preferencial.
              </p>

              <Link
                href="/coaches"
                className="mt-6 inline-block rounded-xl bg-purple-600 px-6 py-3 font-black text-white hover:bg-purple-500"
              >
                Ver mercado
              </Link>
            </div>
          ) : (
            <div className="grid gap-5 xl:grid-cols-2">
              {filteredItems.map((item) => {
                const coach =
                  item.coach;

                if (!coach) {
                  return null;
                }

                const auction =
                  item.auction;

                const isAuctionActive =
                  auction?.status ===
                    "active" &&
                  !!auction.ends_at &&
                  new Date(
                    auction.ends_at
                  ).getTime() >
                    now;

                const myTeamIsLeading =
                  auction
                    ?.winner_team_id ===
                  myTeam?.id;

                const someoneElseIsLeading =
                  auction
                    ?.winner_team_id !=
                    null &&
                  auction
                    .winner_team_id !==
                    myTeam?.id;

                const displayedCurrentBid =
                  auction
                    ? Math.max(
                        Number(
                          auction.current_bid ||
                            0
                        ),
                        Number(
                          auction.starting_value ||
                            0
                        )
                      )
                    : 0;

                const nextBid =
                  getNextBid(
                    auction
                  );

                const startingValue =
                  Number(
                    coach.value ||
                      0
                  );

                return (
                  <article
                    key={item.id}
                    className={[
                      "rounded-2xl border bg-zinc-900 p-6",
                      myTeamIsLeading &&
                      isAuctionActive
                        ? "border-green-500/50"
                        : someoneElseIsLeading &&
                            isAuctionActive
                          ? "border-red-500/50"
                          : isAuctionActive
                            ? "border-yellow-500/40"
                            : "border-zinc-800",
                    ].join(" ")}
                  >

                    {/* STATUS */}

                    <div className="flex flex-wrap gap-2">
                      <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs font-black text-purple-300">
                        ⭐ LISTA PREFERENCIAL
                      </span>

                      {!auction &&
                        coach.team_id ===
                          null && (
                        <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-black text-zinc-300">
                          AGUARDANDO PRIMEIRO LANCE
                        </span>
                      )}

                      {isAuctionActive && (
                        <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-black text-yellow-400">
                          🔥 LEILÃO ATIVO
                        </span>
                      )}

                      {myTeamIsLeading &&
                        isAuctionActive && (
                        <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-black text-green-400">
                          🟢 VOCÊ ESTÁ GANHANDO
                        </span>
                      )}

                      {someoneElseIsLeading &&
                        isAuctionActive && (
                        <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-400">
                          🔴 VOCÊ FOI SUPERADO
                        </span>
                      )}

                      {auction &&
                        !isAuctionActive && (
                        <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-black text-zinc-300">
                          ⏱ LEILÃO ENCERRADO
                        </span>
                      )}
                    </div>

                    {/* DADOS */}

                    <div className="mt-5">
                      <h3 className="text-2xl font-black">
                        {coach.name}
                      </h3>

                      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-400">
                        <span>
                          {coach.role ||
                            "Função não informada"}
                        </span>

                        {coach.nationality && (
                          <span>
                            {coach.nationality}
                          </span>
                        )}

                        {coach.ca !=
                          null && (
                          <span className="font-black text-white">
                            CA {coach.ca}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* SEM LEILÃO */}

                    {!auction &&
                      coach.team_id ===
                        null && (
                      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

                        <div className="grid gap-4 sm:grid-cols-3">

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                              Quem está ganhando
                            </p>

                            <p className="mt-2 text-lg font-black text-zinc-400">
                              Ninguém ainda
                            </p>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                              Lance atual
                            </p>

                            <p className="mt-2 text-lg font-black text-zinc-400">
                              Sem lance
                            </p>
                          </div>

                          <div className="rounded-xl border border-purple-500/20 bg-purple-500/5 p-4">
                            <p className="text-xs font-black uppercase tracking-widest text-purple-400">
                              Primeiro lance
                            </p>

                            <p className="mt-2 text-lg font-black text-purple-300">
                              {formatMoney(
                                startingValue
                              )}
                            </p>
                          </div>

                        </div>

                        <p className="mt-4 text-sm text-zinc-500">
                          O primeiro lance inicia o leilão. Depois disso, cada novo lance será no mínimo 15% maior.
                        </p>

                      </div>
                    )}

                    {/* LEILÃO */}

                    {auction && (
                      <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

                        <div className="grid gap-4 sm:grid-cols-2">

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                              Lance atual
                            </p>

                            <p className="mt-2 text-lg font-black text-white">
                              {formatMoney(
                                displayedCurrentBid
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                              Quem está ganhando
                            </p>

                            <p
                              className={[
                                "mt-2 text-lg font-black",
                                myTeamIsLeading
                                  ? "text-green-400"
                                  : someoneElseIsLeading
                                    ? "text-red-400"
                                    : "text-white",
                              ].join(" ")}
                            >
                              {auction.winner_team_id
                                ? item.leadingTeamName ||
                                  "Clube não identificado"
                                : "Sem lances"}
                            </p>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                              Tempo restante
                            </p>

                            <p
                              className={[
                                "mt-2 text-lg font-black",
                                isAuctionActive
                                  ? "text-yellow-300"
                                  : "text-zinc-400",
                              ].join(" ")}
                            >
                              {getRemainingTime(
                                auction.ends_at,
                                now
                              )}
                            </p>
                          </div>

                          <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
                            <p className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                              Próximo lance +15%
                            </p>

                            <p className="mt-2 text-lg font-black text-purple-300">
                              {nextBid
                                ? formatMoney(
                                    nextBid
                                  )
                                : "—"}
                            </p>
                          </div>

                        </div>

                      </div>
                    )}

                    {/* AÇÕES */}

                    <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-3">

                      <Link
                        href={`/coaches/${coach.id}`}
                        className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-black hover:border-purple-500"
                      >
                        Ver staff
                      </Link>

                      {coach.team_id !==
                      null ? (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-xl bg-zinc-700 px-4 py-3 font-black text-zinc-400"
                        >
                          Já contratado
                        </button>
                      ) : !auction ? (
                        <button
                          type="button"
                          onClick={() =>
                            startAuction(
                              item
                            )
                          }
                          disabled={
                            startingCoachId ===
                              coach.id ||
                            !marketOpen
                          }
                          className="rounded-xl bg-purple-600 px-4 py-3 font-black text-white hover:bg-purple-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                        >
                          {startingCoachId ===
                          coach.id
                            ? "INICIANDO..."
                            : `DAR PRIMEIRO LANCE — ${formatMoney(
                                startingValue
                              )}`}
                        </button>
                      ) : isAuctionActive &&
                        nextBid &&
                        !myTeamIsLeading ? (
                        <button
                          type="button"
                          onClick={() =>
                            coverBid(
                              item
                            )
                          }
                          disabled={
                            biddingAuctionId ===
                              auction.id ||
                            !marketOpen
                          }
                          className="rounded-xl bg-green-600 px-4 py-3 font-black text-white hover:bg-green-500 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                        >
                          {biddingAuctionId ===
                          auction.id
                            ? "ENVIANDO LANCE..."
                            : `COBRIR LANCE — ${formatMoney(
                                nextBid
                              )}`}
                        </button>
                      ) : myTeamIsLeading &&
                        isAuctionActive ? (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 font-black text-green-400"
                        >
                          ✓ VOCÊ ESTÁ GANHANDO
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled
                          className="cursor-not-allowed rounded-xl bg-zinc-700 px-4 py-3 font-black text-zinc-400"
                        >
                          LEILÃO ENCERRADO
                        </button>
                      )}

                      <button
                        type="button"
                        disabled={
                          removingId ===
                            item.id ||
                          biddingAuctionId ===
                            auction?.id ||
                          startingCoachId ===
                            coach.id
                        }
                        onClick={() =>
                          removeItem(
                            item
                          )
                        }
                        className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 hover:bg-red-500/20 disabled:opacity-50"
                      >
                        {removingId ===
                        item.id
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
