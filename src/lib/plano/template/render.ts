import { LAYOUT_CSS } from "./styles";
import { LOGO_URI, COVER_URI } from "./brand-assets";
import type { Card, PlanData } from "./types";

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Render options. `editable` turns the document into an in-place WYSIWYG editor:
// each authored text node gets contenteditable + a data-path that maps it back to
// the PlanData field, plus a tiny "remove paragraph" affordance. None of this is
// emitted in the PDF path (renderPlanoHtml is called without opts there), so the
// exported PDF is byte-for-byte identical to before.
type RenderOpts = { editable?: boolean };

// Build the contenteditable/data-path attribute string for an editable field.
// `rich` fields are read back via innerHTML (to preserve intentional <strong>),
// plain ones via textContent.
function ed(opts: RenderOpts, path: string, rich = false): string {
  if (!opts.editable) return "";
  return ` contenteditable="true" data-path="${path}"${rich ? ' data-rich="1"' : ""}`;
}

// Long-form fields (paragraphs, card bodies, phase descriptions) are authored by
// trainers/AI and may contain intentional <strong> emphasis — passed through as HTML.
// In editable mode each paragraph is addressable as `${basePath}.${index}` and gets
// an absolutely-positioned ✕ (out of flow, so it never disturbs the autofit measure
// or the PDF layout).
function paras(items: string[], basePath: string, opts: RenderOpts, cls = "tx"): string {
  return items
    .map((p, i) => {
      const path = `${basePath}.${i}`;
      if (!opts.editable) return `<p class="${cls}">${p}</p>`;
      const x = `<button class="ed-x" type="button" contenteditable="false" data-action="del" data-path="${path}" title="Remover parágrafo">✕</button>`;
      return `<p class="${cls} ed-p"${ed(opts, path, true)}>${p}${x}</p>`;
    })
    .join("\n");
}

function cards(items: Card[], basePath: string, opts: RenderOpts): string {
  return items
    .map(
      (c, i) => `<div class="card">
          <span class="k"${ed(opts, `${basePath}.${i}.k`)}>${esc(c.k)}</span>
          <div class="h"${ed(opts, `${basePath}.${i}.h`)}>${esc(c.h)}</div>
          <div class="b"${ed(opts, `${basePath}.${i}.b`, true)}>${c.b}</div>
        </div>`,
    )
    .join("\n");
}

// Edit-only chrome: focus rings on editable nodes + the floating remove button.
// Appended after the layout CSS only when editable, so it never reaches the PDF.
const EDIT_CSS = `
[contenteditable="true"]{ outline:none; border-radius:3px; transition:background .12s, box-shadow .12s; }
[contenteditable="true"]:hover{ box-shadow:0 0 0 1px rgba(245,116,38,.4); }
[contenteditable="true"]:focus{ box-shadow:0 0 0 2px rgba(245,116,38,.9); background:rgba(245,116,38,.06); }
.ed-p{ position:relative; }
.ed-x{ position:absolute; top:1px; right:-28px; width:20px; height:20px; line-height:18px; text-align:center;
  border:none; border-radius:50%; background:#262626; color:#bbb; font:600 11px/18px Inter,sans-serif;
  cursor:pointer; opacity:0; transition:opacity .12s, background .12s, color .12s; padding:0; z-index:5; }
.ed-p:hover .ed-x{ opacity:1; }
.ed-x:hover{ background:#f57426; color:#000; }`;

function shot(label: string, uri?: string): string {
  if (uri) {
    return `<div class="shot"><img src="${uri}" alt="${esc(label)}"><span class="tag">${esc(label)}</span></div>`;
  }
  return `<div class="shot"><svg class="ic" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="9" r="1.8"></circle><path d="M21 16l-5-5L5 21"></path></svg><span class="lb">${esc(label)}</span><span class="no">Foto do aluno</span></div>`;
}

const FONTS_HEAD = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&family=Oswald:wght@500;600;700&display=swap" rel="stylesheet">`;

