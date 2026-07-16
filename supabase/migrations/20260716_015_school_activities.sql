create extension if not exists pgcrypto;

create table if not exists public.school_activities (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subject text not null default '',
  description text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  target_turmas jsonb not null default '[]'::jsonb check (jsonb_typeof(target_turmas) = 'array'),
  attachments jsonb not null default '[]'::jsonb check (jsonb_typeof(attachments) = 'array'),
  due_at timestamptz,
  author_user_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  author_email text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.school_activity_completions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.school_activities (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  student_id uuid not null references public.alunos (id) on delete cascade,
  student_name text not null,
  turma text not null,
  responsible_name text not null default '',
  responsible_email text not null default '',
  completed_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (activity_id, auth_user_id, student_id)
);

create index if not exists school_activities_status_created_at_idx
  on public.school_activities (status, created_at desc);

create index if not exists school_activity_completions_activity_id_idx
  on public.school_activity_completions (activity_id, completed_at desc);

create index if not exists school_activity_completions_auth_user_id_idx
  on public.school_activity_completions (auth_user_id);

drop trigger if exists school_activities_set_updated_at on public.school_activities;
create trigger school_activities_set_updated_at
before update on public.school_activities
for each row execute function public.set_updated_at();

drop trigger if exists school_activity_completions_set_updated_at on public.school_activity_completions;
create trigger school_activity_completions_set_updated_at
before update on public.school_activity_completions
for each row execute function public.set_updated_at();

alter table public.school_activities enable row level security;
alter table public.school_activity_completions enable row level security;

create or replace function public.current_teacher_matches_all_activity_turmas(target_turmas jsonb)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_array_length(coalesce(target_turmas, '[]'::jsonb)) > 0
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(target_turmas, '[]'::jsonb)) as turma(nome)
      where not public.current_professor_has_turma(turma.nome)
    )
$$;

drop policy if exists "staff_manage_school_activities" on public.school_activities;
create policy "staff_manage_school_activities"
on public.school_activities
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_own_school_activities" on public.school_activities;
create policy "teachers_manage_own_school_activities"
on public.school_activities
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
)
with check (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
  and public.current_teacher_matches_all_activity_turmas(target_turmas)
);

drop policy if exists "teachers_select_published_school_activities" on public.school_activities;
create policy "teachers_select_published_school_activities"
on public.school_activities
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and status in ('published', 'closed')
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "guardians_select_school_activities" on public.school_activities;
create policy "guardians_select_school_activities"
on public.school_activities
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and status in ('published', 'closed')
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "staff_manage_school_activity_completions" on public.school_activity_completions;
create policy "staff_manage_school_activity_completions"
on public.school_activity_completions
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_select_school_activity_completions" on public.school_activity_completions;
create policy "teachers_select_school_activity_completions"
on public.school_activity_completions
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and exists (
    select 1
    from public.school_activities activity_record
    where activity_record.id = school_activity_completions.activity_id
      and public.current_user_matches_form_turmas(activity_record.target_turmas)
  )
);

drop policy if exists "guardians_select_own_school_activity_completions" on public.school_activity_completions;
create policy "guardians_select_own_school_activity_completions"
on public.school_activity_completions
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
);

drop policy if exists "guardians_insert_own_school_activity_completions" on public.school_activity_completions;
create policy "guardians_insert_own_school_activity_completions"
on public.school_activity_completions
for insert
to authenticated
with check (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
  and public.current_responsavel_has_student(student_id, student_name)
  and exists (
    select 1
    from public.school_activities activity_record
    where activity_record.id = school_activity_completions.activity_id
      and activity_record.status = 'published'
      and public.current_user_matches_form_turmas(activity_record.target_turmas)
  )
);

drop policy if exists "guardians_update_own_school_activity_completions" on public.school_activity_completions;
create policy "guardians_update_own_school_activity_completions"
on public.school_activity_completions
for update
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
)
with check (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
  and public.current_responsavel_has_student(student_id, student_name)
  and exists (
    select 1
    from public.school_activities activity_record
    where activity_record.id = school_activity_completions.activity_id
      and activity_record.status = 'published'
      and public.current_user_matches_form_turmas(activity_record.target_turmas)
  )
);
