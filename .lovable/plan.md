## Diagnóstico

O PDF é gerado via `window.open` + `window.print()` (Chrome "Salvar como PDF") em `src/components/PlanoEditor.tsx`. Dois problemas encontrados:

**1. Fonte diferente do preview**
O código chama `document.fonts.ready` na nova aba, mas quando esse Promise é lido a folha do Google Fonts (`<link>`) muitas vezes ainda nem foi parseada — então `fonts.ready` resolve *antes* de Oswald/Inter/JetBrains Mono começarem a baixar. `autoFit()` mede com a fonte fallback (Times/Arial) e a impressão sai com a fonte fallback também, o que muda todo o visual.

**2. Texto cortado no final das páginas**
Como `autoFit` mede com a fonte errada (mais estreita/curta), calcula uma escala `--s` otimista. Quando o Chrome finalmente aplica Oswald/Inter na hora do print, o conteúdo cresce ~5–8% e estoura o `.page { overflow: clip }`, cortando as últimas linhas. O plano antigo cabia porque tinha menos texto — o novo não.

## Correções

### `src/components/PlanoEditor.tsx` — `downloadPdf`
1. Trocar a espera "cega" por `document.fonts.ready` por:
   - aguardar o `<link>` do Google Fonts disparar `load` (Promise resolvida no `onload` do link);
   - chamar `document.fonts.load(...)` explicitamente para cada família/peso realmente usado (`700 16px Oswald`, `600 16px Oswald`, `400 16px Inter`, `600 16px Inter`, `700 16px Inter`, `500 12px "JetBrains Mono"`);
   - só depois disso rodar `autoFit(w.document)` e `w.print()`.
2. Fallback com timeout de 3s caso a rede falhe, para não travar o botão.

### `src/lib/plano/template/render.ts` — `FONTS_HEAD`
- Adicionar `&text=` não é viável (conteúdo dinâmico). Em vez disso, injetar um pequeno bloco `@font-face` de pré-aquecimento via CSS inline no `<head>` só para forçar o navegador a começar o download imediatamente ao abrir o documento (evita o gap entre `document.write` e o parse do `<link>`).
- Manter o `<link>` do Google Fonts como está para o preview no iframe.

### `src/lib/plano/autofit.ts`
- Guard extra: se `document.fonts?.status !== "loaded"`, esperar `document.fonts.ready` antes da primeira medição. Assim, mesmo que alguém chame `autoFit` cedo, ele não mede com fallback.
- Reduzir o teto de `hi` de `1.15` para `1.08` e o `available` de `0.96` para `0.94`, dando mais folga para a variação sub-pixel do motor de impressão do Chrome, que é a origem real do "corte" quando as fontes finalmente carregam.

### QA
Depois do fix, gerar um plano com um bloco de texto propositalmente longo (a página "Como executar o treino", que é a mais densa e fixa) e imprimir para PDF via Chrome headless local para checar visualmente: (a) tipografia Oswald/Inter presente em todas as páginas, (b) nenhuma linha cortada no rodapé de nenhuma seção, (c) capa e closer inalterados.

## Fora do escopo

Não vou mexer em: logbook, mudança S1→Semana, remoção de "marcar refeição feita", troca vermelho→dourado, upload de PDF pelo treinador. Esses continuam pendentes como você definiu no turno anterior — quando quiser retomar, é só pedir.
