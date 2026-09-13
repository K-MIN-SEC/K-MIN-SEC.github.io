# A–E 진행 상태

작성일: 2026-09-13

## A. MINSEC 개인 사이트 완성도

- 변경: Google/GitHub OAuth 우선 Account UI, 운영자 매직링크 opt-in, CMS/Supabase Admin 경계 안내, 개인 사이트 메뉴에서 Space 분리, Space QA 경로 noindex.
- 구현: Projects/Play 데이터 관리, Markdown Devlog, 프로젝트 반응, Account, Admin, CMS, SEO, 확장 기능 feature flag.
- 완료: GitHub Pages 자동 배포, Supabase 공개 키 연결, 공개 Auth URL/Redirect URL 설정.
- 완료: GitHub OAuth 앱 발급, Supabase 공급자 연결, 공개 사이트에서 GitHub 승인 화면 진입 확인.
- 미완료: Google OAuth 공급자 앱 발급·연결, Analytics 공급자 연결.
- Migration: 없음.
- 환경값: `PUBLIC_EMAIL_LOGIN=false`, `PUBLIC_SPACE_EXTENDED=false`.
- QA: 기본/확장 모드 Astro build와 정적 페이지 검증 통과.
- rollback: 커밋 `e039d3e`를 되돌리거나 두 feature flag를 false로 유지.

## B. 현재 Supabase / Space 실제 QA

- 확인: 비회원 작성 UI 비활성화, 로그인 Member 작성 UI 활성화, 운영자 Admin 진입, 공개 API 조회, Admin 목록 비공개, 익명 글쓰기·신고 거부, 공개 배포의 Supabase 연결.
- 미완료: 실제 Member 테스트 글·댓글·좋아요·신고·수정·삭제의 브라우저 왕복 QA.
- Migration: 없음.
- 시험 명령: `npm run verify:live-public`.
- rollback: 데이터 생성 없는 검사이며 복구 작업 없음. 이후 시험 콘텐츠는 명확한 QA 표식을 붙이고 정리.

## C. 비밀글 / 첨부 / 공지

- 변경: 비밀글을 공개 feed에서 제외, 직접 링크 잠금 요약, bcrypt 해시, 1시간 열람권한, 실패 제한, 비밀번호 변경 시 권한 폐기, private Storage, 파일 정리 trigger, 공개글 공지.
- 로컬 QA: migrations 0001–0004 순차 적용, 기존 공개 글 호환, RLS/RPC와 파일 접근 검증 통과.
- 실제 적용: `supabase/migrations/0004_private_posts_files_notices.sql` 적용 완료. 공개 0004 컬럼/RPC 조회, Admin 목록 비공개, 익명 쓰기·신고 거부 확인.
- 미완료: 로그인 Member의 실제 비밀글·댓글·좋아요와 Storage 업로드 왕복 QA.
- 환경값: 실제 QA 성공 후 `PUBLIC_SPACE_EXTENDED=true`.
- rollback: `docs/space-0004-rollout.md` 참고. 비밀 데이터 생성 후 공개 RLS로 역행 금지.

## D. 공통 반응 모델

- 결과: Registry/v2 구조, 댓글 대상 등록, 권한 함수, 백필·검증·이중 기록·전환·복구 계획 작성.
- 실제 구현/적용: 없음.
- Migration: 실행 파일을 만들기 전에 보존 기간과 정적 콘텐츠 동기화 인증 방식을 결정해야 함.
- 문서: `docs/content-target-registry-migration.md`.

## E. Creator Space 분리

- 결과: 별도 Astro server 서비스, 공유 Supabase Auth/DB, origin별 세션, 공개 SSR, 비밀 캐시 방지, 동적 sitemap, 점진적 이전·복구 설계 작성.
- 실제 프로젝트/저장소 생성: 없음.
- Migration: 없음.
- 문서: `docs/creator-space-separation.md`.

## 남은 순서

1. GitHub 계정의 최초 승인과 callback을 확인하고 로그인 Member QA를 수행한다.
2. Google OAuth 앱을 생성하고 Supabase에 연결한다.
3. 공개글과 비밀글·첨부파일의 실제 브라우저 QA를 수행한다.
4. 개인 사이트에서는 Space QA 경로를 계속 숨기고, Creator Space 별도 서비스에서만 확장 UI를 공개한다.
5. Creator Space 배포 전 해당 서비스 환경에 `PUBLIC_SPACE_EXTENDED=true`를 설정한다.
