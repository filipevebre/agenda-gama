update public.disciplinas
set nome = 'Matemática'
where nome in ('MatemÃ¡tica', 'MatemÃƒÂ¡tica');

drop policy if exists "authenticated_read_disciplinas" on public.disciplinas;
create policy "authenticated_read_disciplinas"
on public.disciplinas
for select
to authenticated
using (true);
