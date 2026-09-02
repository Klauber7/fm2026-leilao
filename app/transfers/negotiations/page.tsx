"use client";

import { useEffect, useMemo, useState } from "react";
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

  creator_team: Team | null;

  offered_players: OfferedPlayer[];
};

type NegotiationThread = {
  rootId: number;
  negotiations: Negotiation[];
  latest: Negotiation;
};

export default function NegotiationsPage() {
  const [myTeam, setMyTeam] = useState<Team | null>(null);

  const [negotiations, setNegotiations] = useState<Negotiation[]>([]);

  const [marketOpen, setMarketOpen] = useState(false);

  const [currentWindow, setCurrentWindow] = useState<number | null>(null);

  const [loading, setLoading] = useState(true);

  const [processingId, setProcessingId] = useState<number | null>(null);

  const [error, setError] = useState("");

  const [message, setMessage] = useState("");

  const [expandedThreads, setExpandedThreads] = useState<
    Record<number, boolean>
  >({});

  useEffect(() => {
    loadNegotiations();
  }, []);

  async function loadNegotiations() {
    setLoading(true);
    setError("");

    /*
      USUÁRIO
    */

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      setError("Você precisa estar logado.");
      setLoading(false);
      return;
    }

    /*
      JANELA ATUAL
    */

    const { data: windowData, error: windowError } = await supabase
      .from("transfer_windows")
      .select(`
        window_number,
        status
      `)
      .eq("status", "open")
      .order("window_number", {
        ascending: false,
      })
      .limit(1)
      .maybeSingle();

    if (windowError) {
      console.error(windowError);
    }

    if (windowData) {
      setMarketOpen(true);

      setCurrentWindow(Number(windowData.window_number));
    } else {
      setMarketOpen(false);
      setCurrentWindow(null);
    }

    /*
      MEU CLUBE
    */

    const { data: teamData, error: teamError } = await supabase
      .from("teams")
      .select(`
        id,
        name,
        budget,
        manager_id
      `)
      .eq("manager_id", user.id)
      .single();

    if (teamError || !teamData) {
      console.error(teamError);

      setError("Não foi possível identificar o seu clube.");

      setLoading(false);
      return;
    }

    setMyTeam(teamData);

    /*
      TODAS AS NEGOCIAÇÕES
      DO CLUBE
    */

    const { data: negotiationRows, error: negotiationError } = await supabase
      .from("negotiations")
      .select("*")
      .or(
        `buyer_team_id.eq.${teamData.id},seller_team_id.eq.${teamData.id}`
      )
      .order("created_at", {
        ascending: true,
      });

    if (negotiationError) {
      console.error(negotiationError);

      setError("Erro ao carregar as negociações.");

      setLoading(false);
      return;
    }

    /*
      COMPLETA OS DADOS
      DE CADA PROPOSTA
    */

    const hydratedNegotiations: Negotiation[] = await Promise.all(
      (negotiationRows || []).map(async (negotiation: any) => {
        const [
          playerResult,
          buyerResult,
          sellerResult,
          creatorResult,
          offeredResult,
        ] = await Promise.all([
          supabase
            .from("players")
            .select(`
              id,
              name,
              position,
              ca
            `)
            .eq("id", negotiation.player_id)
            .maybeSingle(),

          supabase
            .from("teams")
            .select(`
              id,
              name,
              budget,
              manager_id
            `)
            .eq("id", negotiation.buyer_team_id)
            .maybeSingle(),

          supabase
            .from("teams")
            .select(`
              id,
              name,
              budget,
              manager_id
            `)
            .eq("id", negotiation.seller_team_id)
            .maybeSingle(),

          negotiation.created_by_team_id
            ? supabase
                .from("teams")
                .select(`
                  id,
                  name,
                  budget,
                  manager_id
                `)
                .eq("id", negotiation.created_by_team_id)
                .maybeSingle()
            : Promise.resolve({
                data: null,
                error: null,
              }),

          supabase
            .from("negotiation_players")
            .select(`
              id,
              player_id,
              from_team_id,
              to_team_id
            `)
            .eq("negotiation_id", negotiation.id),
        ]);

        const offeredRows = offeredResult.data || [];

        const offeredPlayers: OfferedPlayer[] = await Promise.all(
          offeredRows.map(async (row: any) => {
            const { data: playerData } = await supabase
              .from("players")
              .select(`
                id,
                name,
                position,
                ca
              `)
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

          creator_team: creatorResult.data || null,

          offered_players: offeredPlayers,
        };
      })
    );

    setNegotiations(hydratedNegotiations);

    setLoading(false);
  }

  /*
    AGRUPA PROPOSTA +
    CONTRAPROPOSTAS
  */

  const threads = useMemo(() => {
    const negotiationMap = new Map<number, Negotiation>();

    negotiations.forEach((negotiation) => {
      negotiationMap.set(negotiation.id, negotiation);
    });

    function findRootId(negotiation: Negotiation) {
      let current = negotiation;

      const visited = new Set<number>();

      while (current.parent_negotiation_id) {
        if (visited.has(current.id)) {
          break;
        }

        visited.add(current.id);

        const parent = negotiationMap.get(
          current.parent_negotiation_id
        );

        if (!parent) {
          break;
        }

        current = parent;
      }

      return current.id;
    }

    const groups = new Map<number, Negotiation[]>();

    negotiations.forEach((negotiation) => {
      const rootId = findRootId(negotiation);

      const existing = groups.get(rootId) || [];

      existing.push(negotiation);

      groups.set(rootId, existing);
    });

    const result: NegotiationThread[] = [];

    groups.forEach((items, rootId) => {
      const sorted = [...items].sort((a, b) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();

        if (dateA !== dateB) {
          return dateA - dateB;
        }

        return a.id - b.id;
      });

      result.push({
        rootId,
        negotiations: sorted,
        latest: sorted[sorted.length - 1],
      });
    });

    return result.sort((a, b) => {
      return (
        new Date(b.latest.created_at).getTime() -
        new Date(a.latest.created_at).getTime()
      );
    });
  }, [negotiations]);

  /*
    RECEBIDAS / ENVIADAS

    CONSIDERA QUEM ENVIOU
    A ÚLTIMA PROPOSTA DA THREAD.
  */

  const receivedThreads = useMemo(() => {
    if (!myTeam) return [];

    return threads.filter(
      (thread) => thread.latest.created_by_team_id !== myTeam.id
    );
  }, [threads, myTeam]);

  const sentThreads = useMemo(() => {
    if (!myTeam) return [];

    return threads.filter(
      (thread) => thread.latest.created_by_team_id === myTeam.id
    );
  }, [threads, myTeam]);

  function money(value: number | null | undefined) {
    return `R$ ${Number(value || 0).toLocaleString("pt-BR")}`;
  }

  function dateTime(value: string | null | undefined) {
    if (!value) {
      return "-";
    }

    return new Date(value).toLocaleString("pt-BR");
  }

  function getStatusLabel(status: string) {
    if (status === "accepted") {
      return "Aceita";
    }

    if (status === "rejected") {
      return "Recusada";
    }

    if (status === "countered") {
      return "Substituída";
    }

    if (status === "cancelled") {
      return "Cancelada";
    }

    return "Pendente";
  }

  function statusClass(status: string) {
    if (status === "accepted") {
      return "bg-green-500/15 text-green-400";
    }

    if (status === "rejected") {
      return "bg-red-500/15 text-red-400";
    }

    if (status === "countered") {
      return "bg-blue-500/15 text-blue-400";
    }

    if (status === "cancelled") {
      return "bg-zinc-700 text-zinc-300";
    }

    return "bg-yellow-500/15 text-yellow-400";
  }

  /*
    SOMENTE A ÚLTIMA PROPOSTA
    PENDENTE PODE RECEBER RESPOSTA.
  */

  function canRespond(negotiation: Negotiation) {
    if (!myTeam) {
      return false;
    }

    if (!marketOpen) {
      return false;
    }

    if (negotiation.status !== "pending") {
      return false;
    }

    return negotiation.created_by_team_id !== myTeam.id;
  }

  function toggleThread(rootId: number) {
    setExpandedThreads((current) => ({
      ...current,
      [rootId]: !current[rootId],
    }));
  }

  /*
    ACEITAR
  */

  async function handleAccept(negotiation: Negotiation) {
    if (!myTeam) {
      return;
    }

    if (!marketOpen) {
      setError("Mercado de transferências fechado.");
      return;
    }

    if (!canRespond(negotiation)) {
      setError("Você não pode aceitar essa proposta.");
      return;
    }

    const confirmed = window.confirm(
      `ACEITAR NEGOCIAÇÃO?\n\n` +
        `${negotiation.player?.name || "Jogador"}\n\n` +
        `Valor: ${money(negotiation.amount)}\n\n` +
        `Depois de aceitar, os jogadores e o dinheiro serão transferidos automaticamente.`
    );

    if (!confirmed) {
      return;
    }

    setProcessingId(negotiation.id);

    setError("");
    setMessage("");

    const { error: acceptError } = await supabase.rpc(
      "accept_transfer_negotiation",
      {
        p_negotiation_id: negotiation.id,
      }
    );

    if (acceptError) {
      console.error(acceptError);

      const errorMessage = acceptError.message || "";

      if (errorMessage.includes("TRANSFER_WINDOW_CLOSED")) {
        setMarketOpen(false);

        setError("A janela de transferências foi fechada.");
      } else if (errorMessage.includes("INSUFFICIENT_BUDGET")) {
        setError(
          "O clube comprador não possui saldo suficiente para o pagamento inicial."
        );
      } else if (errorMessage.includes("PLAYER_CHANGED_TEAM")) {
        setError(
          "O jogador negociado já mudou de clube. Essa proposta não pode mais ser aceita."
        );
      } else if (
        errorMessage.includes("OFFERED_PLAYER_CHANGED_TEAM")
      ) {
        setError(
          "Um dos jogadores incluídos na negociação já mudou de clube."
        );
      } else if (
        errorMessage.includes("CANNOT_ACCEPT_OWN_PROPOSAL")
      ) {
        setError(
          "Você não pode aceitar uma proposta enviada pelo seu próprio clube."
        );
      } else if (
        errorMessage.includes("NEGOTIATION_NOT_ACTIVE")
      ) {
        setError("Essa negociação não está mais ativa.");
      } else {
        setError(`Não foi possível aceitar: ${errorMessage}`);
      }

      setProcessingId(null);
      return;
    }

    setMessage(
      "Negociação aceita! Dinheiro, jogadores e parcelas foram atualizados."
    );

    await loadNegotiations();

    setProcessingId(null);
  }

  /*
    RECUSAR
  */

  async function handleReject(negotiation: Negotiation) {
    if (!myTeam) {
      return;
    }

    if (!marketOpen) {
      setError("Mercado de transferências fechado.");
      return;
    }

    if (!canRespond(negotiation)) {
      setError("Você não pode responder a essa proposta.");
      return;
    }

    const confirmed = window.confirm(
      "Tem certeza que deseja recusar essa proposta?"
    );

    if (!confirmed) {
      return;
    }

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
      .eq("id", negotiation.id)
      .eq("status", "pending");

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

  return (
    <main className="min-h-screen bg-[#08090b] px-6 py-10 text-white md:px-10">
      <div className="mx-auto max-w-7xl">

        {/* TOPO */}

        <div className="mb-10 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="mb-2 text-sm font-bold uppercase tracking-[0.2em] text-green-400">
              FriendZone League FM
            </p>

            <h1 className="text-4xl font-black md:text-5xl">
              Negociações
            </h1>

            <p className="mt-3 text-zinc-400">
              Gerencie propostas e contrapropostas do{" "}
              <strong className="text-white">
                {myTeam?.name || "seu clube"}
              </strong>
              .
            </p>

            {marketOpen ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-green-400" />

                <span className="text-sm font-black text-green-400">
                  MERCADO ABERTO
                </span>

                <span className="text-sm font-bold text-zinc-300">
                  • Janela {currentWindow}
                </span>
              </div>
            ) : (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2">
                <span className="h-2 w-2 rounded-full bg-red-400" />

                <span className="text-sm font-black text-red-400">
                  MERCADO FECHADO
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/transfers/installments"
              className="rounded-xl border border-zinc-700 bg-zinc-900 px-5 py-3 font-black transition hover:bg-zinc-800"
            >
              Parcelas
            </Link>

            {marketOpen ? (
              <Link
                href="/transfers/negotiations/new"
                className="rounded-xl bg-green-500 px-5 py-3 font-black text-black transition hover:bg-green-400"
              >
                + Nova proposta
              </Link>
            ) : (
              <button
                type="button"
                disabled
                className="cursor-not-allowed rounded-xl bg-zinc-800 px-5 py-3 font-black text-zinc-500"
              >
                🔒 Nova proposta
              </button>
            )}
          </div>
        </div>

        {!marketOpen && (
          <div className="mb-8 rounded-2xl border border-red-500/30 bg-red-500/5 p-6">
            <p className="font-black text-red-400">
              🔒 Janela de transferências fechada
            </p>

            <p className="mt-2 text-zinc-400">
              O histórico continua disponível, mas novas ações ficam
              bloqueadas até a abertura da próxima janela.
            </p>
          </div>
        )}

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

          {/* RECEBIDAS */}

          <section>
            <div className="mb-5">
              <p className="text-sm font-bold uppercase tracking-widest text-green-400">
                Caixa de entrada
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Aguardando sua resposta
              </h2>
            </div>

            {receivedThreads.length === 0 ? (
              <EmptyBox text="Nenhuma negociação aguardando sua resposta." />
            ) : (
              <div className="grid gap-5">
                {receivedThreads.map((thread) => (
                  <NegotiationThreadCard
                    key={thread.rootId}
                    thread={thread}
                    myTeam={myTeam}
                    money={money}
                    dateTime={dateTime}
                    statusClass={statusClass}
                    getStatusLabel={getStatusLabel}
                    canRespond={canRespond}
                    marketOpen={marketOpen}
                    processingId={processingId}
                    expanded={Boolean(expandedThreads[thread.rootId])}
                    onToggle={() => toggleThread(thread.rootId)}
                    onAccept={handleAccept}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </section>

          {/* ENVIADAS */}

          <section>
            <div className="mb-5">
              <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
                Saída
              </p>

              <h2 className="mt-1 text-2xl font-black">
                Aguardando o outro clube
              </h2>
            </div>

            {sentThreads.length === 0 ? (
              <EmptyBox text="Nenhuma negociação aguardando o outro clube." />
            ) : (
              <div className="grid gap-5">
                {sentThreads.map((thread) => (
                  <NegotiationThreadCard
                    key={thread.rootId}
                    thread={thread}
                    myTeam={myTeam}
                    money={money}
                    dateTime={dateTime}
                    statusClass={statusClass}
                    getStatusLabel={getStatusLabel}
                    canRespond={canRespond}
                    marketOpen={marketOpen}
                    processingId={processingId}
                    expanded={Boolean(expandedThreads[thread.rootId])}
                    onToggle={() => toggleThread(thread.rootId)}
                    onAccept={handleAccept}
                    onReject={handleReject}
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

function EmptyBox({
  text,
}: {
  text: string;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-8 text-zinc-400">
      {text}
    </div>
  );
}

type ThreadCardProps = {
  thread: NegotiationThread;

  myTeam: Team | null;

  money: (
    value: number | null | undefined
  ) => string;

  dateTime: (
    value: string | null | undefined
  ) => string;

  statusClass: (
    status: string
  ) => string;

  getStatusLabel: (
    status: string
  ) => string;

  canRespond: (
    negotiation: Negotiation
  ) => boolean;

  marketOpen: boolean;

  processingId: number | null;

  expanded: boolean;

  onToggle: () => void;

  onAccept: (
    negotiation: Negotiation
  ) => void;

  onReject: (
    negotiation: Negotiation
  ) => void;
};

function NegotiationThreadCard({
  thread,
  myTeam,
  money,
  dateTime,
  statusClass,
  getStatusLabel,
  canRespond,
  marketOpen,
  processingId,
  expanded,
  onToggle,
  onAccept,
  onReject,
}: ThreadCardProps) {
  const latest = thread.latest;

  const otherTeam =
    myTeam?.id === latest.buyer_team_id
      ? latest.seller_team
      : latest.buyer_team;

  const isTwoPayments =
    Number(latest.installments) === 2;

  const responseAllowed =
    canRespond(latest);

  return (
    <div className="overflow-hidden rounded-2xl border border-zinc-800 bg-zinc-900">

      {/* PROPOSTA ATUAL */}

      <div className="p-6">
        <div className="flex flex-col gap-6 lg:flex-row lg:justify-between">

          <div className="flex-1">

            <div className="flex flex-wrap items-center gap-3">
              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${statusClass(
                  latest.status
                )}`}
              >
                {getStatusLabel(latest.status)}
              </span>

              {thread.negotiations.length > 1 && (
                <span className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-black text-blue-400">
                  {thread.negotiations.length} versões
                </span>
              )}

              <span className="text-xs text-zinc-500">
                Negociação #{thread.rootId}
              </span>
            </div>

            <p className="mt-5 text-sm text-zinc-500">
              Jogador negociado
            </p>

            <h3 className="mt-1 text-3xl font-black">
              {latest.player?.name ||
                `Jogador #${latest.player_id}`}
            </h3>

            {latest.player && (
              <p className="mt-1 text-sm text-zinc-400">
                {latest.player.position || "Posição -"}

                {latest.player.ca !== null
                  ? ` • CA ${latest.player.ca}`
                  : ""}
              </p>
            )}

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs uppercase text-zinc-500">
                  Outro clube
                </p>

                <p className="mt-1 font-black">
                  {otherTeam?.name || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs uppercase text-zinc-500">
                  Última proposta enviada por
                </p>

                <p className="mt-1 font-black">
                  {latest.creator_team?.name || "-"}
                </p>
              </div>
            </div>

            {latest.offered_players.length > 0 && (
              <div className="mt-5">
                <p className="text-sm text-zinc-500">
                  Jogadores incluídos
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {latest.offered_players.map((offered) => (
                    <div
                      key={offered.id}
                      className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2"
                    >
                      <span className="font-bold">
                        {offered.player?.name ||
                          `Jogador #${offered.player_id}`}
                      </span>

                      {offered.player?.ca !== null &&
                        offered.player?.ca !== undefined && (
                          <span className="ml-2 text-xs text-zinc-500">
                            CA {offered.player.ca}
                          </span>
                        )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* VALORES */}

          <div className="min-w-[290px] rounded-xl bg-zinc-950 p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
              Proposta atual
            </p>

            <p className="mt-3 text-3xl font-black text-green-400">
              {money(latest.amount)}
            </p>

            {isTwoPayments ? (
              <div className="mt-4 space-y-2 text-sm">
                <div className="flex justify-between gap-5">
                  <span className="text-zinc-500">
                    1ª parcela
                  </span>

                  <strong>
                    {money(latest.installment_1)}
                  </strong>
                </div>

                <div className="flex justify-between gap-5">
                  <span className="text-zinc-500">
                    2ª parcela
                  </span>

                  <strong>
                    {money(latest.installment_2)}
                  </strong>
                </div>

                <p className="pt-2 text-xs font-black uppercase text-yellow-400">
                  2ª parcela na próxima janela
                </p>
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-400">
                Pagamento à vista
              </p>
            )}

            <p className="mt-5 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
              Atualizada em {dateTime(latest.created_at)}
            </p>
          </div>
        </div>

        {/* AÇÕES */}

        {responseAllowed && (
          <div className="mt-6 grid gap-3 border-t border-zinc-800 pt-6 md:grid-cols-3">
            <button
              type="button"
              disabled={
                processingId === latest.id ||
                !marketOpen
              }
              onClick={() =>
                onAccept(latest)
              }
              className="rounded-xl bg-green-500 px-4 py-3 font-black text-black transition hover:bg-green-400 disabled:cursor-not-allowed disabled:bg-zinc-700 disabled:text-zinc-400"
            >
              {processingId === latest.id
                ? "PROCESSANDO..."
                : "✓ ACEITAR"}
            </button>

            <button
              type="button"
              disabled={
                processingId === latest.id ||
                !marketOpen
              }
              onClick={() =>
                onReject(latest)
              }
              className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 font-black text-red-400 transition hover:bg-red-500/20 disabled:opacity-50"
            >
              ✕ RECUSAR
            </button>

            <Link
              href={`/transfers/negotiations/new?counterOf=${latest.id}`}
              className="rounded-xl border border-blue-500/40 bg-blue-500/10 px-4 py-3 text-center font-black text-blue-400 transition hover:bg-blue-500/20"
            >
              ↔ FAZER CONTRAPROPOSTA
            </Link>
          </div>
        )}

        {/* BOTÃO HISTÓRICO */}

        <button
          type="button"
          onClick={onToggle}
          className="mt-6 w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 font-black text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800"
        >
          {expanded
            ? "▲ Fechar histórico"
            : `▼ Ver histórico da negociação (${thread.negotiations.length})`}
        </button>
      </div>

      {/* LINHA DO TEMPO */}

      {expanded && (
        <div className="border-t border-zinc-800 bg-[#0c0d10] p-6">
          <div className="mb-6">
            <p className="text-sm font-bold uppercase tracking-widest text-blue-400">
              Linha do tempo
            </p>

            <h4 className="mt-1 text-2xl font-black">
              Histórico da negociação
            </h4>
          </div>

          <div className="relative space-y-6 border-l border-zinc-700 pl-6">
            {thread.negotiations.map((negotiation, index) => {
              const installmentDeal =
                Number(negotiation.installments) === 2;

              const isLatest =
                negotiation.id === latest.id;

              return (
                <div
                  key={negotiation.id}
                  className="relative"
                >
                  <div
                    className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ${
                      isLatest
                        ? "bg-green-400"
                        : "bg-zinc-600"
                    }`}
                  />

                  <div
                    className={`rounded-xl border p-5 ${
                      isLatest
                        ? "border-green-500/30 bg-green-500/5"
                        : "border-zinc-800 bg-zinc-900"
                    }`}
                  >
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-zinc-500">
                          {index === 0
                            ? "Proposta inicial"
                            : `Contraproposta ${index}`}
                        </p>

                        <h5 className="mt-1 text-lg font-black">
                          {negotiation.creator_team?.name ||
                            "Clube"}
                        </h5>

                        <p className="mt-1 text-xs text-zinc-500">
                          {dateTime(negotiation.created_at)}
                        </p>
                      </div>

                      <span
                        className={`w-fit rounded-full px-3 py-1 text-xs font-black ${statusClass(
                          negotiation.status
                        )}`}
                      >
                        {getStatusLabel(
                          negotiation.status
                        )}
                      </span>
                    </div>

                    <div className="mt-5 grid gap-4 md:grid-cols-2">
                      <div>
                        <p className="text-xs uppercase text-zinc-500">
                          Dinheiro
                        </p>

                        <p className="mt-1 text-xl font-black text-green-400">
                          {money(negotiation.amount)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs uppercase text-zinc-500">
                          Forma de pagamento
                        </p>

                        <p className="mt-1 font-bold">
                          {installmentDeal
                            ? "2 parcelas"
                            : "À vista"}
                        </p>
                      </div>
                    </div>

                    {installmentDeal && (
                      <div className="mt-4 grid gap-3 md:grid-cols-2">
                        <div className="rounded-lg bg-zinc-950 p-3">
                          <p className="text-xs text-zinc-500">
                            1ª parcela
                          </p>

                          <p className="mt-1 font-black">
                            {money(
                              negotiation.installment_1
                            )}
                          </p>
                        </div>

                        <div className="rounded-lg bg-zinc-950 p-3">
                          <p className="text-xs text-zinc-500">
                            2ª parcela
                          </p>

                          <p className="mt-1 font-black">
                            {money(
                              negotiation.installment_2
                            )}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="mt-4">
                      <p className="text-xs uppercase text-zinc-500">
                        Jogadores incluídos
                      </p>

                      {negotiation.offered_players.length === 0 ? (
                        <p className="mt-2 text-sm text-zinc-500">
                          Nenhum jogador.
                        </p>
                      ) : (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {negotiation.offered_players.map(
                            (offered) => (
                              <span
                                key={offered.id}
                                className="rounded-lg bg-zinc-950 px-3 py-2 text-sm font-bold"
                              >
                                {offered.player?.name ||
                                  `Jogador #${offered.player_id}`}

                                {offered.player?.ca !== null &&
                                offered.player?.ca !==
                                  undefined
                                  ? ` • CA ${offered.player.ca}`
                                  : ""}
                              </span>
                            )
                          )}
                        </div>
                      )}
                    </div>

                    {isLatest && (
                      <p className="mt-5 text-xs font-black uppercase text-green-400">
                        ● Proposta atual
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}