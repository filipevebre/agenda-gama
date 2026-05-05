create or replace function public.current_responsavel_has_student(target_student_id uuid, target_student_name text default null)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.responsaveis r
    where (
      r.auth_user_id = auth.uid()
      or lower(coalesce(r.email, '')) = coalesce(public.current_user_email(), '')
    )
      and (
        (target_student_id is not null and r.aluno_id = target_student_id)
        or (
          target_student_name is not null
          and public.normalize_turma_label(r.aluno) = public.normalize_turma_label(target_student_name)
        )
      )
  )
$$;

create or replace function public.current_responsavel_has_turma(target_turma text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.responsaveis r
    join public.alunos a
      on (
        r.aluno_id = a.id
        or public.normalize_turma_label(r.aluno) = public.normalize_turma_label(a.nome)
      )
    where (
      r.auth_user_id = auth.uid()
      or lower(coalesce(r.email, '')) = coalesce(public.current_user_email(), '')
    )
      and public.normalize_turma_label(a.turma) = public.normalize_turma_label(target_turma)
  )
$$;

drop policy if exists "guardians_select_own_records" on public.responsaveis;
create policy "guardians_select_own_records"
on public.responsaveis
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and (
    auth_user_id = auth.uid()
    or lower(coalesce(email, '')) = coalesce(public.current_user_email(), '')
  )
);

drop policy if exists "guardians_select_linked_students" on public.alunos;
create policy "guardians_select_linked_students"
on public.alunos
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and public.current_responsavel_has_student(id, nome)
);

drop policy if exists "guardians_select_linked_turmas" on public.turmas;
create policy "guardians_select_linked_turmas"
on public.turmas
for select
to authenticated
using (
  public.current_user_role() = 'responsaveis'
  and public.current_responsavel_has_turma(nome)
);
