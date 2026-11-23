-- Seaworthy production schema (Postgres / Neon / Supabase)
-- Apply with: npm run db:migrate

create table if not exists scans (
  receipt_id   text primary key,
  url          text not null,
  score        integer not null check (score between 0 and 100),
  coverage     integer not null check (coverage between 0 and 100),
  checks_run   integer not null,
  checks_total integer not null,
  duration_ms  integer not null,
  findings     jsonb not null default '[]'::jsonb,
  summary      text not null,
  checks       jsonb not null default '[]'::jsonb,
  counts       jsonb not null default '{}'::jsonb,
  meta         jsonb not null default '{}'::jsonb,
  created_at   timestamptz not null default now()
);

-- Additive migration for databases created before `meta` existed.
alter table scans add column if not exists meta jsonb not null default '{}'::jsonb;

create index if not exists scans_created_at_idx on scans (created_at desc);

create table if not exists waitlist (
  email      text primary key,
  source     text not null default 'website',
  created_at timestamptz not null default now()
);

create index if not exists waitlist_created_at_idx on waitlist (created_at desc);
