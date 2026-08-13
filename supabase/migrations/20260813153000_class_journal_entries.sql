create table if not exists public.class_journal_entries (
  id uuid primary key default gen_random_uuid(),
  lesson_date date not null,
  turma text not null,
  subject text not null,
  topic text not null,
  summary text not null,
  homework text not null default '',
  teacher_user_id uuid references auth.users (id) on delete set null,
  teacher_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists class_journal_date_idx
  on public.class_journal_entries (lesson_date desc, turma, subject);
create index if not exists class_journal_teacher_idx
  on public.class_journal_entries (teacher_user_id, lesson_date desc);

drop trigger if exists class_journal_entries_set_updated_at on public.class_journal_entries;
create trigger class_journal_entries_set_updated_at
before update on public.class_journal_entries
for each row execute function public.set_updated_at();

alter table public.class_journal_entries enable row level security;

drop policy if exists "staff_manage_class_journal" on public.class_journal_entries;
create policy "staff_manage_class_journal"
on public.class_journal_entries
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_select_class_journal" on public.class_journal_entries;
create policy "teachers_select_class_journal"
on public.class_journal_entries
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
);

drop policy if exists "teachers_insert_class_journal" on public.class_journal_entries;
create policy "teachers_insert_class_journal"
on public.class_journal_entries
for insert
to authenticated
with check (
  public.current_user_role() = 'professores'
  and teacher_user_id = auth.uid()
  and public.current_professor_has_turma(turma)
  and public.current_professor_teaches_subject(subject)
);

drop policy if exists "teachers_update_own_class_journal" on public.class_journal_entries;
create policy "teachers_update_own_class_journal"
on public.class_journal_entries
for update
to authenticated
using (
  public.current_user_role() = 'professores'
  and teacher_user_id = auth.uid()
)
with check (
  public.current_user_role() = 'professores'
  and teacher_user_id = auth.uid()
  and public.current_professor_has_turma(turma)
  and public.current_professor_teaches_subject(subject)
);

drop policy if exists "teachers_delete_own_class_journal" on public.class_journal_entries;
create policy "teachers_delete_own_class_journal"
on public.class_journal_entries
for delete
to authenticated
using (
  public.current_user_role() = 'professores'
  and teacher_user_id = auth.uid()
);
