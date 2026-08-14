create table if not exists public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  token text not null unique,
  platform text not null default 'android' check (platform in ('android', 'ios')),
  device_label text not null default '',
  user_agent text not null default '',
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists native_push_tokens_auth_user_id_idx
  on public.native_push_tokens (auth_user_id);

drop trigger if exists native_push_tokens_set_updated_at on public.native_push_tokens;
create trigger native_push_tokens_set_updated_at
before update on public.native_push_tokens
for each row execute function public.set_updated_at();

alter table public.native_push_tokens enable row level security;

drop policy if exists "users_select_own_native_push_tokens" on public.native_push_tokens;
create policy "users_select_own_native_push_tokens"
on public.native_push_tokens
for select
to authenticated
using (auth.uid() = auth_user_id);
drop policy if exists "users_insert_own_native_push_tokens" on public.native_push_tokens;
create policy "users_insert_own_native_push_tokens"
on public.native_push_tokens
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists "users_update_own_native_push_tokens" on public.native_push_tokens;
create policy "users_update_own_native_push_tokens"
on public.native_push_tokens
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "users_delete_own_native_push_tokens" on public.native_push_tokens;
create policy "users_delete_own_native_push_tokens"
on public.native_push_tokens
for delete
to authenticated
using (auth.uid() = auth_user_id);
