# MINSEC / Creator Space 결정 기록

이 문서는 구현 범위와 데이터 경계를 고정한다. 변경할 때는 기존 데이터의 이전·검증·되돌리기 계획을 먼저 작성한다.

## 서비스 경계

- MINSEC는 Astro 정적 빌드와 GitHub Pages를 유지하는 개인 포트폴리오다.
- Creator Space는 이후 별도 Astro 서비스로 분리하고 Cloudflare의 서버 렌더링을 우선 검토한다.
- 두 서비스는 같은 Supabase 프로젝트와 사용자 ID를 사용하되, 초기에는 브라우저 세션을 공유하지 않는다.
- 공개 Work/Profile/Event/Team Up은 완성된 HTML과 동적 sitemap을 제공한다. 비밀글·회원 전용·Account·Admin은 `noindex`다.

## 회원과 권한

- Visitor: 공개 콘텐츠 읽기.
- Member: 기본 프로필 수정, Space 글·댓글 작성, 좋아요, 신고.
- Creator: Member 권한과 승인된 Works 공개, Team Up/Event 등록.
- Moderator: 신고 검토.
- Admin: 전체 관리, 공지, Featured, 권한, 숨김·삭제.
- 일반 가입은 Google/GitHub OAuth가 우선이다. 이메일+비밀번호 가입은 1차 범위에서 제외한다.

## 비밀글과 파일

- 게시글 비밀번호는 계정 비밀번호와 완전히 별개다.
- 비밀번호 원문은 저장하지 않고 강한 단방향 해시만 비공개 스키마에 저장한다.
- 본문·댓글·첨부파일 접근은 DB/RLS/RPC에서 검사한다. `noindex`를 보안 수단으로 사용하지 않는다.
- 작성자와 Admin은 별도 비밀번호 입력 없이 읽을 수 있다.
- 비밀글 파일은 private Storage bucket에 저장하며 public URL을 만들지 않는다.
- 비밀번호 변경 시 기존 열람 권한을 폐기한다. 실패 횟수를 제한한다.

## 콘텐츠와 반응

공통 반응 모델로 전환하기 전에 `content_targets` Registry를 추가한다. 댓글·좋아요·신고는 Registry UUID를 FK로 참조한다. Registry는 namespace, content type, 외부 ID, 소유자, 공개 범위, 운영 상태를 가진다.

전환 순서는 다음과 같다.

1. Registry와 새 반응 테이블을 추가한다.
2. MINSEC 정적 프로젝트/Devlog 대상을 관리자가 등록한다.
3. Space의 DB 콘텐츠는 trigger 또는 서버 함수에서 Registry와 함께 생성한다.
4. 기존 반응을 복사하고 대상별 건수·소유권·가시성을 대조한다.
5. 일정 기간 이중 기록하거나 쓰기를 잠깐 멈춰 최종 증분을 옮긴다.
6. 읽기 경로를 전환한다. 기존 테이블은 검증 기간 동안 읽기 전용으로 보존한다.

원문 삭제는 Registry를 즉시 물리 삭제하지 않고 `deleted` 상태로 전환한다. 연결된 반응의 보존 기간과 삭제 기준을 정한 후 정리한다. 숨김과 삭제는 별도 상태다. 비밀·회원 전용 대상의 반응 접근은 Registry 값 하나만 믿지 않고 원문 접근 함수도 확인한다.

## 관리자 경계

- Projects/Play/Devlog CMS는 GitHub 저장소 권한을 사용한다.
- Community Admin은 Supabase 역할을 사용한다.
- 한 Admin 화면에서 두 관리 도구로 이동할 수 있지만 권한은 자동 연동하지 않는다.

## 단계와 복구

### A. MINSEC 완성

OAuth 중심 계정 화면, 기존 Space 호환 모드, CMS·SEO·정적 빌드를 안정화한다. DB 변경은 없다. 실패 시 해당 코드 커밋을 되돌린다.

### B. 현재 Supabase/Space QA

Visitor, Member, 작성자, 다른 Member, Admin 경계를 실제 프로젝트에서 검증한다. 시험 데이터만 사용하고 QA 후 제거한다. 스키마 변경은 없다.

### C. 비밀글·첨부·공지

`0004_private_posts_files_notices.sql`을 별도 엔진에서 먼저 검증하고 실제 프로젝트에 적용한다. 기존 공개 글은 `is_secret=false`로 유지된다. 기능을 중지해야 할 때는 클라이언트 플래그를 끄고, 비밀 콘텐츠가 존재하면 이전의 공개 RLS 정책으로 돌아가지 않는다.

### D. 공통 반응 모델 설계

파괴적 변경 없이 migration 초안, 데이터 매핑, 검증 쿼리, 전환·복구 절차를 작성한다. 기존 반응 테이블은 즉시 삭제하지 않는다.

### E. Creator Space 분리 설계

별도 배포 단위, 공유 Auth/DB, 서버 렌더링, 공개 sitemap과 캐시 경계를 설계한다. MINSEC의 현재 Space 경로는 새 서비스가 검증될 때까지 유지한다.
