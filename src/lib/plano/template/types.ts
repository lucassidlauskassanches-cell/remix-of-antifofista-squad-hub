// Shape of the editable, personalized content for a Plano de Ação.
// Fixed sections (manifesto, refeição livre, acompanhamento) live in the renderer.

export type Card = { k: string; h: string; b: string };

export type Phase = {
  num: string; // "01"
  tag: string; // "Fase 1/4"
  name: string; // "Adaptação"
  desc: string;
  months: string[]; // ["Mês 01","Mês 02","Mês 03"]
};

export type Fotos = {
  frente?: string; // data URI
  lado?: string;
  costas?: string;
};

export type Genero = "masculino" | "feminino";

export type PlanData = {
  alunoNome: string;
  cicloMeses: number; // 12
  genero?: Genero; // detectado pela IA (anamnese/fotos) — gendera textos fixos do template
  diaFeedback?: string; // dia do acompanhamento quinzenal, ex: "quarta-feira"

  // Page 03 — Bem-vindo
  bemVindo: { lead: string; paragraphs: string[] };

  // Page 04 — Objetivo
  objetivo: { lead: string; paragraphs: string[] };

  // Page 05 — Treino
  treino: { paragraphs: string[]; cards: Card[] };

  // Page 06 — Dieta
  dieta: { paragraphs: string[]; cards: Card[]; closing: string };

  // Page 08 — Análise de físico
  analise: { paragraphs: string[]; fotos: Fotos };

  // Page 09 — Fases
  fases: Phase[];
};

export const DEFAULT_FASES: Phase[] = [
  {
    num: "01",
    tag: "Fase 1/4",
    name: "Adaptação",
    desc: "Organizar a técnica dos movimentos básicos, criar rotina de treino consistente com pelo menos 90% de presença e ajustar a dieta à sua rotina.",
    months: ["Mês 01", "Mês 02", "Mês 03"],
  },
  {
    num: "02",
    tag: "Fase 2/4",
    name: "Construção",
    desc: "Aumentar força e volume consolidando os padrões motores, avançar a progressão de cargas e começar a transformar a base em corpo.",
    months: ["Mês 04", "Mês 05", "Mês 06"],
  },
  {
    num: "03",
    tag: "Fase 3/4",
    name: "Intensificação",
    desc: "Intensificar o treino com cargas mais altas e mais densidade, mantendo a qualidade da execução e a consistência na dieta.",
    months: ["Mês 07", "Mês 08", "Mês 09"],
  },
  {
    num: "04",
    tag: "Fase 4/4",
    name: "Consolidação",
    desc: "Consolidar o físico alcançado, refinar proporções e decidir junto a próxima estratégia: seguir construindo ou partir pro refinamento.",
    months: ["Mês 10", "Mês 11", "Mês 12"],
  },
];

