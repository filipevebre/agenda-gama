alter table public.responsaveis
  add column if not exists aluno_id uuid references public.alunos (id) on delete set null;

update public.responsaveis r
set aluno_id = a.id
from public.alunos a
where r.aluno_id is null
  and lower(trim(r.aluno)) = lower(trim(a.nome));
