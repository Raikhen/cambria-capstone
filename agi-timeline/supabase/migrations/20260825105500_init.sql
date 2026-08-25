-- AGI Timeline — initial schema.
-- Mirrors docs/EVENT_SCHEMA.md. Writes go through the service role only.

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  date date not null,
  date_precision text not null check (date_precision in ('day', 'month', 'year')),
  title text not null,
  summary text not null,
  category text not null check (
    category in ('capabilities', 'safety', 'governance', 'industry', 'research', 'culture')
  ),
  secondary_category text null check (
    secondary_category is null
    or secondary_category in ('capabilities', 'safety', 'governance', 'industry', 'research', 'culture')
  ),
  importance smallint not null check (importance between 1 and 5),
  importance_rationale text,
  sources jsonb not null default '[]',
  reactions jsonb not null default '[]',
  added_by text not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists events_date_idx on public.events (date);
create index if not exists events_category_idx on public.events (category);
create index if not exists events_importance_idx on public.events (importance);

create table if not exists public.ingestion_runs (
  id uuid primary key default gen_random_uuid(),
  started_at timestamptz default now(),
  finished_at timestamptz,
  status text,
  events_added int default 0,
  events_considered int default 0,
  log jsonb default '[]'
);

-- Row Level Security: public read on events; ingestion_runs is service-role only.
alter table public.events enable row level security;
alter table public.ingestion_runs enable row level security;

create policy "Public read access to events"
  on public.events
  for select
  to anon, authenticated
  using (true);

-- No policies on ingestion_runs: anon/authenticated get nothing;
-- the service role bypasses RLS for all writes and reads.
