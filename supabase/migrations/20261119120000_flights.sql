-- Flights of stairs climbed per day. Scored like steps (see src/config/scoring.ts).
alter table public.daily_stats
  add column flights integer check (flights between 0 and 500),
  add column flights_source public.data_source;
