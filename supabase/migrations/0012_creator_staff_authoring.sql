-- Align creator content edit/delete permissions for authors and community staff.
-- Data and table shapes are unchanged; rollback by restoring the 0009 function bodies.

create or replace function public.save_creator_entry(p_data jsonb,p_id uuid default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_existing creator_entries; v_project uuid;
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if p_id is not null then
  select * into v_existing from creator_entries where id=p_id and (owner_id=auth.uid() or public.is_admin()) and deleted_at is null for update;
  if not found then raise exception 'Author or staff access required'; end if;
  if v_existing.moderation_status='hidden' and not public.is_admin() then raise exception 'Hidden content cannot be edited'; end if;
 end if;
 if not public.is_creator() and not (p_id is not null and public.is_admin()) then raise exception 'Creator approval required'; end if;
 perform private.enforce_community_rate('creator_entry_hour',30,interval '1 hour');
 v_project:=nullif(p_data->>'project_id','')::uuid;
 if v_project is not null and not exists(select 1 from creator_projects p where p.id=v_project and p.deleted_at is null and
 (public.is_admin() or p.owner_id=auth.uid() or exists(select 1 from project_memberships m where m.project_id=p.id and m.user_id=auth.uid() and m.status='accepted'))) then raise exception 'Confirmed project membership required'; end if;
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

create or replace function public.update_creator_project(p_id uuid,p_data jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare v_team uuid; v_owner uuid;
begin
 if not public.is_member() then raise exception 'Login required'; end if;
 if not public.is_creator() and not public.is_admin() then raise exception 'Creator approval required'; end if;
 select owner_id into v_owner from creator_projects where id=p_id and (owner_id=auth.uid() or public.is_admin()) and deleted_at is null and visibility<>'hidden' for update;
 if not found then raise exception 'Project author or staff access required'; end if;
 v_team:=nullif(p_data->>'team_up_id','')::uuid;
 if v_team is not null and not exists(select 1 from creator_entries where id=v_team and kind='teamup' and owner_id=v_owner and deleted_at is null) then raise exception 'Invalid Team Up'; end if;
 if nullif(p_data->>'result_url','') is not null and (p_data->>'result_url') !~ '^https://' then raise exception 'HTTPS URL required'; end if;
 if coalesce(p_data->>'visibility','draft') not in ('draft','public','members') then raise exception 'Invalid visibility'; end if;
 perform private.enforce_community_rate('creator_project_update_hour',30,interval '1 hour');
 update creator_projects set title=btrim(p_data->>'title'),summary=btrim(p_data->>'summary'),category=btrim(p_data->>'category'),
 role_summary=coalesce(p_data->>'role_summary',''),started_on=nullif(p_data->>'started_on','')::date,ended_on=nullif(p_data->>'ended_on','')::date,
 project_status=coalesce(p_data->>'project_status','planning'),visibility=coalesce(p_data->>'visibility','draft'),result_url=nullif(p_data->>'result_url',''),team_up_id=v_team where id=p_id;
end $$;

revoke all on function public.save_creator_entry(jsonb,uuid),public.update_creator_project(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_creator_entry(jsonb,uuid),public.update_creator_project(uuid,jsonb) to authenticated;
