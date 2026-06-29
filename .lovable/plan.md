## Objetivo

Reformular o branding visual do app inteiro para refletir o folder/manifesto Antifofista Squad, seguindo a direção **Industrial Stencil** escolhida. Tirar a vibe SaaS com vermelho neon e instalar uma identidade tipo zine underground: papel preto, tinta off-white suja, Bebas Neue em CAPS, ember queimado como único acento, urso fantasma de fundo, grão de impressão.

## Tokens de design (definidos uma vez em `src/styles.css`)

Substituir os tokens atuais por:

- `--background: #0a0a0a` (papel preto)
- `--surface: #1a1a1a` (sombra/divisor)
- `--foreground: #e8dfcc` (tinta off-white / bone)
- `--muted-foreground: #e8dfcc @ 40% opacity`
- `--accent / --primary: #a83216` (ember queimado — substitui o vermelho neon `#ef4444` em tudo)
- `--border: #1a1a1a`
- Fontes: `--font-display: 'Bebas Neue'` (todos os títulos/labels CAPS), `--font-body: 'Barlow'` (texto). Instalar via `@fontsource/bebas-neue` e `@fontsource/barlow`. Remover Anton.

Adicionar 2 utilitários globais:
- `.af-grain` — overlay de ruído sutil (5% opacity, mix-blend-overlay) aplicado no shell do app.
- `.af-bear-ghost` — SVG do urso (já existe na marca) posicionado fixo no centro do viewport a ~3% de opacidade. Pointer-events none.

## Componentes afetados

1. **Shell autenticado** (`src/routes/_authenticated/app.tsx`)
   - Header: logo + eyebrow "NOT FOR EVERYONE" em ember + "ANTIFOFISTA" em Bebas Neue 4xl + saudação com dot ember pulsante. Botão SAIR vira pílula outline minúscula.
   - Aplicar `.af-grain` e `.af-bear-ghost` no container raiz.
   - Bottom nav: labels em Bebas Neue 10px tracking-tight; ativo = ember + dot acima. Sem ícones coloridos.

2. **Tabs/chips reutilizáveis** (Treino A/B/C, S1-S4, subnavs de Nutrição)
   - Ativo: fill bone (`#e8dfcc`) + texto preto, Bebas Neue.
   - Inativo: outline `#1a1a1a`, texto `#e8dfcc` a 40%.
   - Chips semanais: linha divisora top/bottom + texto pequeno underline ember no ativo.

3. **Cards de exercício** (`src/routes/_authenticated/app.treino...`)
   - Remover `bg-card`/cards arredondados. Trocar por borda esquerda de 2px (`#1a1a1a` → hover/active `#a83216`), padding-left.
   - Título: Bebas Neue 2xl uppercase. Badge "01/06" no canto direito.
   - Stats em colunas (Séries / Reps / Carga / Descanso) com label 10px opacity-40 e número Barlow bold.
   - Botão primário "REGISTRAR CARGA": fill ember sólido, Bebas Neue tracking 0.2em. Botão secundário: outline `#1a1a1a`.
   - Estado "done": opacity 40% + checkmark stencil; estado "ativo": borda ember.

4. **Cards de refeição** (Nutrição) — mesma linguagem dos cards de exercício (border-left + título Bebas + checkbox bone). Sem rounded.

5. **Auth/login** (`src/routes/auth.tsx`)
   - Mesmo header com "NOT FOR EVERYONE" + logo grande.
   - Inputs: fundo `#1a1a1a`, sem border-radius, label Bebas Neue uppercase 10px.
   - Botão entrar: ember sólido full-width Bebas Neue.

6. **Galeria, Evolução, Substituições, Treinador (admin), Equipe**
   - Aplicar mesmos tokens automaticamente via CSS variables — pouca/nenhuma mudança estrutural.
   - Trocar quaisquer instâncias residuais de `text-red-*`, `bg-red-*`, `#ef4444`, `hsl(var(--destructive))` usadas como destaque por `text-accent`/`bg-accent` (o destructive real fica para erros).
   - Garantir todos os títulos de seção em Bebas Neue uppercase.

7. **Diálogos/Toasters/Botões shadcn**
   - Atualizar variants em `src/components/ui/button.tsx`: `default` = ember sólido + Bebas tracking; `outline` = `border-border` bone-on-black. Sem rounded (radius global 0 ou 2px).
   - Toaster: fundo `#1a1a1a`, borda `#a83216` para info, sem rounded.

## Detalhes técnicos

- Remover/limpar regras antigas em `src/styles.css` que referenciam Anton, gradientes vermelhos, sombras vermelhas, `--af-red`, etc.
- Definir `--radius: 0px` (ou 2px discreto) globalmente. Cards e botões ficam retangulares como zine.
- Substituir favicon/ícone do PWA por versão do urso em bone sobre preto (gerar via imagegen, atualizar `public/`).
- Atualizar tela de splash do PWA (`manifest.webmanifest`) com cores `#0a0a0a` background e ícone novo.
- Verificar com Playwright screenshots de Treino, Nutrição, Evolução, Galeria, Auth pós-mudança para garantir consistência.

## Fora de escopo

- Estrutura de navegação, rotas, lógica de negócio, server functions, schemas — nada disso muda.
- Função de registrar carga, marcar refeição, upload de PDF — comportamento idêntico.
- Não reintroduzir nenhum vermelho neon nem cores extras além dos tokens acima.
