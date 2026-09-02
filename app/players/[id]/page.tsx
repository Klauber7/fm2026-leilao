"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

type Attributes = Record<string, string | number>;

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
  attributes: Attributes | null;
  available: boolean | null;
  drafted: boolean | null;
  image_url: string | null;
};

/* =========================================================
   ATRIBUTOS
========================================================= */

const technicalAttributes = [
  ["Cabeceamento", "Cabeceamento"],
  ["Cantos", "Cantos"],
  ["Cruzamentos", "Cruzamentos"],
  ["Desarme", "Desarme"],
  ["Finalização", "Finalização"],
  ["Finta", "Finta"],
  ["Lançamentos Longos", "Passe Longo"],
  ["Livres", "Livres"],
  ["Marcação", "Marcação"],
  ["Marcação de Penáltis", "Pênaltis"],
  ["Passe", "Passe"],
  ["Primeiro Toque", "Primeiro Toque"],
  ["Remates de Longe", "Chute de Longe"],
  ["Técnica", "Técnica"],
];

const mentalAttributes = [
  ["Agressividade", "Agressividade"],
  ["Antecipação", "Antecipação"],
  ["Bravura", "Bravura"],
  ["Compostura", "Compostura"],
  ["Concentração", "Concentração"],
  ["Decisões", "Decisões"],
  ["Determinação", "Determinação"],
  ["Imprevisibilidade", "Imprevisibilidade"],
  ["Índice de Trabalho", "Índice de Trabalho"],
  ["Liderança", "Liderança"],
  ["Posicionamento", "Posicionamento"],
  ["Sem Bola", "Sem Bola"],
  ["Trabalho de Equipa", "Trab Equipe"],
  ["Visão de Jogo", "Visão de Jogo"],
];

const physicalAttributes = [
  ["Aceleração", "Aceleração"],
  ["Agilidade", "Agilidade"],
  ["Aptidão Física", "Aptidão Física"],
  ["Equilíbrio", "Equilíbrio"],
  ["Força", "Força"],
  ["Impulsão", "Impulsão"],
  ["Resistência", "Resistência"],
  ["Velocidade", "Velocidade"],
];

const goalkeeperAttributes = [
  ["(Tendência) para Saídas da Baliza", "Saídas da Baliza"],
  ["Saídas a Punhos", "Saídas a Punhos"],
  ["Alcance Aéreo", "Alcance Aéreo"],
  ["Comando de Área", "Comando de Área"],
  ["Comunicação", "Comunicação"],
  ["Excentricidade", "Excentricidade"],
  ["Jogo de Mãos", "Jogo de Mãos"],
  ["Lançamentos", "Lançamentos"],
  ["Pontapé", "Pontapé"],
  ["Reflexos", "Reflexos"],
  ["Um Para Um", "Um Para Um"],
];

/* =========================================================
   FUNÇÕES
========================================================= */

function getNumber(
  attributes: Attributes | null,
  key: string
): number | null {
  if (!attributes) return null;

  const value = attributes[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return null;
  }

  const parsed = Number(value);

  return Number.isNaN(parsed)
    ? null
    : parsed;
}

function getText(
  attributes: Attributes | null,
  key: string
) {
  if (!attributes) return "-";

  const value = attributes[key];

  if (
    value === undefined ||
    value === null ||
    value === ""
  ) {
    return "-";
  }

  return String(value);
}

