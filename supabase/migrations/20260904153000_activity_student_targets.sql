begin;

alter table public.school_activities
  add column if not exists target_student_ids jsonb not null default '[]'::jsonb
  check (jsonb_typeof(target_student_ids) = 'array');

create index if not exists school_activities_target_student_ids_idx
  on public.school_activities using gin (target_student_ids);

create or replace function public.activity_target_students_match_turmas(
  target_student_ids jsonb,
  target_turmas jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_typeof(coalesce(target_student_ids, '[]'::jsonb)) = 'array'
    and not exists (
      select 1
      from jsonb_array_elements_text(coalesce(target_student_ids, '[]'::jsonb)) as target(student_id)
      left join public.alunos student on student.id::text = target.student_id
      where student.id is null
        or not exists (
          select 1
          from jsonb_array_elements_text(coalesce(target_turmas, '[]'::jsonb)) as turma(nome)
          where public.normalize_turma_label(turma.nome) = public.normalize_turma_label(student.turma)
        )
    )
$$;

create or replace function public.current_guardian_matches_activity_targets(
  target_turmas jsonb,
  target_student_ids jsonb
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.current_user_matches_form_turmas(target_turmas)
    and (
      jsonb_array_length(coalesce(target_student_ids, '[]'::jsonb)) = 0
      or exists (
        select 1
        from jsonb_array_elements_text(coalesce(target_student_ids, '[]'::jsonb)) as target(student_id)
        join public.alunos student on student.id::text = target.student_id
        where public.current_responsavel_has_student(student.id, student.nome)
      )
    )
$$;

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
  and public.activity_target_students_match_turmas(target_student_ids, target_turmas)
);

drop policy if exists "guardians_select_school_activities" on public.school_activities;
create policy "guardians_select_school_activities"
on public.school_activities
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and status in ('published', 'closed')
  and public.current_guardian_matches_activity_targets(target_turmas, target_student_ids)
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
      and public.current_guardian_matches_activity_targets(
        activity_record.target_turmas,
        activity_record.target_student_ids
      )
      and (
        jsonb_array_length(activity_record.target_student_ids) = 0
        or activity_record.target_student_ids ? school_activity_completions.student_id::text
      )
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
      and public.current_guardian_matches_activity_targets(
        activity_record.target_turmas,
        activity_record.target_student_ids
      )
      and (
        jsonb_array_length(activity_record.target_student_ids) = 0
        or activity_record.target_student_ids ? school_activity_completions.student_id::text
      )
  )
);

notify pgrst, 'reload schema';

commit;
