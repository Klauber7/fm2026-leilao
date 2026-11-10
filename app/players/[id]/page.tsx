"use client";

import PlayerPhoto from "@/app/components/PlayerPhoto";
import Link from "next/link";
import { Suspense, useEffect, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import PositionMap from "../PositionMap";

type SeasonPerformance = {
  appearances: number;
  goals: number;
  assists: number;
  player_of_match: number | null;
  average_rating: number | null;
};

type AvailabilitySnapshot = {
  injury_return_date: string | null;
  suspended: boolean;
};

type Player = {
  id: number;
  unique_id: string;
  name: string;
  age: number | null;
  position: string | null;
  position_ratings: number[] | null;
  nationality: string | null;
  club: string | null;
  ca: number | null;
  cp: number | null;
  value: number | null;
  player_season_performance: SeasonPerformance | null;
  player_availability_snapshot: AvailabilitySnapshot | null;
  category: string[] | null;
  available: boolean | null;
  drafted: boolean | null;
  image_url: string | null;
  team_id: number | null;

  ambition: number | null;
  pressure: number | null;
  adaptability: number | null;
  versatility: number | null;
  temperament: number | null;
  loyalty: number | null;
  dirtiness: number | null;
  important_matches: number | null;
  consistency: number | null;
  professionalism: number | null;
  injury_proneness: number | null;

  rushing_out: number | null;
  punching: number | null;
  aerial_reach: number | null;
  command_of_area: number | null;
  communication: number | null;
  eccentricity: number | null;
  handling: number | null;
  throwing: number | null;
  kicking: number | null;
  reflexes: number | null;
  one_on_ones: number | null;

  heading: number | null;
  corners: number | null;
  crossing: number | null;
  tackling: number | null;
  finishing: number | null;
  dribbling: number | null;
  long_throws: number | null;
  free_kicks: number | null;
  marking: number | null;
  penalties: number | null;
  passing: number | null;
  first_touch: number | null;
  long_shots: number | null;
  technique: number | null;

  aggression: number | null;
  anticipation: number | null;
  bravery: number | null;
  composure: number | null;
  concentration: number | null;
  decisions: number | null;
  determination: number | null;
  flair: number | null;
  work_rate: number | null;
  leadership: number | null;
  positioning: number | null;
  off_the_ball: number | null;
  teamwork: number | null;
  vision: number | null;

  acceleration: number | null;
  agility: number | null;
  natural_fitness: number | null;
  balance: number | null;
  strength: number | null;
  jumping_reach: number | null;
  stamina: number | null;
  pace: number | null;

  height: string | null;
  left_foot: string | null;
  right_foot: string | null;
};

type Team = {
  id: number;
  name: string;
  budget: number | null;
  manager_id: string | null;
};

type Auction = {
  id: number;
  player_id: number | null;
  starting_value: number | null;
  current_bid: number | null;
  winner_team_id: number | null;
  status: string | null;
  ends_at: string | null;
};

type TransferWindow = {
  id: number;
  season_number: number | null;
  window_number: number;
  name: string | null;
  status: string;
};

type NumericPlayerKey = {
  [K in keyof Player]: Player[K] extends number | null ? K : never;
}[keyof Player];

type AttributeDefinition = {
  key: NumericPlayerKey;
  label: string;
};

const technicalAttributes: AttributeDefinition[] = [
  { key: "heading", label: "Cabeceamento" },
  { key: "corners", label: "Cantos" },
  { key: "crossing", label: "Cruzamentos" },
  { key: "tackling", label: "Desarme" },
  { key: "finishing", label: "Finalização" },
  { key: "dribbling", label: "Finta" },
  { key: "long_throws", label: "Lançamentos Longos" },
  { key: "free_kicks", label: "Livres" },
  { key: "marking", label: "Marcação" },
  { key: "penalties", label: "Pênaltis" },
  { key: "passing", label: "Passe" },
  { key: "first_touch", label: "Primeiro Toque" },
  { key: "long_shots", label: "Chute de Longe" },
  { key: "technique", label: "Técnica" },
];

const mentalAttributes: AttributeDefinition[] = [
  { key: "aggression", label: "Agressividade" },
  { key: "anticipation", label: "Antecipação" },
  { key: "bravery", label: "Bravura" },
  { key: "composure", label: "Compostura" },
  { key: "concentration", label: "Concentração" },
  { key: "decisions", label: "Decisões" },
  { key: "determination", label: "Determinação" },
  { key: "flair", label: "Imprevisibilidade" },
  { key: "work_rate", label: "Índice de Trabalho" },
  { key: "leadership", label: "Liderança" },
  { key: "positioning", label: "Posicionamento" },
  { key: "off_the_ball", label: "Sem Bola" },
  { key: "teamwork", label: "Trabalho em Equipe" },
  { key: "vision", label: "Visão de Jogo" },
];

const physicalAttributes: AttributeDefinition[] = [
  { key: "acceleration", label: "Aceleração" },
  { key: "agility", label: "Agilidade" },
  { key: "natural_fitness", label: "Aptidão Física" },
  { key: "balance", label: "Equilíbrio" },
  { key: "strength", label: "Força" },
  { key: "jumping_reach", label: "Impulsão" },
  { key: "stamina", label: "Resistência" },
  { key: "pace", label: "Velocidade" },
];

const goalkeeperAttributes: AttributeDefinition[] = [
  { key: "rushing_out", label: "Saídas da Baliza" },
  { key: "punching", label: "Saídas a Punhos" },
  { key: "aerial_reach", label: "Alcance Aéreo" },
  { key: "command_of_area", label: "Comando de Área" },
  { key: "communication", label: "Comunicação" },
  { key: "eccentricity", label: "Excentricidade" },
  { key: "handling", label: "Jogo de Mãos" },
  { key: "throwing", label: "Lançamentos" },
  { key: "kicking", label: "Pontapé" },
  { key: "reflexes", label: "Reflexos" },
  { key: "one_on_ones", label: "Um Para Um" },
];

const otherAttributes: AttributeDefinition[] = [
  { key: "ambition", label: "Ambição" },
  { key: "pressure", label: "Pressão" },
  { key: "adaptability", label: "Adaptabilidade" },
  { key: "versatility", label: "Versatilidade" },
  { key: "temperament", label: "Temperamento" },
  { key: "loyalty", label: "Lealdade" },
  { key: "dirtiness", label: "Jogo Sujo" },
  { key: "important_matches", label: "Jogos Importantes" },
  { key: "consistency", label: "Consistência" },
  { key: "professionalism", label: "Profissionalismo" },
  { key: "injury_proneness", label: "Propensão a Lesões" },
];

const seasonRatingFormat = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function SeasonPerformanceCard({ performance }: { performance: SeasonPerformance | null }) {
  const rating = performance?.average_rating;
  const rows = [
    { label: "Jogos", value: performance?.appearances },
    { label: "Gols", value: performance?.goals },
    { label: "Assistências", value: performance?.assists },
    { label: "Melhor em campo", value: performance?.player_of_match },
    { label: "Nota média", value: rating == null ? null : seasonRatingFormat.format(rating) },
  ];

  return (
    <section aria-label="Estatísticas da temporada atual" className="rounded-lg border border-sky-800 bg-sky-950/30 px-2 py-1.5">
      <h2 className="mb-1 text-[9px] font-extrabold uppercase text-sky-200">Temporada atual</h2>
      <dl className="divide-y divide-sky-900/60">
        {rows.map(({ label, value }) => (
          <div key={label} className="flex items-center justify-between gap-1 py-0.5 text-[10px] leading-tight lg:text-xs">
            <dt className="text-zinc-200">{label}</dt>
            <dd className="shrink-0 font-bold tabular-nums text-sky-100">{value ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function AvailabilityIndicator({ label, active }: { label: string; active: boolean }) {
  return (
    <div className={`rounded-md border px-2 py-1 text-[10px] font-bold leading-tight lg:text-xs ${
      active
        ? "border-red-700 bg-red-950 text-red-200"
        : "border-zinc-700 bg-zinc-900 text-zinc-400"
    }`}>
      {label}<span className="sr-only">{active ? " ativa no save" : " sem registro ativo no save"}</span>
    </div>
  );
}

function formatValue(value: number | null) {
  if (value === null || value === undefined) return "-";

  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString("pt-BR", {
      maximumFractionDigits: 1,
    })}M`;
  }

  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}

function barColor(value: number) {
  if (value >= 16) return "#16a34a";
  if (value >= 13) return "#65a30d";
  if (value >= 10) return "#93c5fd";
  if (value >= 7) return "#facc15";
  return "#ef4444";
}

function numberColor(value: number) {
  if (value >= 16) return "#4ade80";
  if (value >= 13) return "#a3e635";
  if (value >= 10) return "#bfdbfe";
  if (value >= 7) return "#fde047";
  return "#f87171";
}

function AttributeRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null || value === undefined) return null;

  const percentage = Math.max(5, Math.min(100, (value / 20) * 100));

  return (
    <div className="grid min-h-4 grid-cols-[minmax(0,1fr)_1.5rem] items-center gap-x-1 lg:min-h-[27px] lg:grid-cols-[minmax(0,1fr)_minmax(0,28%)_1.5rem] lg:gap-x-[7px]">
      <span className="text-[11px] leading-tight text-zinc-200 lg:text-xs">
        {label}
      </span>

      <div
        aria-hidden="true"
        className="hidden h-[11px] overflow-hidden rounded-[5px] border border-zinc-500 bg-gray-900 lg:block"
      >
        <div
          style={{
            width: `${percentage}%`,
            height: "100%",
            background: barColor(value),
            borderRadius: "4px",
          }}
        />
      </div>

      <span
        className="text-right text-xs leading-none font-extrabold tabular-nums lg:text-[13px]"
        style={{ color: numberColor(value) }}
      >
        {value}
      </span>
    </div>
  );
}

function AttributeCard({
  icon,
  title,
  attributes,
  player,
}: {
  icon: string;
  title: string;
  attributes: AttributeDefinition[];
  player: Player;
}) {
  return (
    <section
      style={{
        background: "linear-gradient(180deg,#04131c 0%,#031016 100%)",
        border: "1px solid #0284c7",
        borderRadius: "10px",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        className="px-1.5 py-1 lg:px-[11px] lg:py-[9px]"
        style={{
          background: "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span aria-hidden="true" className="text-xs lg:text-[19px]">{icon}</span>
        <span
          className="text-[11px] leading-tight font-black text-white italic lg:text-sm"
        >
          {title}
        </span>
      </div>

      <div className="px-1.5 py-1 lg:px-2.5 lg:py-2.5">
        {attributes.map((attribute) => (
          <AttributeRow
            key={attribute.key}
            label={attribute.label}
            value={player[attribute.key] as number | null}
          />
        ))}
      </div>
    </section>
  );
}

function PhysicalCard({ player }: { player: Player }) {
  return (
    <section
      style={{
        background: "linear-gradient(180deg,#04131c 0%,#031016 100%)",
        border: "1px solid #0284c7",
        borderRadius: "10px",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        className="px-1.5 py-1 lg:px-[11px] lg:py-[9px]"
        style={{
          background: "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          display: "flex",
          alignItems: "center",
          gap: "5px",
        }}
      >
        <span aria-hidden="true" className="text-xs lg:text-[19px]">🏃</span>
        <span
          className="text-[11px] leading-tight font-black text-white italic lg:text-sm"
        >
          FÍSICOS & BIOTIPO
        </span>
      </div>

      <div className="px-1.5 py-1 lg:px-2.5 lg:py-2">
        {physicalAttributes.map((attribute) => (
          <AttributeRow
            key={attribute.key}
            label={attribute.label}
            value={player[attribute.key] as number | null}
          />
        ))}
      </div>

      <div
        style={{
          margin: "2px 10px 0",
          borderTop: "1px dashed #52525b",
        }}
      />

      <div
        className="grid grid-cols-2 gap-1 p-1.5 lg:gap-[7px] lg:p-2.5"
      >
        <InfoBox label="📏 ALTURA" value={player.height || "-"} />
        <InfoBox label="⭐ CP" value={player.cp ?? "-"} accent="#7dd3fc" />
        <InfoBox label="🦶 PÉ ESQ." value={player.left_foot || "-"} />
        <InfoBox label="🦶 PÉ DIR." value={player.right_foot || "-"} />
      </div>
    </section>
  );
}

function InfoBox({
  label,
  value,
  accent = "white",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  return (
    <div
      className="min-w-0 px-0.5 py-0.5 wrap-anywhere lg:px-1.5 lg:py-2"
      style={{
        background: "#111827",
        border: "1px solid #334155",
        borderRadius: "7px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          fontSize: "9px",
          color: "#94a3b8",
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: "3px",
          fontSize: "13px",
          fontWeight: 900,
          color: accent,
          textTransform: "uppercase",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InternalMarketOffer({ player, buyerTeamId }: { player: Player; buyerTeamId: number | undefined }) {
  const listingId = useSearchParams().get("listing");

  if (!listingId) return null;

  return <InternalMarketListing key={listingId} listingId={listingId} player={player} buyerTeamId={buyerTeamId} />;
}

function InternalMarketListing({ listingId, player, buyerTeamId }: {
  listingId: string;
  player: Player;
  buyerTeamId: number | undefined;
}) {
  const [listing, setListing] = useState<{ team_id: number; asking_price: number } | null>();
  const playerId = player.id;

  useEffect(() => {
    let active = true;
    void supabase.from("internal_player_listings")
      .select("team_id, asking_price")
      .eq("id", listingId)
      .eq("player_id", playerId)
      .maybeSingle()
      .then(({ data }) => {
        if (active) setListing(data);
      });
    return () => { active = false; };
  }, [listingId, playerId]);

  return (
    <section aria-label="Mercado Interno" className="mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-emerald-500/30 bg-zinc-900 p-2 text-xs sm:p-3">
      <Link href="/mercado-interno" className="font-bold text-emerald-300 hover:underline">← Mercado Interno</Link>
      {listing === null && <p role="status" className="text-zinc-300">Anúncio indisponível.</p>}
      {listing && (
        <>
          <p className="text-zinc-200">Valor atual <strong>{formatValue(player.value)}</strong></p>
          <p className="text-zinc-200">Preço pedido pelo clube <strong>{formatValue(listing.asking_price)}</strong></p>
          {buyerTeamId && buyerTeamId !== listing.team_id && (
            <Link href={`/transfers/negotiations/new?listing=${listingId}`} className="rounded-lg bg-emerald-400 px-3 py-2 font-black text-zinc-950 hover:bg-emerald-300">
              Fazer oferta
            </Link>
          )}
        </>
      )}
    </section>
  );
}

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);
  const [team, setTeam] = useState<Team | null>(null);
  const [currentWindow, setCurrentWindow] =
    useState<TransferWindow | null>(null);
  const [activeAuction, setActiveAuction] =
    useState<Auction | null>(null);
  const [startingAuction, setStartingAuction] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (id) loadPlayer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  async function loadPlayer() {
    setLoading(true);

    const { data, error } = await supabase
      .from("players")
      .select(`
        id,
        unique_id,
        name,
        age,
        position,
        position_ratings,
        nationality,
        club,
        ca,
        cp,
        value,
        player_season_performance(appearances, goals, assists, player_of_match, average_rating),
        player_availability_snapshot(injury_return_date, suspended),
        category,
        available,
        drafted,
        image_url,
        team_id,

        ambition,
        pressure,
        adaptability,
        versatility,
        temperament,
        loyalty,
        dirtiness,
        important_matches,
        consistency,
        professionalism,
        injury_proneness,

        rushing_out,
        punching,
        aerial_reach,
        command_of_area,
        communication,
        eccentricity,
        handling,
        throwing,
        kicking,
        reflexes,
        one_on_ones,

        heading,
        corners,
        crossing,
        tackling,
        finishing,
        dribbling,
        long_throws,
        free_kicks,
        marking,
        penalties,
        passing,
        first_touch,
        long_shots,
        technique,

        aggression,
        anticipation,
        bravery,
        composure,
        concentration,
        decisions,
        determination,
        flair,
        work_rate,
        leadership,
        positioning,
        off_the_ball,
        teamwork,
        vision,

        acceleration,
        agility,
        natural_fitness,
        balance,
        strength,
        jumping_reach,
        stamina,
        pace,

        height,
        left_foot,
        right_foot
      `)
      .eq("id", id)
      .single();

    if (error) {
      console.error("Erro ao carregar jogador:", error);
      setPlayer(null);
      setErrorMessage(error.message);
      setLoading(false);
      return;
    }

    const performance: SeasonPerformance | SeasonPerformance[] | null = data.player_season_performance;
    const availability: AvailabilitySnapshot | AvailabilitySnapshot[] | null = data.player_availability_snapshot;
    const loadedPlayer: Player = {
      ...data,
      player_availability_snapshot: Array.isArray(availability) ? availability[0] ?? null : availability,
      player_season_performance: Array.isArray(performance) ? performance[0] ?? null : performance,
    };
    setPlayer(loadedPlayer);

    const [authResult, windowResult, auctionResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase
        .from("transfer_windows")
        .select("id, season_number, window_number, name, status")
        .eq("status", "open")
        .order("season_number", { ascending: false })
        .order("window_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from("auctions")
        .select(
          "id, player_id, starting_value, current_bid, winner_team_id, status, ends_at"
        )
        .eq("player_id", loadedPlayer.id)
        .eq("status", "active")
        .order("id", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    if (windowResult.error) {
      console.error("Erro ao carregar janela:", windowResult.error);
      setCurrentWindow(null);
    } else {
      setCurrentWindow(
        windowResult.data
          ? (windowResult.data as TransferWindow)
          : null
      );
    }

    if (auctionResult.error) {
      console.error("Erro ao carregar leilão:", auctionResult.error);
      setActiveAuction(null);
    } else {
      setActiveAuction(
        auctionResult.data ? (auctionResult.data as Auction) : null
      );
    }

    const user = authResult.data.user;

    if (user) {
      const { data: teamData, error: teamError } = await supabase
        .from("teams")
        .select("id, name, budget, manager_id")
        .eq("manager_id", user.id)
        .limit(1)
        .maybeSingle();

      if (teamError) {
        console.error("Erro ao carregar clube:", teamError);
        setTeam(null);
      } else {
        setTeam(teamData ? (teamData as Team) : null);
      }
    } else {
      setTeam(null);
    }

    setErrorMessage("");
    setLoading(false);
  }

  async function handleAuction() {
    if (!player) return;

    if (!team) {
      alert("Você precisa estar vinculado a um clube para dar lance.");
      return;
    }

    if (!currentWindow) {
      alert("O mercado está fechado.");
      return;
    }

    if (player.team_id !== null) {
      alert("Este jogador já pertence a um clube.");
      return;
    }

    if (activeAuction) {
      router.push(`/auctions/${activeAuction.id}`);
      return;
    }

    setStartingAuction(true);
    setErrorMessage("");

    try {
      const { data: rpcData, error: rpcError } = await supabase.rpc(
        "start_player_auction",
        {
          player_id_input: player.id,
        }
      );

      if (rpcError) {
        const { data: existingAuction } = await supabase
          .from("auctions")
          .select("id")
          .eq("player_id", player.id)
          .eq("status", "active")
          .order("id", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (existingAuction?.id) {
          router.push(`/auctions/${existingAuction.id}`);
          return;
        }

        throw rpcError;
      }

      let auctionId: number | null = null;

      if (typeof rpcData === "number" || typeof rpcData === "string") {
        const parsed = Number(rpcData);
        if (Number.isFinite(parsed) && parsed > 0) auctionId = parsed;
      } else if (rpcData && typeof rpcData === "object") {
        const maybeId =
          "auction_id" in rpcData
            ? Number((rpcData as { auction_id?: unknown }).auction_id)
            : "id" in rpcData
              ? Number((rpcData as { id?: unknown }).id)
              : NaN;

        if (Number.isFinite(maybeId) && maybeId > 0) {
          auctionId = maybeId;
        }
      }

      if (!auctionId) {
        const { data: createdAuction, error: createdAuctionError } =
          await supabase
            .from("auctions")
            .select("id")
            .eq("player_id", player.id)
            .eq("status", "active")
            .order("id", { ascending: false })
            .limit(1)
            .maybeSingle();

        if (createdAuctionError) throw createdAuctionError;

        auctionId = createdAuction?.id ? Number(createdAuction.id) : null;
      }

      if (!auctionId) {
        throw new Error(
          "O leilão foi iniciado, mas não foi possível localizar o leilão ativo."
        );
      }

      router.push(`/auctions/${auctionId}`);
    } catch (auctionError) {
      const message =
        auctionError instanceof Error
          ? auctionError.message
          : "Não foi possível iniciar o leilão.";

      console.error("Erro ao iniciar leilão:", auctionError);
      setErrorMessage(message);
      alert(message);
    } finally {
      setStartingAuction(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-zinc-950 p-5 text-white">
        Carregando jogador...
      </main>
    );
  }

  if (!player) {
    return (
      <main className="min-h-screen bg-zinc-950 p-5 text-white">
        Jogador não encontrado.
      </main>
    );
  }

  const isGoalkeeper =
    player.category?.includes("Goleiro") ||
    player.position?.toUpperCase().includes("GR");

  return (
    <main className="min-h-screen bg-zinc-950 text-white">
      <div className={`mx-auto w-full px-2 py-2 sm:p-3 ${isGoalkeeper ? "max-w-[1450px]" : "max-w-[1180px]"}`}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: "#27272a",
            color: "#e4e4e7",
            border: "1px solid #3f3f46",
            borderRadius: "6px",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 700,
            marginBottom: "8px",
            cursor: "pointer",
          }}
        >
          ← Jogadores
        </button>

        <Suspense fallback={null}>
          <InternalMarketOffer player={player} buyerTeamId={team?.id} />
        </Suspense>

        {errorMessage && (
          <div
            style={{
              background: "#450a0a",
              border: "1px solid #dc2626",
              borderRadius: "7px",
              padding: "8px 10px",
              color: "#fecaca",
              fontSize: "11px",
              fontWeight: 700,
              marginBottom: "8px",
            }}
          >
            {errorMessage}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            background: currentWindow ? "#052e16" : "#450a0a",
            border: `1px solid ${currentWindow ? "#16a34a" : "#dc2626"}`,
            borderRadius: "7px",
            padding: "7px 9px",
            marginBottom: "8px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "10px",
                fontWeight: 900,
                color: currentWindow ? "#86efac" : "#fecaca",
              }}
            >
              {currentWindow ? "🟢 LEILÃO ABERTO" : "🔒 LEILÃO FECHADO"}
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "#d4d4d8",
                marginTop: "2px",
              }}
            >
              {activeAuction
                ? `Leilão #${activeAuction.id} em andamento`
                : currentWindow
                  ? "Clique para iniciar ou entrar no leilão deste jogador."
                  : "Aguarde a abertura do mercado."}
            </div>
          </div>

          <button
            type="button"
            onClick={handleAuction}
            disabled={
              startingAuction ||
              !currentWindow ||
              !team ||
              player.team_id !== null
            }
            className="max-w-[50%] shrink-0 lg:min-w-[190px]"
            style={{
              background:
                startingAuction ||
                !currentWindow ||
                !team ||
                player.team_id !== null
                  ? "#3f3f46"
                  : "#16a34a",
              color: "white",
              border: "none",
              borderRadius: "6px",
              padding: "8px 12px",
              fontSize: "10px",
              fontWeight: 900,
              cursor:
                startingAuction ||
                !currentWindow ||
                !team ||
                player.team_id !== null
                  ? "not-allowed"
                  : "pointer",
            }}
          >
            {player.team_id !== null
              ? "JÁ CONTRATADO"
              : startingAuction
                ? "ABRINDO..."
                : activeAuction
                  ? "ENTRAR NO LEILÃO"
                  : `DAR LANCE — ${formatValue(player.value)}`}
          </button>
        </div>

        <div
          style={{
            background: "#020617",
            border: "1px solid #075985",
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "10px",
              alignItems: "center",
            }}
          >
            <div className="flex min-w-0 items-center gap-2"><PlayerPhoto name={player.name} uniqueId={player.unique_id} src={player.image_url} className="h-12 w-12 sm:h-16 sm:w-16" /><div className="min-w-0 wrap-anywhere">
              <div style={{ fontSize: "20px", fontWeight: 900 }}>
                {player.name}
              </div>
              <div
                style={{
                  fontSize: "10px",
                  color: "#a1a1aa",
                  marginTop: "3px",
                }}
              >
                {player.age ?? "-"} anos · {player.nationality ?? "-"} ·{" "}
                {player.club ?? "-"} · {player.position ?? "-"} · ID{" "}
                {player.unique_id}
              </div>
            </div>

            </div>
            <div className="flex shrink-0 gap-[5px] [&>div]:min-w-10 lg:[&>div]:min-w-[60px]">
              <div
                style={{
                  textAlign: "center",
                  border: "1px solid #16a34a",
                  borderRadius: "7px",
                  padding: "5px",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    color: "#4ade80",
                    fontWeight: 800,
                  }}
                >
                  CA
                </div>
                <div
                  style={{
                    fontSize: "21px",
                    fontWeight: 900,
                    color: "#4ade80",
                  }}
                >
                  {player.ca ?? "-"}
                </div>
              </div>

              <div
                style={{
                  textAlign: "center",
                  border: "1px solid #38bdf8",
                  borderRadius: "7px",
                  padding: "5px",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    color: "#7dd3fc",
                    fontWeight: 800,
                  }}
                >
                  CP
                </div>
                <div style={{ fontSize: "21px", fontWeight: 900 }}>
                  {player.cp ?? "-"}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mb-2 flex items-start gap-1.5">
          {player.position_ratings && (
            <div className="w-[118px] shrink-0 rounded-lg border border-zinc-800 bg-zinc-900 px-1.5 py-1 sm:w-36 lg:w-56">
              <h2 className="mb-1 text-[10px] font-bold text-zinc-200 lg:text-xs">Mapa de posições</h2>
              <PositionMap ratings={player.position_ratings} />
            </div>
          )}

          <div className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] items-start gap-1.5 wrap-anywhere">
            <div className="min-w-0 space-y-1.5">
              <div
                style={{
                  background: "#18181b",
                  borderRadius: "7px",
                  padding: "6px 9px",
                }}
              >
                <div
                  style={{
                    fontSize: "9px",
                    color: "#71717a",
                    fontWeight: 800,
                  }}
                >
                  VALOR
                </div>
                <div style={{ fontSize: "12px", fontWeight: 800 }}>
                  {formatValue(player.value)}
                </div>
              </div>
              {player.team_id !== null && (
                <section aria-label="Disponibilidade no último save" className="grid gap-1">
                  <AvailabilityIndicator label="Lesão" active={Boolean(player.player_availability_snapshot?.injury_return_date)} />
                  <AvailabilityIndicator label="Suspensão" active={Boolean(player.player_availability_snapshot?.suspended)} />
                </section>
              )}
            </div>

            <SeasonPerformanceCard performance={player.player_season_performance} />
          </div>
        </div>

        <div className={`grid grid-cols-2 gap-1.5 ${isGoalkeeper ? "min-[360px]:grid-cols-3 lg:grid-cols-5" : "md:grid-cols-3 lg:grid-cols-4"}`}>
          <AttributeCard
            icon="🥾"
            title="ATRIBUTOS TÉCNICOS"
            attributes={technicalAttributes}
            player={player}
          />

          <AttributeCard
            icon="🧠"
            title="ATRIBUTOS MENTAIS"
            attributes={mentalAttributes}
            player={player}
          />

          <AttributeCard
            icon="⚙️"
            title="OUTROS ATRIBUTOS"
            attributes={otherAttributes}
            player={player}
          />

          <PhysicalCard player={player} />

          {isGoalkeeper && (
            <AttributeCard
              icon="🧤"
              title="ATRIBUTOS DE GOLEIRO"
              attributes={goalkeeperAttributes}
              player={player}
            />
          )}
        </div>
      </div>
    </main>
  );
}
