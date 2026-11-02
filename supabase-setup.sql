create table if not exists public.league_data (
  id text primary key check (id = 'season-2026'),
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

create table if not exists public.league_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table if not exists public.league_push_subscriptions (
  endpoint text primary key check (char_length(endpoint) <= 2048),
  subscription jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_fcm_tokens (
  token text primary key check (char_length(token) between 20 and 4096),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.league_notifications (
  id uuid primary key default gen_random_uuid(),
  post_id text not null unique check (char_length(post_id) between 1 and 120),
  title text not null check (char_length(title) between 1 and 100),
  message text not null check (char_length(message) between 1 and 500),
  link text not null check (char_length(link) <= 2048),
  created_at timestamptz not null default now()
);

create index if not exists league_notifications_created_at_idx
  on public.league_notifications (created_at desc);

alter table public.league_data enable row level security;
alter table public.league_admins enable row level security;
alter table public.league_push_subscriptions enable row level security;
alter table public.league_fcm_tokens enable row level security;
alter table public.league_notifications enable row level security;

grant usage on schema public to anon, authenticated;
grant usage on schema public to service_role;
grant select on public.league_data to anon;
grant select, update on public.league_data to authenticated;
grant select on public.league_admins to authenticated;
revoke all on public.league_push_subscriptions from public, anon, authenticated;
grant all on public.league_push_subscriptions to service_role;
revoke all on public.league_fcm_tokens from public, anon, authenticated;
grant all on public.league_fcm_tokens to service_role;
revoke insert, update, delete on public.league_notifications from public, anon, authenticated;
grant select on public.league_notifications to anon, authenticated;
grant all on public.league_notifications to service_role;
revoke insert, delete on public.league_data from anon, authenticated;
revoke insert, update, delete on public.league_admins from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('league-media', 'league-media', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

comment on table public.league_push_subscriptions is
  'Legacy Web Push subscriptions; retained during migration to FCM and inaccessible to client roles.';

comment on table public.league_fcm_tokens is
  'Private Firebase Cloud Messaging registration tokens; only Supabase Edge Functions can read or write tokens.';

drop policy if exists "League notifications are publicly readable" on public.league_notifications;
create policy "League notifications are publicly readable"
  on public.league_notifications for select to anon, authenticated
  using (true);

drop policy if exists "League media is publicly readable" on storage.objects;
create policy "League media is publicly readable"
  on storage.objects for select
  using (bucket_id = 'league-media');

drop policy if exists "Listed admins can upload league media" on storage.objects;
create policy "Listed admins can upload league media"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'league-media' and exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ));

drop policy if exists "Listed admins can update league media" on storage.objects;
create policy "Listed admins can update league media"
  on storage.objects for update to authenticated
  using (bucket_id = 'league-media' and exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ))
  with check (bucket_id = 'league-media' and exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ));

drop policy if exists "Listed admins can delete league media" on storage.objects;
create policy "Listed admins can delete league media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'league-media' and exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ));

drop policy if exists "League data is publicly readable" on public.league_data;
create policy "League data is publicly readable"
  on public.league_data for select
  using (true);

drop policy if exists "Only listed admins can update league data" on public.league_data;
create policy "Only listed admins can update league data"
  on public.league_data for update to authenticated
  using (exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ))
  with check (exists (
    select 1 from public.league_admins
    where user_id = (select auth.uid())
  ));

drop policy if exists "Listed admins can view their own admin record" on public.league_admins;
create policy "Listed admins can view their own admin record"
  on public.league_admins for select to authenticated
  using (user_id = (select auth.uid()));

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'league_notifications'
  ) then
    alter publication supabase_realtime add table public.league_notifications;
  end if;
end;
$$;

insert into public.league_data (id, payload)
values (
  'season-2026',
  '{
    "results": [
      {"week":1,"home":"FC Seirin","away":"FC Alhamdulillah","homeScore":1,"awayScore":0,"note":"Thomas · direct free kick"},
      {"week":1,"home":"Blue Lock FC","away":"Psychoriders","homeScore":0,"awayScore":0,"note":""},
      {"week":2,"home":"FC Seirin","away":"Psychoriders","homeScore":2,"awayScore":2,"note":"Thomas · 2 goals"},
      {"week":2,"home":"FC Alhamdulillah","away":"Blue Lock FC","homeScore":1,"awayScore":0,"note":""}
    ],
    "scorers": [
      {"name":"Thomas","club":"FC Seirin","goals":3},
      {"name":"Bash","club":"Psychoriders","goals":1},
      {"name":"Kai2Ray","club":"Psychoriders","goals":1}
    ],
    "assists": [],
    "players": [],
    "clubPhotos": {},
    "totw": {"week":2,"formation":"4-3-3","players":[]},
    "news": []
  }'::jsonb
)
on conflict (id) do nothing;
