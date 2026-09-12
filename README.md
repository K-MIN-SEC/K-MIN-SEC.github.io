# MINSEC

> **현재 상태: 개발 중인 코드 공유본입니다.** 개인 포트폴리오와 기존 커뮤니티 구현을 포함합니다. 비밀글·첨부파일·공지 migration은 별도 로컬 DB에서 권한 검증을 통과했지만 실제 Supabase에는 아직 적용하지 않았습니다. `PUBLIC_SPACE_EXTENDED` 기본값은 `false`이며 실제 적용·QA 전에는 운영 기능으로 사용하지 않습니다. GitHub Pages 공개 배포도 아직 진행하지 않았습니다.

공개 프로필에는 이름·학교·연락용 이메일만 포함하며 전화번호·생년월일은 제외했습니다. `.env`와 인증 정보는 저장소에 포함하지 않습니다.

어두운 배경과 초록색 아이덴티티를 사용하는 Astro 정적 개인 사이트입니다. Node.js 22.12 이상이 필요합니다. `package-lock.json`을 함께 저장해 동일한 버전으로 설치합니다.

## 실행

이 README가 있는 `minsec-site` 폴더를 터미널에서 열고 실행합니다.

```sh
npm ci
npm run dev
```

터미널에 표시되는 로컬 주소(기본 `http://localhost:4321`)를 엽니다. 배포용 빌드와 검증:

```sh
npm run build
npm run verify
npm run preview
```

`build`는 Astro 타입 검사 후 정적 파일을 `dist/`에 생성합니다. `verify`는 생성된 HTML의 제목·설명·JSON-LD·제목 단계·alt 속성·내부 링크·목차 앵커·sitemap·robots·데이터 기반 카드 수를 검증합니다. `dist/index.html`을 파일로 직접 여는 대신 preview 서버를 사용하세요.

## 포함된 페이지

- Home: 대표 프로젝트, Play 소개, 최신 Devlog
- Projects: 전체 목록과 데이터에서 생성되는 상세 페이지
- Play: 데모 상태와 준비 완료 시 실행 링크
- Devlog: Markdown 콘텐츠 컬렉션, 목록, 글, 목차, 관련 프로젝트
- Space: 방문자 게시글, 좋아요, 답글, 신고
- About: 소개, 프로필, 연락처와 작업 관심사
- Account: 방문자 이메일 링크 로그인 / 로그아웃 (Supabase 연결 필요)
- Admin: 사이트 콘텐츠 편집기와 게시글·댓글 수정·삭제·숨김·신고 관리
- 404: 없는 주소에 대한 안내

4개 프로젝트, 4개 Play 카드, 3개 Devlog 예시를 포함합니다. 예시 글에는 표시가 붙어 있으며 실제 검증 결과나 제작 성과를 주장하지 않습니다.

## 프로젝트 / Play 관리 — 페이지 코드 수정 불필요

| 대상 | 편집 파일 | 반영 범위 |
| --- | --- | --- |
| 프로젝트 | `src/data/projects.json` | Home 대표 카드, Projects 목록·상세, 관련 링크 |
| Play | `src/data/play.json` | Play 전체 카드, Home 준비 수, 프로젝트의 Lab 링크 |
| Devlog | `src/content/devlog/*.md` | 목록·상세·목차·최신 글·프로젝트 관련 글 |

두 JSON 파일은 `{ "items": [...] }` 구조입니다. `items` 배열의 객체 하나가 카드 하나입니다. 기존 객체를 복제하고 고유 `id`와 내용을 바꾸면 추가됩니다. 표시 순서는 배열 순서이며, 삭제는 객체를 제거하면 됩니다. 관리자 편집기에서도 같은 파일을 편집할 수 있습니다. 정적 사이트이므로 변경 후 **다시 빌드하고 배포**해야 공개 사이트에 반영됩니다.

프로젝트 필드:

- `id`: 영문 소문자·숫자·하이픈. 상세 주소에 사용하므로 공개 후 변경 시 기존 주소가 사라집니다.
- `title`, `subtitle`, `category`, `status`, `year`, `description`: 카드와 상세의 내용
- `internalName`: 선택 필드. 내부 이름을 상세 페이지에서 작게 표시
- `accent`: `lime`, `mint`, `stone`, `sage` 중 하나
- `featured`: `true`이면 Home에도 표시
- `tags`: 주제 배열
- `sections`: `{ "title": "섹션 제목", "body": "본문" }` 배열. 상세 페이지와 목차를 생성
- `coverImage`, `coverAlt`: 대표 이미지의 HTTPS 주소 또는 `public/` 기준 `/images/...` 경로와 대체 텍스트. 이미지가 없으면 둘 다 `null` 또는 생략
- `videos`: 플레이 영상 배열. `type`은 `video` 또는 `youtube`, `src`는 MP4/웹 영상 주소나 YouTube embed 주소, `title`은 필수이며 `poster`와 `caption`은 선택

Play 필드:

- `id`, `title`, `kind`, `description`, `accent`
- `status`: `coming-soon` 또는 `available`
- `demoUrl`: 준비 중이면 `null`. 공개 시 HTTPS 주소 또는 `/demos/my-demo/index.html`과 같은 사이트 내부 경로
- `projectId`: 선택 필드. 존재하는 프로젝트의 `id`를 연결하면 프로젝트 링크 표시
- `coverImage`, `coverAlt`: Play 카드용 대표 이미지와 대체 텍스트

프로젝트를 삭제해도 Play와 글 자체는 유지됩니다. 삭제된 프로젝트를 향하는 관련 링크는 자동으로 숨깁니다. 연관 콘텐츠도 없애려면 해당 Play 객체나 Markdown을 함께 삭제하세요. 중복 ID, 필수값 누락, 잘못된 상태, URL 없는 공개 데모는 빌드 시 오류로 알려 줍니다.

## 관리자 콘텐츠 편집기

사이트 상단 **관리자 → 콘텐츠 편집기 열기 → 편집기 열기**를 선택합니다. 로컬 사이트와 함께 아래 명령을 별도 터미널에서 실행해 두세요.

```sh
npm run cms
```

프로젝트·Play 카드의 추가/수정/삭제/순서 변경, 이미지 업로드, 영상 파일/URL 첨부, Devlog Markdown 작성/수정/삭제, 프로필 변경을 지원합니다. 업로드 파일은 `public/uploads/`에 저장됩니다. 프로젝트를 삭제해도 업로드 파일은 자동 삭제되지 않습니다. 미디어 목록에서 사용 여부를 확인한 뒤 정리하세요. 전화번호·생년월일을 비우면 해당 프로필 항목은 표시되지 않습니다.

Decap 편집기의 **게시 → 지금 게시**는 로컬 모드에서 이 컴퓨터의 파일에 저장한다는 뜻입니다. 인터넷에 배포하지 않습니다. 로컬 서버는 인증 없이 파일을 편집하므로 `127.0.0.1`에만 연결되게 고정했습니다. `npm run cms`를 실행한 터미널을 닫으면 편집 서버도 종료됩니다. Supabase 계정은 로컬 콘텐츠 편집에 필요하지 않습니다.

공개 사이트에서 편집하려면 저장소 업로드와 신뢰할 수 있는 GitHub OAuth 서비스 연결이 추가로 필요합니다. 서비스 주소를 `PUBLIC_CMS_AUTH_URL`에 설정합니다. Pages 빌드는 같은 이름의 GitHub Actions repository variable을 읽습니다. GitHub OAuth client secret을 공개 환경 변수에 넣지 마세요. 공개 편집은 저장소 쓰기 권한이 있는 GitHub 계정으로 인증하며, 방문자용 Supabase 로그인과 별개입니다. 인증 서비스가 없으면 공개 편집기를 활성화하지 않습니다. 저장한 후 Pages 배포 워크플로를 실행해야 공개 페이지가 갱신됩니다.

## Devlog 작성

`src/content/devlog/my-note.md`처럼 새 파일을 추가합니다. 파일 이름이 주소가 됩니다. 본문은 `##`부터 시작하며 글 제목은 자동으로 `<h1>`에 표시합니다.