function formatValue(value: number | null) {
  if (value === null || value === undefined) {
    return "-";
  }

  if (value >= 1_000_000) {
    return `R$ ${(value / 1_000_000).toLocaleString(
      "pt-BR",
      {
        maximumFractionDigits: 1,
      }
    )}M`;
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

/* =========================================================
   LINHA DE ATRIBUTO
========================================================= */

function AttributeRow({
  label,
  value,
}: {
  label: string;
  value: number | null;
}) {
  if (value === null) return null;

  const percentage = Math.max(
    5,
    Math.min(100, (value / 20) * 100)
  );

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "110px 80px 24px",
        alignItems: "center",
        columnGap: "6px",
        minHeight: "25px",
      }}
    >
      <div
        style={{
          color: "#e4e4e7",
          fontSize: "12px",
          lineHeight: "1",
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

/* =========================================================
   CARD PADRÃO
========================================================= */

function AttributeCard({
  icon,
  title,
  attributes,
  playerAttributes,
}: {
  icon: string;
  title: string;
  attributes: string[][];
  playerAttributes: Attributes | null;
}) {
  return (
    <section
      style={{
        background:
          "linear-gradient(180deg,#04131c 0%,#031016 100%)",
        border: "1px solid #0284c7",
        borderRadius: "10px",
        overflow: "hidden",
        height: "100%",
      }}
    >
      <div
        style={{
          background:
            "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
        }}
      >
        <span style={{ fontSize: "19px" }}>
          {icon}
        </span>

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

      <div
        style={{
          padding: "8px 9px 10px",
        }}
      >
        {attributes.map(([key, label]) => (
          <AttributeRow
            key={key}
            label={label}
            value={getNumber(
              playerAttributes,
              key
            )}
          />
        ))}
      </div>
    </section>
  );
}

/* =========================================================
   FÍSICOS & BIOTIPO
========================================================= */

function PhysicalCard({
  player,
}: {
  player: Player;
}) {
  const height = getText(
    player.attributes,
    "Altura"
  );

  const leftFoot = getText(
    player.attributes,
    "Pé Esquerdo"
  );

  const rightFoot = getText(
    player.attributes,
    "Pé Direito"
  );

  return (
    <section
      style={{
        background:
          "linear-gradient(180deg,#04131c 0%,#031016 100%)",
        border: "1px solid #0284c7",
        borderRadius: "10px",
        overflow: "hidden",
        height: "100%",
      }}
    >
      {/* TÍTULO */}

      <div
        style={{
          background:
            "linear-gradient(90deg,#082f49,#071a2b)",
          borderBottom: "1px solid #075985",
          padding: "8px 10px",
          display: "flex",
          alignItems: "center",
          gap: "7px",
        }}
      >
        <span style={{ fontSize: "19px" }}>
          🏃
        </span>

        <span
          style={{
            color: "white",
            fontSize: "14px",
            fontWeight: 900,
            fontStyle: "italic",
            whiteSpace: "nowrap",
          }}
        >
          FÍSICOS & BIOTIPO
        </span>
      </div>

      {/* ATRIBUTOS */}

      <div
        style={{
          padding: "8px 9px 8px",
        }}
      >
        {physicalAttributes.map(
          ([key, label]) => (
            <AttributeRow
              key={key}
              label={label}
              value={getNumber(
                player.attributes,
                key
              )}
            />
          )
        )}
      </div>

      {/* LINHA */}

      <div
        style={{
          margin: "2px 9px 0",
          borderTop:
            "1px dashed #52525b",
        }}
      />

      {/* BIOTIPO */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns:
            "1fr 1fr",
          gap: "6px",
          padding: "9px",
        }}
      >
        {/* ALTURA */}

        <div
          style={{
            background: "#111827",
            border: "1px solid #334155",
            borderRadius: "7px",
            padding: "8px 5px",
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
            📏 ALTURA
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "15px",
              fontWeight: 900,
              color: "white",
            }}
          >
            {height}
          </div>
        </div>

        {/* CP */}

        <div
          style={{
            background: "#111827",
            border: "1px solid #334155",
            borderRadius: "7px",
            padding: "8px 5px",
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
            ⭐ CP
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "15px",
              fontWeight: 900,
              color: "#7dd3fc",
            }}
          >
            {player.cp ?? "-"}
          </div>
        </div>

        {/* PÉ ESQUERDO */}

        <div
          style={{
            background: "#111827",
            border: "1px solid #334155",
            borderRadius: "7px",
            padding: "8px 5px",
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
            🦶 PÉ ESQ.
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "11px",
              fontWeight: 900,
              color: "white",
              textTransform:
                "uppercase",
            }}
          >
            {leftFoot}
          </div>
        </div>

        {/* PÉ DIREITO */}

        <div
          style={{
            background: "#111827",
            border: "1px solid #334155",
            borderRadius: "7px",
            padding: "8px 5px",
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
            🦶 PÉ DIR.
          </div>

          <div
            style={{
              marginTop: "2px",
              fontSize: "11px",
              fontWeight: 900,
              color: "white",
              textTransform:
                "uppercase",
            }}
          >
            {rightFoot}
          </div>
        </div>
      </div>
    </section>
  );
}

/* =========================================================
   PÁGINA
========================================================= */

export default function PlayerPage() {
  const params = useParams();
  const router = useRouter();

  const id = params.id as string;

  const [player, setPlayer] =
    useState<Player | null>(null);

  const [loading, setLoading] =
    useState(true);

  useEffect(() => {
    if (id) {
      loadPlayer();
    }
  }, [id]);

  async function loadPlayer() {
    setLoading(true);

    const { data, error } =
      await supabase
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
          attributes,
          available,
          drafted,
          image_url
        `)
        .eq("id", id)
        .single();

    if (error) {
      console.error(error);
      setPlayer(null);
    } else {
      setPlayer(
        data as Player
      );
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
    player.category?.includes(
      "Goleiro"
    ) ||
    player.position?.includes(
      "GR"
    );

  return (
    <main className="min-h-screen bg-zinc-950 text-white">

      {/* PAINEL */}

      <div
        style={{
          width: "100%",
          maxWidth: "980px",
          margin: "0 auto",
          padding: "12px",
        }}
      >

        {/* VOLTAR */}

        <button
          type="button"
          onClick={() =>
            router.push(
              "/players"
            )
          }
          style={{
            background: "#27272a",
            color: "#e4e4e7",
            border:
              "1px solid #3f3f46",
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

        {/* CABEÇALHO */}

        <div
          style={{
            background: "#020617",
            border:
              "1px solid #075985",
            borderRadius: "10px",
            padding: "10px 12px",
            marginBottom: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: "10px",
              alignItems: "center",
            }}
          >

            {/* JOGADOR */}

            <div>

              <div
                style={{
                  fontSize: "20px",
                  fontWeight: 900,
                }}
              >
                {player.name}
              </div>

              <div
                style={{
                  fontSize: "10px",
                  color: "#a1a1aa",
                  marginTop: "3px",
                }}
              >
                {player.age ?? "-"} anos
                {" · "}
                {player.nationality ??
                  "-"}
                {" · "}
                {player.club ?? "-"}
                {" · "}
                {player.position ??
                  "-"}
                {" · "}
                ID{" "}
                {player.unique_id}
              </div>

            </div>

            {/* CA */}

            <div
              style={{
                display: "flex",
                gap: "5px",
              }}
            >

              <div
                style={{
                  minWidth: "60px",
                  textAlign:
                    "center",
                  border:
                    "1px solid #16a34a",
                  borderRadius:
                    "7px",
                  padding: "5px",
                }}
              >

                <div
                  style={{
                    fontSize: "9px",
                    color:
                      "#4ade80",
                    fontWeight: 800,
                  }}
                >
                  CA
                </div>

                <div
                  style={{
                    fontSize: "21px",
                    fontWeight: 900,
                    color:
                      "#4ade80",
                  }}
                >
                  {player.ca ??
                    "-"}
                </div>

              </div>

              {/* CP */}

              <div
                style={{
                  minWidth: "60px",
                  textAlign:
                    "center",
                  border:
                    "1px solid #38bdf8",
                  borderRadius:
                    "7px",
                  padding: "5px",
                }}
              >

                <div
                  style={{
                    fontSize: "9px",
                    color:
                      "#7dd3fc",
                    fontWeight: 800,
                  }}
                >
                  CP
                </div>

                <div
                  style={{
                    fontSize: "21px",
                    fontWeight: 900,
                  }}
                >
                  {player.cp ??
                    "-"}
                </div>

              </div>

            </div>

          </div>
        </div>

        {/* VALOR / SALÁRIO */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "1fr 1fr",
            gap: "6px",
            marginBottom: "8px",
          }}
        >

          {/* VALOR */}

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

            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {formatValue(
                player.value
              )}
            </div>

          </div>

          {/* SALÁRIO */}

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

            <div
              style={{
                fontSize: "12px",
                fontWeight: 800,
              }}
            >
              {player.salary ||
                "-"}
            </div>

          </div>

        </div>

        {/* =================================================
            3 COLUNAS
        ================================================= */}

        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              "repeat(3, minmax(0, 1fr))",
            gap: "7px",
            alignItems: "stretch",
          }}
        >

          {/* TÉCNICO */}

          <AttributeCard
            icon="🥾"
            title="ATRIBUTOS TÉCNICOS"
            attributes={
              technicalAttributes
            }
            playerAttributes={
              player.attributes
            }
          />

          {/* MENTAL */}

          <AttributeCard
            icon="🧠"
            title="ATRIBUTOS MENTAIS"
            attributes={
              mentalAttributes
            }
            playerAttributes={
              player.attributes
            }
          />

          {/* FÍSICO */}

          <PhysicalCard
            player={player}
          />

        </div>

        {/* GOLEIRO */}

        {isGoalkeeper && (

          <div
            style={{
              marginTop: "7px",
            }}
          >

            <AttributeCard
              icon="🧤"
              title="ATRIBUTOS DE GOLEIRO"
              attributes={
                goalkeeperAttributes
              }
              playerAttributes={
                player.attributes
              }
            />

          </div>

        )}

      </div>

    </main>
  );
}