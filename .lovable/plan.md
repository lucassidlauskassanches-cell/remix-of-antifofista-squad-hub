
## 1. PDF do Plano de Ação sai com texto cortado

### Diagnóstico

O gerador funciona assim: `PlanoEditor` abre uma janela nova com o HTML final, roda `autoFit()` para escolher um `--s` (escala de fonte/paddings de cada página `.autofit`) e chama `window.print()`. Cada `.page` tem `overflow: hidden` — se o conteúdo passar do slot, ele é engolido em silêncio, exatamente o sintoma do usuário.

O `autoFit` (`src/lib/plano/autofit.ts`) mede a altura do conteúdo com um loop de `getBoundingClientRect()` sobre os filhos diretos de `.body`. Dois problemas nesse método:

1. **Ignora margens colapsadas.** Cada `<p class="tx">` tem `margin: 0 0 calc(16px * var(--s))`. `getBoundingClientRect` devolve só a caixa de conteúdo, não a margem — então a altura total real (com as margens somadas entre parágrafos) é sempre maior que `bottom - top` medido. Resultado: autoFit acredita que cabe, imprime, e o rodapé come as últimas 1–2 linhas.
2. **Ignora `margin-top` do primeiro filho / `margin-bottom` do último.** A página 03 tem `<div class="stmt" style="margin-top:30px">`; esses 30px somem da conta. Nas páginas de cards, os `margin-top:18px`/`margin-top:22px` embaixo dos blocos também somem.
3. Fator de segurança `0.985` é apertado demais — qualquer sub-pixel de arredondamento do Chrome joga o layout para fora do slot no print (o print engine não é pixel-idêntico ao screen).

Impressão de fontes está OK — o código já espera `document.fonts.ready` antes de rodar o autoFit.

### Correção

Reescrever a medição em `autofit.ts`:

- Trocar o loop por `body.scrollHeight` — o browser já faz a soma correta de margens verticais e considera qualquer overflow.
- Reforçar o `available = body.clientHeight * 0.96` (folga de ~4%) para absorver arredondamento de print.
- Baixar o teto de `hi` de `1.28` para `1.15` (nunca queremos que as fontes cresçam demais nas páginas curtas — o objetivo é caber, não inflar).
- Manter o piso `0.42` (páginas densas como a de acompanhamento precisam disso).

Duas melhorias defensivas no template (`src/lib/plano/template/styles.ts`):

- Trocar `overflow: hidden` em `.page` por `overflow: clip` só na tela e nada no print (`@media print { .page { overflow: visible } }`), para que, se algum dia sobrar 1–2 linhas, elas ainda apareçam em vez de sumirem em silêncio.
- Reduzir a margem inferior padrão do `p.tx` de `16px` para `14px` para melhorar o encaixe nas páginas mais densas (treino, dieta, acompanhamento).

Também adicionar um `console.warn` em desenvolvimento quando o binary-search bater no piso — sinal de que aquela página está pedindo edição manual.

### Como valido

Depois do fix, gerar um PDF de teste (pelo próprio fluxo do editor), converter cada página para JPG com `pdftoppm -jpeg -r 150` e conferir visualmente:
- página 03 (Bem-vindo) — bloco `Bora pra cima?` inteiro visível;
- página 05 (Treino) — grid de 3 cards + parágrafos sem clip embaixo;
- página 07 (Dieta) — parágrafo de fechamento + refeição livre inteiros;
- página 10 (Acompanhamento) — os 5 itens numerados + disclaimer sem corte.

## 2. Troca do vermelho por dourado (paleta global)

Único ponto de verdade: `src/styles.css`. Todos os componentes já usam tokens (`--primary`, `--red-2`, `--grad`), então basta reescrever os valores.

- `--primary` → dourado (~`oklch(0.78 0.16 82)`), `--primary-foreground` preto para contraste.
- `--destructive` e `--urgent` continuam vermelhos (erro / sair ainda precisam de sinal de alerta).
- `--ring` → dourado suave.
- `--red-2` → `#e6b64c` (mantém o nome para não churn; comentário `/* legado: dourado */`).
- `--grad` → `linear-gradient(135deg, #8a6a1a 0%, #e6b64c 100%)`.
- Overlays `rgba(194,0,21,…)` (`.af-wk.on`, `.af-alt.on`, thumb da galeria, `.af-ex--active`) trocados por tons dourados equivalentes.

Fora do escopo desta rodada: mudar a paleta do próprio Plano de Ação (`template/styles.ts`) — ele é preto & branco, sem acento vermelho relevante.

## 3. Renomear S1/S2 para "Semana N"

Problema: "S1" é jargão. Solução sem quebrar o strip compacto:

