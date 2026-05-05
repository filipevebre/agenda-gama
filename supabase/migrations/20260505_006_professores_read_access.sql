create extension if not exists unaccent;

create or replace function public.current_user_email()
returns text
language sql
stable
security definer
set search_path = public
as $$
  select lower(email)
  from public.profiles
  where id = auth.uid()
  limit 1
$$;

create or replace function public.normalize_turma_label(input text)
returns text
language sql
immutable
as $$
  select trim(
    regexp_replace(
      translate(
        lower(unaccent(coalesce(input, ''))),
        chr(186) || chr(176),
        'oo'
      ),
      '[^a-z0-9]+',
      ' ',
      'g'
    )
  )
$$;

create or replace function public.current_professor_has_turma(target_turma text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.professores p
    cross join lateral regexp_split_to_table(coalesce(p.turmas, ''), '\s*,\s*') as turma_nome
    where (
      p.auth_user_id = auth.uid()
      or lower(coalesce(p.email, '')) = coalesce(public.current_user_email(), '')
    )
      and public.normalize_turma_label(split_part(turma_nome, ' - ', 1)) = public.normalize_turma_label(target_turma)
  )
$$;

drop policy if exists "teachers_select_own_professor_record" on public.professores;
create policy "teachers_select_own_professor_record"
on public.professores
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and (
    auth_user_id = auth.uid()
    or lower(coalesce(email, '')) = coalesce(public.current_user_email(), '')
  )
);

drop policy if exists "teachers_select_own_turmas" on public.turmas;
create policy "teachers_select_own_turmas"
on public.turmas
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(nome)
);

drop policy if exists "teachers_select_students_from_own_turmas" on public.alunos;
create policy "teachers_select_students_from_own_turmas"
on public.alunos
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and public.current_professor_has_turma(turma)
);

drop policy if exists "teachers_select_guardians_from_own_turmas" on public.responsaveis;
create policy "teachers_select_guardians_from_own_turmas"
on public.responsaveis
for select
to authenticated
using (
  public.current_user_role() = 'professores'
  and exists (
    select 1
    from public.alunos a
    where (
      responsaveis.aluno_id = a.id
      or public.normalize_turma_label(responsaveis.aluno) = public.normalize_turma_label(a.nome)
    )
      and public.current_professor_has_turma(a.turma)
  )
);
