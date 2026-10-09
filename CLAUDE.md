@AGENTS.md

# Migrations do Supabase

- Toda mudança de schema entra como arquivo em `supabase/migrations` e é aplicada pelo fluxo de migrations (CLI ou `apply_migration`), nunca só pelo SQL Editor. SQL aplicado por fora deixa o banco certo e o histórico errado: um `db push` futuro tenta reaplicar e falha (foi o caso de `habit_contexts_unlimited_pro` em produção).
- Antes de promover `dev` para `main`, compare `git diff origin/main...dev -- supabase/migrations` com `supabase_migrations.schema_migrations` de produção: toda migration nova precisa estar aplicada e registrada lá antes do merge.
- Se uma migration foi aplicada por fora, registre-a no histórico em vez de reaplicar: `insert into supabase_migrations.schema_migrations (version, name) values ('<versão>', '<nome>') on conflict (version) do nothing;`
