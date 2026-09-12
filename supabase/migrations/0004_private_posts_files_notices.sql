-- Passwords and unlock grants are never exposed through the Data API.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
alter table public.space_posts add column is_secret boolean not null default false;
alter table public.space_posts add column is_notice boolean not null default false;
alter table public.space_posts add constraint notices_are_public check (not (is_notice and is_secret));
create table private.space_passwords (
  post_id uuid primary key references public.space_posts(id) on delete cascade,
  password_hash text not null
);
create table private.space_access (
  post_id uuid references public.space_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  expires_at timestamptz not null,
  primary key(post_id,user_id)
);
create table private.space_attempts (
  post_id uuid references public.space_posts(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  attempts integer not null default 0,
  window_start timestamptz not null default now(),
  primary key(post_id,user_id)
);
alter table private.space_passwords enable row level security;
alter table private.space_access enable row level security;
alter table private.space_attempts enable row level security;

create function public.can_read_space(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.space_posts p where p.id=p_id and
    (public.is_admin() or (p.status='visible' and (not p.is_secret or p.user_id=auth.uid() or exists(
      select 1 from private.space_access a where a.post_id=p.id and a.user_id=auth.uid() and a.expires_at>now()
    )))))
$$;
create function public.can_manage_space(p_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean,true)
    and exists(select 1 from public.space_posts where id=p_id and
      (public.is_admin() or (user_id=auth.uid() and status='visible')))
$$;

drop policy "visible space posts are public" on public.space_posts;
create policy "read authorized posts" on public.space_posts for select using (public.can_read_space(id));
-- Insert only through the function so secret bodies cannot briefly become public.
revoke insert on public.space_posts from authenticated;
drop policy "visible space comments are public" on public.space_comments;
create policy "read authorized replies" on public.space_comments for select using
  (public.can_read_space(post_id) and (status='visible' or public.is_admin()));
create policy "authorized post replies" on public.space_comments as restrictive for insert to authenticated with check (public.can_read_space(post_id));
drop policy "space likes are public" on public.space_likes;
create policy "read authorized likes" on public.space_likes for select using (public.can_read_space(post_id));
create policy "authorized post likes" on public.space_likes as restrictive for insert to authenticated with check (public.can_read_space(post_id));

create function public.list_space_posts(p_offset integer default 0, p_id uuid default null)
returns table(id uuid,display_name text,title text,created_at timestamptz,is_secret boolean,is_notice boolean)
language sql stable security definer set search_path = public as $$
  select p.id,p.display_name,case when p.is_secret and not public.can_read_space(p.id) then '비밀글' else p.title end,
    p.created_at,p.is_secret,p.is_notice
  from public.space_posts p where p.status='visible' and (p_id is null or p.id=p_id)
  order by p.is_notice desc,p.created_at desc,p.id limit 20 offset greatest(0,least(p_offset,100000))
$$;
create function public.create_space_post(p_name text,p_title text,p_body text,p_link text default null,p_password text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid; secret boolean := nullif(p_password,'') is not null;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Login required'; end if;
  if secret and (char_length(p_password)<8 or octet_length(p_password)>72) then raise exception '비밀번호는 8자 이상, UTF-8 72바이트 이하로 입력해 주세요.'; end if;
  insert into public.space_posts(user_id,display_name,title,body,link_url,is_secret)
    values(auth.uid(),btrim(p_name),btrim(p_title),btrim(p_body),nullif(btrim(p_link),''),secret) returning id into new_id;
  if secret then insert into private.space_passwords values(new_id,crypt(p_password,gen_salt('bf',10))); end if;
  return new_id;
end $$;
create function public.unlock_space_post(p_id uuid,p_password text) returns boolean
language plpgsql security definer set search_path = public, extensions as $$
declare h text; counter private.space_attempts%rowtype;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception '로그인 후 비밀번호를 입력해 주세요.'; end if;
  if public.can_manage_space(p_id) then return true; end if;
  select s.password_hash into h from private.space_passwords s join public.space_posts p on p.id=s.post_id
    where p.id=p_id and p.status='visible' and p.is_secret;
  if h is null or p_password is null or octet_length(p_password)>72 then return false; end if;
  insert into private.space_attempts(post_id,user_id) values(p_id,auth.uid()) on conflict do nothing;
  select * into counter from private.space_attempts where post_id=p_id and user_id=auth.uid() for update;
  if counter.window_start < now()-interval '15 minutes' then
    update private.space_attempts set attempts=0,window_start=now() where post_id=p_id and user_id=auth.uid();
    counter.attempts := 0;
  end if;
  if counter.attempts>=5 then return false; end if;
  if crypt(p_password,h)<>h then
    update private.space_attempts set attempts=attempts+1 where post_id=p_id and user_id=auth.uid();
    return false;
  end if;
  insert into private.space_access values(p_id,auth.uid(),now()+interval '1 hour')
    on conflict(post_id,user_id) do update set expires_at=excluded.expires_at;
  update private.space_attempts set attempts=0 where post_id=p_id and user_id=auth.uid();
  return true;
end $$;
create function public.set_space_password(p_id uuid,p_password text) returns void
language plpgsql security definer set search_path = public, extensions as $$
declare secret boolean := nullif(p_password,'') is not null;
begin
  perform 1 from public.space_posts where id=p_id for update;
  if not public.can_manage_space(p_id) then raise exception 'Edit access denied'; end if;
  if secret and (char_length(p_password)<8 or octet_length(p_password)>72) then raise exception '비밀번호는 8자 이상, UTF-8 72바이트 이하로 입력해 주세요.'; end if;
  if secret then
    insert into private.space_passwords values(p_id,crypt(p_password,gen_salt('bf',10)))
      on conflict(post_id) do update set password_hash=excluded.password_hash;
  else delete from private.space_passwords where post_id=p_id;
  end if;
  update public.space_posts set is_secret=secret,is_notice=case when secret then false else is_notice end where id=p_id;
  delete from private.space_access where post_id=p_id;
  delete from private.space_attempts where post_id=p_id;
end $$;
create function public.set_space_notice(p_id uuid,p_notice boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_notice and exists(select 1 from public.space_posts where id=p_id and is_secret) then raise exception '비밀글은 공지로 등록할 수 없습니다. 먼저 공개글로 전환해 주세요.'; end if;
  update public.space_posts set is_notice=p_notice where id=p_id;
end $$;

create table public.space_attachments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.space_posts(id) on delete cascade,
  filename text not null check(char_length(filename) between 1 and 180),
  object_path text unique not null,
  created_at timestamptz not null default now()
);
alter table public.space_attachments enable row level security;
create policy "authorized attachments" on public.space_attachments for select using(public.can_read_space(post_id));
grant select on public.space_attachments to anon,authenticated;
-- Reserve attachment paths under a post lock: at most five uploads per post, including concurrent requests.
create function public.reserve_space_attachment(p_id uuid,p_filename text) returns text
language plpgsql security definer set search_path = public as $$
declare object_key text;
begin
  perform 1 from public.space_posts where id=p_id for update;
  if not public.can_manage_space(p_id) then raise exception 'Edit access denied'; end if;
  if (select count(*) from public.space_attachments where post_id=p_id)>=5 then raise exception '첨부파일은 글당 최대 5개입니다.'; end if;
  object_key := p_id::text || '/' || gen_random_uuid()::text;
  insert into public.space_attachments(post_id,filename,object_path) values(p_id,p_filename,object_key);
  return object_key;
end $$;
create function public.remove_space_attachment(p_path text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not exists(select 1 from public.space_attachments where object_path=p_path and public.can_manage_space(post_id)) then raise exception 'Edit access denied'; end if;
  delete from public.space_attachments where object_path=p_path;
end $$;

-- Always private: public object URLs must never bypass the post password.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('space-files','space-files',false,10485760,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip','application/x-zip-compressed'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "read space files" on storage.objects for select using(bucket_id='space-files' and exists(
  select 1 from public.space_attachments a where a.object_path=name and public.can_read_space(a.post_id)));
create policy "upload own space files" on storage.objects for insert to authenticated with check(bucket_id='space-files' and exists(
  select 1 from public.space_attachments a where a.object_path=name and public.can_manage_space(a.post_id)));
create policy "remove own space files" on storage.objects for delete to authenticated using(bucket_id='space-files' and exists(
  select 1 from public.space_attachments a where a.object_path=name and public.can_manage_space(a.post_id)));

revoke all on function public.can_read_space(uuid),public.can_manage_space(uuid),public.list_space_posts(integer,uuid),public.create_space_post(text,text,text,text,text),public.unlock_space_post(uuid,text),public.set_space_password(uuid,text),public.set_space_notice(uuid,boolean),public.reserve_space_attachment(uuid,text),public.remove_space_attachment(text) from public,anon,authenticated;
grant execute on function public.can_read_space(uuid),public.can_manage_space(uuid),public.list_space_posts(integer,uuid) to anon,authenticated;
grant execute on function public.create_space_post(text,text,text,text,text),public.unlock_space_post(uuid,text),public.set_space_password(uuid,text),public.set_space_notice(uuid,boolean),public.reserve_space_attachment(uuid,text),public.remove_space_attachment(text) to authenticated;
create index space_posts_notice_created_idx on public.space_posts(is_notice desc,created_at desc);
create index space_attachments_post_idx on public.space_attachments(post_id);
notify pgrst,'reload schema';
