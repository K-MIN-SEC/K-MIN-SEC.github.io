-- Supabase Storage objects must be deleted through the Storage API.
-- The client already removes each object before deleting its attachment metadata.
drop trigger if exists delete_space_object_after_metadata on public.space_attachments;
drop function if exists private.delete_space_object();

notify pgrst,'reload schema';
