create extension if not exists pgcrypto;

create table if not exists public.school_menus (
  id uuid primary key default gen_random_uuid(),
  menu_date date not null,
  title text not null default 'Cardápio do dia',
  status text not null default 'draft' check (status in ('draft', 'published')),
  target_turmas jsonb not null default '[]'::jsonb check (jsonb_typeof(target_turmas) = 'array'),
  meals jsonb not null default '[]'::jsonb check (jsonb_typeof(meals) = 'array'),
  notes text not null default '',
  allergens text not null default '',
  author_user_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  author_email text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists school_menus_date_status_idx
  on public.school_menus (menu_date desc, status);

drop trigger if exists school_menus_set_updated_at on public.school_menus;
create trigger school_menus_set_updated_at
before update on public.school_menus
for each row execute function public.set_updated_at();

create or replace function public.current_user_matches_menu_turmas(target_turmas jsonb)
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

alter table public.school_menus enable row level security;

drop policy if exists "staff_manage_school_menus" on public.school_menus;
create policy "staff_manage_school_menus"
on public.school_menus
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "school_profiles_select_published_menus" on public.school_menus;
create policy "school_profiles_select_published_menus"
on public.school_menus
for select
to authenticated
using (
  public.current_user_role() in ('professores', 'responsaveis')
  and status = 'published'
  and public.current_user_matches_menu_turmas(target_turmas)
);
