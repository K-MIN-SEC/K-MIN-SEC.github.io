-- Additive authoring and registry. Legacy Space reactions retain their existing APIs.
begin;
alter table public.creator_projects add column deleted_at timestamptz;
alter table public.creator_projects add column team_up_id uuid;

create table public.creator_entries (
 id uuid primary key default gen_random_uuid(),
 owner_id uuid not null references auth.users(id) on delete restrict,
 kind text not null check(kind in ('work','teamup','event')),
 title text not null check(char_length(title) between 2 and 100),
 summary text not null check(char_length(summary) between 10 and 1500),
 body text not null default '' check(char_length(body)<=30000),
 category text not null default 'Game' check(char_length(category) between 1 and 80),
 tags text[] not null default '{}' check(cardinality(tags)<=20),
 cover_url text check(cover_url is null or (cover_url ~ '^https://' and char_length(cover_url)<=1000)),
 cover_alt text not null default '' check(char_length(cover_alt)<=200),
 video_url text check(video_url is null or (video_url ~ '^https://' and char_length(video_url)<=1000)),
 external_url text check(external_url is null or (external_url ~ '^https://' and char_length(external_url)<=1000)),
 project_id uuid references public.creator_projects(id) on delete set null,
 starts_on date, ends_on date,
 visibility text not null default 'draft' check(visibility in ('draft','public','members')),
 moderation_status text not null default 'visible' check(moderation_status in ('visible','hidden')),
 featured boolean not null default false,
 deleted_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 check(ends_on is null or starts_on is null or ends_on>=starts_on),
 check(cover_url is null or char_length(btrim(cover_alt))>0)
);
alter table public.creator_projects add constraint creator_project_teamup_fk foreign key(team_up_id) references public.creator_entries(id) on delete set null;
create index creator_entries_listing on public.creator_entries(kind,visibility,created_at desc) where deleted_at is null;
create trigger touch_creator_entries before update on public.creator_entries for each row execute function private.touch_creator_updated_at();
alter table public.creator_entries enable row level security;

create or replace function public.can_read_creator_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from creator_projects p where p.id=p_project_id and p.deleted_at is null and
 (p.owner_id=auth.uid() or public.is_admin() or p.visibility='public' or (p.visibility='members' and public.is_member())))
$$;
create function public.can_read_creator_entry(p_id uuid)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from creator_entries p where p.id=p_id and p.deleted_at is null and
 (public.is_admin() or p.owner_id=auth.uid() or (p.moderation_status='visible' and
 (p.visibility='public' or (p.visibility='members' and public.is_member())))))
$$;
create policy "authorized entry read" on public.creator_entries for select using(public.can_read_creator_entry(id));

