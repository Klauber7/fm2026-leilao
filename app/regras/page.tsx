import type { Metadata } from "next";
import Link from "next/link";

// Revisão do regulamento consolidada para publicação em produção.
export const metadata: Metadata = {
  title: "Regras da Liga",
  description: "Regulamento de elenco, comissão técnica, transferências, finanças, premiações e disciplina da FriendZone League FM.",
};

type RuleSection = {
  id: string;
  icon: string;
  title: string;
  intro: string;
  rules: string[];
};

const sections: RuleSection[] = [
  {
    id: "competicoes",
    icon: "🏆",
    title: "Competições",
    intro: "As competições da FriendZone League FM são organizadas pela administração.",
    rules: [
      "FriendZone Premier League: campeonato de pontos corridos, com 20 equipes e 38 rodadas.",
      "FriendZone Champions League (Champions Cup): as 16 equipes mais bem classificadas da FriendZone Premier League garantem vaga na competição.",
      "FriendZone Cup: os confrontos são definidos pelo Football Manager (FM).",
      "FriendZone Super Cup: o campeão da FriendZone Cup enfrenta o campeão da FriendZone Premier League.",
      "Resultados, classificações e chaveamentos publicados no site são a referência para acompanhar cada torneio.",
    ],
  },
  {
    id: "elencos",
    icon: "👥",
    title: "Elenco dos clubes",
    intro: "Cada presidente responde pela regularidade e conferência do seu clube.",
    rules: [
      "O plantel deve ter 25 jogadores, incluindo 3 goleiros.",
      "Os 3 goleiros fazem parte dos 25 jogadores; não são vagas adicionais.",
      "Após atualizações do save ou janelas, o presidente deve conferir nomes, posições e quantidade de jogadores.",
      "Qualquer divergência deve ser comunicada dentro do prazo anunciado pela administração.",
      "Elenco fora dos requisitos pode resultar em regularização obrigatória e penalidade disciplinar.",
    ],
  },
  {
    id: "comissao",
    icon: "🧑‍💼",
    title: "Comissão técnica",
    intro: "Além do plantel, os clubes precisam manter a equipe técnica obrigatória.",
    rules: [
      "Mínimo obrigatório: 1 treinador, 1 adjunto principal, 1 preparador e 1 fisioterapeuta.",
      "Os profissionais devem estar registrados e vinculados corretamente ao clube.",
      "A contratação e a demissão do treinador principal podem ser realizadas a qualquer momento, inclusive com a janela de transferências fechada.",
      "A administração da liga deve ser informada sobre qualquer contratação ou demissão de treinador. A mudança só terá efeito após a administração ser comunicada e realizar a atualização correspondente.",
      "A contratação e a dispensa dos demais profissionais da comissão técnica, incluindo adjunto principal, preparador e fisioterapeuta, só são permitidas quando a janela de transferências estiver aberta.",
      "O presidente deve conferir sua comissão técnica após cada atualização do save.",
    ],
  },
  {
    id: "mercado",
    icon: "🔄",
    title: "Mercado de transferências",
    intro: "Regras oficiais de contratações e dispensas para o 1º, 2º e 3º leilões.",
    rules: [
      "1º LEILÃO — Mercado livre: cada clube pode contratar quantos jogadores quiser, sem limite de contratações internas ou externas.",
      "1º LEILÃO — Dispensa: é permitido dispensar até 1 jogador e receber 100% do valor investido no atleta.",
      "2º LEILÃO — Limite de 6 contratações por clube: até 3 jogadores no mercado interno e até 3 jogadores no mercado externo.",
      "2º LEILÃO — Dispensa: é permitido dispensar até 1 jogador e receber 100% do valor investido no atleta.",
      "3º LEILÃO — Limite de 4 contratações por clube, com escolha livre entre o mercado interno e o externo.",
      "3º LEILÃO — Dispensa: é permitido dispensar até 2 jogadores, recebendo 100% do valor investido em cada atleta.",
      "Nas negociações internas, o jogador principal também conta para o limite de 2 saídas de um clube para o mesmo adversário por janela. Jogadores incluídos em trocas também contam.",
      "Negociações realizadas com a janela fechada podem ser registradas como transferências futuras, conforme as condições do sistema.",
      "Todas as contratações, dispensas, devoluções e movimentações financeiras devem constar dos registros oficiais do site.",
    ],
  },
  {
    id: "contrapropostas",
    icon: "🤝",
    title: "Negociações internas e contrapropostas",
    intro: "Trocas de jogadores podem incluir dinheiro e atletas dos dois clubes.",
    rules: [
      "O jogador principal da proposta já conta como 1 saída do clube de origem.",
      "Quando o clube de origem do jogador principal faz a contraproposta, pode adicionar mais 1 jogador próprio e solicitar até 1 do adversário.",
      "Quando o outro clube faz a contraproposta, pode incluir até 2 jogadores próprios e solicitar até 1 jogador adicional do adversário.",
      "Em qualquer cenário, permanecem válidos o limite de 2 saídas por clube na mesma direção e os limites da janela.",
      "Um mesmo jogador não pode constar duas vezes na mesma negociação, e cada atleta deve pertencer ao clube de origem indicado.",
      "A movimentação só é concluída após aceitação e validação das regras pelo sistema.",
    ],
  },
  {
    id: "financeiro",
    icon: "💰",
    title: "Financeiro e parcelas",
    intro: "A administração acompanha os saldos, as dívidas e as penalidades dos clubes.",
    rules: [
      "O clube pode manter no máximo R$ 30 milhões em parcelas futuras pendentes, conforme o regulamento financeiro.",
      "A parcela será paga na próxima janela de transferências.",
      "O clube que não quitar a dívida no prazo definido pode receber transfer ban até a regularização.",
      "Compras, vendas, reembolsos, parcelas e multas devem ser registradas no histórico financeiro.",
      "As premiações de competições e partidas seguem os valores oficialmente divulgados pela liga.",
    ],
  },
  {
    id: "ajustes-janela",
    icon: "🛠️",
    title: "Ajustes no início da temporada",
    intro: "Apenas no início de cada temporada, a administração realizará os seguintes ajustes no save do Football Manager para todos os clubes.",
    rules: [
      "Maximizar a familiaridade tática existente de cada equipe.",
      "Melhorar a coesão da equipe.",
      "Remover todas as suspensões dos jogadores.",
      "Remover todas as lesões dos jogadores.",
      "Remover todo o descontentamento dos jogadores.",
    ],
  },
  {
    id: "premiacoes",
    icon: "🏅",
    title: "Premiações oficiais da FriendZone League FM",
    intro: "A liga premia participação, desempenho esportivo, classificação final, destaques individuais e patrocínio ao longo da temporada. Valores em milhões (M) ou milhares (K).",
    rules: [
      "🏆 FRIENDZONE PREMIER LEAGUE — 20 equipes, 38 partidas por equipe.",
      "Por partida: 650K por jogo disputado; bônus adicional de 350K por vitória e 200K por empate. Derrota não gera bônus adicional.",
      "Participação garantida: 24,7M por equipe nas 38 partidas (38 × 650K), independentemente dos resultados.",
      "Classificação final: campeão 40M; vice-campeão 35M; 3º lugar 32M; 4º lugar 27M; 5º ao 12º lugar 23M; 13º ao 20º lugar 19M.",
      "Premiações individuais: artilheiro da Premier League 3M; equipe dos melhores da Premier League 2M.",
      "🏆 CHAMPIONS CUP — 16 equipes, formato mata-mata.",
      "Primeira eliminatória 3M; quartas de final 5M; semifinal 16M; vice-campeão 24M; campeão 30M.",
      "Premiações individuais: artilheiro da Champions Cup 1,5M; equipe dos melhores da Champions Cup 1M.",
      "🏆 FRIENDZONE CUP — 20 equipes, formato mata-mata.",
      "1ª eliminatória 3M; oitavas de final 7M; quartas de final 10M; semifinal 14M; vice-campeão 20M; campeão 25M.",
      "Premiações individuais: artilheiro da FriendZone Cup 1,5M; equipe dos melhores da FriendZone Cup 1M.",
      "🏆 FRIENDZONE SUPER CUP — jogo único entre o campeão da Premier League e o campeão da FriendZone Cup.",
      "Campeão da Super Cup 10M; vice-campeão 7M.",
      "🤝 PATROCÍNIO OFICIAL — cada equipe recebe 75M por temporada, independentemente da classificação ou dos resultados.",
      "O patrocínio será pago em três janelas: 1ª janela 25M; 2ª janela 25M; 3ª janela 25M, totalizando 75M por equipe na temporada.",
    ],
  },
  {
    id: "disciplina",
    icon: "⚖️",
    title: "Fiscalização e penalidades",
    intro: "O regulamento se aplica igualmente a todos os presidentes.",
    rules: [
      "O presidente é responsável por manter elenco, goleiros, comissão técnica e transferências dentro das regras.",
      "Irregularidades, excesso de contratações ou descumprimento de prazos podem gerar multas.",
      "As penalidades e eventuais estornos precisam ficar registrados no financeiro do clube.",
      "Comunicados oficiais da administração definem prazos, exceções e regras específicas de cada janela.",
      "Em caso de divergência entre esta página e um comunicado oficial mais recente, prevalece a decisão posterior da administração.",
    ],
  },
];

