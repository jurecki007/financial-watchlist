-- profiles: one row per auth user, created automatically on signup.
--
-- The row is created by a trigger rather than by the client. If the client
-- created it, a signup that succeeded in auth.users but failed on the client
-- round-trip would leave a user with no profile, and nothing would ever
-- reconcile it. The trigger makes profile creation part of the same
-- transaction as the user insert.

create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  created_at   timestamptz not null default now()
);

comment on table public.profiles is
  'Public user profile. Created by handle_new_user() on auth.users insert — never by the client.';

alter table public.profiles enable row level security;

-- Read and update your own profile. There is deliberately no INSERT policy:
-- the trigger owns creation, and no DELETE policy: profiles die with the
-- auth user via ON DELETE CASCADE.
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- The trigger function.
--
-- SECURITY DEFINER is required — it writes to public.profiles while running as
-- the auth system inserting into auth.users. That makes `set search_path = ''`
-- mandatory rather than stylistic: without it, a schema earlier on the caller's
-- search_path could shadow `profiles` or a function this body calls, and the
-- shadowed object would execute with the definer's privileges. Every reference
-- below is therefore schema-qualified.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    -- Google returns full_name or name; email/password signup has neither, so
    -- fall back to the local part of the address rather than leaving it null.
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    )
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
