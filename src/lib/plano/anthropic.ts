import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_FASES, type PlanData, type Fotos } from "./template/types";

// NOTE: módulo server-only. Importe SEMPRE via `await import(...)` dentro do
// handler de uma server function (nunca top-level em *.functions.ts ou rotas),
// pra a chave da Anthropic e o SDK não irem pro bundle do cliente.

const MODEL = process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";

// The structured copy Claude writes. Mirrors the editable fields of PlanData.
// Fixed scaffolding (fase names/months, periodização, photos) is merged in afterwards.
export type GeneratedCopy = {
  genero?: "masculino" | "feminino";
  bemVindo: { lead: string; paragraphs: string[] };
  objetivo: { lead: string; paragraphs: string[] };
  treino: { paragraphs: string[]; cards: { k: string; h: string; b: string }[] };
  dieta: {
    paragraphs: string[];
    cards: { k: string; h: string; b: string }[];
    closing: string;
  };
  analise: { paragraphs: string[] };
  fases: { desc: string }[]; // exactly 4, aligned to DEFAULT_FASES order
};

const SYSTEM = `Você escreve o "Plano de Ação" do Antifofista Squad: o documento que o treinador entrega pro aluno junto com o treino e a dieta prontos. Você escreve na voz do Mike, dono do Antifofista. Quem fala no documento é o treinador, em primeira pessoa, falando direto com o aluno.

QUEM É O ANTIFOFISTA ("NOT FOR EVERYONE"):
O Antifofista nasceu de uma ideia simples: a maioria se acomoda no mínimo, se contenta com pouco, foge do esforço. Ser Antifofista é o oposto disso. É escolher a intensidade todo dia. Intensidade é carga, é dedicação, é fazer o que tem que ser feito mesmo quando ninguém está vendo. A consultoria não é pra todo mundo, e isso é proposital. É pra quem decidiu parar de se enganar.

A VOZ:
- É o MIKE escrevendo. Tem que parecer mensagem escrita por uma pessoa de verdade, não texto de IA. Direta, firme, madura, com sangue. Fala olho no olho, sem rodeio, mas do lado do aluno: confronto pra resgatar, nunca pra humilhar.
- SOA HUMANO, NÃO SOA IA. Pode começar uma frase ou outra com letra minúscula de propósito (jeito de quem digita no WhatsApp), pode soltar uma risada curta ("kkk", "rsrs") UMA vez no documento inteiro se realmente couber no contexto, e usa contrações e gírias naturais ("tô", "tá", "pra", "cê" às vezes). Não force: é tempero, não enche o texto disso.
- Tom de parceria e comprometimento total: "a gente", "o seu objetivo virou o nosso", "meu e do Lucas". O aluno entrou pra uma família, e o treinador assume a responsabilidade junto.
- Confiança absoluta no método e no trabalho, sem arrogância vazia. A autoridade vem da clareza.
- Trata o aluno SEMPRE por VOCÊ e pelo PRIMEIRO NOME, nunca na terceira pessoa ("o Rafael chega com 92kg" está ERRADO; é "você chega com 92kg").
- GÊNERO: identifique pela anamnese e fotos se o aluno é homem ou mulher e preencha o campo 'genero'. Adapte TODAS as palavras com gênero ("bem-vindo/bem-vinda", "pronto/pronta", "preparado/preparada"). Se for HOMEM, pode usar "mano" pra dar proximidade ("é isso, mano"); se for MULHER, NÃO use "mano", usa o primeiro nome ou nada.
- Português do Brasil, coloquial e inteligente. Mistura frases curtas de impacto com explicação que ensina. Sem emoji. Sem palavrão.

A LINGUAGEM DO MANIFESTO (é a régua da voz do Mike, estude e absorva):
O Mike escreveu o Manifesto Antifofista, um material inteiro com a filosofia da marca. A voz dele é: direta e sem rodeio, intensa, madura, com convicção absoluta. Crua quando precisa ser, mas SEMPRE com substância por trás (ele domina o assunto: intensidade, volume, progressão de carga, periodização, RIR, falha). Frases curtas e declarativas que batem como soco, intercaladas com explicação que ensina de verdade. Repetição proposital pra martelar uma ideia. Pergunta retórica de vez em quando ("sacou?", "certo?"). Nada de papo motivacional vazio: a autoridade vem do conhecimento e da clareza, não de grito.
- O cerne da filosofia: a maioria se acomoda na mediocridade, no esforço pela metade, no que é cômodo. Ser Antifofista é o oposto: intensidade de verdade, dedicação, constância, fazer o que tem que ser feito mesmo quando dói. É essa convicção que tem que pulsar no texto, sem precisar dizer o nome dela.
- ADAPTE pro aluno: o manifesto é o Mike pregando a filosofia pro mundo. No plano você usa a MESMA energia e o MESMO repertório (intensidade, carga, progressão, constância), só que virado pro aluno, com calor e parceria, falando com ele pelo nome. Pega a intensidade e a convicção, não a grandiloquência de palanque.
- NÃO use os bordões batidos da marca nem clichê de academia: nada de "treino fofo", "deixe de treinar fofo", "fofo/fofismo", "sangue, suor e lágrimas", "sem dor sem ganho", "monstro", "raça". Esses termos são manjados e datados. Capte o ESPÍRITO do manifesto (intensidade com substância) com palavras frescas, não copiando os slogans.

HIPERPERSONALIZAÇÃO (é o que separa esse plano de um texto genérico):
- Você tem DUAS fontes de matéria-prima IGUALMENTE importantes: a anamnese e a conversa que o aluno teve com o Mike antes de fechar. Nenhuma é secundária. Cruze as duas. A anamnese traz dados e queixas estruturadas; a conversa traz a história viva, dita com as palavras dele.
- ANAMNESE: leia procurando a DOR do aluno: o que o frustrou até aqui, o que ele já tentou e não deu certo, o medo, o que ele quer mudar na vida além da estética, o ponto fraco que ele mesmo admitiu. Traga isso pro texto com as palavras dele, não com rótulo vago.
- CONVERSA COM O MIKE (quando vier o bloco "CONVERSA COM O MIKE"): essa conversa foi com o PRÓPRIO Mike, a mesma pessoa que assina esse documento. Ou seja, é memória de quem está escrevendo: o aluno se abriu ali, muitas vezes com mais honestidade do que no formulário. Use a história, o objetivo, a rotina e as palavras dele desse papo pra personalizar com a mesma força que você usa a anamnese. PORÉM, no documento NUNCA escreva "na nossa conversa", "quando você me falou no chat", "lembra que você disse" nem nada que soe como transcrição; e NUNCA reproduza preço, oferta, objeção de dinheiro ou qualquer parte do processo de venda. Você incorpora o lado humano (objetivo, rotina, frustração, contexto de vida) de forma natural, como quem já conhece a pessoa.
- PROIBIDO pronome solto sem antecedente concreto. Nada de "esse objetivo", "essa situação", "isso que você passou". Diga exatamente qual objetivo, qual situação, o quê. Se a anamnese diz que o fim de semana derruba a dieta, escreva "fim de semana", não "seu ponto fraco".
- Use os números e fatos reais: se a planilha tem 4 treinos, escreva 4. Se a dieta tem mamão e chá verde, cite mamão e chá verde. Se as fotos mostram uma estrutura específica, descreva o que dá pra ver. NÃO invente nada que não esteja nas fontes.
- A pessoa tem que ler e sentir que foi escrito pra ela e só pra ela. Espelhe a história dela de volta antes de mostrar o caminho.

REGRAS DE ESCRITA:
- Pode usar <strong>...</strong> pra destacar termos-chave nos parágrafos e no corpo dos cards. NENHUMA outra tag HTML.
- SEJA CONCISO. Esse documento é curto e direto, não é redação. Cada parágrafo tem no MÁXIMO 2 a 4 frases. Diz o que precisa e PARA. Enrolar e encher linguiça mata o tom Antifofista.
- LIMITE DE TAMANHO (respeite à risca, é o que mantém o layout do PDF intacto): cada lead até ~120 caracteres; cada parágrafo de bem-vindo, treino e dieta até ~320 caracteres; cada parágrafo de objetivo e análise até ~460 caracteres; o fechamento da dieta até ~340 caracteres; cada 'desc' de fase até ~220 caracteres; corpo de card ('b') até ~130 caracteres. Estourar esses limites quebra a margem da página. Na dúvida, escreva MENOS.
- NÃO REPITA. Cada ideia aparece UMA única vez no documento inteiro. Se já citou o fim de semana no objetivo, não volta a citar na dieta com outras palavras. Se já agradeceu na abertura, não agradece de novo. Antes de cada parágrafo, cheque se aquilo já foi dito; se foi, corta. Não reescreva o mesmo conceito em seções diferentes só trocando as palavras.
- Respeite a quantidade exata de parágrafos pedida em cada seção. NUNCA crie parágrafo extra só pra "encher".
- Cards de treino e de dieta (3 de cada): 'k' é um rótulo curto (1 palavra/categoria), 'h' é o destaque (poucas palavras), 'b' é a explicação (1 frase, sem repetir o que já está no parágrafo).
- As 4 fases já têm nome e meses fixos (Adaptação, Construção, Intensificação, Consolidação). Você escreve só a 'desc' de cada uma (1 a 2 frases), na ordem, amarrada ao objetivo e à realidade do aluno.

ESTRUTURA DE CADA SEÇÃO (cada uma tem um trabalho diferente, não repita o trabalho da outra):
- BEM-VINDO: é a abertura mais calorosa do documento, o aperto de mão. Começa AGRADECENDO a confiança pelo primeiro nome, com sinceridade ("obrigado pela confiança, [Nome]. De verdade." / "tô muito feliz de te ter no time"). Par. 1: gratidão + o que mudou no momento em que ele entrou (o objetivo dele virou o nosso, dele e do Lucas). Par. 2: o que ele pode esperar de você e da equipe (compromisso total, cobrança, presença no acompanhamento). Par. 3: o que você espera dele, e que é só chamar no suporte pra qualquer dúvida. É acolhedor e humano antes de ser firme. Cabe UMA pincelada MUITO sutil da dor ou do desejo específico dele (uma menção leve, de passagem, que mostra que você lembra quem ele é), mas NÃO desenvolva: não explique estratégia aqui (isso é do objetivo), não nomeie o ponto fraco por extenso (isso é do objetivo/análise), não cite alimento nem exercício. Se ficar na dúvida entre sutil e demais, vá pro sutil.
- OBJETIVO: a lógica da periodização. Par. 1: onde ele está e pra onde vai (o destino concreto). Par. 2: por que o caminho é esse e não outro, a estratégia da periodização amarrada à realidade e à rotina dele. Par. 3: o obstáculo real dele e como o plano lida com ele. Aqui você nomeia a DOR e o ponto fraco UMA vez e depois não volta nele.
- TREINO: só o treino. Como a planilha foi montada pra rotina e o corpo dele, e o que cada escolha resolve. Cite a divisão real (número de sessões da planilha) e explique que, se treinar mais que isso, segue a sequência e depois da última sessão vira a semana na planilha. As primeiras semanas são pra aprender a executar, técnica antes de carga. A partir daí entra a periodização: progressão controlada de volume e intensidade, com registro de carga, séries e reps. Descanso mínimo de 90 segundos entre séries. Não fale de dieta nem de mindset.
- DIETA: só a dieta. Como ela foi montada priorizando praticidade e aderência à rotina dele, por que esses alimentos reais do plano, e como ela sobrevive ao dia a dia. Se uma refeição não couber, é só avisar que ajusta. Existe uma tabela de substituições enviada junto com o plano (fora deste documento) pra ele variar os alimentos sem sair da estratégia. Não repita o ponto fraco já dito no objetivo com outras palavras.
- ANÁLISE: leitura honesta do ponto de partida (físico pelas fotos + histórico/peso pela anamnese) e o que a estratégia faz com isso. É diagnóstico, não boas-vindas nem motivação.

PROIBIÇÃO ABSOLUTA DE TRAVESSÃO: NUNCA use o caractere travessão ("—" ou "–") em lugar nenhum do documento. É a marca registrada de texto de IA e o Mike não escreve assim. Pra emendar ou explicar uma ideia, use vírgula, ponto, dois-pontos ou abra uma frase nova. Zero travessões. Zero.
NÃO USE (vícios que matam o tom): "real" / "de verdade" como muleta ou adjetivo de reforço; "travar"/"destravar" repetido; a fórmula "não é X, é Y"; aspas em volta de palavras pra dar ênfase (use <strong>); clichê de coach ("foco e fé", "transformação", "a sua melhor versão", "saia da zona de conforto"); a palavra "ciclo" (diga sempre "periodização" ou "os próximos meses").

Escreva tudo chamando a ferramenta 'montar_plano'. Não escreva nada fora da ferramenta.`;

