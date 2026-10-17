"use client";

type StaffAttribute = Record<string, number | null>;

const GROUPS = [
  {
    title: "Treinamento e avaliações",
    subtitle: "Atributos técnicos e de desenvolvimento da comissão",
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
    title: "Tendências táticas",
    subtitle: "Preferências e inclinações de trabalho (não são notas de qualidade)",
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
    title: "Personalidade",
    subtitle: "Características profissionais, escala original do save",
    keys: [
      "Adaptabilidade", "Ambição", "Lealdade", "Pressão",
      "Profissionalismo", "Desportivismo", "Temperamento", "Controvérsia",
    ],
  },
] as const;

function colorFor(value: number, isTendency: boolean) {
  if (isTendency) return "bg-sky-400";
  if (value >= 16) return "bg-emerald-400";
  if (value >= 12) return "bg-lime-400";
  if (value >= 8) return "bg-yellow-400";
  return "bg-orange-400";
}

export default function StaffAttributes({ attributes }: { attributes?: StaffAttribute | null }) {
  const hasAttributes = !!attributes && Object.keys(attributes).length > 0;
  if (!hasAttributes) {
    return (
      <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="text-2xl font-black text-white">Atributos do profissional</h2>
        <p className="mt-2 text-sm text-zinc-400">
          Atributos ainda não importados para este profissional.
        </p>
      </section>
    );
  }

  return (
    <section className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5 sm:p-7">
      <h2 className="text-2xl font-black text-white">Atributos do profissional</h2>
      <p className="mt-2 text-sm text-zinc-400">
        Dados do save FriendZone FM26. Valores exibidos na escala de 1 a 20.
      </p>
      <div className="mt-7 space-y-8">
        {GROUPS.map((group, index) => {
          const present = group.keys.filter(
            (key) => attributes?.[key] !== null && attributes?.[key] !== undefined
          );
          if (present.length === 0) return null;
          return (
            <div key={group.title}>
              <h3 className="text-lg font-black text-white">{group.title}</h3>
              <p className="mt-1 text-xs text-zinc-500">{group.subtitle}</p>
              <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {present.map((name) => {
                  const value = Number(attributes?.[name]);
                  const isTendency = index === 1;
                  return (
                    <div key={name} className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs font-medium text-zinc-300">{name.replace(/\*$/, "")}</span>
                        <span className="min-w-7 text-right text-sm font-black text-white">{value}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-zinc-800">
                        <div
                          className={`h-full rounded-full ${colorFor(value, isTendency)}`}
                          style={{ width: `${Math.max(0, Math.min(100, value * 5))}%` }}
                        />
                      </div>
                      {name.endsWith("*") && (
                        <p className="mt-1 text-[10px] text-amber-400/80">Nome/escala a confirmar no editor</p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-6 border-t border-zinc-800 pt-4 text-xs text-zinc-500">
        Tendências não representam necessariamente qualidade; para Controvérsia, menor tende a ser melhor.
        Campos marcados com * seguem a interpretação provisória da exportação.
      </p>
    </section>
  );
}
