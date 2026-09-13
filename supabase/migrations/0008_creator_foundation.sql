-- Additive Creator Space foundation. Existing MINSEC and Space data is unchanged.

create table public.member_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  handle text not null,
  display_name text not null,
  bio text not null default '',
  school_name text,
  department_name text,
  admission_year smallint check (admission_year between 2000 and 2100),
  expected_graduation_year smallint check (expected_graduation_year between 2000 and 2100),
  graduation_year smallint check (graduation_year between 2000 and 2100),
  primary_role text,
  interests text[] not null default '{}',
  tools text[] not null default '{}',
  availability text not null default 'hidden' check (availability in ('available','limited','unavailable','hidden')),
  visibility text not null default 'members' check (visibility in ('public','members','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint member_profiles_handle_format check (handle ~ '^[a-z0-9][a-z0-9_-]{2,29}$'),
  constraint member_profiles_name_length check (char_length(display_name) between 1 and 50),
  constraint member_profiles_bio_length check (char_length(bio) <= 1000)
);
create unique index member_profiles_handle_lower_unique on public.member_profiles(lower(handle));

create table public.profile_contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.member_profiles(user_id) on delete cascade,
  contact_type text not null check (contact_type in ('email','discord','github','x','website')),
  contact_value text not null check (char_length(contact_value) between 1 and 240),
  visibility text not null default 'members' check (visibility in ('public','members','private')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id, contact_type)
);

create table public.creator_approvals (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'requested' check (status in ('requested','approved','rejected','revoked')),
  request_message text not null default '' check (char_length(request_message) <= 1000),
  review_note text not null default '' check (char_length(review_note) <= 1000),
  requested_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id) on delete set null
);

