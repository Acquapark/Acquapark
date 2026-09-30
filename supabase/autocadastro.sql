-- Aqua Park Manager — autocadastro do associado (página pública /cadastro)
-- Rode este script no SQL Editor do Supabase, DEPOIS de plano_vencimento_contratacao.sql.
--
-- 1. Plano marcado como "disponível no autocadastro": só esses aparecem na
--    página pública. Default false — nenhum plano existente aparece sozinho.
-- 2. Origem do cadastro (equipe ou internet), para a equipe acompanhar quem
--    se cadastrou sozinho.
-- 3. Bucket privado com as fotos dos associados (base para o reconhecimento
--    facial). Só a equipe lê; o upload do autocadastro é feito pelo servidor
--    com a service role, então o público nunca grava direto no bucket.
-- 4. Registro de tentativas de autocadastro por IP, para limitar abuso da
--    página pública. Sem políticas: só o servidor (service role) acessa.

alter table planos
  add column if not exists disponivel_autocadastro boolean not null default false;

alter table associados
  add column if not exists origem text not null default 'equipe';

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'associados_origem_check') then
    alter table associados
      add constraint associados_origem_check check (origem in ('equipe', 'autocadastro'));
  end if;
end $$;

-- =========================================================
-- STORAGE — fotos dos associados
-- =========================================================
insert into storage.buckets (id, name, public)
values ('associados-fotos', 'associados-fotos', false)
on conflict (id) do nothing;

create policy "staff_read_associados_fotos" on storage.objects
  for select to authenticated
  using (bucket_id = 'associados-fotos' and is_staff());

create policy "staff_write_associados_fotos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'associados-fotos' and is_staff());

create policy "staff_update_associados_fotos" on storage.objects
  for update to authenticated
  using (bucket_id = 'associados-fotos' and is_staff());

create policy "staff_delete_associados_fotos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'associados-fotos' and is_staff());

-- =========================================================
-- LIMITE DE TENTATIVAS DO AUTOCADASTRO
-- =========================================================
create table if not exists autocadastro_tentativas (
  id uuid primary key default gen_random_uuid(),
  ip text not null,
  criado_em timestamptz not null default now()
);

create index if not exists idx_autocadastro_tentativas_ip on autocadastro_tentativas(ip, criado_em);

alter table autocadastro_tentativas enable row level security;