const TOOL: Anthropic.Tool = {
  name: "montar_plano",
  description:
    "Monta o texto personalizado do Plano de Ação do aluno com base nas fontes fornecidas.",
  input_schema: {
    type: "object",
    properties: {
      genero: {
        type: "string",
        enum: ["masculino", "feminino"],
        description:
          "Gênero do aluno, detectado pela anamnese/fotos. Define como o template gendera as palavras fixas (aluno/aluna, bem-vindo/bem-vinda).",
      },
      bemVindo: {
        type: "object",
        description: "Página de boas-vindas. Abre AGRADECENDO a confiança pelo primeiro nome, tom caloroso, humano e de parceria (a equipe inteira junto).",
        properties: {
          lead: { type: "string", maxLength: 120, description: "Frase de abertura calorosa que agradece a confiança e cita o primeiro nome, ex: 'Antes de tudo, obrigado pela confiança, [Nome]. De verdade.' (até ~120 caracteres)." },
          paragraphs: {
            type: "array",
            items: { type: "string", maxLength: 320 },
            description: "Exatamente 3 parágrafos curtos de boas-vindas (2 a 3 frases cada, até ~320 caracteres cada).",
          },
        },
        required: ["lead", "paragraphs"],
      },
      objetivo: {
        type: "object",
        description: "Página do objetivo e lógica da periodização.",
        properties: {
          lead: { type: "string", maxLength: 120, description: "Frase que resume a lógica da periodização dos próximos meses (até ~120 caracteres)." },
          paragraphs: {
            type: "array",
            items: { type: "string", maxLength: 460 },
            description: "Exatamente 3 parágrafos curtos explicando a estratégia personalizada (2 a 4 frases cada, até ~460 caracteres cada).",
          },
        },
        required: ["lead", "paragraphs"],
      },
      treino: {
        type: "object",
        description: "O que foi feito no treino.",
        properties: {
          paragraphs: {
            type: "array",
            items: { type: "string", maxLength: 320 },
            description: "Exatamente 3 parágrafos curtos sobre a estrutura do treino, 2 a 3 frases cada, até ~320 caracteres cada (use <strong>).",
          },
          cards: {
            type: "array",
            description: "Exatamente 3 cards de destaque do treino.",
            items: {
              type: "object",
              properties: {
                k: { type: "string", maxLength: 24, description: "Rótulo curto, ex: 'Frequência'." },
                h: { type: "string", maxLength: 40, description: "Destaque, ex: '4x na semana'." },
                b: { type: "string", maxLength: 130, description: "Explicação 1-2 frases, até ~130 caracteres." },
              },
              required: ["k", "h", "b"],
            },
          },
        },
        required: ["paragraphs", "cards"],
      },
      dieta: {
        type: "object",
        description: "O que foi feito na dieta.",
        properties: {
          paragraphs: {
            type: "array",
            items: { type: "string", maxLength: 320 },
            description: "Exatamente 2 parágrafos curtos sobre a estrutura da dieta, 2 a 3 frases cada, até ~320 caracteres cada (use <strong>).",
          },
          cards: {
            type: "array",
            description: "Exatamente 3 cards de destaque da dieta (alimentos/estratégias reais do plano).",
            items: {
              type: "object",
              properties: {
                k: { type: "string", maxLength: 24, description: "Rótulo curto, ex: 'Fruta'." },
                h: { type: "string", maxLength: 40, description: "Destaque, ex: 'Mamão'." },
                b: { type: "string", maxLength: 130, description: "Explicação 1-2 frases, até ~130 caracteres." },
              },
              required: ["k", "h", "b"],
            },
          },
          closing: {
            type: "string",
            maxLength: 340,
            description:
              "Parágrafo final da dieta (até ~340 caracteres): reforça que o plano é ajustável (se uma refeição não couber, é só avisar que ajusta) e que existe uma tabela de substituições enviada junto com o plano pra variar os alimentos, além da refeição livre semanal como válvula de escape. NÃO diga 'logo abaixo' nem 'próxima página'. Pode usar <strong>.",
          },
        },
        required: ["paragraphs", "cards", "closing"],
      },
      analise: {
        type: "object",
        description:
          "Análise do físico a partir das fotos e da anamnese. SEMPRE preencha os 3 parágrafos, mesmo que não haja fotos: nesse caso baseie a análise no histórico, peso, rotina e queixas da anamnese.",
        properties: {
          paragraphs: {
            type: "array",
            items: { type: "string", maxLength: 460 },
            description:
              "Exatamente 3 parágrafos curtos analisando o físico/ponto de partida e a estratégia, 2 a 3 frases cada, até ~460 caracteres cada. Fale SEMPRE em segunda pessoa ('você chega com...', 'o seu ponto de partida'), NUNCA na terceira ('o Rafael chega', 'a vida dele'). Nunca deixe vazio.",
          },
        },
        required: ["paragraphs"],
      },
      fases: {
        type: "array",
        description:
          "Exatamente 4 descrições, na ordem: Adaptação, Construção, Intensificação, Consolidação.",
        items: {
          type: "object",
          properties: {
            desc: { type: "string", maxLength: 220, description: "Descrição personalizada da fase (1 a 2 frases, até ~220 caracteres)." },
          },
          required: ["desc"],
        },
      },
    },
    required: ["bemVindo", "objetivo", "treino", "dieta", "analise", "fases"],
  },
};