```md
---
title: "개발 기록 제목"
description: "이 글의 내용 요약"
date: 2026-09-13
category: "GAME DESIGN"
tags: ["Design", "Prototype"]
projectId: "one-stroke"
sample: false
draft: false
---

## 이번에 확인한 것

실제 제작 과정과 결과를 기록합니다.
```

`draft: true`인 글은 목록·상세·sitemap에서 제외됩니다. `projectId`는 선택 사항입니다. 예시 초안을 실제 기록으로 교체할 때 내용과 날짜를 갱신하고 `sample: false`로 바꾸세요. 날짜는 별도 예약 게시 기능이 아니므로 미래 날짜라도 `draft: false`면 공개됩니다.

## 공개 주소와 SEO

`.env.example`을 `.env`로 복사해 설정합니다.

```dotenv
SITE_URL=https://your-domain.com
BASE_PATH=/
```

GitHub 저장소 하위 경로라면 `SITE_URL=https://your-name.github.io`, `BASE_PATH=/repository-name/`으로 설정합니다. `SITE_URL`에는 경로 없이 origin만 넣습니다. 환경값 변경 후 개발 서버를 재시작하고 다시 빌드하세요.

개별 title/description, canonical, Open Graph, X summary, JSON-LD, sitemap, robots를 생성합니다. 기본값 `https://example.com`에서는 검색 노출을 막고 빌드 경고를 출력합니다. 실제 공개 주소를 설정하면 자동으로 index/allow로 바뀝니다. 로컬에서 실행되는 것만으로 검색에 노출되지는 않습니다. 공개 호스팅 배포와 도메인 설정 후 검색 도구에 sitemap을 제출할 수 있습니다.

현재 프로젝트 이미지 파일은 포함하지 않았고, 데이터를 채우는 즉시 카드와 상세 화면에 표시됩니다. `public/images/`에 이미지를 넣었다면 `/images/example.webp`처럼 적습니다. YouTube 시청·공유·임베드 주소를 입력하면 재생용 주소로 변환합니다. 직접 올린 플레이 영상은 용량이 커질 수 있으므로 별도 영상 호스팅도 검토하세요. 글꼴은 Google Fonts를 사용하며 불러오지 못하면 시스템 글꼴로 표시됩니다.

## GitHub에 올리기

**이 폴더의 내용이 저장소 루트**가 되도록 업로드합니다. `node_modules`, `dist`, `.astro`, `.env`는 제외하고, `package-lock.json`, `.env.example`, `.github`는 포함하세요. 제공한 워크플로는 저장소 루트 기준입니다.

`Build and verify`는 push/PR에서 루트 주소와 저장소 하위 주소를 각각 검사합니다.

GitHub Pages 배포를 원하면:

1. 저장소 Settings → Pages → Source를 GitHub Actions로 지정합니다.
2. Actions → Publish GitHub Pages → Run workflow를 실행합니다.
3. 워크플로가 Pages 설정에서 실제 origin과 경로를 읽고 빌드·검증·배포합니다.

이 배포 워크플로는 **수동 실행**입니다. 이후 내용 변경도 다시 실행해야 공개됩니다. 다른 정적 호스팅을 쓸 때는 올바른 환경값으로 빌드한 `dist/`를 배포하세요. 하위 경로 호스팅의 robots.txt는 원점 루트에서 조회되므로, 자체 도메인이나 사용자 루트 Pages가 검색 설정 관리에 더 단순합니다.

## 방문자 커뮤니티 연결

현재 로컬 `.env`는 `minsec-site` Supabase 프로젝트에 연결되어 있습니다. 테이블 7개와 RLS 규칙을 적용했고 공개 데이터 조회, 비회원 관리자 정보 접근 차단, 첫 로그인 메일 발송 요청 성공을 확인했습니다. 소유자 이메일 첫 로그인은 완료했습니다. 실제 게시·관리자 동작의 전체 검증은 남아 있습니다. `.env`는 Git과 제공 ZIP에 포함하지 않으므로 다른 컴퓨터에서는 아래 설정을 다시 입력해야 합니다. 환경값이 없는 경우 작성 화면과 버튼을 표시하되 제출을 막고 연결 상태를 안내합니다.

