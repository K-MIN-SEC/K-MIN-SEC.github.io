-- Run after 0001. Visitors authenticate with email; no automatic anonymous accounts.
do $$
declare t text;
begin
  foreach t in array array['project_likes','project_comments','space_posts','space_likes','space_comments','reports'] loop
    execute format('create policy "permanent accounts insert" on public.%I as restrictive for insert to authenticated with check (coalesce((auth.jwt()->>''is_anonymous'')::boolean, true) = false)', t);
    execute format('create policy "permanent accounts delete" on public.%I as restrictive for delete to authenticated using (coalesce((auth.jwt()->>''is_anonymous'')::boolean, true) = false)', t);
  end loop;
end $$;

create or replace function public.edit_community_content(p_type text, p_id uuid, p_name text, p_body text, p_title text default null, p_link text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare tbl text; owner_id uuid; current_status text;
begin
  if auth.uid() is null or coalesce((auth.jwt()->>'is_anonymous')::boolean, true) then raise exception 'Login required'; end if;
  tbl := case p_type when 'space_post' then 'space_posts' when 'space_comment' then 'space_comments' when 'project_comment' then 'project_comments' end;
  if tbl is null then raise exception 'Invalid content type'; end if;
  execute format('select user_id, status from public.%I where id = $1 for update', tbl) into owner_id, current_status using p_id;
  if owner_id is null then raise exception 'Content not found'; end if;
  if not public.is_admin() and (owner_id <> auth.uid() or current_status <> 'visible') then raise exception 'Edit access denied'; end if;
  if p_type = 'space_post' then
    update public.space_posts set display_name = btrim(p_name), body = btrim(p_body), title = btrim(p_title), link_url = nullif(btrim(p_link), '') where id = p_id;
  else
    execute format('update public.%I set display_name = btrim($1), body = btrim($2) where id = $3', tbl) using p_name, p_body, p_id;
  end if;
end $$;

create or replace function public.set_community_visibility(p_type text, p_id uuid, p_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare tbl text;
begin
  if not public.is_admin() then raise exception 'Admin access required'; end if;
  if p_status not in ('visible', 'hidden') or p_status is null then raise exception 'Invalid status'; end if;
  tbl := case p_type when 'space_post' then 'space_posts' when 'space_comment' then 'space_comments' when 'project_comment' then 'project_comments' end;
  if tbl is null then raise exception 'Invalid content type'; end if;
  execute format('update public.%I set status = $1 where id = $2', tbl) using p_status, p_id;
end $$;

revoke all on function public.edit_community_content(text, uuid, text, text, text, text) from public, anon;
revoke all on function public.set_community_visibility(text, uuid, text) from public, anon;
grant execute on function public.edit_community_content(text, uuid, text, text, text, text) to authenticated;
grant execute on function public.set_community_visibility(text, uuid, text) to authenticated;
