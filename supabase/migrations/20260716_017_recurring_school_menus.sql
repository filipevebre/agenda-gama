alter table public.school_menus
  add column if not exists cycle_id uuid,
  add column if not exists weekday smallint,
  add column if not exists period_type text,
  add column if not exists period_year integer,
  add column if not exists valid_from date,
  add column if not exists valid_until date;

with menu_weeks as (
  select date_trunc('week', menu_date)::date as week_start, gen_random_uuid() as cycle_id
  from public.school_menus
  where cycle_id is null
  group by date_trunc('week', menu_date)::date
)
update public.school_menus menu_record
set cycle_id = menu_weeks.cycle_id
from menu_weeks
where menu_record.cycle_id is null
  and date_trunc('week', menu_record.menu_date)::date = menu_weeks.week_start;

update public.school_menus
set weekday = extract(isodow from menu_date)::smallint
where weekday is null;

update public.school_menus
set period_type = 'custom'
where period_type is null;

update public.school_menus
set period_year = extract(year from menu_date)::integer
where period_year is null;

update public.school_menus
set valid_from = date_trunc('week', menu_date)::date
where valid_from is null;

update public.school_menus
set valid_until = (date_trunc('week', menu_date)::date + 4)
where valid_until is null;

alter table public.school_menus
  alter column cycle_id set default gen_random_uuid(),
  alter column cycle_id set not null,
  alter column weekday set not null,
  alter column period_type set default 'year',
  alter column period_type set not null,
  alter column period_year set not null,
  alter column valid_from set not null,
  alter column valid_until set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'school_menus_weekday_check'
      and conrelid = 'public.school_menus'::regclass
  ) then
    alter table public.school_menus
      add constraint school_menus_weekday_check check (weekday between 1 and 5);
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'school_menus_period_type_check'
      and conrelid = 'public.school_menus'::regclass
  ) then
    alter table public.school_menus
      add constraint school_menus_period_type_check check (period_type in ('year', 'semester_1', 'semester_2', 'custom'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'school_menus_validity_check'
      and conrelid = 'public.school_menus'::regclass
  ) then
    alter table public.school_menus
      add constraint school_menus_validity_check check (valid_until >= valid_from);
  end if;
end
$$;

create index if not exists school_menus_cycle_weekday_idx
  on public.school_menus (cycle_id, weekday);

create index if not exists school_menus_validity_idx
  on public.school_menus (valid_from, valid_until, status);
