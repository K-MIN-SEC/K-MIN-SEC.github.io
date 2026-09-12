import { supabase } from './supabase';
const types = ['image/jpeg','image/png','image/webp','image/gif','application/pdf','text/plain','application/zip','application/x-zip-compressed'];
export function validateFiles(files: File[]) {
  if (files.length > 5) throw new Error('첨부파일은 최대 5개입니다.');
  for (const file of files) {
    if (!types.includes(file.type) || file.size > 10 * 1024 * 1024 || file.name.length > 180) throw new Error(`${file.name}: 이미지·PDF·TXT·ZIP 파일을 10MB 이하로 선택해 주세요.`);
  }
}
export async function uploadFiles(postId: string, files: File[]) {
  validateFiles(files);
  for (const file of files) {
    const reserved = await supabase!.rpc('reserve_space_attachment', { p_id: postId, p_filename: file.name });
    if (reserved.error) throw reserved.error;
    const uploaded = await supabase!.storage.from('space-files').upload(reserved.data, file, { contentType: file.type, upsert: false });
    if (uploaded.error) {
      // Release the reserved slot on a failed upload. Successful earlier files remain attached.
      await supabase!.rpc('remove_space_attachment', { p_path: reserved.data });
      throw uploaded.error;
    }
  }
}
export async function removeFile(path: string) {
  const removed = await supabase!.storage.from('space-files').remove([path]);
  if (removed.error) throw removed.error;
  const meta = await supabase!.rpc('remove_space_attachment', { p_path: path });
  if (meta.error) throw meta.error;
}
export async function downloadFile(path: string, filename: string) {
  // Authenticated download rechecks current RLS, even immediately after password rotation.
  const { data, error } = await supabase!.storage.from('space-files').download(path);
  if (error) throw error;
  const href = URL.createObjectURL(data); const link = document.createElement('a');
  link.href = href; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(href), 1000);
}