1. 새 Supabase 프로젝트의 SQL Editor에서 `supabase/migrations/0001_community.sql`, `0002_accounts_and_editing.sql`, `0003_explicit_api_grants.sql`을 순서대로 실행합니다. 현재 연결된 프로젝트에는 이미 적용했으므로 다시 실행하지 않습니다. 프로젝트 생성 시 Automatically expose new tables를 해제해도 세 번째 파일에서 필요한 권한만 부여합니다.
2. Authentication → Providers에서 Email을 활성화하고 Anonymous sign-ins는 끕니다. URL Configuration의 Site URL과 Redirect URLs에 공개 사이트 주소와 `/account/` 주소를 등록합니다. 로컬 시험 시 `http://127.0.0.1:4321/account/`도 등록합니다. 하위 경로로 배포하면 그 경로를 포함해야 합니다.
3. 프로젝트 URL과 Publishable/anon key를 `.env`의 `PUBLIC_SUPABASE_URL`, `PUBLIC_SUPABASE_ANON_KEY`에 입력합니다.
4. 사이트의 Account에서 이메일 로그인을 마친 뒤 Supabase의 Authentication → Users에서 본인 UUID와 이메일 인증 여부를 확인하고 SQL Editor에서 `insert into public.admins(user_id) values ('본인-UUID') on conflict do nothing;`를 한 번 실행합니다. 소유자 첫 로그인은 완료했으며 관리자 등록 작업은 최종 동작 확인이 남아 있습니다.
5. GitHub 저장소 Settings → Secrets and variables → Actions에 같은 두 값을 secret으로 추가하고 사이트를 다시 배포합니다. 현재 GitHub 배포에는 아직 연결값을 등록하지 않았습니다.

현재 Auth Site URL은 `http://127.0.0.1:4321/account/`이며 허용 복귀 주소는 이 주소와 `http://localhost:4321/account/`입니다. 공개 배포 시 Site URL과 Redirect URLs에 실제 공개 Account 주소를 설정해야 합니다. 일반 회원 로그인 UI는 Google/GitHub OAuth를 우선합니다. 각 공급자 앱의 Client ID/Secret을 Supabase Dashboard에 설정하기 전에는 버튼이 동작하지 않습니다. 운영자용 기존 이메일 매직링크 폼은 `PUBLIC_EMAIL_LOGIN=true`일 때만 표시합니다. 이메일+비밀번호 가입은 제공하지 않습니다.

