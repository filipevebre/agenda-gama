create extension if not exists pgcrypto;

create table if not exists public.school_notices (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  summary text not null,
  body text not null,
  audience text not null default 'all' check (audience in ('all', 'responsaveis', 'professores', 'funcionarios')),
  target_turmas jsonb not null default '[]'::jsonb,
  archive_date date,
  pinned boolean not null default false,
  urgent boolean not null default false,
  author_name text not null,
  author_role text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists school_notices_created_at_idx
  on public.school_notices (created_at desc);

create index if not exists school_notices_audience_idx
  on public.school_notices (audience);

create index if not exists school_notices_archive_date_idx
  on public.school_notices (archive_date);

drop trigger if exists school_notices_set_updated_at on public.school_notices;
create trigger school_notices_set_updated_at
before update on public.school_notices
for each row execute function public.set_updated_at();

create or replace function public.current_user_matches_notice_turmas(target_turmas jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when jsonb_array_length(coalesce(target_turmas, '[]'::jsonb)) = 0 then true
    when public.current_user_role() in ('administrador', 'funcionarios') then true
    when public.current_user_role() = 'professores' then exists (
      select 1
      from jsonb_array_elements_text(coalesce(target_turmas, '[]'::jsonb)) as turma(nome)
      where public.current_professor_has_turma(turma.nome)
    )
    when public.current_user_role() = 'responsaveis' then exists (
      select 1
      from jsonb_array_elements_text(coalesce(target_turmas, '[]'::jsonb)) as turma(nome)
      where public.current_responsavel_has_turma(turma.nome)
    )
    else false
  end
$$;

alter table public.school_notices enable row level security;

drop policy if exists "staff_manage_school_notices" on public.school_notices;
create policy "staff_manage_school_notices"
on public.school_notices
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_select_school_notices" on public.school_notices;
create policy "teachers_select_school_notices"
on public.school_notices
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and audience in ('all', 'professores')
  and public.current_user_matches_notice_turmas(target_turmas)
);

drop policy if exists "guardians_select_school_notices" on public.school_notices;
create policy "guardians_select_school_notices"
on public.school_notices
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and audience in ('all', 'responsaveis')
  and public.current_user_matches_notice_turmas(target_turmas)
);
