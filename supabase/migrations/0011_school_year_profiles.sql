-- Add school-year editing without changing or deleting existing profile data.
begin;
create or replace function public.upsert_member_profile_v3(
 p_handle text,p_display_name text,p_bio text default '',
 p_affiliation_type text default 'none',p_affiliation_name text default null,p_affiliation_unit text default null,
 p_admission_year smallint default null,p_expected_graduation_year smallint default null,p_graduation_year smallint default null,
 p_primary_role text default null,p_interests text[] default '{}',p_tools text[] default '{}',
 p_availability text default 'hidden',p_visibility text default 'members'
) returns uuid language plpgsql security definer set search_path=public,pg_temp as $$
declare result uuid;
begin
 if p_affiliation_type='school' then
  if (p_admission_year is not null and p_admission_year not between 2000 and 2100)
   or (p_expected_graduation_year is not null and p_expected_graduation_year not between 2000 and 2100)
   or (p_graduation_year is not null and p_graduation_year not between 2000 and 2100)
  then raise exception 'Invalid school year'; end if;
  if p_admission_year is not null and p_expected_graduation_year is not null and p_expected_graduation_year<p_admission_year
  then raise exception 'Expected graduation year must not precede admission year'; end if;
  if p_admission_year is not null and p_graduation_year is not null and p_graduation_year<p_admission_year
  then raise exception 'Graduation year must not precede admission year'; end if;
 end if;

 result=public.upsert_member_profile_v2(
  p_handle,p_display_name,p_bio,p_affiliation_type,p_affiliation_name,p_affiliation_unit,
  p_primary_role,p_interests,p_tools,p_availability,p_visibility);

 -- Non-school affiliations keep historical education data instead of destroying it.
 if p_affiliation_type='school' then
  update public.member_profiles set admission_year=p_admission_year,
   expected_graduation_year=p_expected_graduation_year,graduation_year=p_graduation_year
   where user_id=auth.uid();
 end if;
 return result;
end $$;
revoke all on function public.upsert_member_profile_v3(text,text,text,text,text,text,smallint,smallint,smallint,text,text[],text[],text,text) from public,anon;
grant execute on function public.upsert_member_profile_v3(text,text,text,text,text,text,smallint,smallint,smallint,text,text[],text[],text,text) to authenticated;
notify pgrst, 'reload schema';
commit;
