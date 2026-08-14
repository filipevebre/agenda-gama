begin;

create or replace function public.current_funcionario_has_sector(target_sector text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.equipe e
    where (
      e.auth_user_id = auth.uid()
      or lower(coalesce(e.email, '')) = coalesce(public.current_user_email(), '')
    )
      and (
        public.normalize_turma_label(e.setor) = public.normalize_turma_label(target_sector)
        or public.normalize_turma_label(e.cargo) = public.normalize_turma_label(target_sector)
        or public.normalize_turma_label(target_sector) like '%' || public.normalize_turma_label(e.setor) || '%'
        or public.normalize_turma_label(e.setor) like '%' || public.normalize_turma_label(target_sector) || '%'
      )
  )
$$;

create or replace function public.is_non_turma_channel(target_publico text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.turmas t
    where public.normalize_turma_label(t.nome) = public.normalize_turma_label(target_publico)
  )
$$;

drop policy if exists "profiles_select_authenticated" on public.profiles;
drop policy if exists "profiles_select_own_or_admin" on public.profiles;
create policy "profiles_select_own_or_admin"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  or public.current_user_role() = 'administrador'
);

drop policy if exists "profiles_update_staff" on public.profiles;
drop policy if exists "profiles_update_admin" on public.profiles;
create policy "profiles_update_admin"
on public.profiles
for update
to authenticated
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

drop policy if exists "profile_roles_select_own_or_staff" on public.profile_roles;
drop policy if exists "profile_roles_select_own_or_admin" on public.profile_roles;
create policy "profile_roles_select_own_or_admin"
on public.profile_roles
for select
to authenticated
using (
  user_id = auth.uid()
  or public.current_user_role() = 'administrador'
);

alter table public.communication_messages
  add column if not exists sender_user_id uuid references auth.users (id) on delete set null,
  add column if not exists thread_key text,
  add column if not exists responsible_email text,
  add column if not exists student_id uuid,
  add column if not exists turma text not null default '',
  add column if not exists sector text not null default '',
  add column if not exists internal_only boolean not null default false,
  add column if not exists recipient_emails text[] not null default '{}'::text[];

create index if not exists communication_messages_sender_user_id_idx
  on public.communication_messages (sender_user_id);
create index if not exists communication_messages_responsible_email_idx
  on public.communication_messages (lower(responsible_email));
create index if not exists communication_messages_turma_idx
  on public.communication_messages (turma);
create index if not exists communication_messages_sector_idx
  on public.communication_messages (sector);
create index if not exists communication_messages_thread_key_idx
  on public.communication_messages (thread_key);

create or replace function public.communication_message_envelope(raw_content text)
returns jsonb
language plpgsql
immutable
as $$
begin
  if coalesce(raw_content, '') not like 'AGAMA_MESSAGE::%' then
    return '{}'::jsonb;
  end if;

  return substring(raw_content from 16)::jsonb;
exception when others then
  return '{}'::jsonb;
end;
$$;

create or replace function public.set_communication_message_access_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  envelope jsonb;
  thread_data jsonb;
begin
  envelope := public.communication_message_envelope(new.content);
  thread_data := coalesce(envelope -> 'thread', '{}'::jsonb);

  if tg_op = 'UPDATE' then
    new.sender_user_id := old.sender_user_id;
    new.sender_email := old.sender_email;
    new.sender_role := old.sender_role;
    new.thread_key := old.thread_key;
    new.responsible_email := old.responsible_email;
    new.student_id := old.student_id;
    new.turma := old.turma;
    new.sector := old.sector;
    new.internal_only := old.internal_only;
    new.recipient_emails := old.recipient_emails;
    return new;
  else
    new.sender_user_id := coalesce(new.sender_user_id, auth.uid());
  end if;

  new.thread_key := coalesce(nullif(new.thread_key, ''), nullif(thread_data ->> 'key', ''));
  new.responsible_email := lower(coalesce(
    nullif(new.responsible_email, ''),
    nullif(thread_data ->> 'responsibleEmail', ''),
    case when new.sender_role = 'responsaveis' then new.sender_email else null end
  ));
  new.turma := coalesce(nullif(new.turma, ''), thread_data ->> 'turma', '');
  new.sector := coalesce(nullif(new.sector, ''), thread_data ->> 'sector', '');
  new.student_id := coalesce(
    new.student_id,
    case
      when coalesce(thread_data ->> 'studentId', '') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      then (thread_data ->> 'studentId')::uuid
      else null
    end
  );
  new.internal_only := coalesce((envelope ->> 'internalOnly')::boolean, new.internal_only, false);

  if coalesce(array_length(new.recipient_emails, 1), 0) = 0 then
    select coalesce(array_agg(lower(value)), '{}'::text[])
    into new.recipient_emails
    from jsonb_array_elements_text(coalesce(to_jsonb(new.recipients), '[]'::jsonb)) as recipient(value)
    where value like '%@%';
  end if;

  return new;
end;
$$;

drop trigger if exists communication_messages_access_fields on public.communication_messages;
create trigger communication_messages_access_fields
before insert or update on public.communication_messages
for each row execute function public.set_communication_message_access_fields();