// Sample content (the "Camila" model) — used for template verification.
export const SAMPLE_PLAN: PlanData = {
  alunoNome: "Camila Andrade",
  cicloMeses: 12,
  genero: "feminino",
  diaFeedback: "quarta-feira",
  bemVindo: {
    lead: "Antes de tudo, obrigado pela confiança, Camila. De verdade.",
    paragraphs: [
      "Tô muito feliz de te ter no time, e quero que você saiba que pode contar com o comprometimento total, meu e de toda a equipe, no seu plano. A partir de agora o seu objetivo virou o nosso também.",
      "Seu treino e sua dieta já estão prontos. E nada mais justo do que te explicar o que foi feito, o porquê de cada escolha e quais metas a gente vai buscar no curto, médio e longo prazo. Foi pra isso que montei esse documento: pra você entender toda a lógica por trás da estratégia do seu treino e da sua dieta.",
      "Faço questão de deixar isso claro com cada aluno, até pra você sentir o nível de individualização do nosso trabalho. Tudo aqui foi pensado pra você, Camila. É isso que faz o Antifofista Squad ser o que é.",
      "Espero que curta. Qualquer dúvida, é só chamar no suporte.",
    ],
  },
  objetivo: {
    lead: "A lógica dos próximos 12 meses é simples e direta: primeiro a gente constrói uma base sólida, depois transforma essa base em corpo.",
    paragraphs: [
      "No seu caso, Camila, a prioridade do começo é recompor. Segurar e ganhar massa magra enquanto reduz gordura e melhora a qualidade do seu dia a dia. Antes de buscar intensidade alta ou método avançado, a gente garante o básico bem feito: execução correta, consistência na dieta e uma rotina que cabe na sua vida. Se o plano não cabe na sua rotina, ele não se sustenta, e plano que não se sustenta não traz resultado.",
      "Como você me falou que o tempo é curto e que o fim de semana é o seu ponto fraco, montei tudo priorizando praticidade e aderência. Refeições com o que você já gosta e já come, treino enxuto de 4 sessões e regras claras pro fim de semana não jogar a semana fora.",
      "Depois que a base estiver firme, o foco passa a ser aumentar carga e volume de forma mais agressiva, lapidar os pontos que você quer evoluir e, lá no fim, decidir junto se a gente segue construindo ou parte pra um refinamento. Cada fase puxa a próxima. Mas nada disso funciona sem você cumprir a sua parte.",
    ],
  },
  treino: {
    paragraphs: [
      "Montei seu treino com <strong>4 sessões semanais</strong>. Se você treinar mais que isso na semana, sem problema: segue a sequência da planilha e, depois do 4º treino, vira a semana. O importante é manter a ordem e não pular sessão.",
      "As primeiras semanas são pra você <strong>aprender a executar</strong>. Padrão de movimento limpo nos básicos antes de querer subir carga rápido. Encara sem ego. Técnica primeiro, peso depois. É o que protege a articulação e garante que a carga que sobe é carga real, não empurrão.",
      "A partir daí entra a <strong>periodização</strong>: a gente progride volume e intensidade ao longo das semanas, de forma controlada. Progressão é o motor de tudo aqui. Sempre buscando evoluir as cargas de forma inteligente e registrando tudo.",
    ],
    cards: [
      { k: "Frequência", h: "4x na semana", b: "Treinou mais? Segue a sequência. Depois do 4º, vira a semana na planilha." },
      { k: "Descanso", h: "90s no mínimo", b: "Os 90 segundos são estratégicos pra você recuperar e manter a intensidade. Encurtar sabota a série seguinte." },
      { k: "Registro", h: "Anota tudo", b: "Carga, série e reps de toda sessão. Sem registro não tem progressão, tem achismo." },
    ],
  },
  dieta: {
    paragraphs: [
      "Sua dieta foi estruturada priorizando <strong>praticidade, facilidade e aderência</strong> à sua rotina. Deixei as refeições com o que você tem preferência pra ser prático no dia a dia. No fim de semana, mantém o máximo de consistência possível. É ali que a maioria perde o que construiu na semana.",
      "Se qualquer refeição estiver complicada de executar ou você precisar variar, <strong>avisa na hora</strong> que a gente ajusta. O plano tem que ser sustentável pra gerar resultado consistente, não pra durar três dias.",
    ],
    cards: [
      { k: "Fruta", h: "Mamão", b: "Rico em enzimas digestivas. Ajuda no funcionamento e no conforto digestivo." },
      { k: "Bebida", h: "Chá verde", b: "Ajuda a reduzir retenção hídrica e entrega antioxidantes." },
      { k: "Fibra", h: "Psyllium", b: "Excelente pro intestino e pra controlar picos de glicose ao longo do dia." },
    ],
    closing:
      "Se qualquer refeição não couber no seu dia, <strong>avisa que a gente ajusta</strong>. O plano tem que ser sustentável pra durar meses, não três dias. E pra não pesar, você tem a <strong>refeição livre</strong>: como ela funciona está logo abaixo.",
  },
  analise: {
    paragraphs: [
      "Olhando as suas fotos, a base de partida é favorável pra trabalhar recomposição. A estrutura ajuda e dá pra ganhar densidade com qualidade, contanto que a adesão à dieta e ao treino seja real. O ponto que mais responde no seu caso é a constância. Seu corpo reage bem, o que falta é repetição.",
      "No treino, vou priorizar técnica nos movimentos básicos, ganho de força e consistência pra aproveitar esse potencial. Na dieta, o foco é manter o aporte certo sem te prender numa rotina impossível, pra você sustentar o plano por meses, não por semanas.",
      "À medida que você evolui e fica confortável com os padrões de movimento, eu subo intensidade e densidade de treino. Por isso o acompanhamento de perto importa tanto: é ele que me deixa ajustar antes de qualquer coisa virar problema.",
    ],
    fotos: {},
  },
  fases: DEFAULT_FASES,
};
