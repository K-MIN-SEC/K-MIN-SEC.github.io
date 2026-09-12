# A–E 진행 상태

작성일: 2026-09-13

## A. MINSEC 개인 사이트 완성도

- 변경: Google/GitHub OAuth 우선 Account UI, 운영자 매직링크 opt-in, 기존 DB와 호환되는 Space 기본 모드, CMS/Supabase Admin 경계 안내, Space 임시 noindex.
- 구현: Projects/Play 데이터 관리, Markdown Devlog, 프로젝트 반응, Account, Admin, CMS, SEO, 확장 기능 feature flag.
- 미완료: OAuth 공급자 외부 설정, 실제 GitHub Pages 배포, Analytics 공급자 연결.
- Migration: 없음.
- 환경값: `PUBLIC_EMAIL_LOGIN=false`, `PUBLIC_SPACE_EXTENDED=false`.
- QA: 기본/확장 모드 Astro build와 정적 페이지 검증 통과.
- rollback: 커밋 `e039d3e`를 되돌리거나 두 feature flag를 false로 유지.

## B. 현재 Supabase / Space 실제 QA

- 확인: 비회원 작성 UI 비활성화, 로그인 Member 작성 UI 활성화, 운영자 Admin 진입, 공개 API 조회, Admin 목록 비공개, 익명 글쓰기·신고 거부.
- 미완료: 실제 Member 테스트 글·댓글·좋아요·신고·수정·삭제의 브라우저 왕복 QA.
- Migration: 없음.
- 시험 명령: `npm run verify:live-public`.
- rollback: 데이터 생성 없는 검사이며 복구 작업 없음. 이후 시험 콘텐츠는 명확한 QA 표식을 붙이고 정리.

## C. 비밀글 / 첨부 / 공지

- 변경: 비밀글을 공개 feed에서 제외, 직접 링크 잠금 요약, bcrypt 해시, 1시간 열람권한, 실패 제한, 비밀번호 변경 시 권한 폐기, private Storage, 파일 정리 trigger, 공개글 공지.
- 로컬 QA: migrations 0001–0004 순차 적용, 기존 공개 글 호환, RLS/RPC와 파일 접근 검증 통과.
- 미완료: 실제 Supabase migration 적용과 실제 Storage 업로드 QA.
- Migration: `supabase/migrations/0004_private_posts_files_notices.sql` 적용 필요.
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

## 돌아온 뒤 필요한 순서

1. OAuth 공급자 앱의 Client ID/Secret을 소유자가 생성·입력한다.
2. 실제 Supabase에 migration 0004를 적용하기 직전 변경 내용을 다시 확인한다.
3. 공개글과 비밀글·첨부파일의 실제 브라우저 QA를 수행한다.
4. 성공 시 `PUBLIC_SPACE_EXTENDED=true`를 배포 환경에 설정한다.
5. GitHub Pages를 활성화하고 Supabase의 공개 Redirect URL을 확정한다.
