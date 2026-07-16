create extension if not exists pgcrypto;

create table if not exists public.school_forms (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  category text not null default 'geral',
  status text not null default 'draft' check (status in ('draft', 'published', 'closed')),
  target_turmas jsonb not null default '[]'::jsonb check (jsonb_typeof(target_turmas) = 'array'),
  questions jsonb not null default '[]'::jsonb check (jsonb_typeof(questions) = 'array'),
  closes_at timestamptz,
  author_user_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  author_email text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.school_form_responses (
  id uuid primary key default gen_random_uuid(),
  form_id uuid not null references public.school_forms (id) on delete cascade,
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  responsible_name text not null default '',
  responsible_email text not null default '',
  student_id uuid not null references public.alunos (id) on delete cascade,
  student_name text not null,
  turma text not null,
  answers jsonb not null default '{}'::jsonb check (jsonb_typeof(answers) = 'object'),
  created_at timestamptz not null default timezone('utc', now()),
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (form_id, auth_user_id, student_id)
);

alter table public.school_form_responses
  add column if not exists created_at timestamptz not null default timezone('utc', now());

create index if not exists school_forms_status_created_at_idx
  on public.school_forms (status, created_at desc);

create index if not exists school_form_responses_form_id_idx
  on public.school_form_responses (form_id, submitted_at desc);

create index if not exists school_form_responses_auth_user_id_idx
  on public.school_form_responses (auth_user_id);

drop trigger if exists school_forms_set_updated_at on public.school_forms;
create trigger school_forms_set_updated_at
before update on public.school_forms
for each row execute function public.set_updated_at();

drop trigger if exists school_form_responses_set_updated_at on public.school_form_responses;
create trigger school_form_responses_set_updated_at
before update on public.school_form_responses
for each row execute function public.set_updated_at();

create or replace function public.current_teacher_matches_all_form_turmas(target_turmas jsonb)
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

create or replace function public.current_user_matches_form_turmas(target_turmas jsonb)
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

alter table public.school_forms enable row level security;
alter table public.school_form_responses enable row level security;

drop policy if exists "staff_manage_school_forms" on public.school_forms;
create policy "staff_manage_school_forms"
on public.school_forms
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_own_school_forms" on public.school_forms;
create policy "teachers_manage_own_school_forms"
on public.school_forms
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
)
with check (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
  and public.current_teacher_matches_all_form_turmas(target_turmas)
);

drop policy if exists "teachers_select_published_school_forms" on public.school_forms;
create policy "teachers_select_published_school_forms"
on public.school_forms
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and status in ('published', 'closed')
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "guardians_select_school_forms" on public.school_forms;
create policy "guardians_select_school_forms"
on public.school_forms
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and status in ('published', 'closed')
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "staff_manage_school_form_responses" on public.school_form_responses;
create policy "staff_manage_school_form_responses"
on public.school_form_responses
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_select_school_form_responses" on public.school_form_responses;
create policy "teachers_select_school_form_responses"
on public.school_form_responses
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and exists (
    select 1
    from public.school_forms form_record
    where form_record.id = school_form_responses.form_id
      and public.current_user_matches_form_turmas(form_record.target_turmas)
  )
);

drop policy if exists "guardians_select_own_school_form_responses" on public.school_form_responses;
create policy "guardians_select_own_school_form_responses"
on public.school_form_responses
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
);

drop policy if exists "guardians_insert_own_school_form_responses" on public.school_form_responses;
create policy "guardians_insert_own_school_form_responses"
on public.school_form_responses
for insert
to authenticated
with check (
  public.current_user_role() = 'responsaveis'
  and auth_user_id = auth.uid()
  and public.current_responsavel_has_student(student_id, student_name)
  and exists (
    select 1
    from public.school_forms form_record
    where form_record.id = school_form_responses.form_id
      and form_record.status = 'published'
      and (form_record.closes_at is null or form_record.closes_at > timezone('utc', now()))
      and public.current_user_matches_form_turmas(form_record.target_turmas)
  )
);

drop policy if exists "guardians_update_own_school_form_responses" on public.school_form_responses;
create policy "guardians_update_own_school_form_responses"
on public.school_form_responses
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
    from public.school_forms form_record
    where form_record.id = school_form_responses.form_id
      and form_record.status = 'published'
      and (form_record.closes_at is null or form_record.closes_at > timezone('utc', now()))
      and public.current_user_matches_form_turmas(form_record.target_turmas)
  )
);
