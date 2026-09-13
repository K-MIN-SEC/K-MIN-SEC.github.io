export const profileRoles = [
  '게임 기획', '클라이언트 개발', '서버 개발', '2D 아트',
  '3D 아트', 'UI/UX 디자인', '사운드', 'AI 개발',
] as const;

export const profileInterests = [
  '게임 기획', '게임 개발', '2D 아트', '3D 아트', 'UI/UX',
  '생성형 AI', '액션', '퍼즐', 'RPG', '스토리텔링', '사운드', '게임잼',
] as const;

export const profileTools = [
  ['Unity', '유니티 (Unity)'], ['Unreal Engine', '언리얼 엔진'],
  ['Godot', '고도'], ['Blender', '블렌더'], ['Figma', '피그마'],
  ['Photoshop', '포토샵'], ['GitHub', '깃허브'], ['Python', '파이썬'],
  ['ChatGPT', '챗GPT'], ['ComfyUI', '컴피UI'],
] as const;

export const availabilityOptions = [
  ['available', '프로젝트 참여 가능'],
  ['limited', '프로젝트 참여 조건 협의'],
  ['unavailable', '현재 프로젝트 참여 어려움'],
] as const;

export const affiliationOptions = [
  ['school', '학교'], ['company', '기업'], ['other', '기타 소속'],
] as const;
