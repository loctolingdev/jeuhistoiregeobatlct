-- Bordeaux 1750: authenticated/anonymous saves and server-enforced moderation.
-- Apply this migration to the external Supabase project before deploying the app.

create table if not exists public.game_saves (
  user_id uuid primary key references auth.users (id) on delete cascade,
  save_data jsonb not null default '{}'::jsonb check (jsonb_typeof(save_data) = 'object'),
  updated_at timestamptz not null default now()
);

create table if not exists public.player_moderation (
  user_id uuid primary key references auth.users (id) on delete cascade,
  banned_until timestamptz,
  permanent_ban boolean not null default false,
  ban_reason text,
  kick_version integer not null default 0 check (kick_version >= 0),
  last_kick_at timestamptz,
  updated_at timestamptz not null default now()
);

create table if not exists public.player_warnings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  message text not null check (length(message) between 1 and 500),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  acknowledged_at timestamptz
);

create index if not exists player_warnings_unread_idx
  on public.player_warnings (user_id, created_at)
  where acknowledged_at is null;

do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    and not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = 'game_saves'
    ) then
    alter publication supabase_realtime add table public.game_saves;
  end if;
end;
$$;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.touch_updated_at() from public, anon, authenticated;

drop trigger if exists game_saves_touch_updated_at on public.game_saves;
create trigger game_saves_touch_updated_at
  before update on public.game_saves
  for each row execute function public.touch_updated_at();

drop trigger if exists player_moderation_touch_updated_at on public.player_moderation;
create trigger player_moderation_touch_updated_at
  before update on public.player_moderation
  for each row execute function public.touch_updated_at();

alter table public.game_saves enable row level security;
alter table public.player_moderation enable row level security;
alter table public.player_warnings enable row level security;

revoke all on table public.player_moderation from anon, authenticated;
revoke all on table public.player_warnings from anon, authenticated;
revoke all on table public.game_saves from anon, authenticated;
grant select, insert, update, delete on table public.game_saves to authenticated;
grant all on table public.game_saves, public.player_moderation, public.player_warnings to service_role;

create or replace function public.can_play_game()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and not exists (
      select 1
      from public.player_moderation as m
      where m.user_id = (select auth.uid())
        and (m.permanent_ban or m.banned_until > now())
    );
$$;

revoke all on function public.can_play_game() from public, anon;
grant execute on function public.can_play_game() to authenticated;

drop policy if exists "Players read their own game save" on public.game_saves;
create policy "Players read their own game save"
  on public.game_saves for select to authenticated
  using (user_id = (select auth.uid()) and public.can_play_game());

drop policy if exists "Players create their own game save" on public.game_saves;
create policy "Players create their own game save"
  on public.game_saves for insert to authenticated
  with check (user_id = (select auth.uid()) and public.can_play_game());

drop policy if exists "Players update their own game save" on public.game_saves;
create policy "Players update their own game save"
  on public.game_saves for update to authenticated
  using (user_id = (select auth.uid()) and public.can_play_game())
  with check (user_id = (select auth.uid()) and public.can_play_game());

drop policy if exists "Players delete their own game save" on public.game_saves;
create policy "Players delete their own game save"
  on public.game_saves for delete to authenticated
  using (user_id = (select auth.uid()) and public.can_play_game());

create or replace function public.is_game_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as u
    where u.id = (select auth.uid())
      and u.email_confirmed_at is not null
      and lower(u.email) in ('lucas.kerouault@scv.bzh', 'sportzonefr@proton.me')
  );
$$;

create or replace function public.get_my_moderation_status()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_moderation public.player_moderation%rowtype;
  v_warnings jsonb := '[]'::jsonb;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('id', w.id, 'message', w.message, 'created_at', w.created_at)
      order by w.created_at
    ),
    '[]'::jsonb
  )
  into v_warnings
  from public.player_warnings as w
  where w.user_id = v_user_id and w.acknowledged_at is null;

  update public.player_warnings
  set acknowledged_at = now()
  where user_id = v_user_id and acknowledged_at is null;

  select * into v_moderation
  from public.player_moderation as m
  where m.user_id = v_user_id;

  return jsonb_build_object(
    'banned', coalesce(v_moderation.permanent_ban, false)
      or coalesce(v_moderation.banned_until > now(), false),
    'permanent_ban', coalesce(v_moderation.permanent_ban, false),
    'banned_until', v_moderation.banned_until,
    'ban_reason', v_moderation.ban_reason,
    'kick_version', coalesce(v_moderation.kick_version, 0),
    'warnings', v_warnings
  );
end;
$$;

