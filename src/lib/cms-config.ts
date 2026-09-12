const field = (label: string, name: string, widget = 'string', extra = {}) => ({ label, name, widget, ...extra });
const optional = { required: false };
const id = field('주소 ID (영문 소문자·숫자·하이픈)', 'id', 'string', { pattern: ['^[a-z0-9]+(-[a-z0-9]+)*$', '영문 소문자·숫자·하이픈을 사용하세요.'], hint: '이미 공개한 ID를 바꾸면 기존 링크도 바뀝니다. 중복 ID는 사용할 수 없습니다.' });
const accent = field('포인트 색', 'accent', 'select', { options: ['lime', 'mint', 'stone', 'sage'], default: 'lime' });
const media = [field('대표 이미지', 'coverImage', 'image', optional), field('대표 이미지 설명 (이미지 등록 시 필수)', 'coverAlt', 'string', optional)];
const projectFields = [id, field('프로젝트명', 'title'), field('내부 프로젝트명', 'internalName', 'string', optional), field('영문 소개', 'subtitle'), field('분류', 'category'), field('진행 상태', 'status'), field('연도 / 개발 단계', 'year'), accent, field('Home에 표시', 'featured', 'boolean', { default: false }), field('짧은 소개', 'description', 'text'), field('태그', 'tags', 'list'), ...media,
  field('소개 문단', 'sections', 'list', { min: 1, summary: '{{fields.title}}', fields: [field('제목', 'title'), field('본문', 'body', 'text')] }),
  field('플레이 영상', 'videos', 'list', { required: false, summary: '{{fields.title}}', fields: [field('영상 제목', 'title'), field('형식', 'type', 'select', { options: [{ label: '영상 파일 / 직접 주소', value: 'video' }, { label: 'YouTube', value: 'youtube' }], default: 'video' }), field('영상 파일 또는 URL', 'src', 'file', { hint: 'YouTube는 시청·공유 주소를 입력해도 됩니다. 큰 영상은 YouTube를 권장합니다.' }), field('영상 포스터', 'poster', 'image', optional), field('영상 설명', 'caption', 'text', optional)] }),
];
const playFields = [id, field('제목', 'title'), field('데모 종류', 'kind'), field('소개', 'description', 'text'), accent, field('준비 상태', 'status', 'select', { options: [{ label: '준비 중', value: 'coming-soon' }, { label: '플레이 가능', value: 'available' }], default: 'coming-soon' }), field('연결할 프로젝트 ID', 'projectId', 'string', optional), field('플레이 주소', 'demoUrl', 'string', { ...optional, hint: '플레이 가능 상태이면 필수입니다.' }), ...media];

export const cmsConfig = {
  backend: { name: 'github', repo: 'K-MIN-SEC/K-MIN-SEC.github.io', branch: 'main', ...(import.meta.env.PUBLIC_CMS_AUTH_URL ? { base_url: import.meta.env.PUBLIC_CMS_AUTH_URL } : {}) },
  local_backend: import.meta.env.DEV ? { url: 'http://127.0.0.1:8081/api/v1' } : false,
  locale: 'ko', media_folder: 'public/uploads', public_folder: '/uploads', publish_mode: 'simple',
  editor: { preview: false },
  collections: [
    { name: 'portfolio', label: '프로젝트 · Play', files: [
      { name: 'projects', label: '프로젝트 카드', file: 'src/data/projects.json', fields: [field('프로젝트', 'items', 'list', { summary: '{{fields.title}}', fields: projectFields })] },
      { name: 'play', label: 'Play 카드', file: 'src/data/play.json', fields: [field('Play', 'items', 'list', { summary: '{{fields.title}}', fields: playFields })] },
    ] },
    { name: 'devlog', label: 'Devlog', folder: 'src/content/devlog', create: true, delete: true, extension: 'md', format: 'frontmatter', slug: '{{slug}}', fields: [field('제목', 'title'), field('요약', 'description', 'text'), field('날짜', 'date', 'datetime', { date_format: 'YYYY-MM-DD', time_format: false, format: 'YYYY-MM-DD' }), field('카테고리', 'category'), field('태그', 'tags', 'list'), field('프로젝트 ID', 'projectId', 'string', optional), field('예시 글 표시', 'sample', 'boolean', { default: false }), field('비공개 초안', 'draft', 'boolean', { default: true }), field('본문', 'body', 'markdown')] },
    { name: 'profile', label: '내 프로필', files: [{ name: 'site', label: '프로필 · 연락처', file: 'src/data/site.json', fields: [field('이름', 'name'), field('브랜드', 'brand'), field('이메일', 'email'), field('전화번호', 'phone', 'string', optional), field('전화 링크 번호', 'phoneHref', 'string', optional), field('학교', 'school'), field('학과', 'major'), field('학번', 'classYear'), field('생년월일', 'birthDate', 'string', optional)] }] },
  ],
};