create table public.creator_projects (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete restrict,
  title text not null check (char_length(title) between 2 and 100),
  summary text not null check (char_length(summary) between 10 and 1500),
  category text not null check (char_length(category) between 2 and 40),
  role_summary text not null default '' check (char_length(role_summary) <= 500),
  started_on date,
  ended_on date,
  project_status text not null default 'planning' check (project_status in ('planning','active','completed','paused')),
  visibility text not null default 'draft' check (visibility in ('draft','public','members','hidden')),
  result_url text check (result_url is null or char_length(result_url) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint creator_projects_date_order check (ended_on is null or started_on is null or ended_on >= started_on)
);

create table public.project_memberships (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.creator_projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (char_length(role) between 2 and 80),
  description text not null default '' check (char_length(description) <= 1000),
  status text not null default 'pending' check (status in ('pending','accepted','rejected')),
  invited_by uuid not null references auth.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  confirmed_at timestamptz,
  unique(project_id, user_id)
);

alter table public.member_profiles enable row level security;
alter table public.profile_contacts enable row level security;
alter table public.creator_approvals enable row level security;
alter table public.creator_projects enable row level security;
alter table public.project_memberships enable row level security;

create function public.is_member()
returns boolean language sql stable security definer set search_path = public
as $$ select auth.uid() is not null and not coalesce((auth.jwt()->>'is_anonymous')::boolean, true) $$;

create function public.is_creator(p_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public
as $$ select exists(select 1 from public.creator_approvals where user_id=p_user_id and status='approved') $$;

create function public.can_read_member_profile(p_user_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.member_profiles p where p.user_id=p_user_id and
      (p.user_id=auth.uid() or public.is_admin() or p.visibility='public' or
       (p.visibility='members' and public.is_member()))
  )
$$;

create function public.can_read_creator_project(p_project_id uuid)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists(
    select 1 from public.creator_projects p where p.id=p_project_id and
      (p.owner_id=auth.uid() or public.is_admin() or p.visibility='public' or
       (p.visibility='members' and public.is_member()))
  )
$$;

create policy "read authorized member profiles" on public.member_profiles for select
using (public.can_read_member_profile(user_id));
create policy "read authorized profile contacts" on public.profile_contacts for select
using (
  user_id=auth.uid() or public.is_admin() or
  (public.can_read_member_profile(user_id) and
   (visibility='public' or (visibility='members' and public.is_member())))
);
create policy "members read own creator approval" on public.creator_approvals for select to authenticated
using (user_id=auth.uid() or public.is_owner());
create policy "read authorized creator projects" on public.creator_projects for select
using (public.can_read_creator_project(id));
create policy "read authorized project memberships" on public.project_memberships for select
using (
  user_id=auth.uid() or invited_by=auth.uid() or public.is_admin() or
  (status='accepted' and public.can_read_creator_project(project_id))
);

create function private.touch_creator_updated_at()
returns trigger language plpgsql set search_path = public, private as $$
begin new.updated_at = now(); return new; end $$;
create trigger touch_member_profiles before update on public.member_profiles
for each row execute function private.touch_creator_updated_at();
create trigger touch_profile_contacts before update on public.profile_contacts
for each row execute function private.touch_creator_updated_at();
create trigger touch_creator_projects before update on public.creator_projects
for each row execute function private.touch_creator_updated_at();

create function public.upsert_member_profile(
  p_handle text,
  p_display_name text,
  p_bio text default '',
  p_school_name text default null,
  p_department_name text default null,
  p_admission_year smallint default null,
  p_expected_graduation_year smallint default null,
  p_graduation_year smallint default null,
  p_primary_role text default null,
  p_interests text[] default '{}',
  p_tools text[] default '{}',
  p_availability text default 'hidden',
  p_visibility text default 'members'
) returns uuid language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Login required'; end if;
  perform private.enforce_community_rate('profile_update_hour', 30, interval '1 hour');
  insert into public.member_profiles(
    user_id,handle,display_name,bio,school_name,department_name,admission_year,
    expected_graduation_year,graduation_year,primary_role,interests,tools,availability,visibility
  ) values (
    auth.uid(),lower(btrim(p_handle)),btrim(p_display_name),btrim(coalesce(p_bio,'')),nullif(btrim(p_school_name),''),
    nullif(btrim(p_department_name),''),p_admission_year,p_expected_graduation_year,p_graduation_year,
    nullif(btrim(p_primary_role),''),coalesce(p_interests,'{}'),coalesce(p_tools,'{}'),p_availability,p_visibility
  ) on conflict(user_id) do update set
    handle=excluded.handle,display_name=excluded.display_name,bio=excluded.bio,school_name=excluded.school_name,
    department_name=excluded.department_name,admission_year=excluded.admission_year,
    expected_graduation_year=excluded.expected_graduation_year,graduation_year=excluded.graduation_year,
    primary_role=excluded.primary_role,interests=excluded.interests,tools=excluded.tools,
    availability=excluded.availability,visibility=excluded.visibility;
  return auth.uid();
end $$;

create function public.upsert_profile_contact(p_type text,p_value text,p_visibility text default 'members')
returns uuid language plpgsql security definer set search_path = public as $$
declare result_id uuid;
begin
  if not public.is_member() then raise exception 'Login required'; end if;
  if not exists(select 1 from public.member_profiles where user_id=auth.uid()) then raise exception '프로필을 먼저 저장해 주세요.'; end if;
  perform private.enforce_community_rate('profile_contact_hour', 30, interval '1 hour');
  insert into public.profile_contacts(user_id,contact_type,contact_value,visibility)
    values(auth.uid(),p_type,btrim(p_value),p_visibility)
    on conflict(user_id,contact_type) do update set contact_value=excluded.contact_value,visibility=excluded.visibility
    returning id into result_id;
  return result_id;
end $$;

create function public.remove_profile_contact(p_type text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Login required'; end if;
  delete from public.profile_contacts where user_id=auth.uid() and contact_type=p_type;
end $$;

create function public.request_creator_access(p_message text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Login required'; end if;
  if not exists(select 1 from public.member_profiles where user_id=auth.uid()) then raise exception '프로필을 먼저 저장해 주세요.'; end if;
  if public.is_creator() then raise exception '이미 Creator로 승인된 계정입니다.'; end if;
  perform private.enforce_community_rate('creator_request_day', 3, interval '24 hours');
  insert into public.creator_approvals(user_id,status,request_message,requested_at,reviewed_at,reviewed_by,review_note)
    values(auth.uid(),'requested',btrim(coalesce(p_message,'')),now(),null,null,'')
    on conflict(user_id) do update set status='requested',request_message=excluded.request_message,
      requested_at=now(),reviewed_at=null,reviewed_by=null,review_note='';
end $$;

create function public.list_creator_approvals()
returns table(user_id uuid,email text,display_name text,status text,request_message text,requested_at timestamptz,reviewed_at timestamptz)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  return query select a.user_id,u.email::text,p.display_name,a.status,a.request_message,a.requested_at,a.reviewed_at
    from public.creator_approvals a join auth.users u on u.id=a.user_id
    left join public.member_profiles p on p.user_id=a.user_id
    order by case a.status when 'requested' then 0 when 'approved' then 1 else 2 end,a.requested_at desc;
end $$;

create function public.set_creator_status(p_email text,p_status text,p_note text default '')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid;
begin
  if not public.is_owner() then raise exception 'Owner access required'; end if;
  if p_status not in ('approved','rejected','revoked') or p_status is null then raise exception 'Invalid Creator status'; end if;
  select id into target_user from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if target_user is null then raise exception '해당 이메일로 로그인한 회원을 찾을 수 없습니다.'; end if;
  if not exists(select 1 from public.member_profiles where user_id=target_user) then raise exception '이 회원은 아직 Creator Space 프로필을 만들지 않았습니다.'; end if;
  insert into public.creator_approvals(user_id,status,review_note,reviewed_at,reviewed_by)
    values(target_user,p_status,btrim(coalesce(p_note,'')),now(),auth.uid())
    on conflict(user_id) do update set status=excluded.status,review_note=excluded.review_note,
      reviewed_at=excluded.reviewed_at,reviewed_by=excluded.reviewed_by;
  return target_user;
end $$;

create function public.create_creator_project(
  p_title text,p_summary text,p_category text,p_role text default '',p_started_on date default null,
  p_ended_on date default null,p_status text default 'planning',p_visibility text default 'draft',p_result_url text default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare new_id uuid;
begin
  if not public.is_creator() then raise exception 'Creator approval required'; end if;
  perform private.enforce_community_rate('creator_project_day', 10, interval '24 hours');
  insert into public.creator_projects(owner_id,title,summary,category,role_summary,started_on,ended_on,project_status,visibility,result_url)
    values(auth.uid(),btrim(p_title),btrim(p_summary),btrim(p_category),btrim(coalesce(p_role,'')),p_started_on,p_ended_on,p_status,p_visibility,nullif(btrim(p_result_url),''))
    returning id into new_id;
  insert into public.project_memberships(project_id,user_id,role,description,status,invited_by,confirmed_at)
    values(new_id,auth.uid(),coalesce(nullif(btrim(p_role),''),'Project Owner'),'','accepted',auth.uid(),now());
  return new_id;
end $$;

create function public.invite_project_member(p_project_id uuid,p_email text,p_role text,p_description text default '')
returns uuid language plpgsql security definer set search_path = public, auth as $$
declare target_user uuid; membership_id uuid;
begin
  if not public.is_creator() then raise exception 'Creator approval required'; end if;
  if not exists(select 1 from public.creator_projects where id=p_project_id and owner_id=auth.uid()) then raise exception 'Project owner access required'; end if;
  select id into target_user from auth.users where lower(email)=lower(btrim(p_email)) limit 1;
  if target_user is null then raise exception '해당 이메일로 로그인한 회원을 찾을 수 없습니다.'; end if;
  if target_user=auth.uid() then raise exception '프로젝트 소유자는 이미 참여자로 등록되어 있습니다.'; end if;
  perform private.enforce_community_rate('project_invite_day', 50, interval '24 hours');
  insert into public.project_memberships(project_id,user_id,role,description,status,invited_by,confirmed_at)
    values(p_project_id,target_user,btrim(p_role),btrim(coalesce(p_description,'')),'pending',auth.uid(),null)
    on conflict(project_id,user_id) do update set role=excluded.role,description=excluded.description,
      status='pending',invited_by=auth.uid(),confirmed_at=null
    returning id into membership_id;
  return membership_id;
end $$;

create function public.respond_project_membership(p_membership_id uuid,p_response text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_member() then raise exception 'Login required'; end if;
  if p_response not in ('accepted','rejected') or p_response is null then raise exception 'Invalid membership response'; end if;
  update public.project_memberships set status=p_response,confirmed_at=now()
    where id=p_membership_id and user_id=auth.uid() and status='pending';
  if not found then raise exception '확인할 수 있는 프로젝트 참여 요청이 없습니다.'; end if;
end $$;

revoke all on table public.member_profiles,public.profile_contacts,public.creator_approvals,public.creator_projects,public.project_memberships from public,anon,authenticated;
grant select on table public.member_profiles,public.profile_contacts,public.creator_approvals,public.creator_projects,public.project_memberships to anon,authenticated;

revoke all on function public.is_member(),public.is_creator(uuid),public.can_read_member_profile(uuid),public.can_read_creator_project(uuid),
  public.upsert_member_profile(text,text,text,text,text,smallint,smallint,smallint,text,text[],text[],text,text),
  public.upsert_profile_contact(text,text,text),public.remove_profile_contact(text),public.request_creator_access(text),
  public.list_creator_approvals(),public.set_creator_status(text,text,text),
  public.create_creator_project(text,text,text,text,date,date,text,text,text),public.invite_project_member(uuid,text,text,text),
  public.respond_project_membership(uuid,text) from public,anon,authenticated;
grant execute on function public.is_member(),public.is_creator(uuid),public.can_read_member_profile(uuid),public.can_read_creator_project(uuid) to anon,authenticated;
grant execute on function public.upsert_member_profile(text,text,text,text,text,smallint,smallint,smallint,text,text[],text[],text,text),
  public.upsert_profile_contact(text,text,text),public.remove_profile_contact(text),public.request_creator_access(text),
  public.list_creator_approvals(),public.set_creator_status(text,text,text),
  public.create_creator_project(text,text,text,text,date,date,text,text,text),public.invite_project_member(uuid,text,text,text),
  public.respond_project_membership(uuid,text) to authenticated;

notify pgrst, 'reload schema';
