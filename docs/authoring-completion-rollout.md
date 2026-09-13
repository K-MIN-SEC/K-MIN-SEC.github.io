# 실제 작성·편집 완성 작업

## 변경 전 점검

- 공개 MINSEC CMS는 GitHub OAuth 중계 서비스가 없어 비활성 상태다. 로컬 Decap 편집기는 존재한다.
- 0008에는 프로필·승인·프로젝트 생성/초대 기반만 있고 Works/Team Up/Event와 편집 화면이 없다.
- Creator Space는 같은 저장소의 `apps/creator-space`에 독립 package/config를 둔다. MINSEC는 Static/Pages 그대로이며 Creator Space만 Cloudflare Workers SSR로 배포한다. 추후 이 폴더를 별도 저장소로 옮길 수 있다.

## DB 영향 및 이전

- 0009는 Creator 콘텐츠와 Content Target Registry·댓글·좋아요·신고를 추가한다. 기존 테이블의 행을 삭제하지 않는다.
- 기존 Projects와 Space 원문을 Registry에 백필하고 trigger로 이후 변경을 동기화한다. Registry만으로 권한을 판정하지 않고 원문을 다시 조회한다.
- 기존 Space 반응은 기존 검증된 UI/RPC에서 계속 처리한다. 새 Creator 콘텐츠 반응만 Registry FK 모델을 사용한다. 기존 반응의 이중 기록/전환은 독립 migration으로 수행하며 이전 완료라고 표시하지 않는다.
- 삭제는 새 콘텐츠에 대해 soft delete한다. 대상 비공개/숨김/삭제 시 연결 반응도 같은 접근 검사로 차단한다.

## 복구

- 새 앱의 링크를 이전 Space로 변경하고 배포를 직전 버전으로 돌린다.
- 새 쓰기 RPC execute 권한을 회수해 쓰기를 중단할 수 있다. 테이블과 비밀글의 보호 정책은 유지한다.
- 새 컬럼/테이블은 사용자 데이터 확인과 백업 전 제거하지 않는다.

## 적용 상태

- MINSEC 공개 GitHub 편집기 구현: 프로젝트/Play/프로필·Markdown Devlog·파일 업로드, SHA 충돌 방지, commit→Pages 배포. 로그인은 기존 GitHub OAuth 공급자에서 public_repo 동의를 받아 GitHub 저장소 권한을 직접 검사한다. 별도 CMS 인증 서버는 필요하지 않다.
- Creator Space SSR 앱 구현과 빌드 통과: 목록/검색/상세, Studio CRUD, 프로젝트 초대/확인, 프로필/연락처, 공개 sitemap, Space 기존 첨부·비밀글 UI, 운영 관리.
- PGlite 0001–0009 테스트 통과. 기존 테스트와 작성자 경계·대상 존재성·비공개 반응 차단·신고 처리·삭제 숨김을 확인했다.
- 2026-09-13 사용자 승인 후 SQL Editor 전체 원문을 0009와 대조하고 운영 DB 적용 완료. `verify-live-public.mjs`에서 0004–0009 테이블/RPC, 익명 쓰기 거부, 비공개 Creator 조회 차단, 존재하지 않는 Registry 대상 접근 거부를 검증했다.
- GitHub 편집 OAuth와 저장 왕복 QA 완료. 기존 프로젝트 내용 저장으로 `f3ba31f` 커밋 생성, Build and verify #23 및 Publish GitHub Pages #19 성공 확인. 저장 시 선택적 이미지/영상 필드 기본값만 추가되었고 소개 문구는 바뀌지 않았다.
- Cloudflare 계정과 Wrangler 연결 완료. 사용자가 계정·사용자 읽기, Workers 쓰기, 로그인 유지 권한을 승인했다. 불필요한 Astro session KV 생성은 `session:false`로 비활성화했다.
- Cloudflare 실제 배포는 아직 미완료: 파일 업로드 후 이메일 미인증 오류 `10034`로 중단됐다. 사용자의 이메일 확인 후 동일 빌드를 배포하고 실제 origin, Supabase redirect, MINSEC Community 링크를 연결해야 한다.
- 로컬 Cloudflare 개발 서버의 지연 의존성 탐색이 SSR 캐시를 교체해 시작 실패하는 문제를 사전 번들 목록으로 해결했다. 새 서버 시작 후 Home/Works/Projects/사람들/Team Up/Events/Studio/Account/Admin와 sitemap의 HTTP 200 및 비공개 관리 화면 noindex를 확인했다.
- 별도 Member 계정의 Creator CRUD·참여 확인·비밀글 해제에 대한 실제 브라우저 QA는 남아 있다. 로컬 DB 역할 테스트와 실제 사용자 간 검증을 구분한다.
