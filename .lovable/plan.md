# ANTIFOFISTA SQUAD — Plano da V1

App web mobile-first em português, estética militar/tática, instalável como PWA. Dois papéis: **aluno** (visualiza) e **treinador** (administra). Backend via **Lovable Cloud** (Supabase gerenciado), com RLS por aluno.

## Escopo da V1 (entrega de ponta a ponta)

1. Login (e-mail/senha) + recuperação de senha
2. Papéis aluno/treinador com redirecionamento automático
3. Treinador: cadastrar aluno, criar/editar treino, criar/editar dieta, gerenciar galeria
4. Aluno: 3 abas (Treino, Nutricional, Galeria) + player YouTube embed
5. PWA instalável (manifest + ícones + splash + standalone)

Fora da V1 (fase 2): importação CSV em massa, cálculo automático de macros, notificações, histórico.

## Design System

- Tema escuro permanente. Fundo `#0A0A0A`/`#121212`
- Verde militar `#3D4127`/`#556B2F` como secundária
- Âmbar tático `#C9A227` como destaque principal; vermelho `#C8102E` para ações urgentes
- Títulos: **Oswald** (condensada bold, CAIXA ALTA); corpo: **Inter**
- Cantos levemente arredondados, divisórias fortes, ícones tipo patente/escudo (lucide-react)
- Wordmark "ANTIFOFISTA SQUAD" no topo

Tokens definidos em `src/styles.css` via `@theme` (Tailwind v4), variantes de botão `tactical` (âmbar) e `urgent` (vermelho).

## Modelo de dados (Supabase)

Tabelas: `profiles`, `user_roles` (separada, com enum `app_role` aluno/treinador — segurança), `training_plans`, `training_exercises`, `nutrition_plans`, `meals`, `meal_items`, `exercise_gallery`.

RLS:
- Função `has_role(uuid, app_role)` SECURITY DEFINER
- Aluno: SELECT apenas onde `student_id = auth.uid()` (planos + filhos via join); SELECT livre em `exercise_gallery`
- Treinador: CRUD total via `has_role(auth.uid(), 'treinador')`
- GRANTs explícitos para `authenticated` e `service_role`

Trigger `handle_new_user` cria perfil + papel padrão `aluno` no signup.

## Rotas (TanStack Start)

```
/auth                              público — login + esqueci senha
/reset-password                    público
/_authenticated/                   gate gerenciado (já existe)
  ├ index                          redireciona por papel
  ├ treino                         aba aluno
  ├ nutricional                    aba aluno
  ├ galeria                        aba aluno (+ filtros/busca)
  └ admin/                         só treinador (gate has_role)
     ├ alunos                      lista paginada + busca
     ├ alunos/$id                  editor de treino + dieta (tabs)
     ├ alunos/novo                 cadastro
     └ galeria                     CRUD vídeos
```

Bottom tab bar fixa para aluno (Treino / Nutricional / Galeria). Header com saudação + logout.

## Server functions

- `createStudent` (treinador, via Auth Admin) — cria usuário + perfil
- `getStudents` (treinador) — lista paginada com busca
- `saveTrainingPlan` / `saveNutritionPlan` (treinador) — upsert plano + filhos
- `getMyTraining` / `getMyNutrition` (aluno autenticado) — RLS aplica
- `listGallery` / `saveGalleryItem` / `deleteGalleryItem`

Todas com `requireSupabaseAuth` + checagem `has_role` quando privilegiado.

## PWA

`vite-plugin-pwa` com `generateSW`, registro guardado (skill PWA): nunca registra em preview Lovable/dev/iframe. Manifest com nome "Antifofista Squad", theme color `#0A0A0A`, ícones 192/512, `display: standalone`.

## Aspectos técnicos

- Lovable Cloud habilitada na primeira ação
- Validação Zod em todos os inputs de server functions
- Player YouTube: `<iframe>` embed com `youtube-nocookie.com`
- Editor tipo planilha: usar `<table>` editável com adicionar/remover/reordenar linhas (drag handle simples com setas ↑↓)
- Galeria de vídeo vinculável por exercício via select populado de `exercise_gallery`

## Ordem de implementação

1. Habilitar Lovable Cloud
2. Migration: enum, tabelas, RLS, grants, trigger, função `has_role`
3. Design system + layout shell + bottom tab
4. Telas /auth + /reset-password
5. Server fns + telas aluno (treino, nutricional, galeria)
6. Painel treinador (alunos, editores, galeria)
7. PWA (manifest, ícones, plugin)
8. SEO mínimo + sitemap/robots

## Perguntas antes de começar

Nenhuma bloqueante — vou seguir os defaults do brief. Confirme só:
- **Importação CSV** fica para fase 2 conforme você indicou ✓
- O **primeiro treinador** será criado manualmente via SQL após o primeiro signup (te passo o comando), já que o trigger cria todos como `aluno` por padrão. OK?
