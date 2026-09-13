-- Additive affiliation model. Preserve legacy education fields and old RPC.
begin;
alter table public.member_profiles add column if not exists affiliation_type text;
alter table public.member_profiles add column if not exists affiliation_name text;
alter table public.member_profiles add column if not exists affiliation_unit text;
update public.member_profiles set
 affiliation_type=case when nullif(btrim(school_name),'') is not null or nullif(btrim(department_name),'') is not null then 'school' else 'none' end,
 affiliation_name=nullif(btrim(school_name),''), affiliation_unit=nullif(btrim(department_name),'')
 where affiliation_type is null;
alter table public.member_profiles alter column affiliation_type set default 'none';
alter table public.member_profiles alter column affiliation_type set not null;
do $$ begin
 if not exists(select 1 from pg_constraint where conrelid='public.member_profiles'::regclass and conname='member_profiles_affiliation_valid') then
  alter table public.member_profiles add constraint member_profiles_affiliation_valid check (
   affiliation_type in ('none','school','company','other') and
   (affiliation_name is null or char_length(affiliation_name)<=100) and
   (affiliation_unit is null or char_length(affiliation_unit)<=100));
 end if;
end $$;
create or replace function public.upsert_member_profile_v2(
 p_handle text,p_display_name text,p_bio text default '',
 p_affiliation_type text default 'none',p_affiliation_name text default null,p_affiliation_unit text default null,
 p_primary_role text default null,p_interests text[] default '{}',p_tools text[] default '{}',
 p_availability text default 'hidden',p_visibility text default 'members'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare previous public.member_profiles%rowtype; result uuid;
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if p_affiliation_type is null or p_affiliation_type not in ('none','school','company','other') then raise exception 'Invalid affiliation type'; end if;
 p_affiliation_name=nullif(btrim(p_affiliation_name),'');
 p_affiliation_unit=nullif(btrim(p_affiliation_unit),'');
 if p_affiliation_type='none' then p_affiliation_name=null;p_affiliation_unit=null;
 elsif p_affiliation_name is null then raise exception 'Affiliation name required';end if;
 if char_length(p_affiliation_name)>100 or char_length(p_affiliation_unit)>100 then raise exception 'Affiliation too long';end if;
 select * into previous from public.member_profiles where user_id=auth.uid() for update;
 result=public.upsert_member_profile(p_handle,p_display_name,p_bio,
  case when p_affiliation_type='school' then p_affiliation_name else previous.school_name end,
  case when p_affiliation_type='school' then p_affiliation_unit else previous.department_name end,
  previous.admission_year,previous.expected_graduation_year,previous.graduation_year,
  p_primary_role,p_interests,p_tools,p_availability,p_visibility);
 update public.member_profiles set affiliation_type=p_affiliation_type,affiliation_name=p_affiliation_name,affiliation_unit=p_affiliation_unit where user_id=auth.uid();
 return result;
end $$;
revoke all on function public.upsert_member_profile_v2(text,text,text,text,text,text,text,text[],text[],text,text) from public,anon;
grant execute on function public.upsert_member_profile_v2(text,text,text,text,text,text,text,text[],text[],text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
