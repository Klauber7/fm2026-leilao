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
  budget: number | null;
  manager_id: string | null;
};

type Player = {
  id: number;
  name: string;
  position: string | null;
  age: number | null;
  nationality: string | null;
  ca: number | null;
  value: number | null;
  team_id: number | null;
};

type ShoppingListRow = {
  id: number;
  team_id: number;
  player_id: number;
  created_at: string;
};

type LiveShoppingRow = {
  shopping_list_id: number;
  shopping_team_id: number;

  player_id: number;
  player_name: string;

  position: string | null;
  ca: number | null;
  player_value: number | null;

  auction_id: number | null;
  auction_status: string | null;

  starting_value: number | null;
  current_bid: number | null;

  leading_team_id: number | null;
  leading_team_name: string | null;

  ends_at: string | null;
  remaining_seconds: number | null;

  next_minimum_bid: number | null;
};

type ShoppingPlayer = {
  id: number;
  team_id: number;
  player_id: number;
  created_at: string;

  player: Player | null;
  current_team: Team | null;

  auction_id: number | null;
  auction_status: string | null;

  starting_value: number | null;
  current_bid: number | null;

  leading_team_id: number | null;
  leading_team_name: string | null;

  ends_at: string | null;
  next_minimum_bid: number | null;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string | null;
  status: string;
};

type SortOption =
  | "recent"
  | "name"
  | "ca_desc"
  | "value_desc"
  | "value_asc"
  | "bid_desc"
  | "ending";

function getErrorMessage(
  error: unknown
) {
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
      "PLAYER_NOT_FOUND"
    )
  ) {
    return "Jogador não encontrado.";
  }

  if (
    text.includes(
      "PLAYER_ALREADY_CONTRACTED"
    )
  ) {
    return "Este jogador já foi contratado.";
  }

  if (
    text.includes(
      "PLAYER_HAS_NO_VALUE"
    )
  ) {
    return "Este jogador não possui valor válido.";
  }

  if (
    text.includes(
      "INSUFFICIENT_AVAILABLE_BUDGET"
    )
  ) {
    return "Seu clube não possui orçamento disponível suficiente.";
  }

  if (
    text.includes(
      "AUCTION_NOT_FOUND"
    )
  ) {
    return "Leilão não encontrado.";
  }

  if (
    text.includes(
      "AUCTION_NOT_ACTIVE"
    )
  ) {
    return "Este leilão não está mais ativo.";
  }

  if (
    text.includes(
      "AUCTION_EXPIRED"
    )
  ) {
    return "O tempo deste leilão já terminou.";
  }

  if (
    text.includes(
      "BID_TOO_LOW"
    )
  ) {
    return "O lance precisa ser pelo menos 15% maior que o lance atual.";
  }

  if (
    text.includes(
      "INVALID_BID"
    )
  ) {
    return "Valor de lance inválido.";
  }

  return text;
}

