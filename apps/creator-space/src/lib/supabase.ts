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
  const message=error instanceof Error?error.message:error&&typeof error==='object'&&'message' in error?String(error.message):'';
  const labels:Record<string,string>={
    'Login required':'로그인 후 다시 시도해 주세요.',
    'Creator approval required':'Creator 승인이 필요합니다. 계정의 Creator 신청 메뉴를 확인해 주세요.',
    'Author access required':'본인이 작성한 글만 수정할 수 있습니다.',
    'Project owner access required':'프로젝트 작성자만 수정할 수 있습니다.',
    'Hidden content cannot be edited':'운영자가 숨긴 콘텐츠입니다. 운영자에게 문의해 주세요.',
    'Content access denied':'콘텐츠를 볼 수 있는 권한이 없습니다. 로그인과 공개 범위를 확인해 주세요.',
    'HTTPS URL required':'https://로 시작하는 주소를 입력해 주세요.',
    'Owner access required':'최고 운영자 권한이 필요합니다.',
    'Staff access required':'커뮤니티 운영자 권한이 필요합니다.',
    'Failed to fetch':'서버에 연결하지 못했습니다. 인터넷 연결을 확인한 뒤 다시 시도해 주세요.'
  };
  if(labels[message])return labels[message];
  if(/duplicate key.*handle/i.test(message))return '이미 사용 중인 프로필 주소 ID입니다. 다른 ID를 입력해 주세요.';
  if(/check constraint/i.test(message))return '입력값을 저장하지 못했습니다. 글자 수, 날짜와 필수 항목을 확인해 주세요.';
  return message||'잠시 후 다시 시도해 주세요.';
}
