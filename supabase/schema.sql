-- Pravaah — Supabase schema (Phase 2).
-- Adapted to the shapes already in lib/roomTypes.ts and lib/ledger.ts rather than inventing a
-- new shape: `rooms.id` IS the human room code (e.g. "GATE-885") that's already used everywhere
-- as the room identifier — no separate `code` column, because nothing in the app has ever had a
-- room id that wasn't also its code. `rooms.broadcast`/`rooms.outcome` hold the current
-- RoomBroadcast/RoomOutcome directly as jsonb (there is only ever one "current" broadcast per
-- room — a new one clears votes and replaces the old one, exactly like the in-memory version did)
-- rather than a separate table, since nothing ever needs broadcast history.
--
-- Apply once via the Supabase SQL editor, or `node scripts/apply-schema.mjs` (uses DIRECT_URL).
-- Safe to re-run: everything is `if not exists` / `create or replace`.

create extension if not exists pgcrypto;

create table if not exists rooms (
  id          text primary key,                 -- the room code, e.g. 'GATE-885'
  scenario_id text not null,
  status      text not null default 'open' check (status in ('open', 'closed')),
  cohorts     jsonb not null,                    -- RoomCohort[], fixed at creation
  broadcast   jsonb,                             -- RoomBroadcast | null
  outcome     jsonb,                             -- RoomOutcome | null
  created_at  timestamptz not null default now()
);

create table if not exists participants (
  id         text primary key,                   -- client-generated anonymous id (localStorage)
  room_id    text not null references rooms(id) on delete cascade,
  cohort     text not null,
  lang       text not null check (lang in ('mr', 'hi', 'en')),
  simulated  boolean not null default false,
  joined_at  timestamptz not null default now()
);
create index if not exists participants_room_idx on participants(room_id);

-- One live vote per participant (matches the old in-memory Map<pid, Vote>): a new broadcast
-- deletes every vote row for that room before the message goes out, exactly like r.votes.clear().
create table if not exists votes (
  participant_id text primary key references participants(id) on delete cascade,
  room_id        text not null references rooms(id) on delete cascade,
  plan_id        text,
  choice         text not null check (choice in ('yes', 'no')),
  created_at     timestamptz not null default now()
);
create index if not exists votes_room_idx on votes(room_id);

-- The Black Box, keyed by a client-generated session id (localStorage) so the ledger survives a
-- refresh on the same laptop but different sessions/laptops never collide or interleave seq.
create table if not exists ledger_entries (
  session_id text not null,
  seq        integer not null,
  ts         timestamptz not null,
  sim_clock  text not null,
  type       text not null,
  summary    text not null,
  payload    jsonb not null default '{}'::jsonb,
  prev_hash  text not null,
  hash       text not null,
  created_at timestamptz not null default now(),
  primary key (session_id, seq)
);

-- Realtime: broadcast row-level changes on these tables to subscribed clients.
-- (ALTER PUBLICATION ... ADD TABLE has no IF NOT EXISTS either — check pg_publication_tables first.)
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'rooms') then
    alter publication supabase_realtime add table rooms;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'participants') then
    alter publication supabase_realtime add table participants;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'votes') then
    alter publication supabase_realtime add table votes;
  end if;
end $$;

-- RLS: this is a hackathon demo with anonymous participants and no auth, so every operation goes
-- through Next.js API routes using the service-role key (server-only, never shipped to the
-- browser). Row Level Security stays ON with no policies, which blocks the anon/publishable key
-- from reading or writing directly — the only path in is through our own server code.
alter table rooms enable row level security;
alter table participants enable row level security;
alter table votes enable row level security;
alter table ledger_entries enable row level security;

-- Realtime change notifications ARE allowed to anon subscribers (read-only, row contents only,
-- and everything in these rows is already public-by-design — a room's own participant counts and
-- vote tallies are shown to every phone in it). This mirrors the old in-memory behaviour, where
-- any client polling /api/room/[id] could see the same snapshot.
-- (plain PostgreSQL CREATE POLICY has no IF NOT EXISTS — drop-then-create is the idempotent form)
drop policy if exists "anon can read rooms via realtime" on rooms;
create policy "anon can read rooms via realtime" on rooms for select using (true);
drop policy if exists "anon can read participants via realtime" on participants;
create policy "anon can read participants via realtime" on participants for select using (true);
drop policy if exists "anon can read votes via realtime" on votes;
create policy "anon can read votes via realtime" on votes for select using (true);
