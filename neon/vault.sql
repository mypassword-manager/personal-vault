-- Jalankan sekali dalam Neon SQL Editor selepas Auth dan Data API dihidupkan.
-- Jadual ini menyimpan vault tersulit sahaja. Tiada kata laluan biasa.

create table if not exists public.vault_sampul (
  user_id text primary key default auth.user_id(),
  format text not null,
  version integer not null,
  kdf jsonb not null,
  salt text not null,
  iv text not null,
  ciphertext text not null,
  updated_at timestamptz not null default now()
);

grant select, insert, update, delete on public.vault_sampul to authenticated;

alter table public.vault_sampul enable row level security;

drop policy if exists "pemilik vault sahaja" on public.vault_sampul;
create policy "pemilik vault sahaja"
on public.vault_sampul
for all
to authenticated
using (auth.user_id() = user_id)
with check (auth.user_id() = user_id);