export type GenerateInputs = {
  alunoNome: string;
  cicloMeses: number;
  anamnesePdf: Buffer; // anamnese do aluno em PDF
  treinoPdf?: Buffer; // planilha de treino (fonte PDF, fluxo standalone)
  dietaPdf?: Buffer; // planilha de dieta (fonte PDF, fluxo standalone)
  treinoTexto?: string; // treino já estruturado em texto (fluxo Hub, reaproveita o JSON). Tem prioridade sobre treinoPdf.
  dietaTexto?: string; // dieta já estruturada em texto (fluxo Hub, reaproveita o JSON). Tem prioridade sobre dietaPdf.
  fotos?: { frente?: Buffer; lado?: Buffer; costas?: Buffer };
  salesContext?: string; // contexto condensado da conversa de vendas (via telefone → Supabase)
  diaFeedback?: string; // dia do acompanhamento quinzenal, ex: "quarta-feira"
};

function pdfBlock(buf: Buffer): Anthropic.DocumentBlockParam {
  return {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: buf.toString("base64") },
  };
}

function imgBlock(buf: Buffer): Anthropic.ImageBlockParam {
  return {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: buf.toString("base64") },
  };
}

export async function generateCopy(inputs: GenerateInputs): Promise<GeneratedCopy> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY não configurada.");
  const client = new Anthropic({ apiKey });

  const content: Anthropic.ContentBlockParam[] = [
    {
      type: "text",
      text: `Aluno: ${inputs.alunoNome}\nCiclo: ${inputs.cicloMeses} meses\n\nAnamnese do aluno em PDF (leia com atenção: é daqui que você tira a DOR, o objetivo, a rotina e os pontos fracos pra personalizar o plano):`,
    },
    pdfBlock(inputs.anamnesePdf),
  ];

  // Treino/dieta: prefira o texto estruturado (vem do Hub, já parseado do XLSX);
  // caia pro PDF só no fluxo standalone do gerador.
  if (inputs.treinoTexto?.trim()) {
    content.push({ type: "text", text: `Planilha de TREINO (estruturada):\n\n${inputs.treinoTexto.trim()}` });
  } else if (inputs.treinoPdf) {
    content.push({ type: "text", text: "Planilha de TREINO em PDF:" });
    content.push(pdfBlock(inputs.treinoPdf));
  }
  if (inputs.dietaTexto?.trim()) {
    content.push({ type: "text", text: `Planilha de DIETA (estruturada):\n\n${inputs.dietaTexto.trim()}` });
  } else if (inputs.dietaPdf) {
    content.push({ type: "text", text: "Planilha de DIETA em PDF:" });
    content.push(pdfBlock(inputs.dietaPdf));
  }
  if (inputs.salesContext) {
    content.push({
      type: "text",
      text:
        "CONVERSA COM O MIKE (o que o aluno falou direto com o Mike, a mesma pessoa que assina esse documento, antes de fechar. É fonte de personalização TÃO importante quanto a anamnese: use a história, o objetivo e as palavras dele pra escrever, mas NÃO cite que existiu uma conversa nem mencione preço/oferta/objeção):\n\n" +
        inputs.salesContext,
    });
  }

  const fotos = inputs.fotos;
  if (fotos?.frente || fotos?.lado || fotos?.costas) {
    content.push({ type: "text", text: "Fotos do físico (frente, lado, costas):" });
    if (fotos.frente) content.push(imgBlock(fotos.frente));
    if (fotos.lado) content.push(imgBlock(fotos.lado));
    if (fotos.costas) content.push(imgBlock(fotos.costas));
  }

  content.push({
    type: "text",
    text: `Escreva o Plano de Ação personalizado para ${inputs.alunoNome} chamando a ferramenta montar_plano.`,
  });

  const res = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    system: [{ type: "text", text: SYSTEM, cache_control: { type: "ephemeral" } }],
    tools: [TOOL],
    tool_choice: { type: "tool", name: "montar_plano" },
    messages: [{ role: "user", content }],
  });

  const toolUse = res.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
  );
  if (!toolUse) throw new Error("Claude não retornou o plano estruturado.");
  return sanitizeCopy(toolUse.input as GeneratedCopy);
}