기본 이메일 발송 서비스는 Supabase 조직의 팀원 주소에만 메일을 보내며, 현재 시간당 2건으로 제한됩니다. 일반 방문자의 이메일 가입/로그인을 공개하려면 Custom SMTP를 구성하거나 별도로 OAuth 로그인 제공자를 연결해야 합니다. 이메일 확인을 끄는 방식으로 우회하지 않습니다. [Supabase SMTP 안내](https://supabase.com/docs/guides/auth/auth-smtp)

읽기는 비회원에게 허용하고, 작성·좋아요·신고에는 Member 로그인이 필요합니다. 작성자는 본인 글·댓글을 수정/삭제할 수 있고, 관리자는 모든 게시글·댓글 수정/삭제/숨김/재공개와 신고 기각/숨김 처리를 할 수 있습니다. 관리자 여부와 소유권은 Row Level Security와 서버 함수에서 검사합니다. `node scripts/test-community.mjs`로 별도 로컬 PostgreSQL 엔진에서 권한과 수정·신고 흐름을 검증할 수 있습니다. 이 검사는 실제 Supabase Auth 시험을 대신하지 않습니다. Creator 승인, 차단·스팸 자동화·관리자 메일 알림은 아직 포함하지 않았습니다.

2026-09-13 설치 시 Decap 3.16.2와 로컬 서버의 의존성 감사에서 31건(높음 7, 보통 22, 낮음 2)이 보고되었습니다. 호환 가능한 자동 수정으로 해소되지 않았습니다. 편집기 Markdown 처리 등의 하위 의존성에 해당하며, `devDependencies`라고 해서 브라우저에 복사되는 CMS 코드까지 안전하다는 뜻은 아닙니다. 현재 공개 OAuth 편집은 연결하지 않았고, 실제 공개 운영 전 이 의존성의 업데이트/영향 범위를 재검토해야 합니다.

사이트의 이름·학교·연락처는 `src/data/site.json`에서 관리합니다. 현재 공개 저장소에는 이름, 학교와 연락용 이메일만 포함하며 전화번호와 생년월일은 제외했습니다.

확정된 서비스 경계, 권한, 보안 원칙과 A–E 작업 순서는 [`docs/architecture-decisions.md`](docs/architecture-decisions.md)에 기록합니다. 비밀글·첨부파일·공지는 `PUBLIC_SPACE_EXTENDED=true`와 migration 0004가 모두 준비된 뒤에만 활성화합니다. 기본값은 기존 공개 Space와 호환되는 모드입니다. 적용·복구 절차는 [`docs/space-0004-rollout.md`](docs/space-0004-rollout.md), 공통 반응 이전안은 [`docs/content-target-registry-migration.md`](docs/content-target-registry-migration.md), Creator Space 분리안은 [`docs/creator-space-separation.md`](docs/creator-space-separation.md)를 확인하세요.

현재 단계별 완료·대기 항목은 [`docs/phase-status.md`](docs/phase-status.md), OAuth 설정에 필요한 정확한 주소와 QA 기준은 [`docs/oauth-setup.md`](docs/oauth-setup.md)에 정리했습니다.

## 분석 확장 구조

`src/lib/events.ts`에는 `minsec:event` 브라우저 이벤트와 Analytics adapter 자리가 있습니다. 기본 상태에서는 저장·집계·외부 전송을 하지 않습니다. `page_view`, `project_open`, `devlog_open`, `demo_open`, 화면이 실제 보였던 시간의 `engagement`를 발생시킵니다. `durationMs`는 구간별 증분이므로 여러 engagement 이벤트를 합산하세요. `demo_open`은 링크 클릭이며 게임 실행 완료를 뜻하지 않습니다. `demo_start`, `demo_complete`는 향후 게임 로더와 종료 콜백에서 `track()`으로 연결합니다.

실제 분석 서비스를 연결할 때 `setAnalyticsAdapter()`를 첫 `page_view` 호출 이전에 구성하세요. 동의 절차가 필요하다면 동의 이후 등록하고 그 시점에 `track('page_view')`를 호출합니다. URL query와 referrer는 현재 전송하지 않습니다. 검색/직접/캠페인 유입 분석은 향후 공급자 연결 시 필요한 UTM 값만 선별해 추가합니다.

브라우저에는 공개용 anon key만 사용합니다. service-role 키는 필요하지 않으며 저장소나 브라우저 코드에 넣지 마세요.

## WebGL 연결

빌드를 `public/demos/<demo-id>/`에 넣고 Play 데이터의 URL을 지정하거나 별도 HTTPS 호스팅 주소로 연결합니다. `available`로 바꾸면 준비 중 문구가 실행 링크로 바뀝니다. 정적 파일로 제공할 때 빌드 크기와 저장소 용량을 확인하고, Unity 압축 형식에 필요한 응답 헤더를 호스팅에서 지원하는지 확인해야 합니다. GitHub Pages에서는 빌드 설정에 따라 압축 해제 fallback을 사용하거나 적절한 헤더를 제공하는 별도 데모 호스트가 필요할 수 있습니다. 실제 WebGL 빌드가 전달되기 전에는 게임 실행 자체를 검증할 수 없습니다.

## 참고 문서

- [Astro 콘텐츠 컬렉션](https://docs.astro.build/en/guides/content-collections/)
- [Astro sitemap](https://docs.astro.build/en/guides/integrations-guide/sitemap/)

원본 프로젝트의 `sources/`는 수정하지 않았으며 이 사이트는 별도 폴더로 구성했습니다.