- Label pequeno acima do strip: "SEMANA".
- Chip inativo mostra só o número (`1`, `2`, `3`…). Chip ativo mostra "Semana N" completo.
- Cabeçalhos da view "planilha" (colunas) usam `Semana 1`, `Semana 2` etc.

Em `app.treino.index.tsx`: `shortWeek()` vira `weekNumber()` + `weekLabel()`.

## 4. Logbook em tempo real — novo fluxo

Problemas atuais:
- Card "REGISTRAR CARGA" tracejado + inputs empilhados ocupam meia tela por exercício.
- Ao editar, o card empurra o resto da lista para fora da viewport.
- "Última: X × Y · dd/mm" e "editar carga · X × Y" repetem info nos dois estados.
- Checkmark + opacidade + borda vermelha ao ativo = três estados visuais competindo.

Novo fluxo (mesmo arquivo, sem tocar backend):
- Cada exercício mostra um chip discreto colado à linha de métricas: `— · registrar` (vazio) ou `72 kg × 10` dourado (registrado hoje). Toque abre inputs.
- Inputs aparecem numa faixa compacta abaixo (2 campos + botão dourado com check), sem borda tracejada. Enter salva. Salvar mantém a posição do scroll.
- Sem mais estado "opacidade+check" para exercício feito — o chip preenchido já comunica.
- "Cancelar" some — clicar no chip de novo, clicar fora ou Esc fecha.
- Legenda de 1 linha só quando fechado e há histórico anterior: `↳ semana passada: 70 × 10`.

CSS: substituir `.af-log*`, `.af-regbtn`, `.af-cancelbtn`, `.af-ex--active`, `.af-ex--done` por um bloco novo `.af-log`.

## 5. Remover "marcar refeição como feita"

Em `app.nutricional.index.tsx`: fora `Checkbox`, `checked` state, `storageKey`, `toggle`, `line-through`, `opacity-60`. Título da refeição volta a ser texto simples.

## 6. Treinador: só planilha, sem PDF (treino e dieta)

Em `src/routes/_authenticated/app.admin.alunos.$id.tsx`: remover `PdfUploader` das abas `treino` e `nutricao`. Manter apenas `StructuredPlanSection` e `DietSection`.

Aba `acao` continua com PDF (é o caminho hoje pro plano de ação, e o próprio ponto 1 acabou de arrumar).

Backend (bucket `plans`, colunas `pdf_path`/`pdf_name`, server functions) fica intocado nesta rodada — se algum aluno ainda tiver PDF antigo salvo, o botão "Ver em planilha" continua funcionando até você mandar remover.

No lado do aluno (`app.treino.index.tsx` / `app.nutricional.index.tsx`): botão "Ver em planilha" só aparece se `pdf_path` existir.

## 7. Correções UX pontuais (varredura)

- **Hydration mismatch em `/auth`** (aparece nos runtime errors): página está renderizando conteúdo client-only durante SSR. Envolver a leitura de `sessionStorage`/`localStorage` de recuperação em check de `mounted` para eliminar o warning.
- **Aluno — evolução**: header (eyebrow + subtítulo + lead) ocupa 3 linhas; encolher para eyebrow + título só, alinhado com as outras abas.
- **Aluno — dieta**: esconder toggle "planilha" quando `refeicoes.length === 0`.
- **Admin — visão geral**: estado vazio decente ("nenhum aluno") por treinador sem alunos.

Nada disso altera schema ou policies.

## 8. Fora de escopo (confirmo antes se quiser mexer)

- Remover bucket `plans` e colunas `pdf_path`/`pdf_name` dos schemas de treino/dieta.
- Motor de PDF servidor-side (puppeteer/edge) para o Plano de Ação em vez de `window.print()`.
- Notificações / lembretes.

---

### Arquivos a tocar

- `src/lib/plano/autofit.ts` — trocar medição para `body.scrollHeight`, folga 0.96, teto 1.15.
- `src/lib/plano/template/styles.ts` — `overflow: clip` (screen) + `overflow: visible` (print), margem `p.tx` reduzida.
- `src/styles.css` — dourado + refactor `.af-log*` + `.af-wk-label`.
- `src/routes/_authenticated/app.treino.index.tsx` — novo fluxo de registro + `weekNumber`/`weekLabel`.
- `src/routes/_authenticated/app.nutricional.index.tsx` — remover checkbox + toggle condicional.
- `src/routes/_authenticated/app.admin.alunos.$id.tsx` — sem `PdfUploader` em treino/nutrição.
- `src/routes/_authenticated/app.logbook.tsx` — header enxuto.
- `src/routes/_authenticated/app.admin.visao.tsx` — empty state.
- `src/routes/auth.tsx` — fix hydration mismatch.
