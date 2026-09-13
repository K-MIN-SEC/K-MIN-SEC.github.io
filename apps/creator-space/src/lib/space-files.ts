import { supabase } from './supabase';
export const spaceExtendedEnabled = import.meta.env.PUBLIC_SPACE_EXTENDED === 'true';
const acceptedFiles: Record<string, string> = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif',
  pdf: 'application/pdf', txt: 'text/plain',
  hwp: 'application/x-hwp', hwpx: 'application/vnd.hancom.hwpx',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ods: 'application/vnd.oasis.opendocument.spreadsheet',
};
const extensionOf = (name: string) => name.toLowerCase().match(/\.([^.]+)$/)?.[1] ?? '';
export const isPreviewImage = (name: string) => /\.(jpe?g|png|webp|gif)$/i.test(name);
export async function previewImage(path: string, filename: string) {
  if (!isPreviewImage(filename)) return null;
  // The same authenticated private-bucket read used for downloads applies here.
  const {data,error}=await supabase!.storage.from('space-files').download(path);
  if(error)throw error;
  if(!data || !['image/jpeg','image/png','image/webp','image/gif'].includes(data.type.split(';')[0]))throw new Error('이미지 형식을 확인할 수 없습니다. 다운로드로 확인해 주세요.');
  return URL.createObjectURL(data);
}
export function validateFiles(files: File[]) {
  if (files.length > 5) throw new Error('첨부파일은 최대 5개입니다.');
  for (const file of files) {
    if (!acceptedFiles[extensionOf(file.name)] || file.size > 10 * 1024 * 1024 || file.name.length > 180) throw new Error(`${file.name}: 이미지·PDF·TXT·한글·Word·Excel 문서를 10MB 이하로 선택해 주세요.`);
  }
}
export async function uploadFiles(postId: string, files: File[]) {
  validateFiles(files);
  for (const file of files) {
    const reserved = await supabase!.rpc('reserve_space_attachment', { p_id: postId, p_filename: file.name });
    if (reserved.error) throw reserved.error;
    const uploaded = await supabase!.storage.from('space-files').upload(reserved.data, file, { contentType: acceptedFiles[extensionOf(file.name)], upsert: false });
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
