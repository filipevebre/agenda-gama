create extension if not exists pgcrypto;

create table if not exists public.student_diary_entries (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid,
  student_id uuid references public.alunos (id) on delete cascade,
  student_name text not null,
  turma text not null,
  turno text not null default '',
  category text not null default 'rotina',
  title text not null,
  body text not null,
  photos jsonb not null default '[]'::jsonb,
  author_name text not null,
  author_email text not null,
  author_role text not null,
  target_mode text not null default 'students',
  recipient_count integer not null default 1,
  target_turmas jsonb not null default '[]'::jsonb,
  entry_date date not null default current_date,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists student_diary_entries_student_id_idx
  on public.student_diary_entries (student_id);

create index if not exists student_diary_entries_entry_date_idx
  on public.student_diary_entries (entry_date desc);

create index if not exists student_diary_entries_turma_idx
  on public.student_diary_entries (turma);

drop trigger if exists student_diary_entries_set_updated_at on public.student_diary_entries;
create trigger student_diary_entries_set_updated_at
before update on public.student_diary_entries
for each row execute function public.set_updated_at();

alter table public.student_diary_entries enable row level security;

drop policy if exists "staff_manage_student_diary_entries" on public.student_diary_entries;
create policy "staff_manage_student_diary_entries"
on public.student_diary_entries
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_student_diary_entries" on public.student_diary_entries;
create policy "teachers_manage_student_diary_entries"
on public.student_diary_entries
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
)
with check (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
);

drop policy if exists "guardians_select_student_diary_entries" on public.student_diary_entries;
create policy "guardians_select_student_diary_entries"
on public.student_diary_entries
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and public.current_responsavel_has_student(student_id, student_name)
);
