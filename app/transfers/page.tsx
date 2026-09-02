"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";

type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_id: string | null;
};

type SimplePlayer = {
  id: number;
  name: string;
  position: string | null;
  ca: number | null;
};

type OfferedPlayer = {
  id: number;
  player_id: number;
  from_team_id: number | null;
  to_team_id: number | null;
  player: SimplePlayer | null;
};

type Negotiation = {
  id: number;
  player_id: number;
  buyer_team_id: number;
  seller_team_id: number;

  amount: number;
  payment_type: string;
  installments: number;
  installment_1: number;
  installment_2: number;

  status: string;

  parent_negotiation_id: number | null;
  created_by_team_id: number | null;

  created_at: string;
  accepted_at: string | null;
  rejected_at: string | null;

  player: SimplePlayer | null;
  buyer_team: Team | null;
  seller_team: Team | null;

  offered_players: OfferedPlayer[];
};

export default function InternalNegotiationPage() {
  const [myTeam, setMyTeam] = useState<Team | null>(null);
  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);

  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<number | null>(null);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    loadNegotiations();
  }, []);

  async function loadNegotiations() {
    setLoading(true);
    setError("");

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select("id, name, budget, manager_id")
      .eq("manager_id", user.id)
      .single();

    if (teamError || !teamData) {
      console.error(teamError);
      setError("Não foi possível identificar o seu clube.");
      setLoading(false);
      return;
    }

    setMyTeam(teamData);

    const { data: negotiationRows, error: negotiationError } =
      await supabase
        .from("negotiations")
        .select("*")
        .or(
          `buyer_team_id.eq.${teamData.id},seller_team_id.eq.${teamData.id}`
        )
        .order("created_at", { ascending: false });

    if (negotiationError) {
      console.error(negotiationError);
      setError("Erro ao carregar as negociações.");
      setLoading(false);
      return;
    }

    const hydratedNegotiations: Negotiation[] = await Promise.all(
      (negotiationRows || []).map(async (negotiation: any) => {
        const [
          playerResult,
          buyerResult,
          sellerResult,
          offeredPlayersResult,
        ] = await Promise.all([
          supabase
            .from("players")
            .select("id, name, position, ca")
            .eq("id", negotiation.player_id)
            .maybeSingle(),

          supabase
            .from("teams")
            .select("id, name, budget, manager_id")
            .eq("id", negotiation.buyer_team_id)
            .maybeSingle(),

          supabase
            .from("teams")
            .select("id, name, budget, manager_id")
            .eq("id", negotiation.seller_team_id)
            .maybeSingle(),

          supabase
            .from("negotiation_players")
            .select("id, player_id, from_team_id, to_team_id")
            .eq("negotiation_id", negotiation.id),
        ]);

        const offeredRows = offeredPlayersResult.data || [];

        const offeredPlayers: OfferedPlayer[] = await Promise.all(
          offeredRows.map(async (row: any) => {
            const { data: playerData } = await supabase
              .from("players")
              .select("id, name, position, ca")
              .eq("id", row.player_id)
              .maybeSingle();

            return {
              ...row,
              player: playerData || null,
            };
          })
        );

        return {
          ...negotiation,

          amount: Number(negotiation.amount || 0),
          installment_1: Number(negotiation.installment_1 || 0),
          installment_2: Number(negotiation.installment_2 || 0),

          player: playerResult.data || null,
          buyer_team: buyerResult.data || null,
          seller_team: sellerResult.data || null,

          offered_players: offeredPlayers,
        };
      })
    );

    setNegotiations(hydratedNegotiations);
    setLoading(false);
  }

  function money(value: number | null | undefined) {
    return `R$ ${Number(value || 0).toLocaleString("pt-BR")}`;
  }

  function getStatusLabel(status: string) {
    switch (status) {
      case "accepted":
        return "Aceita";

      case "rejected":
        return "Recusada";

      case "countered":
        return "Contraproposta";

      case "cancelled":
        return "Cancelada";

      default:
        return "Pendente";
    }
  }

  function statusClass(status: string) {
    switch (status) {
      case "accepted":
        return "bg-green-500/15 text-green-400";

      case "rejected":
        return "bg-red-500/15 text-red-400";

      case "countered":
        return "bg-blue-500/15 text-blue-400";

      case "cancelled":
        return "bg-zinc-700 text-zinc-300";

      default:
        return "bg-yellow-500/15 text-yellow-400";
    }
  }

  function canRespond(negotiation: Negotiation) {
    if (!myTeam) return false;

    if (
      negotiation.status !== "pending" &&
      negotiation.status !== "countered"
    ) {
      return false;
    }

    return negotiation.created_by_team_id !== myTeam.id;
  }

  async function handleReject(negotiation: Negotiation) {
    if (!myTeam) return;

    if (!canRespond(negotiation)) {
      setError("Você não pode responder a essa proposta.");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja recusar essa proposta?"
    );

    if (!confirmed) return;

    setProcessingId(negotiation.id);
    setError("");
    setMessage("");

    const { error: rejectError } = await supabase
      .from("negotiations")
      .update({
        status: "rejected",
        rejected_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", negotiation.id);

    if (rejectError) {
      console.error(rejectError);

      setError("Não foi possível recusar a proposta.");
      setProcessingId(null);
      return;
    }

    setMessage("Proposta recusada.");

    await loadNegotiations();

    setProcessingId(null);
  }

  async function handleAccept(negotiation: Negotiation) {
    if (!myTeam) return;

    if (!canRespond(negotiation)) {
      setError("Você não pode aceitar essa proposta.");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja aceitar essa negociação?\n\n" +
        "O sistema irá validar saldo, Fair Play Financeiro, limite de 2 jogadores, propriedade dos jogadores, parcelas e BID antes de concluir."
    );

    if (!confirmed) return;

    setProcessingId(negotiation.id);
    setError("");
    setMessage("");

    try {
      const {
        data,
        error: acceptError,
      } = await supabase.rpc(
        "accept_internal_negotiation",
        {
          p_negotiation_id: negotiation.id,
        }
      );

      if (acceptError) {
        throw acceptError;
      }

      const result =
        data &&
        typeof data === "object"
          ? data
          : null;

      setMessage(
        result &&
          "message" in result &&
          typeof result.message === "string"
          ? result.message
          : "Negociação aceita com sucesso!"
      );

      await loadNegotiations();
    } catch (acceptError: any) {
      console.error(
        "Erro ao aceitar negociação:",
        acceptError
      );

      const rawMessage =
        String(
          acceptError?.message ||
            ""
        );

      if (
        rawMessage.includes(
          "MARKET_CLOSED"
        )
      ) {
        setError(
          "Não é possível aceitar a proposta porque o mercado está fechado."
        );
      } else if (
        rawMessage.includes(
          "NOT_ALLOWED_TO_ACCEPT"
        )
      ) {
        setError(
          "Você não possui permissão para aceitar esta proposta."
        );
      } else if (
        rawMessage.includes(
          "NEGOTIATION_NOT_AVAILABLE"
        )
      ) {
        setError(
          "Esta proposta não está mais disponível para aceitação."
        );
      } else if (
        rawMessage.includes(
          "INSUFFICIENT_BUDGET"
        )
      ) {
        setError(
          "O clube comprador não possui orçamento suficiente para pagar o valor inicial."
        );
      } else if (
        rawMessage.includes(
          "FAIR_PLAY_LIMIT"
        )
      ) {
        setError(
          "Fair Play Financeiro: o comprador ultrapassaria o limite de R$ 30.000.000 em parcelas futuras."
        );
      } else if (
        rawMessage.includes(
          "TRANSFER_LIMIT"
        )
      ) {
        setError(
          "Limite da janela atingido: um dos clubes ultrapassaria o máximo de 2 jogadores enviados ao mesmo clube."
        );
      } else if (
        rawMessage.includes(
          "PLAYER_OWNERSHIP_CHANGED"
        )
      ) {
        setError(
          "A negociação não pode ser concluída porque um dos jogadores não pertence mais ao clube informado na proposta."
        );
      } else if (
        rawMessage.includes(
          "PLAYER_NOT_FOUND"
        )
      ) {
        setError(
          "Um dos jogadores da negociação não foi encontrado."
        );
      } else if (
        rawMessage.includes(
          "TEAM_NOT_FOUND"
        )
      ) {
        setError(
          "Um dos clubes da negociação não foi encontrado."
        );
      } else if (
        rawMessage.includes(
          "NOT_AUTHENTICATED"
        )
      ) {
        setError(
          "Sua sessão expirou. Entre novamente."
        );
      } else {
        setError(
          rawMessage ||
            "Não foi possível aceitar a negociação."
        );
      }
    } finally {
      setProcessingId(null);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white">
        <div className="mx-auto max-w-7xl">
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
            Carregando negociações...
          </div>
        </div>
      </main>
    );
  }

  const received = negotiations.filter(
    (negotiation) =>
      negotiation.created_by_team_id !== myTeam?.id
  );

  const sent = negotiations.filter(
    (negotiation) =>
      negotiation.created_by_team_id === myTeam?.id
  );

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-green-400">
              FriendZone League FM
            </p>

            <h1 className="text-4xl font-black md:text-5xl">
              Negociação Interna
            </h1>

            <p className="mt-3 text-zinc-400">
              Gerencie propostas de transferências entre os clubes da FriendZone League FM.
            </p>

            <div className="mt-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              <span className="font-black">
                REGRA DA JANELA:
              </span>{" "}
              cada clube pode transferir no máximo 2 jogadores para o mesmo clube por janela. Jogadores usados em troca também contam.
            </div>

            <div className="mt-3 rounded-xl border border-blue-500/30 bg-blue-500/10 px-4 py-3 text-sm text-blue-200">
              <span className="font-black">
                FAIR PLAY FINANCEIRO:
              </span>{" "}
              nenhum clube pode acumular mais de R$ 30.000.000 em parcelas futuras.
            </div>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/transfers/installments"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black text-white transition hover:bg-zinc-800"
            >
              Parcelas pendentes
            </Link>

            <Link
              href="/transfers/negotiations/new"
              className="rounded-xl bg-green-500 px-5 py-3 font-black text-black transition hover:bg-green-400"
            >
              + Nova proposta
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-red-300">
            {error}
          </div>
        )}

        {message && (
          <div className="mb-6 rounded-xl border border-green-500/30 bg-green-500/10 p-4 text-green-300">
            {message}
          </div>
        )}

        <div className="space-y-12">

          <section>
            <div className="mb-5">
              <p className="text-sm font-bold uppercase tracking-widest text-green-400">
                Caixa de entrada
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Propostas recebidas
              </h2>
            </div>

            {received.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
                Nenhuma proposta recebida.
              </div>
            ) : (
              <div className="grid gap-5">
                {received.map((negotiation) => (
                  <NegotiationCard
                    key={negotiation.id}
                    negotiation={negotiation}
                    myTeam={myTeam}
                    money={money}
                    statusClass={statusClass}
                    getStatusLabel={getStatusLabel}
                    canRespond={canRespond}
                    processing={
                      processingId === negotiation.id
                    }
                    onAccept={() =>
                      handleAccept(negotiation)
                    }
                    onReject={() =>
                      handleReject(negotiation)
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-5">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
                Saída
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Propostas enviadas
              </h2>
            </div>

            {sent.length === 0 ? (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
                Nenhuma proposta enviada.
              </div>
            ) : (
              <div className="grid gap-5">
                {sent.map((negotiation) => (
                  <NegotiationCard
                    key={negotiation.id}
                    negotiation={negotiation}
                    myTeam={myTeam}
                    money={money}
                    statusClass={statusClass}
                    getStatusLabel={getStatusLabel}
                    canRespond={canRespond}
                    processing={
                      processingId === negotiation.id
                    }
                    onAccept={() =>
                      handleAccept(negotiation)
                    }
                    onReject={() =>
                      handleReject(negotiation)
                    }
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}

type CardProps = {
  negotiation: Negotiation;
  myTeam: Team | null;

  money: (
    value: number | null | undefined
  ) => string;

  statusClass: (status: string) => string;

  getStatusLabel: (status: string) => string;

  canRespond: (negotiation: Negotiation) => boolean;

  processing: boolean;

  onAccept: () => void;
  onReject: () => void;
};

function NegotiationCard({
  negotiation,
  myTeam,
  money,
  statusClass,
  getStatusLabel,
  canRespond,
  processing,
  onAccept,
  onReject,
}: CardProps) {
  const isTwoPayments =
    Number(negotiation.installments) === 2;

  const otherTeam =
    myTeam?.id === negotiation.buyer_team_id
      ? negotiation.seller_team
      : negotiation.buyer_team;

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">

      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">

        <div className="flex-1">
          <div className="mb-4 flex flex-wrap items-center gap-3">

            <span
              className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                negotiation.status
              )}`}
            >
              {getStatusLabel(negotiation.status)}
            </span>

            {negotiation.parent_negotiation_id && (
              <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-bold text-blue-400">
                Contraproposta
              </span>
            )}

          </div>

          <p className="text-sm text-zinc-500">
            Jogador negociado
          </p>

          <h3 className="mt-1 text-2xl font-black">
            {negotiation.player?.name ||
              `Jogador #${negotiation.player_id}`}
          </h3>


          {negotiation.player && (
            <p className="mt-1 text-sm text-zinc-400">
              {negotiation.player.position || "Posição -"}
              {negotiation.player.ca !== null
                ? ` • CA ${negotiation.player.ca}`
                : ""}
            </p>
          )}

          <div className="mt-5">
            <p className="text-sm text-zinc-500">
              Outro clube
            </p>

            <p className="font-bold">
              {otherTeam?.name || "-"}
            </p>
          </div>

          {negotiation.offered_players.length > 0 && (
            <div className="mt-5">
              <p className="text-sm text-zinc-500">
                Jogadores incluídos na proposta
              </p>

              <div className="mt-2 space-y-2">
                {negotiation.offered_players.map(
                  (offered) => (
                    <div
                      key={offered.id}
                      className="rounded-lg bg-zinc-950 px-3 py-2"
                    >
                      <span className="font-bold">
                        +{" "}
                        {offered.player?.name ||
                          `Jogador #${offered.player_id}`}
                      </span>

                      {offered.player?.ca !== null &&
                        offered.player?.ca !==
                          undefined && (
                          <span className="ml-2 text-sm text-zinc-500">
                            CA {offered.player.ca}
                          </span>
                        )}
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        <div className="min-w-[260px] rounded-xl bg-zinc-950 p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
            Pagamento
          </p>

          <p className="mt-2 text-2xl font-black text-green-400">
            {money(negotiation.amount)}
          </p>

          {isTwoPayments ? (
            <div className="mt-3 space-y-1 text-sm text-zinc-400">
              <p>
                1ª parcela:{" "}
                <strong className="text-white">
                  {money(
                    negotiation.installment_1
                  )}
                </strong>
              </p>

              <p>
                2ª parcela:{" "}
                <strong className="text-white">
                  {money(
                    negotiation.installment_2
                  )}
                </strong>
              </p>

              <p className="pt-2 text-xs font-bold uppercase text-yellow-400">
                2ª parcela: próxima janela
              </p>
            </div>
          ) : (
            <p className="mt-2 text-sm text-zinc-400">
              Pagamento à vista
            </p>
          )}
        </div>
      </div>

      {canRespond(negotiation) && (
        <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6 md:grid-cols-3">

          <button
            type="button"
            disabled={processing}
            onClick={onAccept}
            className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:opacity-50"
          >
            {processing
              ? "Processando..."
              : "✓ Aceitar"}
          </button>

          <button
            type="button"
            disabled={processing}
            onClick={onReject}
            className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
          >
            ✕ Recusar
          </button>

          <Link
            href={`/transfers/negotiations/new?counterOf=${negotiation.id}`}
            className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center font-black text-blue-400 transition hover:bg-blue-500/20"
          >
            ↔ Fazer contraproposta
          </Link>

        </div>
      )}
    </div>
  );
}