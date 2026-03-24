-- ══════════════════════════════════════════════════════════════════════════════
-- TITAN OS — Supabase Schema
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ══════════════════════════════════════════════════════════════════════════════

-- 1. Profiles table (extends auth.users with app-specific fields)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  name text not null,
  role text not null default 'Member',
  initials text not null default '',
  color text not null default '#00d4ff',
  dept text not null default 'General',
  is_admin boolean not null default false,
  created_at timestamptz default now()
);

-- Enable RLS
alter table public.profiles enable row level security;

-- Everyone can read all profiles (team visibility)
create policy "Profiles are viewable by everyone" on public.profiles
  for select using (true);

-- Users can update their own profile
create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Allow insert during signup
create policy "Users can insert own profile" on public.profiles
  for insert with check (auth.uid() = id);

-- 2. Workspace state table (stores all app data as JSONB)
create table if not exists public.workspace_state (
  id text primary key default 'default',
  data jsonb not null default '{}',
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.workspace_state enable row level security;

-- All authenticated users can read workspace state
create policy "Workspace readable by authenticated" on public.workspace_state
  for select using (auth.role() = 'authenticated');

-- All authenticated users can update workspace state
create policy "Workspace writable by authenticated" on public.workspace_state
  for update using (auth.role() = 'authenticated');

-- All authenticated users can insert workspace state
create policy "Workspace insertable by authenticated" on public.workspace_state
  for insert with check (auth.role() = 'authenticated');

-- 3. Auto-create profile on signup via trigger
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, name, role, initials, color, dept, is_admin)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'Member'),
    coalesce(new.raw_user_meta_data->>'initials', upper(left(split_part(new.email, '@', 1), 2))),
    coalesce(new.raw_user_meta_data->>'color', '#00d4ff'),
    coalesce(new.raw_user_meta_data->>'dept', 'General'),
    coalesce((new.raw_user_meta_data->>'is_admin')::boolean, false)
  );
  return new;
end;
$$ language plpgsql security definer;

-- Drop trigger if it exists, then create
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 4. Insert default workspace state row
insert into public.workspace_state (id, data) values ('default', '{}')
on conflict (id) do nothing;

-- 5. Enable Realtime on workspace_state so changes sync across all users
-- This allows the CEO dashboard to see employee check-ins/tasks in real-time
alter publication supabase_realtime add table public.workspace_state;