update public.communication_messages m
set sender_user_id = coalesce(
      m.sender_user_id,
      (select p.id from public.profiles p where lower(p.email) = lower(m.sender_email) limit 1)
    ),
    thread_key = coalesce(nullif(m.thread_key, ''), public.communication_message_envelope(m.content) #>> '{thread,key}'),
    responsible_email = lower(coalesce(
      nullif(m.responsible_email, ''),
      public.communication_message_envelope(m.content) #>> '{thread,responsibleEmail}',
      case when m.sender_role = 'responsaveis' then m.sender_email else null end
    )),
    turma = coalesce(nullif(m.turma, ''), public.communication_message_envelope(m.content) #>> '{thread,turma}', ''),
    sector = coalesce(nullif(m.sector, ''), public.communication_message_envelope(m.content) #>> '{thread,sector}', ''),
    internal_only = coalesce((public.communication_message_envelope(m.content) ->> 'internalOnly')::boolean, false),
    recipient_emails = coalesce(
      (
        select array_agg(lower(value))
        from jsonb_array_elements_text(coalesce(to_jsonb(m.recipients), '[]'::jsonb)) as recipient(value)
        where value like '%@%'
      ),
      '{}'::text[]
    );

drop policy if exists "authenticated_use_communication_channels" on public.communication_channels;
drop policy if exists "communication_channels_select_visible" on public.communication_channels;
drop policy if exists "communication_channels_manage_staff" on public.communication_channels;

create policy "communication_channels_select_visible"
on public.communication_channels
for select
to authenticated
using (
  public.current_user_role() in ('administrador', 'funcionarios')
  or public.is_non_turma_channel(publico)
  or (
    public.current_user_role() = 'professores'
    and public.current_professor_has_turma(publico)
  )
  or (
    public.current_user_role() = 'responsaveis'
    and public.current_responsavel_has_turma(publico)
  )
);

create policy "communication_channels_manage_staff"
on public.communication_channels
for all
to authenticated
using (public.current_user_role() = 'administrador')
with check (public.current_user_role() = 'administrador');

drop policy if exists "authenticated_use_communication_messages" on public.communication_messages;
drop policy if exists "communication_messages_select_visible" on public.communication_messages;
drop policy if exists "communication_messages_insert_visible" on public.communication_messages;
drop policy if exists "communication_messages_update_school" on public.communication_messages;
drop policy if exists "communication_messages_delete_school" on public.communication_messages;

create policy "communication_messages_select_visible"
on public.communication_messages
for select
to authenticated
using (
  public.current_user_role() = 'administrador'
  or (
    public.current_user_role() = 'funcionarios'
    and (
      sender_user_id = auth.uid()
      or
      coalesce(sector, '') = ''
      or public.current_funcionario_has_sector(sector)
      or recipient_type = 'turmas'
    )
  )
  or (
    public.current_user_role() = 'professores'
    and (
      sender_user_id = auth.uid()
      or public.current_professor_has_turma(turma)
    )
  )
  or (
    public.current_user_role() = 'responsaveis'
    and not internal_only
    and (
      sender_user_id = auth.uid()
      or lower(coalesce(responsible_email, '')) = coalesce(public.current_user_email(), '')
      or coalesce(public.current_user_email(), '') = any(recipient_emails)
    )
  )
);

create policy "communication_messages_insert_visible"
on public.communication_messages
for insert
to authenticated
with check (
  sender_user_id = auth.uid()
  and lower(sender_email) = coalesce(public.current_user_email(), '')
  and (
    public.current_user_role() = 'administrador'
    or public.current_user_role() = 'funcionarios'
    or (
      public.current_user_role() = 'professores'
      and public.current_professor_has_turma(turma)
    )
    or (
      public.current_user_role() = 'responsaveis'
      and not internal_only
      and lower(coalesce(responsible_email, '')) = coalesce(public.current_user_email(), '')
      and public.current_responsavel_has_turma(turma)
    )
  )
);

create policy "communication_messages_update_school"
on public.communication_messages
for update
to authenticated
using (
  public.current_user_role() = 'administrador'
  or (
    public.current_user_role() = 'funcionarios'
    and (sender_user_id = auth.uid() or coalesce(sector, '') = '' or public.current_funcionario_has_sector(sector))
  )
  or (
    public.current_user_role() = 'professores'
    and sender_user_id = auth.uid()
    and public.current_professor_has_turma(turma)
  )
)
with check (
  public.current_user_role() = 'administrador'
  or (
    public.current_user_role() = 'funcionarios'
    and (sender_user_id = auth.uid() or coalesce(sector, '') = '' or public.current_funcionario_has_sector(sector))
  )
  or (
    public.current_user_role() = 'professores'
    and sender_user_id = auth.uid()
    and public.current_professor_has_turma(turma)
  )
);

create policy "communication_messages_delete_school"
on public.communication_messages
for delete
to authenticated
using (
  public.current_user_role() = 'administrador'
  or (
    public.current_user_role() = 'funcionarios'
    and (sender_user_id = auth.uid() or coalesce(sector, '') = '' or public.current_funcionario_has_sector(sector))
  )
  or (
    public.current_user_role() = 'professores'
    and sender_user_id = auth.uid()
    and public.current_professor_has_turma(turma)
  )
);

revoke all on function public.current_funcionario_has_sector(text) from public;
revoke all on function public.is_non_turma_channel(text) from public;
revoke all on function public.communication_message_envelope(text) from public;
grant execute on function public.current_funcionario_has_sector(text) to authenticated;
grant execute on function public.is_non_turma_channel(text) to authenticated;

commit;
