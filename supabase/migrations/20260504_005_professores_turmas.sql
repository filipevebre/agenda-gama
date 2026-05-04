alter table public.professores
  add column if not exists turmas text;

update public.professores
set turmas = coalesce(turmas, '')
where turmas is null;
