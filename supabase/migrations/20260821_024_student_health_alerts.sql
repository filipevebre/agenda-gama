begin;

create table if not exists public.student_health_records (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null unique references public.alunos (id) on delete cascade,
  category text not null check (category in ('food_restriction', 'health_condition', 'other')),
  observation text not null check (length(trim(observation)) > 0),
  document_path text not null default '',
  document_name text not null default '',
  document_mime_type text not null default '',
  created_by_user_id uuid references auth.users (id) on delete set null,
  created_by_name text not null default '',
  active boolean not null default true,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists student_health_records_active_idx
  on public.student_health_records (active, updated_at desc);

drop trigger if exists student_health_records_set_updated_at on public.student_health_records;
create trigger student_health_records_set_updated_at
before update on public.student_health_records
for each row execute function public.set_updated_at();

alter table public.student_health_records enable row level security;

drop policy if exists "student_health_select_staff" on public.student_health_records;
create policy "student_health_select_staff"
on public.student_health_records
for select
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "student_health_insert_staff" on public.student_health_records;
create policy "student_health_insert_staff"
on public.student_health_records
for insert
to authenticated
with check (
  public.current_user_role() in ('administrador', 'funcionarios')
  and (created_by_user_id is null or created_by_user_id = auth.uid())
);

drop policy if exists "student_health_update_staff" on public.student_health_records;
create policy "student_health_update_staff"
on public.student_health_records
for update
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'))
with check (public.current_user_role() in ('administrador', 'funcionarios'));

drop policy if exists "student_health_delete_staff" on public.student_health_records;
create policy "student_health_delete_staff"
on public.student_health_records
for delete
to authenticated
using (public.current_user_role() in ('administrador', 'funcionarios'));

grant select, insert, update, delete on public.student_health_records to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'student-health-documents',
  'student-health-documents',
  false,
  10485760,
  array['application/pdf', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "student_health_documents_select_staff" on storage.objects;
create policy "student_health_documents_select_staff"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'student-health-documents'
  and public.current_user_role() in ('administrador', 'funcionarios')
);

drop policy if exists "student_health_documents_insert_staff" on storage.objects;
create policy "student_health_documents_insert_staff"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'student-health-documents'
  and public.current_user_role() in ('administrador', 'funcionarios')
  and (storage.foldername(name))[1] = auth.uid()::text
);

drop policy if exists "student_health_documents_update_staff" on storage.objects;
create policy "student_health_documents_update_staff"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'student-health-documents'
  and public.current_user_role() in ('administrador', 'funcionarios')
)
with check (
  bucket_id = 'student-health-documents'
  and public.current_user_role() in ('administrador', 'funcionarios')
);

drop policy if exists "student_health_documents_delete_staff" on storage.objects;
create policy "student_health_documents_delete_staff"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'student-health-documents'
  and public.current_user_role() in ('administrador', 'funcionarios')
);

commit;
