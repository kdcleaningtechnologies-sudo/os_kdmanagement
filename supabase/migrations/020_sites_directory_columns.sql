-- Site form fields that lived only in the demo seed (002). Fresh databases
-- never got them, so Save failed with: Could not find the 'services' column.
-- Safe to re-run.

alter table public.sites add column if not exists services text[] default '{}';
alter table public.sites add column if not exists shift_timings text;
alter table public.sites add column if not exists city text;

notify pgrst, 'reload schema';
