## Problema principal

Ao criar um novo aluno (ou treinador), o toast diz "Aluno cadastrado" mas ele nunca aparece na lista. Causa: o trigger `on_auth_user_created` que deveria chamar `handle_new_user()` **não está instalado** no banco (a função existe, mas não há trigger em `auth.users`).

Consequência: `supabaseAdmin.auth.admin.createUser(...)` cria o usuário em `auth.users`, mas nenhuma linha é criada em `public.profiles` nem em `public.user_roles`. O `UPDATE profiles ... WHERE id = novo_id` que seta `trainer_id` vira no-op silencioso, e o aluno fica invisível para o treinador (que filtra por `trainer_id = auth.uid()`).

Hoje há 3 usuários órfãos em `auth.users` sem profile: `lucas@gmail.com`, `michelfrancisluz@gmail.com`, `lulu@gmail.com`.

## Plano

### 1. Migração de banco

- Recriar o trigger `on_auth_user_created AFTER INSERT ON auth.users` chamando `public.handle_new_user()`, para futuras criações via signup direto.
- Backfill: para cada usuário em `auth.users` sem linha em `profiles`, inserir profile (id, email, full_name do `raw_user_meta_data`) e user_role `aluno`.

### 2. Blindar `createStudent` e `createTrainer` (`src/lib/squad.functions.ts`)

Não confiar no trigger — fazer o insert de profile + role explicitamente com `supabaseAdmin` (idempotente via `upsert` / `insert ... on conflict do nothing`). Assim funciona mesmo se o trigger falhar novamente no futuro:

- `createStudent`: após `admin.createUser`, `upsert` em `profiles` com `{id, email, full_name, phone, trainer_id}`; garantir role `aluno` em `user_roles`.
- `createTrainer`: mesma coisa, com role `treinador` e sem `aluno`.

### 3. Outros bugs encontrados na varredura admin/treinador

- **`/app/admin/alunos/$id` mostra aba "AÇÃO" para treinadores comuns**, mas o gerador de plano roda com `ANTHROPIC_API_KEY` (recurso do admin/dono). Manter a aba, mas confirmar que o `GerarPlanoAcao` só aparece para treinador do aluno ou admin — hoje já é gated pela RLS do server fn, então ok visualmente. Sem mudança.
- **Filtro `q.not("id", "in", "(uuid1,uuid2)")`** em `listStudents` (branch admin sem `trainerId`) e em `getAdminOverview`: com UUIDs sem aspas, PostgREST às vezes retorna erro. Trocar para excluir staff em JS após buscar todos os profiles, ou usar `.filter("id", "not.in", "(...)")` com uuids quotados. Corrigir nos dois lugares para o admin não ver linha em branco quando houver muitos staff.
- **Invalidação de cache pós-criação**: `NovoAluno` só navega para `/app/admin/alunos`, mas a query `["students", search, page]` pode servir cache antigo. Adicionar `queryClient.invalidateQueries({ queryKey: ["students"] })` e `["admin-overview"]` no sucesso.
- **`getMyContext` cache**: em `AlunosList`, se o admin acabou de criar aluno e volta, o total exibido no `admin/visao` fica desatualizado até refetch. Coberto pela invalidação acima.

### 4. Verificação

Após aplicar: criar um novo aluno de teste pelo painel do treinador e conferir via `supabase--read_query` que profile + user_role foram gerados e que ele aparece na lista.

## Detalhes técnicos

Arquivos tocados:
- `supabase/migrations/<new>.sql` — recria trigger + backfill.
- `src/lib/squad.functions.ts` — `createStudent`, `createTrainer`, `listStudents`, `getAdminOverview`.
- `src/routes/_authenticated/app.admin.alunos.novo.tsx` — invalidateQueries no sucesso.

Sem mudança em UI/estilo. Mudança de dados: backfill de 3 profiles órfãos + role `aluno` default (o admin pode reatribuir/promover depois via painel).
