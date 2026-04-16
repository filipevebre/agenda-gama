create extension if not exists pgcrypto;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create or replace function public.current_user_role()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null unique,
  full_name text not null,
  role text not null check (role in ('administrador', 'funcionarios', 'professores', 'responsaveis')),
  role_label text not null,
  can_approve boolean not null default false,
  first_access_pending boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  turno text not null,
  sala text not null,
  ano text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.disciplinas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  carga text not null,
  etapa text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.equipe (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cargo text not null,
  setor text not null,
  contato text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.professores (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  disciplinas text not null,
  turno text not null,
  email text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.alunos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  matricula text not null,
  turma text not null,
  turno text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.responsaveis (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid references auth.users (id) on delete set null,
  nome text not null,
  parentesco text not null,
  aluno text not null,
  contato text not null,
  email text not null,
  access_status text not null default 'Convite enviado',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.communication_channels (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  publico text not null,
  descricao text not null,
  created_by_name text not null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.communication_messages (
  id uuid primary key default gen_random_uuid(),
  canal_id uuid references public.communication_channels (id) on delete set null,
  canal_nome text not null,
  sender_name text not null,
  sender_email text not null,
  sender_role text not null,
  recipient_type text not null,
  recipients jsonb not null default '[]'::jsonb,
  subject text not null,
  content text not null,
  status text not null default 'rascunho',
  approved_by text not null default '',
  sent_by text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

drop trigger if exists turmas_set_updated_at on public.turmas;
create trigger turmas_set_updated_at
before update on public.turmas
for each row execute function public.set_updated_at();

drop trigger if exists disciplinas_set_updated_at on public.disciplinas;
create trigger disciplinas_set_updated_at
before update on public.disciplinas
for each row execute function public.set_updated_at();

drop trigger if exists equipe_set_updated_at on public.equipe;
create trigger equipe_set_updated_at
before update on public.equipe
for each row execute function public.set_updated_at();

drop trigger if exists professores_set_updated_at on public.professores;
create trigger professores_set_updated_at
before update on public.professores
for each row execute function public.set_updated_at();

drop trigger if exists alunos_set_updated_at on public.alunos;
create trigger alunos_set_updated_at
before update on public.alunos
for each row execute function public.set_updated_at();

drop trigger if exists responsaveis_set_updated_at on public.responsaveis;
create trigger responsaveis_set_updated_at
before update on public.responsaveis
for each row execute function public.set_updated_at();

drop trigger if exists communication_channels_set_updated_at on public.communication_channels;
create trigger communication_channels_set_updated_at
before update on public.communication_channels
for each row execute function public.set_updated_at();

drop trigger if exists communication_messages_set_updated_at on public.communication_messages;
create trigger communication_messages_set_updated_at
before update on public.communication_messages
for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.turmas enable row level security;
alter table public.disciplinas enable row level security;
alter table public.equipe enable row level security;
alter table public.professores enable row level security;
alter table public.alunos enable row level security;
alter table public.responsaveis enable row level security;
alter table public.communication_channels enable row level security;
alter table public.communication_messages enable row level security;

drop policy if exists "profiles_select_authenticated" on public.profiles;
create policy "profiles_select_authenticated"
on public.profiles
for select
to authenticated
using (true);

drop policy if exists "profiles_update_self_or_staff" on public.profiles;
create policy "profiles_update_self_or_staff"
on public.profiles
for update
to authenticated
using (auth.uid() = id or public.current_user_role() in ('administrador', 'funcionarios'))
with check (auth.uid() = id or public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_turmas" on public.turmas;
create policy "staff_manage_turmas"
on public.turmas
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_disciplinas" on public.disciplinas;
create policy "staff_manage_disciplinas"
on public.disciplinas
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_equipe" on public.equipe;
create policy "staff_manage_equipe"
on public.equipe
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_professores" on public.professores;
create policy "staff_manage_professores"
on public.professores
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_alunos" on public.alunos;
create policy "staff_manage_alunos"
on public.alunos
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "staff_manage_responsaveis" on public.responsaveis;
create policy "staff_manage_responsaveis"
on public.responsaveis
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "authenticated_use_communication_channels" on public.communication_channels;
create policy "authenticated_use_communication_channels"
on public.communication_channels
for all
to authenticated
using (true)
with check (true);

drop policy if exists "authenticated_use_communication_messages" on public.communication_messages;
create policy "authenticated_use_communication_messages"
on public.communication_messages
for all
to authenticated
using (true)
with check (true);