export default function ShoppingListPage() {
  const router = useRouter();

  const [
    myTeam,
    setMyTeam,
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
    items,
    setItems,
  ] =
    useState<ShoppingPlayer[]>(
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
    bidLoadingId,
    setBidLoadingId,
  ] =
    useState<number | null>(
      null
    );

  const [
    startingAuctionId,
    setStartingAuctionId,
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
    sort,
    setSort,
  ] =
    useState<SortOption>(
      "recent"
    );

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

  /*
    RELÓGIO
  */

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          setNow(
            Date.now()
          );
        },
        1000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, []);

  /*
    JANELA DE TRANSFERÊNCIA
  */

  const loadTransferWindow =
    useCallback(async () => {
      const {
        data,
        error:
          windowError,
      } =
        await supabase
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
              ascending: false,
            }
          )
          .limit(1)
          .maybeSingle();

      if (
        windowError
      ) {
        console.error(
          "Erro ao carregar janela:",
          windowError
        );

        setCurrentWindow(
          null
        );

        return;
      }

      setCurrentWindow(
        data
          ? (data as TransferWindow)
          : null
      );
    }, []);

  /*
    LISTA DE COMPRAS
  */

  const loadShoppingList =
    useCallback(async () => {
      setLoading(true);
      setError("");

      const {
        data: {
          user,
        },
        error:
          authError,
      } =
        await supabase.auth.getUser();

      if (
        authError ||
        !user
      ) {
        router.replace(
          "/login"
        );

        return;
      }

      /*
        CLUBE DO USUÁRIO
      */

      const {
        data:
          teamData,
        error:
          teamError,
      } =
        await supabase
          .from("teams")
          .select(`
            id,
            name,
            budget,
            manager_id
          `)
          .eq(
            "manager_id",
            user.id
          )
          .maybeSingle();

      if (
        teamError ||
        !teamData
      ) {
        console.error(
          teamError
        );

        setError(
          "Não foi possível identificar o seu clube."
        );

        setLoading(
          false
        );

        return;
      }

      const team =
        teamData as Team;

      setMyTeam(
        team
      );

      /*
        LISTA SALVA
      */

      const {
        data:
          listRows,
        error:
          listError,
      } =
        await supabase
          .from(
            "player_shopping_list"
          )
          .select(`
            id,
            team_id,
            player_id,
            created_at
          `)
          .eq(
            "team_id",
            team.id
          )
          .order(
            "created_at",
            {
              ascending: false,
            }
          );

      if (
        listError
      ) {
        console.error(
          listError
        );

        setError(
          "Não foi possível carregar sua lista de compras."
        );

        setLoading(
          false
        );

        return;
      }

      const rows =
        (
          listRows ||
          []
        ) as ShoppingListRow[];

      if (
        rows.length ===
        0
      ) {
        setItems([]);
        setLoading(
          false
        );

        return;
      }

      /*
        VIEW COM DADOS
        DO LEILÃO
      */

      const {
        data:
          liveRows,
        error:
          liveError,
      } =
        await supabase
          .from(
            "player_shopping_list_live"
          )
          .select(`
            shopping_list_id,
            shopping_team_id,
            player_id,
            player_name,
            position,
            ca,
            player_value,
            auction_id,
            auction_status,
            starting_value,
            current_bid,
            leading_team_id,
            leading_team_name,
            ends_at,
            remaining_seconds,
            next_minimum_bid
          `)
          .eq(
            "shopping_team_id",
            team.id
          );

      if (
        liveError
      ) {
        console.error(
          "Erro ao carregar dados dos leilões:",
          liveError
        );

        setError(
          "Não foi possível carregar os dados dos leilões."
        );

        setLoading(
          false
        );

        return;
      }

      const liveMap =
        new Map<
          number,
          LiveShoppingRow
        >();

      (
        (
          liveRows ||
          []
        ) as LiveShoppingRow[]
      ).forEach(
        (row) => {
          liveMap.set(
            Number(
              row.player_id
            ),
            row
          );
        }
      );

      /*
        JOGADORES
      */

      const playerIds =
        rows.map(
          (row) =>
            Number(
              row.player_id
            )
        );

      const {
        data:
          playersData,
        error:
          playersError,
      } =
        await supabase
          .from(
            "players"
          )
          .select(`
            id,
            name,
            position,
            age,
            nationality,
            ca,
            value,
            team_id
          `)
          .in(
            "id",
            playerIds
          );

      if (
        playersError
      ) {
        console.error(
          playersError
        );

        setError(
          "Não foi possível carregar os jogadores."
        );

        setLoading(
          false
        );

        return;
      }

      const playerMap =
        new Map<
          number,
          Player
        >();

      (
        (
          playersData ||
          []
        ) as Player[]
      ).forEach(
        (player) => {
          playerMap.set(
            Number(
              player.id
            ),
            player
          );
        }
      );

      /*
        CLUBES ATUAIS
      */

      const currentTeamIds =
        Array.from(
          new Set(
            (
              (
                playersData ||
                []
              ) as Player[]
            )
              .map(
                (player) =>
                  player.team_id
              )
              .filter(
                (
                  id
                ): id is number =>
                  id !==
                  null
              )
          )
        );

      const currentTeamMap =
        new Map<
          number,
          Team
        >();

      if (
        currentTeamIds.length >
        0
      ) {
        const {
          data:
            teamsData,
          error:
            teamsError,
        } =
          await supabase
            .from(
              "teams"
            )
            .select(`
              id,
              name,
              budget,
              manager_id
            `)
            .in(
              "id",
              currentTeamIds
            );

        if (
          teamsError
        ) {
          console.error(
            teamsError
          );
        } else {
          (
            (
              teamsData ||
              []
            ) as Team[]
          ).forEach(
            (
              currentTeam
            ) => {
              currentTeamMap.set(
                Number(
                  currentTeam.id
                ),
                currentTeam
              );
            }
          );
        }
      }

      /*
        MONTA LISTA FINAL
      */

      const hydrated =
        rows.map(
          (
            row
          ): ShoppingPlayer => {
            const player =
              playerMap.get(
                Number(
                  row.player_id
                )
              ) ||
              null;

            const live =
              liveMap.get(
                Number(
                  row.player_id
                )
              ) ||
              null;

            const currentTeam =
              player?.team_id
                ? currentTeamMap.get(
                    Number(
                      player.team_id
                    )
                  ) ||
                  null
                : null;

            return {
              id:
                Number(
                  row.id
                ),

              team_id:
                Number(
                  row.team_id
                ),

              player_id:
                Number(
                  row.player_id
                ),

              created_at:
                row.created_at,

              player,

              current_team:
                currentTeam,

              auction_id:
                live
                  ?.auction_id ??
                null,

              auction_status:
                live
                  ?.auction_status ??
                null,

              starting_value:
                live
                  ?.starting_value ??
                null,

              current_bid:
                live
                  ?.current_bid ??
                null,

              leading_team_id:
                live
                  ?.leading_team_id ??
                null,

              leading_team_name:
                live
                  ?.leading_team_name ??
                null,

              ends_at:
                live
                  ?.ends_at ??
                null,

              next_minimum_bid:
                live
                  ?.next_minimum_bid ??
                null,
            };
          }
        );

      setItems(
        hydrated
      );

      setLoading(
        false
      );
    }, [
      router,
    ]);

  /*
    LOAD
  */

  useEffect(() => {
    loadTransferWindow();
    loadShoppingList();
  }, [
    loadTransferWindow,
    loadShoppingList,
  ]);

  /*
    REALTIME
  */

  useEffect(() => {
    if (
      !myTeam
    ) {
      return;
    }

    const channel =
      supabase
        .channel(
          `player-shopping-list-${myTeam.id}`
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "player_shopping_list",
            filter:
              `team_id=eq.${myTeam.id}`,
          },
          () => {
            loadShoppingList();
          }
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
            loadShoppingList();
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
            loadShoppingList();
          }
        )

        .on(
          "postgres_changes",
          {
            event:
              "UPDATE",
            schema:
              "public",
            table:
              "players",
          },
          () => {
            loadShoppingList();
          }
        )

        .on(
          "postgres_changes",
          {
            event: "*",
            schema:
              "public",
            table:
              "teams",
          },
          () => {
            loadShoppingList();
          }
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
            loadTransferWindow();
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
    loadShoppingList,
    loadTransferWindow,
  ]);

  /*
    DINHEIRO
  */

  function money(
    value:
      | number
      | null
      | undefined
  ) {
    return new Intl.NumberFormat(
      "pt-BR",
      {
        style:
          "currency",
        currency:
          "BRL",
        minimumFractionDigits:
          0,
        maximumFractionDigits:
          0,
      }
    ).format(
      Number(
        value ||
          0
      )
    );
  }

  /*
    DATA
  */

  function dateTime(
    value:
      | string
      | null
      | undefined
  ) {
    if (
      !value
    ) {
      return "-";
    }

    return new Date(
      value
    ).toLocaleString(
      "pt-BR"
    );
  }

  /*
    TEMPO RESTANTE
  */

  function getRemainingSeconds(
    endsAt:
      | string
      | null
  ) {
    if (
      !endsAt
    ) {
      return 0;
    }

    return Math.max(
      0,
      Math.ceil(
        (
          new Date(
            endsAt
          ).getTime() -
          now
        ) /
          1000
      )
    );
  }

  function formatRemainingTime(
    endsAt:
      | string
      | null
  ) {
    const totalSeconds =
      getRemainingSeconds(
        endsAt
      );

    const hours =
      Math.floor(
        totalSeconds /
          3600
      );

    const minutes =
      Math.floor(
        (
          totalSeconds %
          3600
        ) /
          60
      );

    const seconds =
      totalSeconds %
      60;

    return [
      hours,
      minutes,
      seconds,
    ]
      .map(
        (value) =>
          String(
            value
          ).padStart(
            2,
            "0"
          )
      )
      .join(":");
  }

  /*
    FECHA LEILÕES
    EXPIRADOS
  */

  const closeExpiredAuctions =
    useCallback(async () => {
      const expired =
        items.filter(
          (item) => {
            if (
              !item.auction_id ||
              item.auction_status !==
                "active" ||
              !item.ends_at
            ) {
              return false;
            }

            return (
              new Date(
                item.ends_at
              ).getTime() <=
              Date.now()
            );
          }
        );

      if (
        expired.length ===
        0
      ) {
        return;
      }

      await Promise.all(
        expired.map(
          async (
            item
          ) => {
            if (
              !item.auction_id
            ) {
              return;
            }

            const {
              error:
                closeError,
            } =
              await supabase.rpc(
                "close_expired_auction",
                {
                  auction_id_input:
                    item.auction_id,
                }
              );

            if (
              closeError
            ) {
              console.error(
                "Erro ao encerrar leilão:",
                closeError
              );
            }
          }
        )
      );

      await loadShoppingList();
    }, [
      items,
      loadShoppingList,
    ]);

  useEffect(() => {
    const timer =
      window.setInterval(
        () => {
          closeExpiredAuctions();
        },
        5000
      );

    return () => {
      window.clearInterval(
        timer
      );
    };
  }, [
    closeExpiredAuctions,
  ]);

  /*
    REMOVER DA LISTA
  */

  async function removeItem(
    item: ShoppingPlayer
  ) {
    const playerName =
      item.player
        ?.name ||
      "este jogador";

    const confirmed =
      window.confirm(
        `Remover ${playerName} da sua lista de compras?`
      );

    if (
      !confirmed
    ) {
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
          "player_shopping_list"
        )
        .delete()
        .eq(
          "id",
          item.id
        );

    if (
      removeError
    ) {
      console.error(
        removeError
      );

      setError(
        "Não foi possível remover o jogador da lista."
      );

      setRemovingId(
        null
      );

      return;
    }

    setMessage(
      `${playerName} foi removido da sua lista de compras.`
    );

    await loadShoppingList();

    setRemovingId(
      null
    );
  }

  /*
    INICIAR LEILÃO
  */

  async function startAuction(
    item: ShoppingPlayer
  ) {
    const player =
      item.player;

    if (
      !player
    ) {
      return;
    }

    if (
      !currentWindow
    ) {
      setError(
        "O mercado está fechado."
      );

      return;
    }

    if (
      player.team_id !==
      null
    ) {
      setError(
        "Este jogador já pertence a um clube."
      );

      return;
    }

    const startingValue =
      Number(
        player.value ||
          0
      );

    if (
      startingValue <=
      0
    ) {
      setError(
        "Este jogador não possui valor válido."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Confirmar lance inicial em ${player.name} por ${money(
          startingValue
        )}?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setStartingAuctionId(
      player.id
    );

    setError("");
    setMessage("");

    try {
      const {
        error:
          auctionError,
      } =
        await supabase.rpc(
          "start_player_auction",
          {
            player_id_input:
              player.id,
          }
        );

      if (
        auctionError
      ) {
        throw auctionError;
      }

      setMessage(
        `Leilão de ${player.name} iniciado por ${money(
          startingValue
        )}.`
      );

      await loadShoppingList();
    } catch (
      auctionError
    ) {
      console.error(
        auctionError
      );

      setError(
        getErrorMessage(
          auctionError
        )
      );
    } finally {
      setStartingAuctionId(
        null
      );
    }
  }

  /*
    COBRIR LANCE
  */

  async function coverBid(
    item: ShoppingPlayer
  ) {
    const player =
      item.player;

    if (
      !player ||
      !item.auction_id
    ) {
      return;
    }

    if (
      !currentWindow
    ) {
      setError(
        "O mercado está fechado."
      );

      return;
    }

    const remaining =
      getRemainingSeconds(
        item.ends_at
      );

    if (
      remaining <=
      0
    ) {
      setError(
        "O tempo deste leilão já terminou."
      );

      await closeExpiredAuctions();

      return;
    }

    const currentBid =
      Math.max(
        Number(
          item.current_bid ||
            0
        ),
        Number(
          item.starting_value ||
            0
        )
      );

    const nextBid =
      Number(
        item.next_minimum_bid ||
          Math.ceil(
            currentBid *
              1.15
          )
      );

    if (
      nextBid <=
      0
    ) {
      setError(
        "Não foi possível calcular o próximo lance."
      );

      return;
    }

    const confirmed =
      window.confirm(
        `Cobrir o lance de ${player.name} por ${money(
          nextBid
        )}?`
      );

    if (
      !confirmed
    ) {
      return;
    }

    setBidLoadingId(
      item.auction_id
    );

    setError("");
    setMessage("");

    try {
      const {
        error:
          bidError,
      } =
        await supabase.rpc(
          "place_auction_bid",
          {
            auction_id_input:
              item.auction_id,

            amount_input:
              nextBid,
          }
        );

      if (
        bidError
      ) {
        throw bidError;
      }

      setMessage(
        `Lance de ${money(
          nextBid
        )} enviado por ${player.name}.`
      );

      await loadShoppingList();
    } catch (
      bidError
    ) {
      console.error(
        bidError
      );

      setError(
        getErrorMessage(
          bidError
        )
      );

      await loadShoppingList();
    } finally {
      setBidLoadingId(
        null
      );
    }
  }

  /*
    FILTRO
  */

  const filteredItems =
    useMemo(() => {
      const term =
        search
          .trim()
          .toLowerCase();

      const result =
        items.filter(
          (item) => {
            const player =
              item.player;

            if (
              !player
            ) {
              return false;
            }

            const text =
              [
                player.name,
                player.position,
                player.nationality,
                item
                  .current_team
                  ?.name,
                item
                  .leading_team_name,
              ]
                .filter(
                  Boolean
                )
                .join(" ")
                .toLowerCase();

            return (
              !term ||
              text.includes(
                term
              )
            );
          }
        );

      return [
        ...result,
      ].sort(
        (a, b) => {
          const playerA =
            a.player;

          const playerB =
            b.player;

          if (
            !playerA ||
            !playerB
          ) {
            return 0;
          }

          if (
            sort ===
            "name"
          ) {
            return playerA.name.localeCompare(
              playerB.name
            );
          }

          if (
            sort ===
            "ca_desc"
          ) {
            return (
              Number(
                playerB.ca ||
                  0
              ) -
              Number(
                playerA.ca ||
                  0
              )
            );
          }

          if (
            sort ===
            "value_desc"
          ) {
            return (
              Number(
                playerB.value ||
                  0
              ) -
              Number(
                playerA.value ||
                  0
              )
            );
          }

          if (
            sort ===
            "value_asc"
          ) {
            return (
              Number(
                playerA.value ||
                  0
              ) -
              Number(
                playerB.value ||
                  0
              )
            );
          }

          if (
            sort ===
            "bid_desc"
          ) {
            return (
              Number(
                b.current_bid ||
                  0
              ) -
              Number(
                a.current_bid ||
                  0
              )
            );
          }

          if (
            sort ===
            "ending"
          ) {
            const aTime =
              a.ends_at
                ? new Date(
                    a.ends_at
                  ).getTime()
                : Number.MAX_SAFE_INTEGER;

            const bTime =
              b.ends_at
                ? new Date(
                    b.ends_at
                  ).getTime()
                : Number.MAX_SAFE_INTEGER;

            return (
              aTime -
              bTime
            );
          }

          return (
            new Date(
              b.created_at
            ).getTime() -
            new Date(
              a.created_at
            ).getTime()
          );
        }
      );
    }, [
      items,
      search,
      sort,
    ]);

  /*
    RESUMO
  */

  const activeAuctions =
    items.filter(
      (item) =>
        item.auction_status ===
          "active" &&
        item.auction_id !==
          null
    );

  const winningAuctions =
    activeAuctions.filter(
      (item) =>
        item.leading_team_id ===
        myTeam?.id
    );

  const losingAuctions =
    activeAuctions.filter(
      (item) =>
        item.leading_team_id !==
        null &&
        item.leading_team_id !==
        myTeam?.id
    );

  const committedValue =
    winningAuctions.reduce(
      (
        total,
        item
      ) => {
        return (
          total +
          Number(
            item.current_bid ||
              0
          )
        );
      },
      0
    );

  const marketOpen =
    Boolean(
      currentWindow
    );

  /*
    LOADING
  */

  if (
    loading
  ) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">

        <div className="mx-auto max-w-7xl">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando lista de compras...
          </div>

        </div>

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#08090b] px-4 py-8 text-white md:px-10">

      <div className="mx-auto max-w-7xl">

        {/* HEADER */}

        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">

          <div>

            <p className="text-sm font-black uppercase tracking-[0.2em] text-green-400">
              FriendZone League FM
            </p>

            <h1 className="mt-2 text-4xl font-black md:text-5xl">
              🛒 Lista de Compras
            </h1>

            <p className="mt-3 max-w-3xl text-zinc-400">
              Acompanhe seus jogadores, veja quem está ganhando cada leilão, o lance atual, o próximo lance e o tempo restante.
            </p>

            {myTeam && (
              <p className="mt-3 text-sm font-bold text-zinc-500">
                Lista de{" "}
                <span className="text-white">
                  {myTeam.name}
                </span>
              </p>
            )}

          </div>

          <div className="flex flex-wrap gap-3">

            <Link
              href="/players"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:bg-zinc-800"
            >
              ← Mercado
            </Link>

            <Link
              href="/transfers/negotiations"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:bg-zinc-800"
            >
              Negociações
            </Link>

          </div>

        </div>

        {/* MERCADO */}

        <section className="mt-8">

          {marketOpen ? (

            <div className="rounded-2xl border border-green-500/30 bg-green-500/10 p-5">

              <p className="font-black text-green-400">
                🟢 LEILÕES ABERTOS
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                Você pode iniciar e cobrir lances diretamente pela sua Lista de Compras.
              </p>

            </div>

          ) : (

            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-5">

              <p className="font-black text-red-400">
                🔒 MERCADO FECHADO
              </p>

              <p className="mt-1 text-sm text-zinc-300">
                Você pode acompanhar os jogadores, mas não pode enviar novos lances.
              </p>

            </div>

          )}

        </section>

        {/* RESUMO */}

        <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

            <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
              Jogadores salvos
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
              {activeAuctions.length}
            </p>

          </div>

          <div className="rounded-2xl border border-green-500/20 bg-green-500/5 p-5">

            <p className="text-xs font-black uppercase tracking-widest text-green-500">
              Você está ganhando
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              {winningAuctions.length}
            </p>

          </div>

          <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5">

            <p className="text-xs font-black uppercase tracking-widest text-red-500">
              Você foi superado
            </p>

            <p className="mt-3 text-3xl font-black text-red-400">
              {losingAuctions.length}
            </p>

          </div>

          <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5">

            <p className="text-xs font-black uppercase tracking-widest text-blue-500">
              Valor comprometido
            </p>

            <p className="mt-3 text-xl font-black text-blue-400">
              {money(
                committedValue
              )}
            </p>

          </div>

        </section>

        {/* ORÇAMENTO */}

        <section className="mt-4 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                Orçamento atual
              </p>

              <p className="mt-2 text-2xl font-black text-blue-400">
                {money(
                  myTeam
                    ?.budget
                )}
              </p>

            </div>

            {currentWindow && (

              <span className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-2 text-sm font-black text-green-400">
                JANELA{" "}
                {
                  currentWindow.window_number
                }
              </span>

            )}

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
                Buscar jogador
              </label>

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target
                      .value
                  )
                }
                placeholder="Nome, posição, nacionalidade ou clube..."
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              />

            </div>

            <div>

              <label className="mb-2 block text-sm font-black text-zinc-300">
                Ordenar por
              </label>

              <select
                value={
                  sort
                }
                onChange={(
                  event
                ) =>
                  setSort(
                    event.target
                      .value as SortOption
                  )
                }
                className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 outline-none focus:border-green-500"
              >

                <option value="recent">
                  Adicionados recentemente
                </option>

                <option value="ending">
                  Leilões terminando primeiro
                </option>

                <option value="bid_desc">
                  Maior lance atual
                </option>

                <option value="name">
                  Nome
                </option>

                <option value="ca_desc">
                  Maior CA
                </option>

                <option value="value_desc">
                  Maior valor
                </option>

                <option value="value_asc">
                  Menor valor
                </option>

              </select>

            </div>

          </div>

        </section>

        {/* LISTA */}

        <section className="mt-8">

          <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">

            <h2 className="text-2xl font-black">
              Jogadores desejados
            </h2>

            <span className="text-sm font-bold text-zinc-500">
              {
                filteredItems.length
              }{" "}
              resultado(s)
            </span>

          </div>

          {filteredItems.length ===
          0 ? (

            <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-10 text-center">

              <p className="text-5xl">
                🛒
              </p>

              <h3 className="mt-5 text-2xl font-black">
                Sua lista está vazia
              </h3>

              <p className="mx-auto mt-3 max-w-xl text-zinc-500">
                Vá até o Mercado de Jogadores e adicione os jogadores que deseja acompanhar.
              </p>

              <Link
                href="/players"
                className="mt-6 inline-block rounded-xl bg-green-500 px-6 py-3 font-black text-black transition hover:bg-green-400"
              >
                Ver mercado
              </Link>

            </div>

          ) : (

            <div className="grid gap-5 xl:grid-cols-2">

              {filteredItems.map(
                (
                  item
                ) => {
                  const player =
                    item.player;

                  if (
                    !player
                  ) {
                    return null;
                  }

                  const playerValue =
                    Number(
                      player.value ||
                        0
                    );

                  const currentBid =
                    Math.max(
                      Number(
                        item.current_bid ||
                          0
                      ),
                      Number(
                        item.starting_value ||
                          0
                      )
                    );

                  const nextBid =
                    Number(
                      item.next_minimum_bid ||
                        (
                          currentBid >
                          0
                            ? Math.ceil(
                                currentBid *
                                  1.15
                              )
                            : Math.ceil(
                                playerValue *
                                  1.15
                              )
                        )
                    );

                  const isOwnPlayer =
                    player.team_id ===
                    myTeam?.id;

                  const hasActiveAuction =
                    item.auction_status ===
                      "active" &&
                    item.auction_id !==
                      null;

                  const remainingSeconds =
                    getRemainingSeconds(
                      item.ends_at
                    );

                  const expired =
                    hasActiveAuction &&
                    remainingSeconds <=
                      0;

                  const iAmWinning =
                    hasActiveAuction &&
                    item.leading_team_id ===
                      myTeam?.id;

                  const someoneElseWinning =
                    hasActiveAuction &&
                    item.leading_team_id !==
                      null &&
                    item.leading_team_id !==
                      myTeam?.id;

                  return (
                    <article
                      key={
                        item.id
                      }
                      className={[
                        "rounded-2xl border bg-zinc-900 p-6 transition",
                        iAmWinning &&
                        !expired
                          ? "border-green-500/50"
                          : someoneElseWinning &&
                              !expired
                            ? "border-red-500/50"
                            : hasActiveAuction
                              ? "border-yellow-500/40"
                              : "border-zinc-800",
                      ].join(
                        " "
                      )}
                    >

                      {/* STATUS */}

                      <div className="flex flex-wrap gap-2">

                        <span className="rounded-full bg-indigo-500/15 px-3 py-1 text-xs font-black text-indigo-300">
                          🛒 NA LISTA
                        </span>

                        {isOwnPlayer && (

                          <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black text-blue-400">
                            SEU ELENCO
                          </span>

                        )}

                        {hasActiveAuction &&
                          !expired && (

                          <span className="rounded-full bg-yellow-500/15 px-3 py-1 text-xs font-black text-yellow-400">
                            🔥 LEILÃO ATIVO
                          </span>

                        )}

                        {iAmWinning &&
                          !expired && (

                          <span className="rounded-full bg-green-500/15 px-3 py-1 text-xs font-black text-green-400">
                            🟢 VOCÊ ESTÁ GANHANDO
                          </span>

                        )}

                        {someoneElseWinning &&
                          !expired && (

                          <span className="rounded-full bg-red-500/15 px-3 py-1 text-xs font-black text-red-400">
                            🔴 VOCÊ FOI SUPERADO
                          </span>

                        )}

                        {expired && (

                          <span className="rounded-full bg-zinc-700 px-3 py-1 text-xs font-black text-zinc-300">
                            ⏱ TEMPO ENCERRADO
                          </span>

                        )}

                      </div>

                      {/* DADOS */}

                      <div className="mt-5">

                        <h3 className="break-words text-2xl font-black">
                          {
                            player.name
                          }
                        </h3>

                        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-sm text-zinc-400">

                          <span>
                            {
                              player.position ||
                              "Posição -"
                            }
                          </span>

                          {player.age !==
                            null && (

                            <span>
                              {
                                player.age
                              }{" "}
                              anos
                            </span>

                          )}

                          {player.nationality && (

                            <span>
                              {
                                player.nationality
                              }
                            </span>

                          )}

                          {player.ca !==
                            null && (

                            <span className="font-black text-white">
                              CA{" "}
                              {
                                player.ca
                              }
                            </span>

                          )}

                        </div>

                      </div>

                      {/* LEILÃO */}

                      {hasActiveAuction &&
                      !isOwnPlayer ? (

                        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

                          <div className="grid gap-5 sm:grid-cols-2">

                            {/* QUEM GANHA */}

                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">

                              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                                Quem está ganhando
                              </p>

                              <p
                                className={[
                                  "mt-2 text-xl font-black",
                                  iAmWinning
                                    ? "text-green-400"
                                    : "text-red-400",
                                ].join(
                                  " "
                                )}
                              >
                                {
                                  item.leading_team_name ||
                                  "Sem líder"
                                }
                              </p>

                            </div>

                            {/* TEMPO */}

                            <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">

                              <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                                Tempo restante
                              </p>

                              <p
                                className={[
                                  "mt-2 text-2xl font-black tabular-nums",
                                  remainingSeconds <=
                                  300
                                    ? "text-red-400"
                                    : "text-white",
                                ].join(
                                  " "
                                )}
                              >
                                {
                                  formatRemainingTime(
                                    item.ends_at
                                  )
                                }
                              </p>

                            </div>

                          </div>

                          {/* LANCE ATUAL */}

                          <div className="mt-4 rounded-xl border border-yellow-500/20 bg-yellow-500/5 p-4">

                            <p className="text-xs font-black uppercase tracking-widest text-yellow-500">
                              Lance atual
                            </p>

                            <p className="mt-2 text-3xl font-black text-yellow-400">
                              {
                                money(
                                  currentBid
                                )
                              }
                            </p>

                          </div>

                          {/* PRÓXIMO */}

                          {!expired && (

                            <div className="mt-4 rounded-xl border border-green-500/20 bg-green-500/5 p-4">

                              <p className="text-xs font-black uppercase tracking-widest text-green-500">
                                Próximo lance +15%
                              </p>

                              <p className="mt-2 text-3xl font-black text-green-400">
                                {
                                  money(
                                    nextBid
                                  )
                                }
                              </p>

                            </div>

                          )}

                        </div>

                      ) : (

                        <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-950 p-5">

                          <p className="text-xs font-black uppercase tracking-widest text-zinc-500">
                            Valor do jogador
                          </p>

                          <p className="mt-2 text-2xl font-black">
                            {
                              money(
                                playerValue
                              )
                            }
                          </p>

                          {player.team_id ===
                            null &&
                            !hasActiveAuction && (

                            <p className="mt-3 text-sm text-zinc-500">
                              Ainda não existe leilão ativo para este jogador.
                            </p>

                          )}

                          {player.team_id !==
                            null && (

                            <p className="mt-3 text-sm text-zinc-500">
                              Clube atual:{" "}
                              <span className="font-black text-white">
                                {
                                  item.current_team
                                    ?.name ||
                                  "Clube"
                                }
                              </span>
                            </p>

                          )}

                        </div>

                      )}

                      {/* AÇÕES */}

                      <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6 sm:grid-cols-3">

                        <Link
                          href={`/players/${player.id}`}
                          className="rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-center font-black transition hover:bg-zinc-800"
                        >
                          Ver jogador
                        </Link>

                        {isOwnPlayer ? (

                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-xl bg-zinc-700 px-4 py-3 font-black text-zinc-400"
                          >
                            Já é seu jogador
                          </button>

                        ) : player.team_id !==
                          null ? (

                          <Link
                            href={`/transfers/negotiations/new?playerId=${player.id}&sellerTeamId=${player.team_id}`}
                            className="rounded-xl bg-blue-500 px-4 py-3 text-center font-black text-white transition hover:bg-blue-400"
                          >
                            FAZER PROPOSTA
                          </Link>

                        ) : hasActiveAuction &&
                          !expired ? (

                          iAmWinning ? (

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
                              disabled={
                                bidLoadingId ===
                                  item.auction_id ||
                                !marketOpen
                              }
                              onClick={() =>
                                coverBid(
                                  item
                                )
                              }
                              className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                            >
                              {bidLoadingId ===
                              item.auction_id
                                ? "ENVIANDO..."
                                : `COBRIR ${money(
                                    nextBid
                                  )}`}
                            </button>

                          )

                        ) : expired ? (

                          <button
                            type="button"
                            disabled
                            className="cursor-not-allowed rounded-xl bg-zinc-700 px-4 py-3 font-black text-zinc-400"
                          >
                            PROCESSANDO...
                          </button>

                        ) : (

                          <button
                            type="button"
                            disabled={
                              startingAuctionId ===
                                player.id ||
                              !marketOpen
                            }
                            onClick={() =>
                              startAuction(
                                item
                              )
                            }
                            className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
                          >
                            {startingAuctionId ===
                            player.id
                              ? "INICIANDO..."
                              : `DAR LANCE ${money(
                                  playerValue
                                )}`}
                          </button>

                        )}

                        <button
                          type="button"
                          disabled={
                            removingId ===
                            item.id
                          }
                          onClick={() =>
                            removeItem(
                              item
                            )
                          }
                          className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {removingId ===
                          item.id
                            ? "Removendo..."
                            : "Remover"}
                        </button>

                      </div>

                      <p className="mt-5 text-xs text-zinc-600">
                        Adicionado em{" "}
                        {
                          dateTime(
                            item.created_at
                          )
                        }
                      </p>

                    </article>
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