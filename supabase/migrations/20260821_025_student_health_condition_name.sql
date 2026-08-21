begin;

alter table public.student_health_records
  add column if not exists condition_name text not null default '';

update public.student_health_records
set condition_name = left(trim(observation), 160)
where trim(condition_name) = '';

alter table public.student_health_records
  drop constraint if exists student_health_records_condition_name_check;

alter table public.student_health_records
  add constraint student_health_records_condition_name_check
  check (length(trim(condition_name)) between 1 and 160);

commit;
