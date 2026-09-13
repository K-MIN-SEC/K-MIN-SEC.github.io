# Creator Space 분리 설계

상태: **별도 SSR 앱 구현·로컬 실행·0009 운영 적용 완료 — Cloudflare 계정 이메일 확인 후 원격 배포 예정**

## 제품 목적

Creator Space는 선배와 동료의 작업을 보고, 프로젝트에 참여하고, 확인된 경험을 자신의 다음 포트폴리오로 만드는 크리에이터 네트워크다. 커뮤니티의 규모보다 `Team Up → Project → Result → Portfolio` 흐름이 실제로 한 번 완성되는 것을 첫 성공 조건으로 삼는다.

장기적으로 연도·직군별 Portfolio Archive와 Project Archive를 제공해 학생이 선배의 작업 수준, 졸업작품과 준비 직군을 찾아볼 수 있게 한다.

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

- `/`, `/portfolios`, `/works/[id]`, `/projects/[id]`, `/members/[handle]`, `/events/[id]`, `/team-up/[id]`: 서버에서 공개·visible 데이터를 읽어 완성된 HTML을 응답한다.
- `/space/[id]`: 공개 글만 서버 렌더링한다. 비밀글은 제목·본문·작성자를 HTML에 넣지 않고 잠금 화면만 응답한다.
- `/account`, `/admin`, 비밀글, 회원 전용 화면: `X-Robots-Tag: noindex, nofollow`와 HTML robots meta를 함께 사용한다.
- 사용자별 응답은 `Cache-Control: private, no-store`를 사용한다. 공개 페이지에만 공유 캐시를 허용하고 인증 쿠키가 있는 요청을 공용 캐시에 저장하지 않는다.
- Supabase service-role 키는 서버 비밀 환경값으로만 사용한다. 가능한 공개 읽기는 anon key와 RLS로 처리한다.

## 공개 sitemap

`/sitemap-index.xml`은 정적 섹션 sitemap과 동적 콘텐츠 sitemap을 나눈다. 동적 sitemap endpoint는 Registry에서 `visibility='public' and status='visible'`인 Work/Profile/Event/Team Up만 페이지 단위로 조회한다. 비밀글·회원 전용·숨김·삭제 항목은 포함하지 않는다. `lastmod`는 Registry `updated_at`을 사용한다.

콘텐츠가 많아지면 sitemap 하나당 URL 수를 제한하고 `/sitemaps/content-1.xml`처럼 분할한다. 갱신은 요청 시 짧은 TTL로 생성하거나 콘텐츠 변경 후 Cloudflare cache tag를 무효화한다.

## 권한과 콘텐츠 생성

권한은 다음 세 축과 외부 CMS 권한으로 나눈다.

```text
ACCOUNT          Member
CREATOR STATUS   Not approved | Creator
COMMUNITY STAFF  None | Moderator | Owner
MINSEC CMS       No repository access | GitHub Repository Editor
```

- Member는 기본 Profile과 Space 글·댓글·좋아요·신고를 사용한다.
- Creator 승인은 별도 role/approval 테이블에서 관리한다. Works와 Projects 공개, Team Up과 Event 작성 RPC는 Creator 상태를 검사한다.
- Moderator는 신고 처리, 게시글 숨김·복구, 공지 등록·해제를 담당한다.
- Owner는 Moderator 권한과 Creator 승인, 운영자 지정·해제, Featured 선정, 서비스 운영 설정을 담당한다.
- Moderator나 Owner 상태는 Creator 상태를 자동으로 부여하지 않는다.
- MINSEC GitHub CMS 권한은 모든 Supabase 역할과 별개다. `Admin`은 관리 UI의 이름으로만 사용한다.

현재 실제 DB에는 `owner`와 `moderator`, 별도의 Creator 승인 상태와 Profile·Project Experience 기반이 구현되어 있다. Creator Space 서비스는 이 구조를 재사용한다.

## Profile과 연락처

Profile은 입학년도, 졸업예정년도와 실제 졸업년도, 직군, 관심 분야, 사용 도구, 프로젝트 참여 가능 상태를 제공한다. 사용자가 등록한 Works와 확인된 Project Experience를 함께 보여준다.

연락처는 Auth 이메일과 분리해 사용자가 직접 입력한다. MVP는 Email, Discord, GitHub, X, 개인 사이트를 지원하고 전화번호는 지원하지 않는다. 연락처마다 `public`, `members`, `private` 공개 범위를 둔다. 사용자가 명시적으로 허용한 값만 HTML과 API에 노출한다.

## Project Experience

Project는 기간, 분야, 결과물, 참여자, 역할과 연결된 Team Up을 기록하는 중심 객체다.

```text
project_memberships
├ project_id
├ user_id
├ role
├ description
├ status: pending | accepted | rejected
├ invited_by
├ created_at
└ confirmed_at
```

프로젝트 등록자가 참여 이력을 요청하고 참여자가 확인하거나 거절한다. `accepted` 이력만 Project 페이지와 공개 Profile의 Project Experience에 표시한다. 평점과 협업 후기는 MVP에 넣지 않는다.

## Archive와 검색

- Portfolio Archive: 연도·직군별 Profile, Works, 외부 포트폴리오 링크.
- Project Archive: 연도별 Project와 확인된 참여 이력.
- Team Up 검색: 직군, 엔진, 참여 가능 상태, 프로젝트 분야.
- 초기에는 추천 알고리즘보다 조건 검색과 Owner 큐레이션을 우선한다.

## Storage

bucket 후보는 `avatars`, `work-media`, `work-files`, `post-attachments`다. public asset도 업로드 권한은 소유자 RPC/정책으로 제한한다. 비밀 콘텐츠 파일은 private bucket과 RLS를 사용하며 public URL을 만들지 않는다. 영상·게임 빌드·원본 제작 파일은 외부 호스팅 링크를 사용한다.

문서 첨부는 브라우저에서 실행하거나 임의 라이브러리로 렌더링하지 않고 다운로드로 제공한다. 이미지와 PDF만 별도 검증 후 미리보기를 고려한다. 학과 전체 서비스 전에는 업로드 격리 또는 악성 파일 검사를 추가한다.

## 분리 순서와 rollback

1. Creator Space 저장소를 만들고 read-only 공개 목록부터 연결한다.
2. 공유 Auth와 Profiles, 연락처 공개 범위를 검증한다.
3. Creator 승인과 Profile/Portfolio/Works를 추가한다.
4. Projects와 참여 확인을 포함한 Project Experience를 추가한다.
5. Team Up, Events, Archive와 조건 검색을 추가한다.
6. Space를 새 서비스로 옮긴다.
7. MINSEC의 Creator Space 링크를 새 origin으로 바꾼다.
8. 일정 기간 기존 `/space`를 읽기 전용 안내 페이지로 유지한다.

문제가 생기면 MINSEC 링크를 기존 `/space`로 되돌리고 Creator Space의 쓰기 기능을 닫는다. DB 테이블은 삭제하지 않고 안정화 후 다시 전환한다.
