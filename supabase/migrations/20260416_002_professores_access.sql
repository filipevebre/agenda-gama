alter table public.professores
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

alter table public.professores
  add column if not exists access_status text not null default 'Acesso nao enviado';

update public.professores
set access_status = 'Acesso nao enviado'
where access_status is null or trim(access_status) = '';
