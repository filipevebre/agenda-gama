alter table public.equipe
  add column if not exists auth_user_id uuid references auth.users (id) on delete set null;

alter table public.equipe
  add column if not exists email text;

alter table public.equipe
  add column if not exists access_status text not null default 'Acesso nao enviado';

update public.equipe
set email = coalesce(nullif(trim(email), ''), lower(regexp_replace(nome, '\s+', '.', 'g')) || '@agenda-gama.local')
where email is null or trim(email) = '';

alter table public.equipe
  alter column email set not null;

update public.equipe
set access_status = 'Acesso nao enviado'
where access_status is null or trim(access_status) = '';