const highlights = [
  { value: "25", label: "jogadores por clube" },
  { value: "3", label: "goleiros no plantel" },
  { value: "4", label: "funções técnicas obrigatórias" },
  { value: "2", label: "saídas por direção na janela" },
];

export default function RegrasDaLigaPage() {
  return (
    <main className="min-h-screen bg-[#050816] px-4 py-8 text-white md:px-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 overflow-hidden rounded-3xl border border-emerald-500/20 bg-gradient-to-br from-emerald-950/70 via-zinc-900 to-zinc-950 p-7 md:p-10">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-emerald-400">
            FriendZone League FM
          </div>
          <h1 className="mt-3 text-3xl font-black md:text-5xl">📜 Regras da Liga</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 md:text-base">
            Consulte o regulamento de competições, elencos, comissão técnica,
            transferências, contrapropostas, finanças e premiações. Todos os presidentes
            devem acompanhar também os comunicados oficiais da liga.
          </p>
          <Link href="/teams" className="mt-6 inline-block rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-bold text-emerald-300 transition hover:bg-emerald-500/20">
            ← Voltar para Clubes
          </Link>
        </div>

        <div className="mb-8 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {highlights.map((item) => (
            <div key={item.label} className="rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="text-3xl font-black text-emerald-400">{item.value}</div>
              <div className="mt-1 text-sm font-semibold text-zinc-300">{item.label}</div>
            </div>
          ))}
        </div>

        <nav aria-label="Índice do regulamento" className="mb-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-zinc-400">Índice do regulamento</p>
          <div className="flex flex-wrap gap-2">
            {sections.map((section) => (
              <a
                key={section.id}
                href={`#${section.id}`}
                className="rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-bold text-zinc-200 transition hover:border-emerald-500/50 hover:text-emerald-300"
              >
                {section.icon} {section.title}
              </a>
            ))}
          </div>
        </nav>

        <div className="grid gap-5">
          {sections.map((section, index) => (
            <section key={section.id} id={section.id} className="scroll-mt-8 rounded-2xl border border-zinc-800 bg-zinc-900 p-6 md:p-8">
              <div className="flex items-start gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-2xl">
                  {section.icon}
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
                    Artigo {String(index + 1).padStart(2, "0")}
                  </p>
                  <h2 className="mt-1 text-xl font-black md:text-2xl">{section.title}</h2>
                  <p className="mt-2 text-sm text-zinc-400">{section.intro}</p>
                </div>
              </div>
              <ul className="mt-6 space-y-3">
                {section.rules.map((rule) => (
                  <li key={rule} className="flex gap-3 text-sm leading-7 text-zinc-200 md:text-base">
                    <span aria-hidden="true" className="mt-1 shrink-0 font-black text-emerald-400">✓</span>
                    <span>{rule}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-6 text-sm leading-7 text-zinc-300">
          <p className="font-black text-amber-300">Importante para os presidentes</p>
          Este resumo reúne as regras gerais da liga. Janelas extraordinárias,
          alterações de regras vigentes, alterações de premiação e decisões
          disciplinares serão regidas pelos comunicados oficiais mais recentes
          da administração.
        </div>
      </div>
    </main>
  );
}
