-- Additive hardening for department-wide community use.
-- Existing posts, comments, reactions, reports, and attachments are preserved.

alter table public.admins add column role text;
alter table public.admins add column granted_by uuid references auth.users(id) on delete set null;
update public.admins set role = 'owner' where role is null;
alter table public.admins alter column role set default 'moderator';
alter table public.admins alter column role set not null;
alter table public.admins add constraint admins_role_check check (role in ('owner', 'moderator'));

create or replace function public.is_owner()
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.admins where user_id = auth.uid() and role = 'owner') $$;

create function public.list_community_admins()
returns table(user_id uuid, email text, role text, created_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  return query
    select a.user_id, u.email::text, a.role, a.created_at
    from public.admins a join auth.users u on u.id = a.user_id
    order by case a.role when 'owner' then 0 else 1 end, a.created_at;
end $$;

create function public.grant_community_admin(p_email text, p_role text default 'moderator')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid;
begin
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  if p_role not in ('owner', 'moderator') or p_role is null then raise exception 'Invalid community role'; end if;
  select id into target_user from auth.users where lower(email) = lower(btrim(p_email)) limit 1;
  if target_user is null then raise exception '해당 이메일로 로그인한 회원을 찾을 수 없습니다.'; end if;
  if target_user = auth.uid() and p_role = 'moderator'
     and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception '마지막 소유자 권한은 운영자로 낮출 수 없습니다.';
  end if;
  insert into public.admins(user_id, role, granted_by) values(target_user, p_role, auth.uid())
    on conflict(user_id) do update set role = excluded.role, granted_by = excluded.granted_by;
  return target_user;
end $$;

create function public.revoke_community_admin(p_user_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare target_role text;
begin
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  select role into target_role from public.admins where user_id = p_user_id for update;
  if target_role is null then raise exception 'Community admin not found'; end if;
  if p_user_id = auth.uid() then raise exception '현재 로그인한 소유자 권한은 직접 해제할 수 없습니다.'; end if;
  if target_role = 'owner' and (select count(*) from public.admins where role = 'owner') <= 1 then
    raise exception '마지막 소유자 권한은 해제할 수 없습니다.';
  end if;
  delete from public.admins where user_id = p_user_id;
end $$;

create table private.community_action_limits (
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null,
  window_started_at timestamptz not null default now(),
  action_count integer not null default 0 check (action_count >= 0),
  primary key(user_id, action)
);
alter table private.community_action_limits enable row level security;
revoke all on table private.community_action_limits from public, anon, authenticated;

create function private.enforce_community_rate(p_action text, p_max integer, p_window interval)
returns void language plpgsql security definer set search_path = private, public as $$
declare current_row private.community_action_limits%rowtype;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then raise exception 'Login required'; end if;
  insert into private.community_action_limits(user_id, action, action_count)
    values(auth.uid(), p_action, 0) on conflict do nothing;
  select * into current_row from private.community_action_limits
    where user_id = auth.uid() and action = p_action for update;
  if current_row.window_started_at < now() - p_window then
    update private.community_action_limits set action_count = 1, window_started_at = now()
      where user_id = auth.uid() and action = p_action;
  elsif current_row.action_count >= p_max then
    raise exception '요청이 너무 많습니다. 잠시 후 다시 시도해 주세요.';
  else
    update private.community_action_limits set action_count = action_count + 1
      where user_id = auth.uid() and action = p_action;
  end if;
end $$;

create or replace function public.create_space_post(p_name text,p_title text,p_body text,p_link text default null,p_password text default null)
returns uuid language plpgsql security definer set search_path = public, extensions as $$
declare new_id uuid; secret boolean := nullif(p_password,'') is not null;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean,true) then raise exception 'Login required'; end if;
  perform private.enforce_community_rate('space_post_hour', 6, interval '1 hour');
  perform private.enforce_community_rate('space_post_day', 20, interval '24 hours');
  if secret and (char_length(p_password)<8 or octet_length(p_password)>72) then raise exception '비밀번호는 8자 이상, UTF-8 72바이트 이하로 입력해 주세요.'; end if;
  insert into public.space_posts(user_id,display_name,title,body,link_url,is_secret)
    values(auth.uid(),btrim(p_name),btrim(p_title),btrim(p_body),nullif(btrim(p_link),''),secret) returning id into new_id;
  if secret then insert into private.space_passwords values(new_id,crypt(p_password,gen_salt('bf',10))); end if;
  return new_id;
end $$;

create function public.create_project_comment(p_project_id text, p_name text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  perform private.enforce_community_rate('comment_hour', 30, interval '1 hour');
  insert into public.project_comments(project_id,user_id,display_name,body)
    values(p_project_id,auth.uid(),btrim(p_name),btrim(p_body)) returning id into new_id;
  return new_id;
end $$;

create function public.create_space_comment(p_post_id uuid, p_name text, p_body text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.can_read_space(p_post_id) then raise exception 'Comment access denied'; end if;
  perform private.enforce_community_rate('comment_hour', 30, interval '1 hour');
  insert into public.space_comments(post_id,user_id,display_name,body)
    values(p_post_id,auth.uid(),btrim(p_name),btrim(p_body)) returning id into new_id;
  return new_id;
end $$;

create function public.toggle_project_like(p_project_id text)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  perform private.enforce_community_rate('reaction_hour', 120, interval '1 hour');
  if exists(select 1 from public.project_likes where project_id=p_project_id and user_id=auth.uid()) then
    delete from public.project_likes where project_id=p_project_id and user_id=auth.uid(); return false;
  end if;
  insert into public.project_likes(project_id,user_id) values(p_project_id,auth.uid()); return true;
end $$;

create function public.toggle_space_like(p_post_id uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if not public.can_read_space(p_post_id) then raise exception 'Reaction access denied'; end if;
  perform private.enforce_community_rate('reaction_hour', 120, interval '1 hour');
  if exists(select 1 from public.space_likes where post_id=p_post_id and user_id=auth.uid()) then
    delete from public.space_likes where post_id=p_post_id and user_id=auth.uid(); return false;
  end if;
  insert into public.space_likes(post_id,user_id) values(p_post_id,auth.uid()); return true;
end $$;

create function public.create_community_report(p_type text, p_target_id uuid, p_reason text)
returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid; target_exists boolean := false;
begin
  if p_reason not in ('spam','harassment','unsafe','other') or p_reason is null then raise exception 'Invalid report reason'; end if;
  if p_type = 'project_comment' then
    select exists(select 1 from public.project_comments where id=p_target_id and status='visible') into target_exists;
  elsif p_type = 'space_post' then
    target_exists := public.can_read_space(p_target_id);
  elsif p_type = 'space_comment' then
    select exists(select 1 from public.space_comments where id=p_target_id and status='visible' and public.can_read_space(post_id)) into target_exists;
  else raise exception 'Invalid report target';
  end if;
  if not target_exists then raise exception '신고할 수 있는 대상을 찾을 수 없습니다.'; end if;
  perform private.enforce_community_rate('report_hour', 10, interval '1 hour');
  insert into public.reports(user_id,target_type,target_id,reason)
    values(auth.uid(),p_type,p_target_id,p_reason) returning id into new_id;
  return new_id;
end $$;

create or replace function public.reserve_space_attachment(p_id uuid,p_filename text) returns text
language plpgsql security definer set search_path = public as $$
declare object_key text; extension text;
begin
  perform 1 from public.space_posts where id=p_id for update;
  if not public.can_manage_space(p_id) then raise exception 'Edit access denied'; end if;
  if p_filename is null or char_length(p_filename) not between 1 and 180 or p_filename ~ '[[:cntrl:]]' then raise exception '올바른 파일 이름을 사용해 주세요.'; end if;
  extension := lower(substring(p_filename from '\.([^.]+)$'));
  if extension is null or extension not in ('jpg','jpeg','png','webp','gif','pdf','txt','hwp','hwpx','docx','xlsx','ods') then
    raise exception '이미지, PDF, TXT, 한글, Word, Excel 문서만 첨부할 수 있습니다.';
  end if;
  perform private.enforce_community_rate('attachment_day', 20, interval '24 hours');
  if (select count(*) from public.space_attachments where post_id=p_id)>=5 then raise exception '첨부파일은 글당 최대 5개입니다.'; end if;
  object_key := p_id::text || '/' || gen_random_uuid()::text;
  insert into public.space_attachments(post_id,filename,object_path) values(p_id,p_filename,object_key);
  return object_key;
end $$;

update storage.buckets set public=false, file_size_limit=10485760,
  allowed_mime_types=array[
    'image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain',
    'application/x-hwp','application/haansofthwp','application/vnd.hancom.hwp','application/vnd.hancom.hwpx',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.oasis.opendocument.spreadsheet'
  ] where id='space-files';

revoke all on function public.is_owner(),public.list_community_admins(),public.grant_community_admin(text,text),public.revoke_community_admin(uuid),
  public.create_project_comment(text,text,text),public.create_space_comment(uuid,text,text),public.toggle_project_like(text),public.toggle_space_like(uuid),
  public.create_community_report(text,uuid,text) from public,anon,authenticated;
grant execute on function public.is_owner() to anon,authenticated;
grant execute on function public.list_community_admins(),public.grant_community_admin(text,text),public.revoke_community_admin(uuid),
  public.create_project_comment(text,text,text),public.create_space_comment(uuid,text,text),public.toggle_project_like(text),public.toggle_space_like(uuid),
  public.create_community_report(text,uuid,text) to authenticated;

notify pgrst,'reload schema';
