# A–E 진행 상태

작성일: 2026-09-13

## A. MINSEC 개인 사이트 완성도

- 변경: Google/GitHub OAuth 우선 Account UI, 운영자 매직링크 opt-in, CMS/Supabase Admin 경계 안내, 개인 사이트 메뉴에서 Space 분리, Space QA 경로 noindex.
- 구현: Projects/Play 데이터 관리, Markdown Devlog, 프로젝트 반응, Account, Admin, CMS, SEO, 확장 기능 feature flag.
- 완료: GitHub Pages 자동 배포, Supabase 공개 키 연결, 공개 Auth URL/Redirect URL 설정.
- 완료: GitHub OAuth 앱 발급, Supabase 공급자 연결, 공개 사이트 로그인 확인.
- 완료: Google OAuth 앱·웹 클라이언트 발급, Supabase 공급자 연결, 외부 사용자용 프로덕션 공개, 공개 사이트 버튼 활성화와 callback 로그인 확인.
- 미완료: 별도 Member 계정 로그인 QA, Analytics 공급자 연결.
- Migration: 없음.
- 환경값: `PUBLIC_EMAIL_LOGIN=false`. 숨겨진 QA 경로에서 `PUBLIC_SPACE_EXTENDED=true`로 실제 검증한다.
- QA: 기본/확장 모드 Astro build와 정적 페이지 검증 통과.
- rollback: OAuth 문제가 있으면 `PUBLIC_GOOGLE_LOGIN=false`로 되돌려 Google 버튼을 숨긴다. Supabase 공급자 비활성화는 인증 장애가 확인될 때만 별도로 수행한다.

## B. 현재 Supabase / Space 실제 QA

- 확인: 비회원 작성 UI 비활성화, 로그인 Member 작성 UI 활성화, 운영자 Admin 진입, 공개 API 조회, Admin 목록 비공개, 익명 글쓰기·신고 거부, 공개 배포의 Supabase 연결.
- 미완료: 실제 Member 테스트 글·댓글·좋아요·신고·수정·삭제의 브라우저 왕복 QA.
- Migration: 없음.
- 시험 명령: `npm run verify:live-public`.
- rollback: 데이터 생성 없는 검사이며 복구 작업 없음. 이후 시험 콘텐츠는 명확한 QA 표식을 붙이고 정리.
- 보안 보강 적용 완료: `0006_security_roles_limits_files.sql`과 `0007_lock_direct_community_writes.sql`을 실제 Supabase에 적용하고 새 클라이언트를 배포했다. Owner/Moderator 분리, DB 쓰기 제한, 신고 대상 검증, 직접 쓰기 차단, ZIP 차단과 문서 형식 허용을 포함한다.

## C. 비밀글 / 첨부 / 공지

- 변경: 비밀글을 공개 feed에서 제외, 직접 링크 잠금 요약, bcrypt 해시, 1시간 열람권한, 실패 제한, 비밀번호 변경 시 권한 폐기, private Storage, 파일 정리 trigger, 공개글 공지.
- 로컬 QA: migrations 0001–0004 순차 적용, 기존 공개 글 호환, RLS/RPC와 파일 접근 검증 통과.
- 실제 적용: `0004_private_posts_files_notices.sql` 적용 완료. 공개 0004 컬럼/RPC 조회, Admin 목록 비공개, 익명 쓰기·신고 거부 확인.
- 실제 QA: GitHub 로그인, 글·댓글 작성/수정/삭제, 좋아요, 신고·기각, 공지, 비밀글 전환, 비회원 본문·댓글·첨부 차단, 관리자 비밀번호 없는 열람, private Storage 업로드·삭제와 게시글 cascade 정리 확인.
- 발견/수정: Supabase가 금지하는 `storage.objects` 직접 삭제 trigger를 `0005_storage_api_cleanup.sql`로 제거하고 Storage API 순서로 정리. 실제 프로젝트 적용과 첨부 글 삭제 재검증 완료.
- 미완료: 다른 Member 계정의 비밀글 비밀번호 해제 QA.
- 환경값: 공개 메뉴에 노출되지 않는 `/space/` QA 경로에 `PUBLIC_SPACE_EXTENDED=true` 적용.
- rollback: `docs/space-0004-rollout.md` 참고. 비밀 데이터 생성 후 공개 RLS로 역행 금지.

## D. 공통 반응 모델

- 결과: Registry/v2 구조, 댓글 대상 등록, 권한 함수, 백필·검증·이중 기록·전환·복구 계획 작성.
- 실제 구현/적용: 없음.
- Migration: 실행 파일을 만들기 전에 보존 기간과 정적 콘텐츠 동기화 인증 방식을 결정해야 함.
- 문서: `docs/content-target-registry-migration.md`.

## E. Creator Space 분리

- 결과: 별도 Astro server 서비스, 공유 Supabase Auth/DB, origin별 세션, 공개 SSR, 비밀 캐시 방지, 동적 sitemap, 점진적 이전·복구 설계 작성.
- 기반 적용: `0008_creator_foundation.sql`을 실제 Supabase에 적용했다. Creator 상태는 Community Staff와 독립이며, Profile 연락처 공개범위와 확인형 Project Experience 구조를 포함한다.
- 임시 UI: MINSEC Account에서 Profile 저장·연락처·Creator 신청을 제공하고, Owner Admin에서 Creator 승인·반려·해제를 제공한다. Creator Space 분리 후 해당 서비스로 옮긴다.
- 실제 앱: `apps/creator-space`에 독립 package/config의 Astro SSR 앱을 만들었다. Works/Projects/Team Up/Events 목록·검색·작성·편집·삭제, Profile, 참여 확인, 운영 화면과 동적 sitemap을 포함한다. 원격 Cloudflare 배포는 계정 가입 대기다.
- Migration: 0008 적용 완료. 기존 MINSEC/Space 테이블 변경 없음.
- 문서: `docs/creator-space-separation.md`.

## 남은 순서

1. 자동 승인 검토가 거절한 0009 운영 적용에 대해 사용자의 명시적 승인을 받는다. 로컬 DB 테스트는 통과했으며 실제 적용 완료로 간주하지 않는다.
2. 공개 MINSEC 편집기에서 사용자 GitHub public_repo 동의 후 저장→커밋→배포 왕복을 QA한다.
3. Cloudflare 가입·로그인 후 Creator Space를 배포하고 Supabase redirect를 추가한다.
4. 별도 Member 계정으로 Creator 승인·작업 CRUD·참여 확인·비밀글/첨부를 실제 QA한다.
5. Registry는 새 Creator 반응에 적용하며 기존 Space 반응은 기존 API를 유지한다. 기존 반응/정적 MINSEC 대상 전체 전환과 Turnstile·파일 검역은 추가 작업이다.

MINSEC 공개 CMS는 GitHub 권한을 직접 검증하는 편집기로 구현했다. 별도 OAuth 중계 서버를 요구하던 이전 제한을 제거했으며, Devlog와 Community의 진입 링크를 노출했다. 정확한 배포 및 외부 승인 상태는 `authoring-completion-rollout.md`를 확인한다.
