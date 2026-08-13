create table if not exists public.profile_roles (
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('administrador', 'funcionarios', 'professores', 'responsaveis')),
  role_label text not null,
  created_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, role)
);

insert into public.profile_roles (user_id, role, role_label)
select id, role, role_label
from public.profiles
on conflict (user_id, role) do update
set role_label = excluded.role_label;

alter table public.profile_roles enable row level security;

drop policy if exists "profile_roles_select_own_or_staff" on public.profile_roles;
create policy "profile_roles_select_own_or_staff"
on public.profile_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() in ('administrador', 'funcionarios')
);

create or replace function public.profile_role_label(target_role text)
returns text
language sql
immutable
as $$
  select case target_role
    when 'administrador' then 'Administrador'
    when 'funcionarios' then 'Funcionário'
    when 'professores' then 'Professor'
    when 'responsaveis' then 'Responsável'
    else target_role
  end
$$;

create or replace function public.set_active_profile_role(target_role text)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  if not exists (
    select 1
    from public.profile_roles
    where user_id = auth.uid()
      and role = target_role
  ) then
    raise exception 'Este perfil não está vinculado à sua conta.';
  end if;

  update public.profiles
  set role = target_role,
      role_label = public.profile_role_label(target_role)
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

create or replace function public.complete_first_access()
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_profile public.profiles;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado.';
  end if;

  update public.profiles
  set first_access_pending = false
  where id = auth.uid()
  returning * into updated_profile;

  return updated_profile;
end;
$$;

revoke all on function public.set_active_profile_role(text) from public;
revoke all on function public.complete_first_access() from public;
grant execute on function public.set_active_profile_role(text) to authenticated;
grant execute on function public.complete_first_access() to authenticated;

drop policy if exists "profiles_update_self_or_staff" on public.profiles;
drop policy if exists "profiles_update_staff" on public.profiles;
create policy "profiles_update_staff"
on public.profiles
for update
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));
