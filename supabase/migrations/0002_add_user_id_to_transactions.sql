-- Associa cada transação ao usuário (UUID gerado pelo frontend e guardado na sessão do navegador).

alter table public.transactions add column if not exists user_id uuid;

-- Linhas antigas ficam com user_id nulo e, portanto, invisíveis para qualquer usuário.
-- NOT VALID: a regra vale para novos inserts/updates sem falhar por causa dessas linhas legadas.
alter table public.transactions
  add constraint transactions_user_id_not_null check (user_id is not null) not valid;

-- Idempotency-Key passa a ser única por usuário, e não globalmente:
-- dois usuários podem gerar a mesma chave sem conflito entre si.
alter table public.transactions drop constraint if exists transactions_idempotency_key_key;
drop index if exists public.idx_transactions_idempotency_key;
alter table public.transactions
  add constraint transactions_user_id_idempotency_key_key unique (user_id, idempotency_key);

-- Índice de apoio à listagem paginada por usuário.
drop index if exists public.idx_transactions_created_at;
create index if not exists idx_transactions_user_id_created_at
  on public.transactions (user_id, created_at desc);
