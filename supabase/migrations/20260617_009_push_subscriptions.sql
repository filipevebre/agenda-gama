create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid not null references auth.users (id) on delete cascade,
  endpoint text not null unique,
  subscription jsonb not null,
  device_label text not null default '',
  user_agent text not null default '',
  last_seen_at timestamptz not null default timezone('utc', now()),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index if not exists push_subscriptions_auth_user_id_idx
  on public.push_subscriptions (auth_user_id);

drop trigger if exists push_subscriptions_set_updated_at on public.push_subscriptions;
create trigger push_subscriptions_set_updated_at
before update on public.push_subscriptions
for each row execute function public.set_updated_at();

alter table public.push_subscriptions enable row level security;

drop policy if exists "users_select_own_push_subscriptions" on public.push_subscriptions;
create policy "users_select_own_push_subscriptions"
on public.push_subscriptions
for select
to authenticated
using (auth.uid() = auth_user_id);

drop policy if exists "users_insert_own_push_subscriptions" on public.push_subscriptions;
create policy "users_insert_own_push_subscriptions"
on public.push_subscriptions
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists "users_update_own_push_subscriptions" on public.push_subscriptions;
create policy "users_update_own_push_subscriptions"
on public.push_subscriptions
for update
to authenticated
using (auth.uid() = auth_user_id)
with check (auth.uid() = auth_user_id);

drop policy if exists "users_delete_own_push_subscriptions" on public.push_subscriptions;
create policy "users_delete_own_push_subscriptions"
on public.push_subscriptions
for delete
to authenticated
using (auth.uid() = auth_user_id);
