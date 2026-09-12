-- Works with "Automatically expose new tables" disabled.
grant usage on schema public to anon, authenticated;
revoke all on table public.project_likes, public.project_comments, public.space_posts,
  public.space_likes, public.space_comments, public.reports, public.admins from anon, authenticated;
grant select on table public.project_likes, public.project_comments, public.space_posts,
  public.space_likes, public.space_comments to anon, authenticated;
grant select on table public.reports, public.admins to authenticated;
grant insert on table public.project_likes, public.project_comments, public.space_posts,
  public.space_likes, public.space_comments, public.reports to authenticated;
grant delete on table public.project_likes, public.project_comments, public.space_posts,
  public.space_likes, public.space_comments to authenticated;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;
revoke all on function public.moderate_report(uuid, text) from public, anon;
grant execute on function public.moderate_report(uuid, text) to authenticated;

notify pgrst, 'reload schema';
