create extension if not exists pgcrypto;

create table if not exists public.school_calendar_events (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null default '',
  event_type text not null default 'evento' check (event_type in ('evento', 'reuniao', 'prova', 'feriado', 'passeio', 'entrega', 'outro')),
  status text not null default 'published' check (status in ('draft', 'published')),
  event_date date not null,
  end_date date,
  all_day boolean not null default true,
  start_time time,
  end_time time,
  location text not null default '',
  target_turmas jsonb not null default '[]'::jsonb check (jsonb_typeof(target_turmas) = 'array'),
  important boolean not null default false,
  author_user_id uuid references auth.users (id) on delete set null,
  author_name text not null default '',
  author_email text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (end_date is null or end_date >= event_date),
  check (all_day or start_time is not null)
);

create table if not exists public.attendance_sessions (
  id uuid primary key default gen_random_uuid(),
  attendance_date date not null,
  turma text not null,
  status text not null default 'open' check (status in ('open', 'completed')),
  notes text not null default '',
  teacher_user_id uuid references auth.users (id) on delete set null,
  teacher_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (attendance_date, turma)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id uuid not null references public.alunos (id) on delete cascade,
  student_name text not null,
  status text not null default 'present' check (status in ('present', 'absent', 'late', 'excused')),
  note text not null default '',
  recorded_by_user_id uuid references auth.users (id) on delete set null,
  recorded_by_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (session_id, student_id)
);

create index if not exists school_calendar_events_date_idx
  on public.school_calendar_events (event_date, status);
create index if not exists attendance_sessions_date_turma_idx
  on public.attendance_sessions (attendance_date desc, turma);
create index if not exists attendance_records_session_idx
  on public.attendance_records (session_id, status);
create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id, created_at desc);

drop trigger if exists school_calendar_events_set_updated_at on public.school_calendar_events;
create trigger school_calendar_events_set_updated_at
before update on public.school_calendar_events
for each row execute function public.set_updated_at();

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
before update on public.attendance_sessions
for each row execute function public.set_updated_at();

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
before update on public.attendance_records
for each row execute function public.set_updated_at();

alter table public.school_calendar_events enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records enable row level security;

create or replace function public.current_teacher_matches_all_calendar_turmas(target_turmas jsonb)
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

drop policy if exists "staff_manage_school_calendar_events" on public.school_calendar_events;
create policy "staff_manage_school_calendar_events"
on public.school_calendar_events
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_own_calendar_events" on public.school_calendar_events;
create policy "teachers_manage_own_calendar_events"
on public.school_calendar_events
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
)
with check (
  public.current_user_role() = 'professores'
  and author_user_id = auth.uid()
  and public.current_teacher_matches_all_calendar_turmas(target_turmas)
);

drop policy if exists "teachers_select_published_calendar_events" on public.school_calendar_events;
create policy "teachers_select_published_calendar_events"
on public.school_calendar_events
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and status = 'published'
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "guardians_select_calendar_events" on public.school_calendar_events;
create policy "guardians_select_calendar_events"
on public.school_calendar_events
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and status = 'published'
  and public.current_user_matches_form_turmas(target_turmas)
);

drop policy if exists "staff_manage_attendance_sessions" on public.attendance_sessions;
create policy "staff_manage_attendance_sessions"
on public.attendance_sessions
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_attendance_sessions" on public.attendance_sessions;
create policy "teachers_manage_attendance_sessions"
on public.attendance_sessions
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

drop policy if exists "guardians_select_attendance_sessions" on public.attendance_sessions;
create policy "guardians_select_attendance_sessions"
on public.attendance_sessions
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and public.current_responsavel_has_turma(turma)
);

drop policy if exists "staff_manage_attendance_records" on public.attendance_records;
create policy "staff_manage_attendance_records"
on public.attendance_records
for all
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "teachers_manage_attendance_records" on public.attendance_records;
create policy "teachers_manage_attendance_records"
on public.attendance_records
for all
to authenticated
using (
  public.current_user_role() = 'professores'
  and exists (
    select 1 from public.attendance_sessions session_record
    where session_record.id = attendance_records.session_id
      and public.current_professor_has_turma(session_record.turma)
  )
)
with check (
  public.current_user_role() = 'professores'
  and exists (
    select 1 from public.attendance_sessions session_record
    where session_record.id = attendance_records.session_id
      and public.current_professor_has_turma(session_record.turma)
  )
);

drop policy if exists "guardians_select_own_attendance_records" on public.attendance_records;
create policy "guardians_select_own_attendance_records"
on public.attendance_records
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and public.current_responsavel_has_student(student_id, student_name)
);
