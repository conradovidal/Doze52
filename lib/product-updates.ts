export type ProductUpdateCategory =
  | "Calendario"
  | "Perfis"
  | "Interface"
  | "Sincronizacao";

export type ProductUpdateMilestone = {
  dateLabel: string;
  title: string;
  categories: ProductUpdateCategory[];
  bullets: string[];
};

export type ProductRoadmapSection = {
  key: "launched" | "in-progress" | "backlog" | "top-voted";
  label: string;
  eyebrow: string;
  title: string;
  description: string;
  emptyStateTitle?: string;
  emptyStateBody?: string;
};

export const PRODUCT_ROADMAP_SECTIONS: ProductRoadmapSection[] = [
  {
    key: "launched",
    label: "Lancadas",
    eyebrow: "Ja no produto",
    title: "O que ja melhoramos no doze52",
    description:
      "Marcos importantes da evolucao do produto, sempre com foco no que mudou para o usuario.",
  },
  {
    key: "in-progress",
    label: "Em andamento",
    eyebrow: "Proxima etapa",
    title: "O que estiver em construcao aparecera aqui",
    description:
      "Quando abrirmos esse bloco, voce vai conseguir acompanhar o que esta sendo desenvolvido agora.",
    emptyStateTitle: "Em breve",
    emptyStateBody:
      "Vamos usar esta area para mostrar melhorias em execucao e dar mais visibilidade ao que esta chegando.",
  },
  {
    key: "backlog",
    label: "Backlog",
    eyebrow: "Ideias e melhorias",
    title: "Espaco reservado para o backlog publico",
    description:
      "Aqui vamos organizar oportunidades futuras com mais clareza e contexto para o usuario.",
    emptyStateTitle: "Em breve",
    emptyStateBody:
      "O backlog publico sera o lugar para acompanhar ideias que ainda nao entraram em desenvolvimento.",
  },
  {
    key: "top-voted",
    label: "Mais votadas",
    eyebrow: "Participacao da comunidade",
    title: "O ranking de prioridades vira nesta proxima fase",
    description:
      "Essa area vai concentrar as melhorias mais pedidas e ajudar a tornar a priorizacao mais transparente.",
    emptyStateTitle: "Em breve",
    emptyStateBody:
      "Quando a votacao entrar no ar, voce vai ver aqui o que a comunidade mais quer ver no doze52.",
  },
];

export const PRODUCT_UPDATE_MILESTONES: ProductUpdateMilestone[] = [
  {
    dateLabel: "11 de fevereiro de 2026",
    title: "Primeira versao publica do doze52",
    categories: ["Calendario", "Interface"],
    bullets: [
      "A base do calendario anual entrou no ar com foco total na visualizacao do ano.",
      "O produto ganhou a estrutura inicial para planejamento visual de longo prazo.",
    ],
  },
  {
    dateLabel: "12 a 13 de fevereiro de 2026",
    title: "Login com Google ficou mais simples e confiavel",
    categories: ["Sincronizacao", "Interface"],
    bullets: [
      "A autenticacao por popup foi estabilizada para reduzir interrupcoes no acesso.",
      "O retorno ao produto depois do login ficou mais previsivel e seguro.",
    ],
  },
  {
    dateLabel: "18 a 20 de fevereiro de 2026",
    title: "Sincronizacao e drag-and-drop ganharam consistencia",
    categories: ["Sincronizacao", "Calendario"],
    bullets: [
      "A base de sincronizacao com Supabase foi consolidada.",
      "Mover eventos no calendario ficou muito mais estavel e natural.",
      "O feedback visual das celulas e do arraste foi refinado.",
    ],
  },
  {
    dateLabel: "23 a 28 de fevereiro de 2026",
    title: "Calendario mais legivel e header mais claro",
    categories: ["Calendario", "Interface"],
    bullets: [
      "Eventos passaram a respeitar melhor ordenacao e empilhamento visual.",
      "O indicador de hoje ficou automatico, sem precisar recarregar a pagina.",
      "Header, logo, tema e mobile receberam uma rodada forte de polimento.",
    ],
  },
  {
    dateLabel: "7 a 8 de marco de 2026",
    title: "Perfis de calendario foram lancados",
    categories: ["Perfis", "Calendario"],
    bullets: [
      "Categorias passaram a ser isoladas por perfil, como profissional, pessoal e familia.",
      "Perfis ganharam icones e um fluxo mais direto para foco por contexto.",
    ],
  },
  {
    dateLabel: "9 a 10 de marco de 2026",
    title: "Edicao e navegacao ficaram mais fluídas",
    categories: ["Perfis", "Interface"],
    bullets: [
      "Header evoluiu para uma composicao mais premium, simetrica e clara.",
      "Perfis e categorias ganharam modo de edicao mais consistente.",
      "Reordenacao, footer e pop-ups foram compactados e refinados.",
    ],
  },
  {
    dateLabel: "11 a 12 de marco de 2026",
    title: "Modal de evento e fluxos de configuracao ficaram mais amigaveis",
    categories: ["Interface", "Perfis"],
    bullets: [
      "O modal de evento ficou mais compacto e facil de preencher.",
      "Pop-ups passaram a respeitar melhor a area do calendario.",
      "Criacao e edicao de perfis e categorias receberam refinamentos visuais importantes.",
    ],
  },
];
