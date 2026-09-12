create extension if not exists pgcrypto;

create table public.project_likes (
  project_id text not null check (project_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create table public.project_comments (
  id uuid primary key default gen_random_uuid(),
  project_id text not null check (project_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  body text not null check (char_length(body) between 2 and 800),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.space_posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  title text not null check (char_length(title) between 2 and 80),
  body text not null check (char_length(body) between 2 and 2000),
  link_url text check (link_url is null or (char_length(link_url) <= 500 and link_url ~ '^https://')),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.space_likes (
  post_id uuid not null references public.space_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table public.space_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.space_posts(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 24),
  body text not null check (char_length(body) between 2 and 800),
  status text not null default 'visible' check (status in ('visible', 'hidden')),
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null check (target_type in ('project_comment', 'space_post', 'space_comment')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'harassment', 'unsafe', 'other')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique (user_id, target_type, target_id)
);

create table public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid()) $$;

alter table public.project_likes enable row level security;
alter table public.project_comments enable row level security;
alter table public.space_posts enable row level security;
alter table public.space_likes enable row level security;
alter table public.space_comments enable row level security;
alter table public.reports enable row level security;
alter table public.admins enable row level security;

create policy "project likes are public" on public.project_likes for select using (true);
create policy "users like projects" on public.project_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users unlike projects" on public.project_likes for delete to authenticated using (auth.uid() = user_id);
create policy "visible project comments are public" on public.project_comments for select using (status = 'visible' or public.is_admin());
create policy "users create project comments" on public.project_comments for insert to authenticated with check (auth.uid() = user_id and status = 'visible');
create policy "owners or admins delete project comments" on public.project_comments for delete to authenticated using (auth.uid() = user_id or public.is_admin());

create policy "visible space posts are public" on public.space_posts for select using (status = 'visible' or public.is_admin());
create policy "users create space posts" on public.space_posts for insert to authenticated with check (auth.uid() = user_id and status = 'visible');
create policy "owners or admins delete space posts" on public.space_posts for delete to authenticated using (auth.uid() = user_id or public.is_admin());
create policy "space likes are public" on public.space_likes for select using (true);
create policy "users like space posts" on public.space_likes for insert to authenticated with check (auth.uid() = user_id);
create policy "users unlike space posts" on public.space_likes for delete to authenticated using (auth.uid() = user_id);
create policy "visible space comments are public" on public.space_comments for select using (status = 'visible' or public.is_admin());
create policy "users create space comments" on public.space_comments for insert to authenticated with check (auth.uid() = user_id and status = 'visible');
create policy "owners or admins delete space comments" on public.space_comments for delete to authenticated using (auth.uid() = user_id or public.is_admin());

create policy "users report content" on public.reports for insert to authenticated with check (auth.uid() = user_id and status = 'open');
create policy "admins read reports" on public.reports for select to authenticated using (public.is_admin());
create policy "admins see their role" on public.admins for select to authenticated using (auth.uid() = user_id);

create or replace function public.moderate_report(p_report_id uuid, p_action text)
returns void language plpgsql security definer set search_path = public
as $$
declare item public.reports%rowtype;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_action not in ('hide', 'dismiss') then raise exception 'Invalid action'; end if;
  select * into item from public.reports where id = p_report_id and status = 'open' for update;
  if not found then raise exception 'Open report not found'; end if;
  if p_action = 'hide' then
    if item.target_type = 'project_comment' then update public.project_comments set status = 'hidden' where id = item.target_id;
    elsif item.target_type = 'space_post' then update public.space_posts set status = 'hidden' where id = item.target_id;
    elsif item.target_type = 'space_comment' then update public.space_comments set status = 'hidden' where id = item.target_id;
    end if;
  end if;
  update public.reports set status = case when p_action = 'hide' then 'resolved' else 'dismissed' end, resolved_at = now() where id = p_report_id;
end $$;

grant execute on function public.moderate_report(uuid, text) to authenticated;
create index project_comments_project_created_idx on public.project_comments(project_id, created_at desc);
create index space_posts_created_idx on public.space_posts(created_at desc);
create index space_comments_post_created_idx on public.space_comments(post_id, created_at);
create index reports_status_created_idx on public.reports(status, created_at desc);
