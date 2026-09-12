# Creator Space 분리 설계

상태: **구조 설계 — Creator Space 구현을 시작하지 않음**

## 배포 단위

```text
K-MIN-SEC.github.io
└─ MINSEC: Astro static / GitHub Pages

creator-space (향후 별도 저장소)
└─ Creator Space: Astro server output / Cloudflare Workers·Pages

Supabase minsec-site
├─ Auth: 두 서비스가 같은 사용자 ID 사용
├─ PostgreSQL: Profiles, Registry, reactions, community content
└─ Storage: private/public 정책이 분리된 bucket
```

두 프론트엔드는 각자의 Supabase 클라이언트를 만들고 각 origin에 세션을 저장한다. 초기 버전은 SSO 쿠키나 중앙 로그인 브로커를 만들지 않는다. 사용자는 같은 Google/GitHub 계정을 선택해 각 사이트에서 로그인한다.

MINSEC 저장소의 `src/lib/supabase.ts`, 권한 타입과 DB 타입은 이후 작은 shared-contract 패키지 또는 Supabase에서 생성한 타입 파일로 맞춘다. UI 컴포넌트와 배포 설정은 공유하지 않는다.

## Creator Space 렌더링

- `/`, `/works/[id]`, `/members/[handle]`, `/events/[id]`, `/team-up/[id]`: 서버에서 공개·visible 데이터를 읽어 완성된 HTML을 응답한다.
- `/space/[id]`: 공개 글만 서버 렌더링한다. 비밀글은 제목·본문·작성자를 HTML에 넣지 않고 잠금 화면만 응답한다.
- `/account`, `/admin`, 비밀글, 회원 전용 화면: `X-Robots-Tag: noindex, nofollow`와 HTML robots meta를 함께 사용한다.
- 사용자별 응답은 `Cache-Control: private, no-store`를 사용한다. 공개 페이지에만 공유 캐시를 허용하고 인증 쿠키가 있는 요청을 공용 캐시에 저장하지 않는다.
- Supabase service-role 키는 서버 비밀 환경값으로만 사용한다. 가능한 공개 읽기는 anon key와 RLS로 처리한다.

## 공개 sitemap

`/sitemap-index.xml`은 정적 섹션 sitemap과 동적 콘텐츠 sitemap을 나눈다. 동적 sitemap endpoint는 Registry에서 `visibility='public' and status='visible'`인 Work/Profile/Event/Team Up만 페이지 단위로 조회한다. 비밀글·회원 전용·숨김·삭제 항목은 포함하지 않는다. `lastmod`는 Registry `updated_at`을 사용한다.

콘텐츠가 많아지면 sitemap 하나당 URL 수를 제한하고 `/sitemaps/content-1.xml`처럼 분할한다. 갱신은 요청 시 짧은 TTL로 생성하거나 콘텐츠 변경 후 Cloudflare cache tag를 무효화한다.

## 권한과 콘텐츠 생성

- Member는 기본 Profile과 Space를 사용한다.
- Creator 승인은 별도 role/approval 테이블에서 관리한다.
- Works 공개, Team Up, Event 작성 RPC는 현재 role이 Creator 이상인지 DB에서 확인한다.
- Moderator는 Reports 처리만, Admin은 Featured·공지·권한과 전체 moderation을 담당한다.
- MINSEC GitHub CMS 권한은 Supabase role과 별개다.

## Storage

bucket 후보는 `avatars`, `work-media`, `work-files`, `post-attachments`다. public asset도 업로드 권한은 소유자 RPC/정책으로 제한한다. 비밀 콘텐츠 파일은 private bucket과 RLS를 사용하며 public URL을 만들지 않는다. 영상·게임 빌드·원본 제작 파일은 외부 호스팅 링크를 사용한다.

## 분리 순서와 rollback

1. Creator Space 저장소를 만들고 read-only 공개 목록부터 연결한다.
2. 공유 Auth와 Profiles를 검증한다.
3. Works/Profile 작성, Space를 순서대로 옮긴다.
4. Team Up/Event를 추가한다.
5. MINSEC의 Creator Space 링크를 새 origin으로 바꾼다.
6. 일정 기간 기존 `/space`를 읽기 전용 안내 페이지로 유지한다.

문제가 생기면 MINSEC 링크를 기존 `/space`로 되돌리고 Creator Space의 쓰기 기능을 닫는다. DB 테이블은 삭제하지 않고 안정화 후 다시 전환한다.
