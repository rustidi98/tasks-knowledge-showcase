-- Row-Level Security: the security boundary in the database (sanitized extract)
-- -----------------------------------------------------------------------------
-- Authorization here is NOT just app-level checks. Every table that holds
-- user-visible data has RLS enabled and dedicated policies, so the database
-- itself refuses to return a row the current user isn't allowed to see. If the
-- application layer has a bug — a forgotten WHERE, a leaky join — Postgres is
-- the backstop, and it doesn't leak. More work up front; much harder to bypass
-- later.
--
-- The pattern, shown on a "work groups" table:
--   * a SECURITY DEFINER helper answers "is this user a member of this group?"
--     once, so every policy can reuse it without duplicating the join;
--   * SELECT is allowed if you're a member (or the creator);
--   * INSERT is allowed only when you're stamping yourself as the creator —
--     you can't forge a row on someone else's behalf.
--
-- `auth.uid()` is the authenticated user id, provided by the platform's auth
-- layer at the database session level. Sanitized: names generalized; logic and
-- SQL are unchanged.

-- Membership check, centralized in one SECURITY DEFINER function so policies
-- stay simple and consistent (and so the check runs with a stable, audited
-- definition instead of being re-implemented per policy).
create or replace function public.is_group_member(p_group_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from group_members gm
    where gm.group_id = p_group_id
      and gm.user_id  = p_user_id
  );
$$;

-- Turn RLS on. Without an explicit permissive policy below, this table now
-- returns ZERO rows to a normal user — deny-by-default is the safe posture.
alter table public.work_groups enable row level security;

-- The creator column defaults to the caller, so a client cannot claim a
-- different author even if it tries.
alter table public.work_groups
  alter column created_by set default auth.uid();

-- SELECT: you can read a group only if you belong to it (or you made it).
drop policy if exists work_groups_select_member on public.work_groups;
create policy work_groups_select_member
  on public.work_groups
  for select
  to authenticated
  using (
    public.is_group_member(id, auth.uid())
    or created_by = auth.uid()
  );

-- INSERT: you may create a group only with yourself as the creator. WITH CHECK
-- is evaluated on the NEW row, so a forged created_by is rejected at write time.
drop policy if exists work_groups_insert_self on public.work_groups;
create policy work_groups_insert_self
  on public.work_groups
  for insert
  to authenticated
  with check (
    auth.uid() is not null
    and created_by = auth.uid()
  );
