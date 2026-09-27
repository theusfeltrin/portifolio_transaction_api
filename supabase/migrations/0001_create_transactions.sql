-- Tabela principal de transações

create table if not exists public.transactions (
  id uuid primary key default gen_random_uuid(),
  idempotency_key text not null unique,
  type text not null check (type in ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER')),
  amount numeric(18, 2) not null check (amount > 0),
  currency char(3) not null,
  description text,
  status text not null default 'COMPLETED' check (status in ('PENDING', 'COMPLETED', 'FAILED')),
  metadata jsonb,
  created_at timestamptz not null default now()
);

-- Índices de apoio às consultas mais comuns
create index if not exists idx_transactions_created_at on public.transactions (created_at desc);
create index if not exists idx_transactions_idempotency_key on public.transactions (idempotency_key);

-- Row Level Security: a API acessa via service_role key (que ignora RLS),
-- então mantemos RLS habilitado para bloquear qualquer acesso direto via anon/public key.
alter table public.transactions enable row level security;

create policy "Bloquear acesso público direto"
  on public.transactions
  for all
  to anon, authenticated
  using (false);

-- Grant para a Data API (PostgREST/supabase-js).
grant select, insert, update, delete on public.transactions to service_role;