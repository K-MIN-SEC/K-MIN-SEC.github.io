-- Run only after the website client uses the checked 0006 RPC functions.
-- This closes direct Data API write paths that could bypass application rate limits.

revoke insert on public.project_comments, public.space_comments, public.project_likes, public.space_likes, public.reports from authenticated;
revoke delete on public.project_likes, public.space_likes from authenticated;

notify pgrst, 'reload schema';
