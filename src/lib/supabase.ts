import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

export const communityEnabled = Boolean(supabaseUrl && supabaseKey);
export const supabase = communityEnabled
  ? createClient(supabaseUrl, supabaseKey, { auth: { persistSession: true, autoRefreshToken: true } })
  : null;

export async function ensureCommunityUser() {
  if (!supabase) throw new Error('커뮤니티가 아직 연결되지 않았습니다.');
  const { data } = await supabase.auth.getSession();
  if (data.session?.user && !data.session.user.is_anonymous) return data.session.user;
  throw new Error('상단 로그인 메뉴에서 먼저 로그인해 주세요.');
}

export function messageOf(error: unknown) {
  if (error instanceof Error) return error.message;
  if (error && typeof error === 'object' && 'message' in error) return String(error.message);
  return '잠시 후 다시 시도해 주세요.';
}