export function renderPlanoHtml(data: PlanData, opts: RenderOpts = {}): string {
  const css = LAYOUT_CSS.replace(/__LOGO__/g, LOGO_URI)
    .replace(/__COVER__/g, COVER_URI);

  const nome = esc(data.alunoNome);
  const meses = data.cicloMeses || 12;
  const fem = data.genero === "feminino";
  const alunoLabel = fem ? "Aluna" : "Aluno";
  const bemVindoLabel = fem ? "Bem-vinda ao Squad" : "Bem-vindo ao Squad";
  const diaFeedback = esc(data.diaFeedback?.trim() || "quarta-feira");

  const body = `
<div class="doc">

  <!-- 01 CAPA -->
  <section class="page">
    <div class="cover-photo"></div>
    <div class="cover-fade"></div>
    <div class="cover-top"><div class="cover-logo" role="img" aria-label="Antifofista Squad"></div></div>
    <div class="cover-mid">
      <span class="cover-kick">Antifofista Squad · Plano individual</span>
      <h1 class="cover-title">Plano<br>de Ação</h1>
      <div class="cover-rule"></div>
      <p class="cover-sub">Neste documento explicamos os bastidores do seu treino, da sua dieta e o caminho que a gente vai trilhar nos próximos ${meses} meses. Leia com atenção.</p>
    </div>
    <div class="cover-aluno">
      <div class="ic"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"></circle><path d="M4 21c0-4 3.5-7 8-7s8 3 8 7"></path></svg></div>
      <div><div class="k">${alunoLabel}</div><div class="n"${ed(opts, "alunoNome")}>${nome}</div></div>
    </div>
  </section>

  <!-- 02 MANIFESTO -->
  <section class="page">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Manifesto · 02</div></div>
      <div class="mani">
        <p>Ser Antifofista nunca foi só sobre treino. É uma escolha diária em dar tudo de si, não se contentar com o pouco, nunca se doar ao mínimo.</p>
        <p>Ser maior que o mundo te colocou. Ser maior que a multidão. Se esforçar e conquistar tudo o que o mundo pode te oferecer.</p>
        <p>Tudo começou entre barras, ferros e cabos, mas me moldou para a vida. Sempre foi sobre esforço, sobre a intensidade que você coloca, sobre a dedicação.</p>
        <p>Ninguém pode mais do que eu. Ninguém consegue fazer o que eu faço. Ninguém vai chegar onde eu me propus. Me propus o mundo todo, e nem mesmo o céu é o limite.</p>
        <p class="end">Sou Antifofista.</p>
      </div>
      <div class="foot"><span>Manifesto</span><span>02 / 10</span></div>
    </div>
  </section>

  <!-- 03 BEM-VINDO -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Plano de Ação · 03</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">${bemVindoLabel}</span><span class="line"></span></div>
      <div class="body">
      <p class="tx lead"${ed(opts, "bemVindo.lead", true)}>${data.bemVindo.lead}</p>
      ${paras(data.bemVindo.paragraphs, "bemVindo.paragraphs", opts)}
      <div class="stmt" style="flex:0; margin-top:30px;"><div class="big">Bora<br><span class="out">pra cima?</span></div></div>
      </div>
      <div class="foot"><span>${bemVindoLabel}</span><span>03 / 10</span></div>
    </div>
  </section>

  <!-- 04 OBJETIVO -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Análise · 04</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">Objetivo</span><span class="line"></span></div>
      <div class="body">
      <p class="tx lead"${ed(opts, "objetivo.lead", true)}>${data.objetivo.lead}</p>
      ${paras(data.objetivo.paragraphs, "objetivo.paragraphs", opts)}
      </div>
      <div class="foot"><span>Objetivo · Próximos ${meses} meses</span><span>04 / 10</span></div>
    </div>
  </section>

  <!-- 05 TREINO -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">O que foi feito · 05</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">O que foi feito · Treino</span><span class="line"></span></div>
      <div class="body">
      ${paras(data.treino.paragraphs, "treino.paragraphs", opts)}
      <div class="subh"><span class="bar"></span><h3>As regras do seu treino</h3></div>
      <div class="g3">${cards(data.treino.cards, "treino.cards", opts)}</div>
      </div>
      <div class="foot"><span>O que foi feito · Treino</span><span>05 / 10</span></div>
    </div>
  </section>

  <!-- 06 COMO EXECUTAR O TREINO (fixo) -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Como executar · 06</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">Como executar seu treino</span><span class="line"></span></div>
      <div class="body">
      <div class="subh"><span class="bar"></span><h3>Executando o seu treino</h3></div>
      <p class="tx">No primeiro exercício do treino, você deve realizar uma série de aquecimento com <strong>30% da carga</strong> que usaria nas séries válidas, entre 10 e 15 repetições, longe da falha. Após isso, é possível adicionar uma ou duas séries de reconhecimento de carga (<strong>feeder sets</strong>) para encontrar a carga de trabalho ideal — essas séries devem ter no máximo 5 repetições, e muito longe da falha. Nos exercícios seguintes, uma ou duas feeder sets por exercício também podem ser usadas. As séries de aquecimento e as feeder sets <strong>não contam como séries válidas</strong>.</p>
      <p class="tx">As séries que aparecem na sua planilha de treino são as <strong>séries válidas</strong>: são elas que devem ser executadas com a carga adequada para o range de repetições proposto.</p>
      <div class="subh"><span class="bar"></span><h3>Entendendo o range de repetições</h3></div>
      <p class="tx">O range indica o intervalo dentro do qual você deve trabalhar. Por exemplo: <strong>5 a 9 repetições</strong> significa escolher uma carga com a qual você consiga fazer no mínimo 5 e no máximo 9. Se completar as 9, aumente a carga na próxima série. Se já na primeira série você atingir o mínimo do range (no exemplo, 5), aumente o tempo de descanso entre as séries ou reduza levemente a carga — caso contrário, não dá pra manter a mesma carga em todas as séries do exercício.</p>
      <div class="subh"><span class="bar"></span><h3>Repetições na reserva</h3></div>
      <p class="tx">O plano é estruturado pra você <strong>não atingir a falha máxima</strong> em nenhum exercício, salvo quando houver observação específica (como num back off set). Em todos os demais, deixe zero ou uma repetição na reserva:</p>
      <p class="tx"><strong>Zero na reserva:</strong> você completou a última repetição de forma limpa, mas não conseguiria mais uma completa. <strong>Uma na reserva:</strong> você ainda conseguiria fazer mais uma repetição completa. <strong>Falha:</strong> você não conseguiu completar a repetição.</p>
      <div class="subh"><span class="bar"></span><h3>Padrões de movimento</h3></div>
      <p class="tx">Todas as execuções devem ser limpas e tecnicamente corretas, independentemente da carga ou da proximidade da falha. A qualidade do movimento é uma constante — ela nunca deve ser comprometida.</p>
      <div class="subh"><span class="bar"></span><h3>Descanso entre as séries</h3></div>
      <p class="tx">Use no <strong>mínimo 90 segundos</strong> de descanso entre as séries, podendo chegar até 5 minutos se necessário.</p>
      </div>
      <div class="foot"><span>Como executar seu treino</span><span>06 / 10</span></div>
    </div>
  </section>

  <!-- 07 DIETA -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">O que foi feito · 07</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">O que foi feito · Dieta</span><span class="line"></span></div>
      <div class="body">
      ${paras(data.dieta.paragraphs, "dieta.paragraphs", opts)}
      <div class="subh"><span class="bar"></span><h3>Por que isso está na sua dieta</h3></div>
      <div class="g3" style="margin-bottom:8px;">${cards(data.dieta.cards, "dieta.cards", opts)}</div>
      <p class="tx" style="margin-top:18px;"${ed(opts, "dieta.closing", true)}>${data.dieta.closing}</p>
      <div class="subh"><span class="bar"></span><h3>Refeição livre</h3></div>
      <div class="g2">
        <div class="card">
          <span class="k">Como funciona</span>
          <div class="h">1x por semana</div>
          <div class="b">Você troca <strong>2 refeições</strong> da dieta pela refeição livre, uma principal e uma intermediária (ex. lanche da tarde e jantar). Aproveite o momento, mas sem exagerar.</div>
        </div>
        <div class="card">
          <span class="k">A regra</span>
          <div class="h">Substitui, não soma</div>
          <div class="b">A refeição livre toma o lugar das <strong>duas refeições</strong>, não entra além delas. E é uma refeição, não um dia inteiro.</div>
        </div>
      </div>
      </div>
      <div class="foot"><span>O que foi feito · Dieta</span><span>07 / 10</span></div>
    </div>
  </section>

  <!-- 08 ANÁLISE DE FÍSICO -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Análise · 08</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">Análise de físico</span><span class="line"></span></div>
      <div class="body">
      <div class="shots">
        ${shot("Frente", data.analise.fotos.frente)}
        ${shot("Lado", data.analise.fotos.lado)}
        ${shot("Costas", data.analise.fotos.costas)}
      </div>
      ${paras(data.analise.paragraphs, "analise.paragraphs", opts)}
      </div>
      <div class="foot"><span>Análise de físico</span><span>08 / 10</span></div>
    </div>
  </section>

  <!-- 09 AS FASES -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Projeto · 09</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">As fases do seu projeto</span><span class="line"></span></div>
      <div class="body">
      ${data.fases
        .map(
          (f, i) => `<div class="phase">
        <div class="num">${esc(f.num)}</div>
        <div>
          <span class="pk">${esc(f.tag)}</span>
          <div class="pn">${esc(f.name)}</div>
          <div class="po"${ed(opts, `fases.${i}.desc`, true)}>${f.desc}</div>
        </div>
        <div class="mo">${f.months.map(esc).join("<br>")}</div>
      </div>`,
        )
        .join("\n")}
      </div>
      <div class="foot"><span>As fases do seu projeto</span><span>09 / 10</span></div>
    </div>
  </section>

  <!-- 10 ACOMPANHAMENTO (fixo) -->
  <section class="page autofit">
    <div class="frame">
      <div class="runhead"><div class="l"><span class="mk"></span>Antifofista Squad</div><div class="r">Regras · 10</div></div>
      <div class="sec"><span class="sq"></span><span class="badge">Acompanhamento &amp; observações</span><span class="line"></span></div>
      <div class="body">
      <p class="tx">A cada <strong>15 dias, na ${diaFeedback}</strong>, você vai enviar fotos em jejum ao acordar (no mesmo padrão das primeiras que mandou) junto com um relatório de como está sendo a semana. É esse acompanhamento de perto que permite ajustar antes que qualquer problema vire obstáculo. Quanto mais detalhe você der, mais preciso fica o ajuste. Os feedbacks são <strong>de sua responsabilidade</strong> e devem ser preenchidos no formulário que vou enviar fora desse documento.</p>
      <ol class="num">
        <li><div><div class="h">Dúvida, nos chame na hora</div><div class="d">Pode tirar todas as suas dúvidas aqui pelo WhatsApp, a gente sempre responde assim que possível. Dúvida na execução de algum exercício: filma e manda aqui.</div></div></li>
        <li><div><div class="h">Hidratação não é um simples detalhe</div><div class="d">Bater a meta de água todo dia. Faz parte da dieta tanto quanto a comida.</div></div></li>
        <li><div><div class="h">Cuidado na refeição livre</div><div class="d">Siga a regra, sem exagero. Uma refeição descontrolada apaga o resultado da semana inteira.</div></div></li>
        <li><div><div class="h">Durma 7 a 8h</div><div class="d">Se der, antes das 23h. É no sono que a gente constrói o que o treino estimulou.</div></div></li>
        <li><div><div class="h">Bateu desânimo, chama a gente</div><div class="d">A gente não tá aqui só pra entregar treino e dieta. Tá aqui pra te segurar e te fazer chegar. Agora você é da família, a Família Antifofista.</div></div></li>
      </ol>
      <div class="disc" style="margin-top:22px;">
        <div class="st"><svg viewBox="0 0 24 24"><path d="M12 2l2.9 6.3 6.9.7-5.1 4.6 1.4 6.8L12 17.8 5.9 21.2l1.4-6.8L2.2 9.8l6.9-.7z"></path></svg></div>
        <div class="b">As metas do seu plano são uma <strong>projeção</strong>, considerando 100% de cumprimento do treino e da dieta. Elas podem mudar com o tempo conforme o seu comprometimento, a resposta do seu corpo e as necessidades que surgirem no caminho.</div>
      </div>
      </div>
      <div class="foot"><span>Acompanhamento &amp; observações</span><span>10 / 10</span></div>
    </div>
  </section>

  <!-- 11 CLOSER -->
  <section class="page">
    <div class="closer">
      <div class="mk"></div>
      <div class="dash"><span></span><span class="d"></span><span></span></div>
      <div class="bora">Bora,<br><span class="out">${nome.split(" ")[0]}.</span></div>
      <div class="sub">Antifofista Squad · Not for everyone</div>
    </div>
  </section>

</div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Plano de Ação · Antifofista Squad · ${nome}</title>
${FONTS_HEAD}
<style>${css}${opts.editable ? EDIT_CSS : ""}</style>
</head>
<body>${body}</body>
</html>`;
}
