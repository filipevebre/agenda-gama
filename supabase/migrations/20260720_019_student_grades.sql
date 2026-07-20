create table if not exists public.student_grades (
  id uuid primary key default gen_random_uuid(),
  academic_year integer not null check (academic_year between 2000 and 2100),
  period smallint not null check (period between 1 and 4),
  turma text not null,
  subject text not null,
  student_id uuid not null references public.alunos (id) on delete cascade,
  student_name text not null,
  grade numeric(4, 2) check (grade is null or (grade >= 0 and grade <= 10)),
  recovery_grade numeric(4, 2) check (recovery_grade is null or (recovery_grade >= 0 and recovery_grade <= 10)),
  absences integer not null default 0 check (absences >= 0 and absences <= 999),
  note text not null default '',
  status text not null default 'draft' check (status in ('draft', 'published')),
  teacher_user_id uuid references auth.users (id) on delete set null,
  teacher_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (academic_year, period, student_id, subject)
);

create index if not exists student_grades_student_year_idx
  on public.student_grades (student_id, academic_year desc, period, subject);
create index if not exists student_grades_turma_year_idx
  on public.student_grades (turma, academic_year desc, period, subject);

drop trigger if exists student_grades_set_updated_at on public.student_grades;
create trigger student_grades_set_updated_at
before update on public.student_grades
for each row execute function public.set_updated_at();

alter table public.student_grades enable row level security;

create or replace function public.current_professor_teaches_subject(target_subject text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professores professor
    cross join lateral unnest(string_to_array(coalesce(professor.disciplinas, ''), ',')) discipline(nome)
    where (
      professor.auth_user_id = auth.uid()
      or lower(trim(professor.email)) = lower(coalesce((select email from public.profiles where id = auth.uid()), ''))
    )
      and lower(trim(discipline.nome)) = lower(trim(coalesce(target_subject, '')))
  )
$$;

drop policy if exists "staff_manage_student_grades" on public.student_grades;
create policy "staff_manage_student_grades"
on public.student_grades
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_student_grades" on public.student_grades;
create policy "teachers_manage_student_grades"
on public.student_grades
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
  and public.current_professor_teaches_subject(subject)
)
with check (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
  and public.current_professor_teaches_subject(subject)
);

drop policy if exists "guardians_select_published_student_grades" on public.student_grades;
create policy "guardians_select_published_student_grades"
on public.student_grades
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and status = 'published'
  and public.current_responsavel_has_student(student_id, student_name)
);
