"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useRouter,
  useSearchParams,
} from "next/navigation";
import Link from "next/link";
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

type NegotiationRow = {
  id: number;
  player_id: number;
  buyer_team_id: number;
  seller_team_id: number;

  amount: number | null;

  payment_type: string | null;
  installments: number | null;

  installment_1: number | null;
  installment_2: number | null;

  status: string | null;

  created_by_team_id: number | null;
};

type TransferWindow = {
  id: number;
  window_number: number;
  name: string;
  status: string;
  opened_at: string | null;
  closed_at: string | null;
};

export default function NewNegotiationPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const counterOf =
    searchParams.get("counterOf");

  const isCounterOffer =
    Boolean(counterOf);

  const [myTeam, setMyTeam] =
    useState<Team | null>(null);

  const [teams, setTeams] =
    useState<Team[]>([]);

  const [
    targetPlayers,
    setTargetPlayers,
  ] = useState<Player[]>([]);

  const [
    myPlayers,
    setMyPlayers,
  ] = useState<Player[]>([]);

  const [
    originalNegotiation,
    setOriginalNegotiation,
  ] =
    useState<NegotiationRow | null>(
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
    marketOpen,
    setMarketOpen,
  ] = useState(false);

  const [
    sellerTeamId,
    setSellerTeamId,
  ] = useState("");

  const [playerId, setPlayerId] =
    useState("");

  const [
    paymentType,
    setPaymentType,
  ] =
    useState<
      "cash" | "installments"
    >("cash");

  const [amount, setAmount] =
    useState("");

  const [
    installment1,
    setInstallment1,
  ] = useState("");

  const [
    installment2,
    setInstallment2,
  ] = useState("");

  const [
    offeredPlayer1,
    setOfferedPlayer1,
  ] = useState("");

  const [
    offeredPlayer2,
    setOfferedPlayer2,
  ] = useState("");

  const [loading, setLoading] =
    useState(true);

  const [
    loadingPlayers,
    setLoadingPlayers,
  ] = useState(false);

  const [sending, setSending] =
    useState(false);

  const [error, setError] =
    useState("");

  const [success, setSuccess] =
    useState("");

  useEffect(() => {
    loadPage();
  }, []);

  useEffect(() => {
    if (!sellerTeamId) {
      setTargetPlayers([]);
      setPlayerId("");
      return;
    }

    loadTargetPlayers(
      Number(sellerTeamId)
    );
  }, [sellerTeamId]);

  function parseMoney(
    value: string
  ) {
    if (!value) {
      return 0;
    }

    return Number(
      value
        .replace(/\./g, "")
        .replace(",", ".")
    );
  }

  const totalAmount =
    paymentType === "cash"
      ? parseMoney(amount)
      : parseMoney(
          installment1
        ) +
        parseMoney(
          installment2
        );

  /*
    REGRA DA LIGA:
    NO MÁXIMO 2 JOGADORES PODEM IR
    DE UM MESMO CLUBE PARA OUTRO
    EM CADA JANELA.
  */

  async function getTransferredCountInWindow(
    fromTeamId: number,
    toTeamId: number,
    windowOpenedAt: string
  ) {
    const {
      data: historyRows,
      error: historyError,
    } = await supabase
      .from("transfer_history")
      .select(`
        negotiation_id,
        seller_team_id,
        buyer_team_id,
        completed_at
      `)
      .gte(
        "completed_at",
        windowOpenedAt
      );

    if (historyError) {
      throw historyError;
    }

    const rows =
      historyRows || [];

    let count =
      rows.filter(
        (row: any) =>
          Number(
            row.seller_team_id
          ) === fromTeamId &&
          Number(
            row.buyer_team_id
          ) === toTeamId
      ).length;

    const negotiationIds =
      rows
        .map(
          (row: any) =>
            row.negotiation_id
        )
        .filter(
          (
            id: number | null
          ): id is number =>
            id !== null &&
            id !== undefined
        );

    if (
      negotiationIds.length >
      0
    ) {
      const {
        data: exchangeRows,
        error: exchangeError,
      } = await supabase
        .from(
          "negotiation_players"
        )
        .select(`
          negotiation_id,
          player_id,
          from_team_id,
          to_team_id
        `)
        .in(
          "negotiation_id",
          negotiationIds
        );

      if (exchangeError) {
        throw exchangeError;
      }

      count +=
        (
          exchangeRows || []
        ).filter(
          (row: any) =>
            Number(
              row.from_team_id
            ) === fromTeamId &&
            Number(
              row.to_team_id
            ) === toTeamId
        ).length;
    }

    return count;
  }

  async function loadPage() {
    setLoading(true);
    setError("");

    /*
      1.
      VERIFICA LOGIN
    */

    const {
      data: { user },
      error: authError,
    } =
      await supabase.auth.getUser();

    if (
      authError ||
      !user
    ) {
      router.replace("/login");
      return;
    }

    /*
      2.
      VERIFICA JANELA
    */

    const {
      data: windowData,
      error: windowError,
    } =
      await supabase
        .from(
          "transfer_windows"
        )
        .select(
          `
          id,
          window_number,
          name,
          status,
          opened_at,
          closed_at
          `
        )
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

    if (windowError) {
      console.error(
        windowError
      );

      setError(
        "Não foi possível verificar a janela de transferências."
      );

      setLoading(false);
      return;
    }

    if (!windowData) {
      setMarketOpen(false);
      setCurrentWindow(null);
    } else {
      setMarketOpen(true);

      setCurrentWindow(
        windowData as TransferWindow
      );
    }

    /*
      3.
      IDENTIFICA O CLUBE
    */

    const {
      data: teamData,
      error: teamError,
    } =
      await supabase
        .from("teams")
        .select(
          `
          id,
          name,
          budget,
          manager_id
          `
        )
        .eq(
          "manager_id",
          user.id
        )
        .single();

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

      setLoading(false);
      return;
    }

    setMyTeam(teamData);

    /*
      4.
      CARREGA OS OUTROS CLUBES
    */

    const {
      data: teamsData,
      error: teamsError,
    } =
      await supabase
        .from("teams")
        .select(
          `
          id,
          name,
          budget,
          manager_id
          `
        )
        .neq(
          "id",
          teamData.id
        )
        .order(
          "name",
          {
            ascending: true,
          }
        );

    if (teamsError) {
      console.error(
        teamsError
      );

      setError(
        "Erro ao carregar os clubes."
      );

      setLoading(false);
      return;
    }

    setTeams(
      teamsData || []
    );

    /*
      5.
      CARREGA JOGADORES
      DO MEU CLUBE
    */

    const {
      data: myPlayersData,
      error: myPlayersError,
    } =
      await supabase
        .from("players")
        .select(
          `
          id,
          name,
          position,
          age,
          nationality,
          ca,
          value,
          team_id
          `
        )
        .eq(
          "team_id",
          teamData.id
        )
        .order(
          "name",
          {
            ascending: true,
          }
        );

    if (myPlayersError) {
      console.error(
        myPlayersError
      );

      setError(
        "Erro ao carregar os jogadores do seu clube."
      );

      setLoading(false);
      return;
    }

    setMyPlayers(
      myPlayersData || []
    );

    /*
      6.
      CONTRAPROPOSTA
    */

    if (counterOf) {
      await loadCounterOffer(
        Number(counterOf),
        teamData.id
      );
    }

    setLoading(false);
  }

  async function loadCounterOffer(
    negotiationId: number,
    currentTeamId: number
  ) {
    const {
      data,
      error,
    } =
      await supabase
        .from(
          "negotiations"
        )
        .select(
          `
          id,
          player_id,
          buyer_team_id,
          seller_team_id,
          amount,
          payment_type,
          installments,
          installment_1,
          installment_2,
          status,
          created_by_team_id
          `
        )
        .eq(
          "id",
          negotiationId
        )
        .single();

    if (
      error ||
      !data
    ) {
      console.error(error);

      setError(
        "Não foi possível carregar a proposta original."
      );

      return;
    }

    /*
      SEGURANÇA:
      negociação precisa
      pertencer ao clube.
    */

    if (
      data.buyer_team_id !==
        currentTeamId &&
      data.seller_team_id !==
        currentTeamId
    ) {
      setError(
        "Essa negociação não pertence ao seu clube."
      );

      return;
    }

    /*
      SÓ PODE CONTRAPROPOR
      NEGOCIAÇÃO ATIVA.
    */

    if (
      data.status !==
        "pending" &&
      data.status !==
        "countered"
    ) {
      setError(
        "Essa negociação não aceita mais contrapropostas."
      );

      return;
    }

    setOriginalNegotiation(
      data
    );

    setSellerTeamId(
      String(
        data.seller_team_id
      )
    );

    setPlayerId(
      String(
        data.player_id
      )
    );

    /*
      PREENCHE PAGAMENTO
      ORIGINAL
    */

    if (
      Number(
        data.installments
      ) === 2
    ) {
      setPaymentType(
        "installments"
      );

      setInstallment1(
        String(
          Number(
            data.installment_1 ||
              0
          )
        )
      );

      setInstallment2(
        String(
          Number(
            data.installment_2 ||
              0
          )
        )
      );
    } else {
      setPaymentType(
        "cash"
      );

      setAmount(
        String(
          Number(
            data.amount || 0
          )
        )
      );
    }

    /*
      JOGADORES DA
      PROPOSTA ORIGINAL
    */

    const {
      data: offeredRows,
      error: offeredError,
    } =
      await supabase
        .from(
          "negotiation_players"
        )
        .select(
          "player_id"
        )
        .eq(
          "negotiation_id",
          negotiationId
        );

    if (offeredError) {
      console.error(
        offeredError
      );

      return;
    }

    /*
      SE QUEM ESTÁ FAZENDO
      A CONTRAPROPOSTA É
      O COMPRADOR ORIGINAL,
      REAPROVEITA OS JOGADORES
      DA PROPOSTA ANTERIOR.
    */

    if (
      data.buyer_team_id ===
      currentTeamId
    ) {
      const ids =
        (
          offeredRows || []
        ).map(
          (row) =>
            String(
              row.player_id
            )
        );

      if (ids[0]) {
        setOfferedPlayer1(
          ids[0]
        );
      }

      if (ids[1]) {
        setOfferedPlayer2(
          ids[1]
        );
      }
    }
  }

  async function loadTargetPlayers(
    teamId: number
  ) {
    setLoadingPlayers(true);

    const {
      data,
      error,
    } =
      await supabase
        .from("players")
        .select(
          `
          id,
          name,
          position,
          age,
          nationality,
          ca,
          value,
          team_id
          `
        )
        .eq(
          "team_id",
          teamId
        )
        .order(
          "name",
          {
            ascending: true,
          }
        );

    if (error) {
      console.error(error);

      setError(
        "Erro ao carregar os jogadores desse clube."
      );

      setTargetPlayers([]);

      setLoadingPlayers(
        false
      );

      return;
    }

    setTargetPlayers(
      data || []
    );

    if (!isCounterOffer) {
      setPlayerId("");
    }

    setLoadingPlayers(
      false
    );
  }

  const selectedTargetPlayer =
    useMemo(() => {
      return (
        targetPlayers.find(
          (player) =>
            player.id ===
            Number(
              playerId
            )
        ) || null
      );
    }, [
      targetPlayers,
      playerId,
    ]);

  const selectedSeller =
    useMemo(() => {
      return (
        teams.find(
          (team) =>
            team.id ===
            Number(
              sellerTeamId
            )
        ) || null
      );
    }, [
      teams,
      sellerTeamId,
    ]);

  const selectedOfferedPlayer1 =
    useMemo(() => {
      return (
        myPlayers.find(
          (player) =>
            player.id ===
            Number(
              offeredPlayer1
            )
        ) || null
      );
    }, [
      myPlayers,
      offeredPlayer1,
    ]);

  const selectedOfferedPlayer2 =
    useMemo(() => {
      return (
        myPlayers.find(
          (player) =>
            player.id ===
            Number(
              offeredPlayer2
            )
        ) || null
      );
    }, [
      myPlayers,
      offeredPlayer2,
    ]);

  async function handleSubmit(
    event: React.FormEvent
  ) {
    event.preventDefault();

    setError("");
    setSuccess("");

    /*
      VERIFICA A JANELA
      NOVAMENTE NO MOMENTO
      DE ENVIAR.

      Isso evita deixar a
      página aberta e enviar
      depois que o ADM fechar.
    */

    const {
      data: windowCheck,
      error: windowCheckError,
    } =
      await supabase
        .from(
          "transfer_windows"
        )
        .select(
          `
          id,
          window_number,
          status,
          opened_at
          `
        )
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
      windowCheckError
    ) {
      console.error(
        windowCheckError
      );

      setError(
        "Não foi possível verificar se o mercado está aberto."
      );

      return;
    }

    if (!windowCheck) {
      setMarketOpen(false);

      setError(
        "Mercado de transferências fechado. Aguarde a próxima janela."
      );

      return;
    }

    if (!myTeam) {
      setError(
        "Seu clube não foi identificado."
      );

      return;
    }

    if (!sellerTeamId) {
      setError(
        "Selecione o clube do jogador."
      );

      return;
    }

    if (!playerId) {
      setError(
        "Selecione o jogador desejado."
      );

      return;
    }

    if (
      paymentType ===
        "cash" &&
      parseMoney(amount) < 0
    ) {
      setError(
        "Digite um valor válido."
      );

      return;
    }

    if (
      paymentType ===
      "installments"
    ) {
      if (
        parseMoney(
          installment1
        ) < 0 ||
        parseMoney(
          installment2
        ) < 0
      ) {
        setError(
          "Digite valores válidos para as parcelas."
        );

        return;
      }
    }

    if (
      totalAmount === 0 &&
      !offeredPlayer1 &&
      !offeredPlayer2
    ) {
      setError(
        "A proposta precisa ter dinheiro, jogadores ou ambos."
      );

      return;
    }

    if (
      offeredPlayer1 &&
      offeredPlayer2 &&
      offeredPlayer1 ===
        offeredPlayer2
    ) {
      setError(
        "Você não pode selecionar o mesmo jogador duas vezes."
      );

      return;
    }

    /*
      DIREÇÃO DO NEGÓCIO
    */

    let buyerTeamId =
      myTeam.id;

    let finalSellerTeamId =
      Number(
        sellerTeamId
      );

    if (
      isCounterOffer &&
      originalNegotiation
    ) {
      buyerTeamId =
        originalNegotiation.buyer_team_id;

      finalSellerTeamId =
        originalNegotiation.seller_team_id;
    }

    /*
      LIMITE DE 2 JOGADORES
      POR DIREÇÃO / POR JANELA
    */

    if (!windowCheck.opened_at) {
      setError(
        "A janela atual não possui data de abertura registrada."
      );

      return;
    }

    try {
      const otherTeamId =
        myTeam.id ===
        buyerTeamId
          ? finalSellerTeamId
          : buyerTeamId;

      const offeredCount =
        [
          offeredPlayer1,
          offeredPlayer2,
        ].filter(Boolean).length;

      const additions =
        new Map<
          string,
          {
            fromTeamId: number;
            toTeamId: number;
            amount: number;
          }
        >();

      function addMovement(
        fromTeamId: number,
        toTeamId: number,
        amountToAdd: number
      ) {
        if (
          amountToAdd <= 0
        ) {
          return;
        }

        const key =
          `${fromTeamId}-${toTeamId}`;

        const existing =
          additions.get(key);

        if (existing) {
          existing.amount +=
            amountToAdd;

          additions.set(
            key,
            existing
          );
        } else {
          additions.set(
            key,
            {
              fromTeamId,
              toTeamId,
              amount:
                amountToAdd,
            }
          );
        }
      }

      /*
        JOGADOR PRINCIPAL:
        VENDEDOR -> COMPRADOR
      */

      addMovement(
        finalSellerTeamId,
        buyerTeamId,
        1
      );

      /*
        JOGADORES OFERECIDOS:
        CLUBE QUE ESTÁ CRIANDO
        A PROPOSTA -> OUTRO CLUBE
      */

      addMovement(
        myTeam.id,
        otherTeamId,
        offeredCount
      );

      for (
        const movement of
        additions.values()
      ) {
        const used =
          await getTransferredCountInWindow(
            movement.fromTeamId,
            movement.toTeamId,
            windowCheck.opened_at
          );

        if (
          used +
            movement.amount >
          2
        ) {
          const {
            data: fromTeam,
          } = await supabase
            .from("teams")
            .select("name")
            .eq(
              "id",
              movement.fromTeamId
            )
            .maybeSingle();

          const {
            data: toTeam,
          } = await supabase
            .from("teams")
            .select("name")
            .eq(
              "id",
              movement.toTeamId
            )
            .maybeSingle();

          setError(
            `Limite da janela atingido: ${
              fromTeam?.name ||
              "este clube"
            } já enviou ${used}/2 jogador(es) para ${
              toTeam?.name ||
              "o outro clube"
            }. Esta proposta enviaria mais ${
              movement.amount
            }.`
          );

          return;
        }
      }
    } catch (limitError) {
      console.error(
        "Erro ao verificar limite de transferências:",
        limitError
      );

      setError(
        "Não foi possível verificar o limite de 2 jogadores por clube nesta janela."
      );

      return;
    }

    /*
      PAGAMENTO IMEDIATO
    */

    const immediatePayment =
      paymentType ===
      "installments"
        ? parseMoney(
            installment1
          )
        : totalAmount;

    /*
      VERIFICA SALDO
      DO COMPRADOR
    */

    const {
      data: buyerTeamData,
      error:
        buyerTeamError,
    } =
      await supabase
        .from("teams")
        .select(
          `
          id,
          name,
          budget
          `
        )
        .eq(
          "id",
          buyerTeamId
        )
        .single();

    if (
      buyerTeamError ||
      !buyerTeamData
    ) {
      console.error(
        buyerTeamError
      );

      setError(
        "Não foi possível verificar o orçamento do comprador."
      );

      return;
    }

    /*
      FAIR PLAY FINANCEIRO

      Um clube não pode acumular
      mais de R$ 30.000.000 em
      parcelas futuras.

      Entram na conta:
      - parcelas pendentes
      - parcelas com falha
      - a nova 2ª parcela desta proposta

      Pagamento à vista e 1ª parcela
      não entram porque são pagos agora.
    */

    if (
      paymentType ===
        "installments" &&
      parseMoney(
        installment2
      ) > 0
    ) {
      const {
        data: debtRows,
        error: debtError,
      } =
        await supabase
          .from(
            "negotiation_installments"
          )
          .select(
            "amount, status"
          )
          .eq(
            "payer_team_id",
            buyerTeamId
          )
          .in(
            "status",
            [
              "pending",
              "failed",
            ]
          );

      if (debtError) {
        console.error(
          "Erro ao verificar Fair Play Financeiro:",
          debtError
        );

        setError(
          "Não foi possível verificar as parcelas pendentes do clube."
        );

        return;
      }

      const currentDebt =
        (
          debtRows || []
        ).reduce(
          (
            total,
            row
          ) =>
            total +
            Number(
              row.amount ||
                0
            ),
          0
        );

      const newFutureDebt =
        parseMoney(
          installment2
        );

      const projectedDebt =
        currentDebt +
        newFutureDebt;

      if (
        projectedDebt >
        30000000
      ) {
        const availableDebt =
          Math.max(
            0,
            30000000 -
              currentDebt
          );

        setError(
          `Fair Play Financeiro: ${buyerTeamData.name} já possui R$ ${currentDebt.toLocaleString(
            "pt-BR"
          )} em parcelas comprometidas. Com esta 2ª parcela, a dívida chegaria a R$ ${projectedDebt.toLocaleString(
            "pt-BR"
          )}. O limite é R$ 30.000.000. O clube pode assumir no máximo mais R$ ${availableDebt.toLocaleString(
            "pt-BR"
          )} em parcelas.`
        );

        return;
      }
    }

    if (
      Number(
        buyerTeamData.budget ||
          0
      ) <
      immediatePayment
    ) {
      setError(
        `${buyerTeamData.name} não possui orçamento suficiente para o pagamento inicial.`
      );

      return;
    }

    setSending(true);

    /*
      CRIA NEGOCIAÇÃO
    */

    const {
      data:
        negotiationData,
      error:
        negotiationError,
    } =
      await supabase
        .from(
          "negotiations"
        )
        .insert({
          player_id:
            Number(playerId),

          buyer_team_id:
            buyerTeamId,

          seller_team_id:
            finalSellerTeamId,

          amount:
            totalAmount,

          payment_type:
            paymentType ===
            "cash"
              ? "cash"
              : "installments",

          installments:
            paymentType ===
            "cash"
              ? 1
              : 2,

          installment_1:
            paymentType ===
            "cash"
              ? totalAmount
              : parseMoney(
                  installment1
                ),

          installment_2:
            paymentType ===
            "cash"
              ? 0
              : parseMoney(
                  installment2
                ),

          status: "pending",

          parent_negotiation_id:
            isCounterOffer &&
            originalNegotiation
              ? originalNegotiation.id
              : null,

          created_by_team_id:
            myTeam.id,
        })
        .select("id")
        .single();

    if (
      negotiationError ||
      !negotiationData
    ) {
      console.error(
        negotiationError
      );

      setError(
        "Não foi possível criar a negociação."
      );

      setSending(false);
      return;
    }

    const negotiationId =
      negotiationData.id;

    /*
      JOGADORES INCLUÍDOS
    */

    const otherTeamId =
      myTeam.id ===
      buyerTeamId
        ? finalSellerTeamId
        : buyerTeamId;

    const exchangePlayers: {
      negotiation_id: number;
      player_id: number;
      from_team_id: number;
      to_team_id: number;
    }[] = [];

    if (offeredPlayer1) {
      exchangePlayers.push({
        negotiation_id:
          negotiationId,

        player_id:
          Number(
            offeredPlayer1
          ),

        from_team_id:
          myTeam.id,

        to_team_id:
          otherTeamId,
      });
    }

    if (offeredPlayer2) {
      exchangePlayers.push({
        negotiation_id:
          negotiationId,

        player_id:
          Number(
            offeredPlayer2
          ),

        from_team_id:
          myTeam.id,

        to_team_id:
          otherTeamId,
      });
    }

    if (
      exchangePlayers.length >
      0
    ) {
      const {
        error:
          playersError,
      } =
        await supabase
          .from(
            "negotiation_players"
          )
          .insert(
            exchangePlayers
          );

      if (playersError) {
        console.error(
          playersError
        );

        /*
          REMOVE A NEGOCIAÇÃO
          SE FALHAR AO ADICIONAR
          OS JOGADORES.
        */

        await supabase
          .from(
            "negotiations"
          )
          .delete()
          .eq(
            "id",
            negotiationId
          );

        setError(
          "Erro ao incluir os jogadores na proposta."
        );

        setSending(false);
        return;
      }
    }

    /*
      SE FOR CONTRAPROPOSTA,
      MARCA A ANTERIOR COMO
      COUNTERED.
    */

    if (
      isCounterOffer &&
      originalNegotiation
    ) {
      await supabase
        .from(
          "negotiations"
        )
        .update({
          status:
            "countered",

          updated_at:
            new Date().toISOString(),
        })
        .eq(
          "id",
          originalNegotiation.id
        );
    }

    setSuccess(
      isCounterOffer
        ? "Contraproposta enviada com sucesso!"
        : "Proposta enviada com sucesso!"
    );

    setTimeout(() => {
      router.push(
        "/transfers/negotiations"
      );

      router.refresh();
    }, 900);
  }

  /*
    CARREGANDO
  */

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">

        <div className="mx-auto max-w-6xl">

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando mercado...
          </div>

        </div>

      </main>
    );
  }

  /*
    MERCADO FECHADO
  */

  if (!marketOpen) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">

        <div className="mx-auto max-w-5xl">

          <Link
            href="/transfers/negotiations"
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Voltar para negociações
          </Link>

          <div className="mt-16 rounded-3xl border border-red-500/30 bg-red-500/5 p-10 text-center">

            <div className="text-6xl">
              🔒
            </div>

            <p className="mt-6 text-sm font-bold uppercase tracking-[0.25em] text-red-400">
              Mercado fechado
            </p>

            <h1 className="mt-3 text-4xl font-black md:text-5xl">
              Janela de transferências fechada
            </h1>

            <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-zinc-400">
              Nenhuma nova proposta ou contraproposta pode ser enviada enquanto o mercado estiver fechado.
            </p>

            <p className="mt-3 text-zinc-500">
              Aguarde o administrador abrir a próxima janela de transferências.
            </p>

            <Link
              href="/transfers/negotiations"
              className="mt-8 inline-block rounded-xl bg-zinc-800 px-6 py-4 font-black transition hover:bg-zinc-700"
            >
              Voltar para negociações
            </Link>

          </div>

        </div>

      </main>
    );
  }

  /*
    MERCADO ABERTO
  */

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">

      <div className="mx-auto max-w-6xl">

        <div className="mb-10">

          <Link
            href="/transfers/negotiations"
            className="text-sm font-bold text-zinc-400 hover:text-white"
          >
            ← Voltar para negociações
          </Link>

          {/* JANELA ATUAL */}

          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">

            <span className="h-2 w-2 rounded-full bg-green-400" />

            <span className="text-sm font-black text-green-400">
              MERCADO ABERTO
            </span>

            {currentWindow && (
              <span className="text-sm font-bold text-zinc-300">
                • Janela {currentWindow.window_number}
              </span>
            )}

          </div>

          <p className="mt-6 text-sm font-bold uppercase tracking-[0.2em] text-green-400">
            FriendZone League FM
          </p>

          <h1 className="mt-2 text-4xl font-black md:text-5xl">
            {isCounterOffer
              ? "Fazer contraproposta"
              : "Nova proposta"}
          </h1>

          <p className="mt-3 text-zinc-400">
            {isCounterOffer
              ? "Altere os termos e devolva uma nova proposta ao outro presidente."
              : "Monte sua oferta usando dinheiro, jogadores ou os dois."}
          </p>

          <div className="mt-5 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
            <span className="font-black">
              REGRA DA JANELA:
            </span>{" "}
            cada clube pode transferir no máximo 2 jogadores para o mesmo clube por janela. Jogadores incluídos em troca também contam para o limite.
          </div>

        </div>

        {isCounterOffer && (
          <div className="mb-6 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-blue-300">
            Você está respondendo à proposta #{counterOf}.
          </div>
        )}

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {success}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">

          <form
            onSubmit={handleSubmit}
            className="space-y-6"
          >

            {/* JOGADOR DESEJADO */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <h2 className="mb-5 text-xl font-black">
                Jogador desejado
              </h2>

              <div className="space-y-5">

                <div>

                  <label className="mb-2 block text-sm font-bold text-zinc-300">
                    Clube do jogador
                  </label>

                  <select
                    value={sellerTeamId}
                    onChange={(event) =>
                      setSellerTeamId(
                        event.target.value
                      )
                    }
                    disabled={isCounterOffer}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <option value="">
                      Selecione o clube do jogador
                    </option>

                    {teams.map((team) => (
                      <option
                        key={team.id}
                        value={team.id}
                      >
                        {team.name}
                      </option>
                    ))}

                    {originalNegotiation &&
                      !teams.some(
                        (team) =>
                          team.id ===
                          originalNegotiation.seller_team_id
                      ) && (
                        <option
                          value={
                            originalNegotiation.seller_team_id
                          }
                        >
                          Clube do jogador
                        </option>
                      )}

                  </select>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-bold text-zinc-300">
                    Jogador
                  </label>

                  <select
                    value={playerId}
                    onChange={(event) =>
                      setPlayerId(
                        event.target.value
                      )
                    }
                    disabled={
                      isCounterOffer ||
                      !sellerTeamId ||
                      loadingPlayers
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500 disabled:cursor-not-allowed disabled:opacity-60"
                  >

                    <option value="">
                      {loadingPlayers
                        ? "Carregando jogadores..."
                        : "Selecione um jogador"}
                    </option>

                    {targetPlayers.map(
                      (player) => (
                        <option
                          key={player.id}
                          value={player.id}
                        >
                          {player.name}

                          {player.position
                            ? ` — ${player.position}`
                            : ""}

                          {player.ca !== null
                            ? ` — CA ${player.ca}`
                            : ""}
                        </option>
                      )
                    )}

                  </select>

                </div>

              </div>

            </section>

            {/* PAGAMENTO */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <h2 className="mb-5 text-xl font-black">
                Pagamento
              </h2>

              <div className="mb-6 grid grid-cols-2 gap-3">

                <button
                  type="button"
                  onClick={() =>
                    setPaymentType(
                      "cash"
                    )
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentType ===
                    "cash"
                      ? "border-green-500 bg-green-500 text-black"
                      : "border-zinc-700 bg-zinc-950 text-white"
                  }`}
                >
                  À vista
                </button>

                <button
                  type="button"
                  onClick={() =>
                    setPaymentType(
                      "installments"
                    )
                  }
                  className={`rounded-xl border px-4 py-3 font-bold ${
                    paymentType ===
                    "installments"
                      ? "border-green-500 bg-green-500 text-black"
                      : "border-zinc-700 bg-zinc-950 text-white"
                  }`}
                >
                  2x
                </button>

              </div>

              {paymentType === "cash" ? (
                <div>

                  <label className="mb-2 block text-sm font-bold text-zinc-300">
                    Valor à vista
                  </label>

                  <input
                    type="number"
                    min="0"
                    value={amount}
                    onChange={(event) =>
                      setAmount(
                        event.target.value
                      )
                    }
                    placeholder="Ex: 20000000"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500"
                  />

                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">

                  <div>

                    <label className="mb-2 block text-sm font-bold text-zinc-300">
                      1ª parcela
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={installment1}
                      onChange={(event) =>
                        setInstallment1(
                          event.target.value
                        )
                      }
                      placeholder="Ex: 15000000"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500"
                    />

                  </div>

                  <div>

                    <label className="mb-2 block text-sm font-bold text-zinc-300">
                      2ª parcela
                    </label>

                    <input
                      type="number"
                      min="0"
                      value={installment2}
                      onChange={(event) =>
                        setInstallment2(
                          event.target.value
                        )
                      }
                      placeholder="Ex: 10000000"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500"
                    />

                  </div>

                </div>
              )}

              <p className="mt-4 text-sm text-zinc-500">
                Total em dinheiro: R${" "}
                {totalAmount.toLocaleString(
                  "pt-BR"
                )}
              </p>

              <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 p-4 text-sm text-yellow-200">
                <span className="font-black">
                  FAIR PLAY FINANCEIRO:
                </span>{" "}
                cada clube pode ter no máximo R$ 30.000.000 em parcelas futuras pendentes.
              </div>


            </section>

            {/* JOGADORES */}

            <section className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

              <h2 className="text-xl font-black">
                Jogadores incluídos
              </h2>

              <p className="mt-1 text-sm text-zinc-500">
                Você pode incluir no máximo 2 jogadores do seu clube.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">

                <div>

                  <label className="mb-2 block text-sm font-bold text-zinc-300">
                    Jogador 1
                  </label>

                  <select
                    value={
                      offeredPlayer1
                    }
                    onChange={(event) =>
                      setOfferedPlayer1(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500"
                  >

                    <option value="">
                      Nenhum jogador
                    </option>

                    {myPlayers
                      .filter(
                        (player) =>
                          String(
                            player.id
                          ) !==
                          offeredPlayer2
                      )
                      .map(
                        (player) => (
                          <option
                            key={
                              player.id
                            }
                            value={
                              player.id
                            }
                          >
                            {
                              player.name
                            }

                            {player.position
                              ? ` — ${player.position}`
                              : ""}

                            {player.ca !==
                            null
                              ? ` — CA ${player.ca}`
                              : ""}
                          </option>
                        )
                      )}

                  </select>

                </div>

                <div>

                  <label className="mb-2 block text-sm font-bold text-zinc-300">
                    Jogador 2
                  </label>

                  <select
                    value={
                      offeredPlayer2
                    }
                    onChange={(event) =>
                      setOfferedPlayer2(
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-white outline-none focus:border-green-500"
                  >

                    <option value="">
                      Nenhum jogador
                    </option>

                    {myPlayers
                      .filter(
                        (player) =>
                          String(
                            player.id
                          ) !==
                          offeredPlayer1
                      )
                      .map(
                        (player) => (
                          <option
                            key={
                              player.id
                            }
                            value={
                              player.id
                            }
                          >
                            {
                              player.name
                            }

                            {player.position
                              ? ` — ${player.position}`
                              : ""}

                            {player.ca !==
                            null
                              ? ` — CA ${player.ca}`
                              : ""}
                          </option>
                        )
                      )}

                  </select>

                </div>

              </div>

            </section>

            {/* ENVIAR */}

            <button
              type="submit"
              disabled={
                sending ||
                !marketOpen
              }
              className="w-full rounded-xl bg-green-500 px-5 py-4 text-lg font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {sending
                ? "Enviando..."
                : isCounterOffer
                ? "Enviar contraproposta"
                : "Enviar proposta"}
            </button>

          </form>

          {/* RESUMO */}

          <aside className="h-fit rounded-2xl border border-zinc-800 bg-zinc-900 p-6 lg:sticky lg:top-6">

            <p className="text-sm font-bold uppercase tracking-widest text-zinc-500">
              {isCounterOffer
                ? "Resumo da contraproposta"
                : "Resumo da proposta"}
            </p>

            <div className="mt-6 space-y-5">

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Clube
                </p>

                <p className="mt-1 font-black">
                  {myTeam?.name || "-"}
                </p>

              </div>

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Orçamento atual
                </p>

                <p className="mt-1 text-xl font-black text-green-400">
                  R${" "}
                  {Number(
                    myTeam?.budget || 0
                  ).toLocaleString(
                    "pt-BR"
                  )}
                </p>

              </div>

              <hr className="border-zinc-800" />

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Clube do jogador
                </p>

                <p className="mt-1 font-bold">
                  {selectedSeller?.name ||
                    "-"}
                </p>

              </div>

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Jogador negociado
                </p>

                <p className="mt-1 font-black">
                  {selectedTargetPlayer?.name ||
                    "-"}
                </p>

              </div>

              <hr className="border-zinc-800" />

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Dinheiro
                </p>

                <p className="mt-1 font-bold">
                  {paymentType ===
                  "cash"
                    ? "À vista"
                    : "2 parcelas"}
                </p>

                {paymentType ===
                  "installments" && (
                  <div className="mt-2 text-sm text-zinc-400">

                    <p>
                      1ª: R${" "}
                      {parseMoney(
                        installment1
                      ).toLocaleString(
                        "pt-BR"
                      )}
                    </p>

                    <p>
                      2ª: R${" "}
                      {parseMoney(
                        installment2
                      ).toLocaleString(
                        "pt-BR"
                      )}
                    </p>

                  </div>
                )}

                <p className="mt-2 text-2xl font-black text-green-400">
                  R${" "}
                  {totalAmount.toLocaleString(
                    "pt-BR"
                  )}
                </p>

              </div>

              <hr className="border-zinc-800" />

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Jogadores incluídos
                </p>

                {!selectedOfferedPlayer1 &&
                !selectedOfferedPlayer2 ? (
                  <p className="mt-2 text-zinc-500">
                    Nenhum
                  </p>
                ) : (
                  <div className="mt-2 space-y-2">

                    {selectedOfferedPlayer1 && (
                      <p className="font-bold">
                        +{" "}
                        {
                          selectedOfferedPlayer1.name
                        }
                      </p>
                    )}

                    {selectedOfferedPlayer2 && (
                      <p className="font-bold">
                        +{" "}
                        {
                          selectedOfferedPlayer2.name
                        }
                      </p>
                    )}

                  </div>
                )}

              </div>

              <hr className="border-zinc-800" />

              <div>

                <p className="text-xs uppercase text-zinc-500">
                  Janela
                </p>

                <p className="mt-1 font-black text-green-400">
                  {currentWindow
                    ? `Janela ${currentWindow.window_number}`
                    : "-"}
                </p>

              </div>

            </div>

          </aside>

        </div>

      </div>

    </main>
  );
}