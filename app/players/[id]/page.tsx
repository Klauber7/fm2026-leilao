"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";

type Player = {
  id: number;
  unique_id: string;
  name: string;
  age: number | null;
  position: string | null;
  nationality: string | null;
  club: string | null;
  ca: number | null;
  cp: number | null;
  value: number | null;
  salary: string | null;
  category: string[] | null;
  available: boolean | null;
  drafted: boolean | null;
  image_url: string | null;

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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(115px,1fr) 80px 24px",
        alignItems: "center",
        columnGap: "7px",
        minHeight: "27px",
      }}
    >
      <div
        style={{
          color: "#e4e4e7",
          fontSize: "12px",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>

      <div
        style={{
          width: "80px",
          height: "11px",
          borderRadius: "5px",
          border: "1px solid #71717a",
          background: "#111827",
          overflow: "hidden",
        }}
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

      <div
        style={{
          fontSize: "13px",
          fontWeight: 800,
          textAlign: "right",
          color: numberColor(value),
        }}
      >
        {value}
      </div>
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
        style={{
          background: "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          padding: "9px 11px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "19px" }}>{icon}</span>
        <span
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 900,
            fontStyle: "italic",
            whiteSpace: "nowrap",
          }}
        >
          {title}
        </span>
      </div>

      <div style={{ padding: "9px 10px 11px" }}>
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
        style={{
          background: "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          padding: "9px 11px",
          display: "flex",
          alignItems: "center",
          gap: "8px",
        }}
      >
        <span style={{ fontSize: "19px" }}>🏃</span>
        <span
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 900,
            fontStyle: "italic",
          }}
        >
          FÍSICOS & BIOTIPO
        </span>
      </div>

      <div style={{ padding: "9px 10px 8px" }}>
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
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "7px",
          padding: "10px",
        }}
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
      style={{
        background: "#111827",
        border: "1px solid #334155",
        borderRadius: "7px",
        padding: "8px 6px",
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

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [player, setPlayer] = useState<Player | null>(null);
  const [loading, setLoading] = useState(true);

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
        nationality,
        club,
        ca,
        cp,
        value,
        salary,
        category,
        available,
        drafted,
        image_url,

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
    } else {
      setPlayer(data as Player);
    }

    setLoading(false);
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
      <div
        style={{
          width: "100%",
          maxWidth: "1180px",
          margin: "0 auto",
          padding: "12px",
        }}
      >
        <button
          type="button"
          onClick={() => router.push("/players")}
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
            <div>
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

            <div style={{ display: "flex", gap: "5px" }}>
              <div
                style={{
                  minWidth: "60px",
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
                  minWidth: "60px",
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

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "6px",
            marginBottom: "8px",
          }}
        >
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
              SALÁRIO
            </div>
            <div style={{ fontSize: "12px", fontWeight: 800 }}>
              {player.salary || "-"}
            </div>
          </div>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
            gap: "7px",
            alignItems: "stretch",
          }}
        >
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

          <PhysicalCard player={player} />
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: isGoalkeeper
              ? "1fr 1fr"
              : "1fr",
            gap: "7px",
            marginTop: "7px",
          }}
        >
          <AttributeCard
            icon="⚙️"
            title="OUTROS ATRIBUTOS"
            attributes={otherAttributes}
            player={player}
          />

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