create function public.save_creator_entry(p_data jsonb,p_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_existing creator_entries; v_project uuid;
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if p_id is not null then
  select * into v_existing from creator_entries where id=p_id and owner_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'Author access required'; end if;
  if v_existing.moderation_status='hidden' then raise exception 'Hidden content cannot be edited'; end if;
 end if;
 if not public.is_creator() then raise exception 'Creator approval required'; end if;
 perform private.enforce_community_rate('creator_entry_hour',30,interval '1 hour');
 v_project:=nullif(p_data->>'project_id','')::uuid;
 if v_project is not null and not exists(select 1 from creator_projects p where p.id=v_project and p.deleted_at is null and
 (p.owner_id=auth.uid() or exists(select 1 from project_memberships m where m.project_id=p.id and m.user_id=auth.uid() and m.status='accepted'))) then raise exception 'Confirmed project membership required'; end if;
 if p_id is null then
  insert into creator_entries(owner_id,kind,title,summary) values(auth.uid(),p_data->>'kind',btrim(p_data->>'title'),btrim(p_data->>'summary')) returning id into v_id;
 else v_id:=p_id; end if;
 update creator_entries set title=btrim(p_data->>'title'),summary=btrim(p_data->>'summary'),body=coalesce(p_data->>'body',''),
 category=coalesce(nullif(p_data->>'category',''),'Game'),tags=array(select jsonb_array_elements_text(coalesce(p_data->'tags','[]'::jsonb))),
 cover_url=nullif(p_data->>'cover_url',''),cover_alt=coalesce(p_data->>'cover_alt',''),video_url=nullif(p_data->>'video_url',''),external_url=nullif(p_data->>'external_url',''),
 project_id=v_project,starts_on=nullif(p_data->>'starts_on','')::date,ends_on=nullif(p_data->>'ends_on','')::date,
 visibility=coalesce(p_data->>'visibility','draft') where id=v_id;
 return v_id;
end $$;

create function public.update_creator_project(p_id uuid,p_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_team uuid;
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if not public.is_creator() then raise exception 'Creator approval required'; end if;
 perform 1 from creator_projects where id=p_id and owner_id=auth.uid() and deleted_at is null and visibility<>'hidden' for update;
 if not found then raise exception 'Project owner access required'; end if;
 v_team:=nullif(p_data->>'team_up_id','')::uuid;
 if v_team is not null and not exists(select 1 from creator_entries where id=v_team and kind='teamup' and owner_id=auth.uid() and deleted_at is null) then raise exception 'Invalid Team Up'; end if;
 if nullif(p_data->>'result_url','') is not null and (p_data->>'result_url') !~ '^https://' then raise exception 'HTTPS URL required'; end if;
 if coalesce(p_data->>'visibility','draft') not in ('draft','public','members') then raise exception 'Invalid visibility'; end if;
 perform private.enforce_community_rate('creator_project_update_hour',30,interval '1 hour');
 update creator_projects set title=btrim(p_data->>'title'),summary=btrim(p_data->>'summary'),category=btrim(p_data->>'category'),
 role_summary=coalesce(p_data->>'role_summary',''),started_on=nullif(p_data->>'started_on','')::date,ended_on=nullif(p_data->>'ended_on','')::date,
 project_status=coalesce(p_data->>'project_status','planning'),visibility=coalesce(p_data->>'visibility','draft'),result_url=nullif(p_data->>'result_url',''),team_up_id=v_team where id=p_id;
end $$;
create function public.delete_creator_content(p_id uuid,p_kind text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if p_kind='project' then
  update creator_projects set deleted_at=now() where id=p_id and (owner_id=auth.uid() or public.is_admin()) and deleted_at is null;
 else
  update creator_entries set deleted_at=now() where id=p_id and kind=p_kind and (owner_id=auth.uid() or public.is_admin()) and deleted_at is null;
 end if;
 if not found then raise exception 'Delete access denied'; end if;
end $$;

create table public.content_targets (
 id uuid primary key default gen_random_uuid(),namespace text not null,content_type text not null,external_id text not null,
 owner_id uuid references auth.users(id) on delete set null,
 visibility text not null,status text not null default 'visible' check(status in ('visible','hidden','deleted')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(namespace,content_type,external_id)
);
create function private.sync_creator_target() returns trigger language plpgsql security definer set search_path=public as $$
declare v_type text; v_visibility text; v_owner uuid; v_status text;
begin
 if TG_TABLE_NAME='creator_entries' then
  v_type:=new.kind;v_visibility:=new.visibility;v_owner:=new.owner_id;
  v_status:=case when new.deleted_at is not null then 'deleted' else new.moderation_status end;
 elsif TG_TABLE_NAME='creator_projects' then
  v_type:='project';v_visibility:=new.visibility;v_owner:=new.owner_id;
  v_status:=case when new.deleted_at is not null then 'deleted' when new.visibility='hidden' then 'hidden' else 'visible' end;
 else
  v_type:='space_post';v_visibility:=case when new.is_secret then 'secret' else 'public' end;v_owner:=new.user_id;v_status:=new.status;
 end if;
 insert into content_targets(namespace,content_type,external_id,owner_id,visibility,status) values('SPACE',v_type,new.id::text,v_owner,v_visibility,v_status)
 on conflict(namespace,content_type,external_id) do update set owner_id=excluded.owner_id,visibility=excluded.visibility,status=excluded.status,updated_at=now();
 return new;
end $$;
create trigger sync_entry_target after insert or update on public.creator_entries for each row execute function private.sync_creator_target();
create trigger sync_project_target after insert or update on public.creator_projects for each row execute function private.sync_creator_target();
create trigger sync_space_target after insert or update on public.space_posts for each row execute function private.sync_creator_target();
insert into public.content_targets(namespace,content_type,external_id,owner_id,visibility,status)
select 'SPACE','project',id::text,owner_id,visibility,case when visibility='hidden' then 'hidden' else 'visible' end from public.creator_projects;
insert into public.content_targets(namespace,content_type,external_id,owner_id,visibility,status)
select 'SPACE','space_post',id::text,user_id,case when is_secret then 'secret' else 'public' end,status from public.space_posts;
create function private.mark_space_target_deleted() returns trigger language plpgsql security definer set search_path=public as $$
begin update content_targets set status='deleted',updated_at=now() where namespace='SPACE' and content_type='space_post' and external_id=old.id::text;return old;end $$;
create trigger delete_space_target after delete on public.space_posts for each row execute function private.mark_space_target_deleted();

create function public.can_read_content_target(p_id uuid) returns boolean language plpgsql stable security definer set search_path=public as $$
declare t content_targets;
begin
 select * into t from content_targets where id=p_id;
 if not found or t.status='deleted' or t.namespace<>'SPACE' then return false; end if;
 if t.content_type in ('work','teamup','event') then return public.can_read_creator_entry(t.external_id::uuid);
 elsif t.content_type='project' then return public.can_read_creator_project(t.external_id::uuid);
 elsif t.content_type='space_post' then return exists(select 1 from space_posts where id=t.external_id::uuid and public.can_read_space(id));
 end if; return false;
end $$;
create table public.target_comments (
 id uuid primary key default gen_random_uuid(),content_target_id uuid not null references public.content_targets(id) on delete cascade,
 user_id uuid not null references auth.users(id),display_name text not null,body text not null check(char_length(body) between 2 and 2000),
 status text not null default 'visible' check(status in ('visible','hidden','deleted')),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table public.target_reactions(content_target_id uuid not null references public.content_targets(id) on delete cascade,user_id uuid not null references auth.users(id),created_at timestamptz not null default now(),primary key(content_target_id,user_id));
create table public.target_reports(id uuid primary key default gen_random_uuid(),content_target_id uuid not null references public.content_targets(id),comment_id uuid references public.target_comments(id),user_id uuid not null references auth.users(id),reason text not null check(char_length(reason) between 2 and 1000),status text not null default 'open' check(status in ('open','resolved','dismissed')),created_at timestamptz not null default now());
alter table public.content_targets enable row level security;
alter table public.target_comments enable row level security;
alter table public.target_reactions enable row level security;
alter table public.target_reports enable row level security;
create policy "target access" on public.content_targets for select using(public.can_read_content_target(id));
create policy "comment access" on public.target_comments for select using(public.can_read_content_target(content_target_id) and (status='visible' or public.is_admin()));
create policy "own reaction access" on public.target_reactions for select using(user_id=auth.uid() and public.can_read_content_target(content_target_id));
create policy "report access" on public.target_reports for select using(public.is_admin() or user_id=auth.uid());
create function public.target_like_count(p_id uuid) returns bigint language sql stable security definer set search_path=public as $$ select count(*) from target_reactions where content_target_id=p_id and public.can_read_content_target(p_id) $$;
create function public.write_target_comment(p_target uuid,p_body text,p_comment uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_name text;
begin
 if not public.is_member() or not public.can_read_content_target(p_target) then raise exception 'Content access denied'; end if;
 perform private.enforce_community_rate('target_comment_hour',40,interval '1 hour');
 select display_name into v_name from member_profiles where user_id=auth.uid();
 if p_comment is null then
  insert into target_comments(content_target_id,user_id,display_name,body) values(p_target,auth.uid(),coalesce(v_name,'Member'),btrim(p_body)) returning id into v_id;
 else update target_comments set body=btrim(p_body),updated_at=now() where id=p_comment and content_target_id=p_target and user_id=auth.uid() and status='visible' returning id into v_id;
 end if;
 if v_id is null then raise exception 'Comment edit access denied'; end if; return v_id;
end $$;
create function public.delete_target_comment(p_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 update target_comments set status='deleted' where id=p_id and (user_id=auth.uid() or public.is_admin());
 if not found then raise exception 'Comment delete access denied'; end if;
end $$;
create function public.toggle_target_reaction(p_id uuid) returns boolean language plpgsql security definer set search_path=public as $$
begin
 if not public.is_member() or not public.can_read_content_target(p_id) then raise exception 'Content access denied'; end if;
 perform private.enforce_community_rate('target_reaction_hour',120,interval '1 hour');
 perform pg_advisory_xact_lock(hashtextextended(p_id::text||auth.uid()::text,0));
 delete from target_reactions where content_target_id=p_id and user_id=auth.uid();if found then return false;end if;
 insert into target_reactions(content_target_id,user_id) values(p_id,auth.uid());return true;
end $$;
create function public.report_content_target(p_target uuid,p_reason text,p_comment uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid;
begin
 if not public.is_member() or not public.can_read_content_target(p_target) then raise exception 'Content access denied'; end if;
 if p_comment is not null and not exists(select 1 from target_comments where id=p_comment and content_target_id=p_target and status='visible') then raise exception 'Invalid comment target'; end if;
 perform private.enforce_community_rate('target_report_day',15,interval '24 hours');
 insert into target_reports(content_target_id,comment_id,user_id,reason) values(p_target,p_comment,auth.uid(),btrim(p_reason)) returning id into v_id;return v_id;
end $$;
create function public.moderate_creator_target(p_target uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$
declare t content_targets;
begin
 if not public.is_admin() then raise exception 'Staff access required'; end if;
 select * into t from content_targets where id=p_target and namespace='SPACE' and status<>'deleted';
 if not found then raise exception 'Target not found'; end if;
 if p_action in ('feature','unfeature') then
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  update creator_entries set featured=(p_action='feature') where id=t.external_id::uuid;
 elsif p_action in ('hide','restore') then
  if t.content_type='project' then update creator_projects set visibility=case when p_action='hide' then 'hidden' else 'draft' end where id=t.external_id::uuid;
  elsif t.content_type in ('work','teamup','event') then update creator_entries set moderation_status=case when p_action='hide' then 'hidden' else 'visible' end where id=t.external_id::uuid;
  else raise exception 'Use Space moderation'; end if;
 else raise exception 'Invalid action'; end if;
end $$;
create function public.resolve_target_report(p_id uuid,p_action text) returns void language plpgsql security definer set search_path=public as $$
declare r target_reports;
begin
 if not public.is_admin() then raise exception 'Staff access required'; end if;
 select * into r from target_reports where id=p_id and status='open' for update;
 if not found then raise exception 'Report not found'; end if;
 if p_action='hide' then
  if r.comment_id is not null then update target_comments set status='hidden' where id=r.comment_id;
  else perform public.moderate_creator_target(r.content_target_id,'hide');end if;
 elsif p_action<>'dismiss' then raise exception 'Invalid action';end if;
 update target_reports set status=case when p_action='hide' then 'resolved' else 'dismissed' end where id=p_id;
end $$;

revoke all on public.creator_entries,public.content_targets,public.target_comments,public.target_reactions,public.target_reports from public,anon,authenticated;
grant select on public.creator_entries,public.content_targets,public.target_comments,public.target_reactions,public.target_reports to anon,authenticated;
revoke all on function public.can_read_creator_entry(uuid),public.can_read_content_target(uuid),public.target_like_count(uuid),public.save_creator_entry(jsonb,uuid),public.update_creator_project(uuid,jsonb),public.delete_creator_content(uuid,text),public.write_target_comment(uuid,text,uuid),public.delete_target_comment(uuid),public.toggle_target_reaction(uuid),public.report_content_target(uuid,text,uuid),public.moderate_creator_target(uuid,text),public.resolve_target_report(uuid,text) from public,anon,authenticated;
grant execute on function public.can_read_creator_entry(uuid),public.can_read_content_target(uuid),public.target_like_count(uuid) to anon,authenticated;
grant execute on function public.save_creator_entry(jsonb,uuid),public.update_creator_project(uuid,jsonb),public.delete_creator_content(uuid,text),public.write_target_comment(uuid,text,uuid),public.delete_target_comment(uuid),public.toggle_target_reaction(uuid),public.report_content_target(uuid,text,uuid),public.moderate_creator_target(uuid,text),public.resolve_target_report(uuid,text) to authenticated;
notify pgrst,'reload schema';
commit;