create or replace function public.admin_manage_player(
  p_action text,
  p_target_user_id uuid,
  p_reason text default null,
  p_duration_hours integer default null,
  p_points bigint default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_reason text := nullif(left(trim(coalesce(p_reason, '')), 500), '');
  v_current_score numeric;
  v_new_score numeric;
  v_save_data jsonb;
begin
  if not public.is_game_admin() then
    raise exception 'Administrator access required' using errcode = '42501';
  end if;

  if p_target_user_id is null then
    raise exception 'A target player is required';
  end if;

  if not exists (select 1 from auth.users where id = p_target_user_id) then
    raise exception 'Player not found';
  end if;

  if p_action not in ('kick', 'temporary_ban', 'permanent_ban', 'unban', 'warn', 'set_points', 'adjust_points') then
    raise exception 'Unsupported moderation action';
  end if;

  if p_action in ('kick', 'temporary_ban', 'permanent_ban', 'unban', 'warn')
    and exists (
      select 1 from auth.users as u
      where u.id = p_target_user_id
        and u.email_confirmed_at is not null
        and lower(u.email) in ('lucas.kerouault@scv.bzh', 'sportzonefr@proton.me')
    ) then
    raise exception 'Administrator accounts are protected from moderation actions';
  end if;

  if p_action = 'kick' then
    insert into public.player_moderation (user_id, kick_version, last_kick_at, ban_reason)
    values (p_target_user_id, 1, now(), v_reason)
    on conflict (user_id) do update
      set kick_version = public.player_moderation.kick_version + 1,
          last_kick_at = now(),
          ban_reason = excluded.ban_reason;

  elsif p_action = 'temporary_ban' then
    if p_duration_hours is null or p_duration_hours < 1 or p_duration_hours > 87600 then
      raise exception 'Temporary ban duration must be between 1 and 87600 hours';
    end if;
    if v_reason is null then raise exception 'A ban reason is required'; end if;
    insert into public.player_moderation (user_id, banned_until, permanent_ban, ban_reason)
    values (p_target_user_id, now() + make_interval(hours => p_duration_hours), false, v_reason)
    on conflict (user_id) do update
      set banned_until = excluded.banned_until,
          permanent_ban = false,
          ban_reason = excluded.ban_reason;

  elsif p_action = 'permanent_ban' then
    if v_reason is null then raise exception 'A ban reason is required'; end if;
    insert into public.player_moderation (user_id, banned_until, permanent_ban, ban_reason)
    values (p_target_user_id, null, true, v_reason)
    on conflict (user_id) do update
      set banned_until = null,
          permanent_ban = true,
          ban_reason = excluded.ban_reason;

  elsif p_action = 'unban' then
    update public.player_moderation
    set banned_until = null, permanent_ban = false, ban_reason = null
    where user_id = p_target_user_id;

  elsif p_action = 'warn' then
    if v_reason is null then raise exception 'An avertissement message is required'; end if;
    insert into public.player_warnings (user_id, message, created_by)
    values (p_target_user_id, v_reason, auth.uid());

  elsif p_action in ('set_points', 'adjust_points') then
    if p_points is null then raise exception 'A point value is required'; end if;
    select coalesce(save_data, '{}'::jsonb) into v_save_data
    from public.game_saves where user_id = p_target_user_id;
    v_save_data := coalesce(v_save_data, '{}'::jsonb);
    v_current_score := coalesce(nullif(v_save_data ->> 'score', '')::numeric, 0);
    if p_action = 'set_points' then
      v_new_score := p_points::numeric;
    else
      v_new_score := v_current_score + p_points::numeric;
    end if;
    if v_new_score < -9007199254740991 or v_new_score > 9007199254740991 then
      raise exception 'Point total is outside the safe numeric range';
    end if;
    insert into public.game_saves (user_id, save_data)
    values (p_target_user_id, jsonb_set(v_save_data, '{score}', to_jsonb(v_new_score), true))
    on conflict (user_id) do update
      set save_data = jsonb_set(coalesce(public.game_saves.save_data, '{}'::jsonb), '{score}', to_jsonb(v_new_score), true);
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function public.is_game_admin() from public, anon;
revoke all on function public.can_play_game() from public, anon;
revoke all on function public.get_my_moderation_status() from public, anon;
revoke all on function public.admin_manage_player(text, uuid, text, integer, bigint) from public, anon;
grant execute on function public.is_game_admin() to authenticated;
grant execute on function public.can_play_game() to authenticated;
grant execute on function public.get_my_moderation_status() to authenticated;
grant execute on function public.admin_manage_player(text, uuid, text, integer, bigint) to authenticated;
