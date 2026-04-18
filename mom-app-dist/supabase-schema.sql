-- ============================================================
-- Ksolves MoM Tool — Supabase Database Schema
-- Run this in your Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── Companies ────────────────────────────────────────────────────────────────
create table if not exists public.companies (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  slug        text unique not null,
  invite_code text unique,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz default now()
);

-- ─── Profiles ─────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text,
  full_name       text,
  company_id      uuid references public.companies(id) on delete set null,
  claude_api_key  text,   -- stored encrypted at rest by Supabase
  created_at      timestamptz default now()
);

-- ─── Company Members ──────────────────────────────────────────────────────────
create table if not exists public.company_members (
  id          uuid primary key default uuid_generate_v4(),
  company_id  uuid not null references public.companies(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at   timestamptz default now(),
  unique (company_id, user_id)
);

-- ─── MoMs ────────────────────────────────────────────────────────────────────
create table if not exists public.moms (
  id            uuid primary key default uuid_generate_v4(),
  company_id    uuid not null references public.companies(id) on delete cascade,
  created_by    uuid references auth.users(id) on delete set null,
  title         text not null default '',
  client        text default '',
  date          date,
  time          text default '',
  platform      text default '',
  location      text default '',
  category      text default '',
  agenda        jsonb default '[]',
  attendees     jsonb default '[]',
  discussions   jsonb default '[]',
  action_items  jsonb default '[]',
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger moms_updated_at
  before update on public.moms
  for each row execute function public.handle_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

alter table public.companies       enable row level security;
alter table public.profiles        enable row level security;
alter table public.company_members enable row level security;
alter table public.moms            enable row level security;

-- Profiles: users can read/write own profile
create policy "profiles_own" on public.profiles
  for all using (auth.uid() = id);

-- Companies: members can read their company
create policy "companies_read" on public.companies
  for select using (
    id in (select company_id from public.company_members where user_id = auth.uid())
  );
-- Authenticated users can create companies
create policy "companies_insert" on public.companies
  for insert with check (auth.uid() is not null);
-- Owners can update their company
create policy "companies_update" on public.companies
  for update using (created_by = auth.uid());

-- Company members: visible to members of same company
create policy "members_read" on public.company_members
  for select using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );
create policy "members_insert" on public.company_members
  for insert with check (auth.uid() is not null);
-- Owners can remove members
create policy "members_delete" on public.company_members
  for delete using (
    company_id in (select id from public.companies where created_by = auth.uid())
    or user_id = auth.uid()  -- users can remove themselves
  );

-- MoMs: all company members can read/write
create policy "moms_company" on public.moms
  for all using (
    company_id in (select company_id from public.company_members where user_id = auth.uid())
  );

-- ─── Helper: auto-create profile on signup ────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
