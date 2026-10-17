"use client";

type AttributeValues = Record<string, number | null>;

const GROUPS = [
  {
    icon: "🏋️",
    title: "TREINAMENTO E AVALIAÇÕES",
    keys: [
      "Treino Ataque", "Treino Defesa", "Treino Físico", "Treino Guarda-Redes",
      "Treino Bolas Paradas", "Treino Posse", "Treino Técnico", "Treino Tático",
      "Conhecimento Tático", "Avaliar Capacidade", "Avaliar Potencial",
      "Análise de Dados", "Avaliar Staff", "Negociação", "Gestão de Pessoas",
      "Motivação", "Determinação", "Autoridade", "Trabalho c/ Jovens",
      "Fisioterapia", "Ciência Desportiva", "Treino Geral*", "GR Manejo*",
      "GR Distribuição*", "Adaptabilidade Tática*", "Excentricidade*",
    ],
  },
  {
    icon: "⚽",
    title: "TENDÊNCIAS TÁTICAS",
    keys: [
      "Tend. Ataque", "Tend. Objetividade", "Tend. Ritmo", "Tend. Largura",
      "Tend. Pressão", "Tend. Recuar", "Tend. Impedimento", "Tend. Marcação",
      "Tend. Armador", "Tend. Liberdade", "Tend. Fluidez", "Tend. Flexibilidade",
      "Tend. Profundidade*", "Tend. Substituições", "Tend. Paciência",
      "Tend. Interferência", "Tend. Dureza Treino", "Tend. Rotação",
      "Tend. Comprar", "Tend. Negócios", "Tend. Jogos Mentais",
      "Tend. Recursos",
    ],
  },
  {
    icon: "🧠",
    title: "PERSONALIDADE",
    keys: [
      "Adaptabilidade", "Ambição", "Lealdade", "Pressão",
      "Profissionalismo", "Desportivismo", "Temperamento", "Controvérsia",
    ],
  },
] as const;

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

function AttributeLine({
  label,
  value,
}: {
  label: string;
  value: number | null | undefined;
}) {
  const numericValue = value == null ? null : Number(value);
  const valid = numericValue !== null && Number.isFinite(numericValue);
  const score = valid ? Math.min(20, Math.max(0, numericValue)) : 0;

  return (
    <div
      className="grid min-h-[27px] grid-cols-[minmax(0,1fr)_minmax(65px,30%)_24px] items-center gap-2"
      title={label.endsWith("*") ? label + " — nomenclatura provisória do save" : label}
    >
      <span className="truncate text-[12px] text-zinc-200" title={label}>
        {label.replace(/\*$/, "")}
        {label.endsWith("*") && <span className="ml-0.5 text-amber-400">*</span>}
      </span>

      <div className="h-[11px] overflow-hidden rounded-md border border-zinc-600 bg-[#111827]">
        {valid && (
          <div
            className="h-full rounded"
            style={{
              background: barColor(score),
              width: `${score * 5}%`,
            }}
          />
        )}
      </div>
      <span
        className="text-right text-[13px] font-extrabold tabular-nums"
        style={{ color: valid ? numberColor(score) : "#71717a" }}
      >
        {valid ? score : "—"}
      </span>
    </div>
  );
}

export default function StaffAttributes({
  attributes,
}: {
  attributes?: AttributeValues | null;
}) {
  const hasAttributes = !!attributes && Object.keys(attributes).length > 0;
  if (!hasAttributes) {
    return (
      <section className="mt-4 rounded-xl border border-sky-800 bg-[#031016] p-5">
        <h2 className="text-base font-black text-white">Atributos do profissional</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Este profissional é um cadastro antigo e ainda não tem atributos no arquivo atual do save.
        </p>
      </section>
    );
  }

  return (
    <div className="mt-3 grid grid-cols-1 items-stretch gap-2 lg:grid-cols-3" aria-label="Atributos da comissão técnica">
      {GROUPS.map((group) => (
        <section
          key={group.title}
          className="h-full overflow-hidden rounded-[10px] border border-sky-600 bg-[linear-gradient(180deg,#04131c_0%,#031016_100%)]"
        >
          <div className="flex min-h-[48px] items-center gap-2 border-b border-sky-800 bg-[linear-gradient(90deg,#082f49,#071a2b)] px-3 py-2">
            <span className="text-xl" aria-hidden="true">{group.icon}</span>
            <h2 className="text-[13px] font-black italic tracking-wide text-white sm:text-sm">
              {group.title}
            </h2>
          </div>
          <div className="px-3 py-3">
            {group.keys.map((label) => (
              <AttributeLine key={label} label={label} value={attributes[label]} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