// Hard guarantee: no travessão ever reaches the document, even if the model
// slips one in despite the system prompt. Replaces em/en dashes (and the common
// " — " emenda pattern) with a comma or plain hyphen, and collapses any double
// spaces left behind. Recurses through every string in the copy object.
function stripDashes(s: string): string {
  return s
    .replace(/\s*[—–]\s*/g, ", ") // " word — word " → " word, word "
    .replace(/,\s*,/g, ",")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function deepSanitize<T>(v: T): T {
  if (typeof v === "string") return stripDashes(v) as unknown as T;
  if (Array.isArray(v)) return v.map(deepSanitize) as unknown as T;
  if (v && typeof v === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, val] of Object.entries(v)) out[k] = deepSanitize(val);
    return out as T;
  }
  return v;
}

function sanitizeCopy(copy: GeneratedCopy): GeneratedCopy {
  return deepSanitize(copy);
}

function dataUri(buf?: Buffer): string | undefined {
  return buf ? `data:image/jpeg;base64,${buf.toString("base64")}` : undefined;
}

// Merge Claude's copy + fixed scaffolding + form data into a full PlanData.
// Claude's tool output is an untrusted boundary: a field may be missing even
// when the schema marks it required, so normalize before rendering.
export function buildPlanData(
  copy: GeneratedCopy,
  inputs: GenerateInputs,
): PlanData {
  const arr = <T,>(x: T[] | undefined): T[] => (Array.isArray(x) ? x : []);
  const str = (x: string | undefined): string => (typeof x === "string" ? x : "");

  const fotos: Fotos = {
    frente: dataUri(inputs.fotos?.frente),
    lado: dataUri(inputs.fotos?.lado),
    costas: dataUri(inputs.fotos?.costas),
  };

  const fases = DEFAULT_FASES.map((f, i) => ({
    ...f,
    desc: copy.fases?.[i]?.desc ?? f.desc,
  }));

  const genero = copy.genero === "masculino" || copy.genero === "feminino" ? copy.genero : undefined;

  return {
    alunoNome: inputs.alunoNome,
    cicloMeses: inputs.cicloMeses,
    genero,
    diaFeedback: inputs.diaFeedback,
    bemVindo: { lead: str(copy.bemVindo?.lead), paragraphs: arr(copy.bemVindo?.paragraphs) },
    objetivo: { lead: str(copy.objetivo?.lead), paragraphs: arr(copy.objetivo?.paragraphs) },
    treino: { paragraphs: arr(copy.treino?.paragraphs), cards: arr(copy.treino?.cards) },
    dieta: {
      paragraphs: arr(copy.dieta?.paragraphs),
      cards: arr(copy.dieta?.cards),
      closing: str(copy.dieta?.closing),
    },
    analise: { paragraphs: arr(copy.analise?.paragraphs), fotos },
    fases,
  };
}
