# MINSEC / Creator Space 결정 기록

이 문서는 구현 범위와 데이터 경계를 고정한다. 변경할 때는 기존 데이터의 이전·검증·되돌리기 계획을 먼저 작성한다.

## 서비스 경계

- MINSEC는 Astro 정적 빌드와 GitHub Pages를 유지하는 개인 포트폴리오다.
- Creator Space는 이후 별도 Astro 서비스로 분리하고 Cloudflare의 서버 렌더링을 우선 검토한다.
- 두 서비스는 같은 Supabase 프로젝트와 사용자 ID를 사용하되, 초기에는 브라우저 세션을 공유하지 않는다.
- 공개 Work/Profile/Event/Team Up은 완성된 HTML과 동적 sitemap을 제공한다. 비밀글·회원 전용·Account·Admin은 `noindex`다.

## 서비스 목적

Creator Space는 다양한 창작자의 작업을 발견하고, 프로젝트에 참여하고, 확인된 경험을 다음 포트폴리오로 축적하는 크리에이터 네트워크다. 초기 사용자는 학과에서 모집하되, 학과 → 지인 → 타학교 → 더 넓은 창작자 커뮤니티 순서로 확장한다. 학교 소속은 가입·활동의 전제 조건이 아니며, 직군과 작업·프로젝트 경험 중심의 Portfolio Archive와 Project Archive를 만든다.

```text
Portfolio 탐색 → Work/Project 발견 → Team Up → 프로젝트 참여
→ 확인된 Project Experience → 개인 Portfolio 축적 → 다음 참여
```

프로필 소속은 없음·학교·기업·기타의 선택값과 소속명·학과/부서로 관리한다. 학교를 기본 전제로 삼지 않으며 선택한 유형에 맞는 양식과 공개 표시를 제공한다. 기존 교육 데이터는 0010 migration에서 보존한다.

## 회원과 권한

권한을 하나의 등급표로 만들지 않고 서로 독립된 세 축으로 관리한다.

```text
ACCOUNT          Member
CREATOR STATUS   Not approved | Creator
COMMUNITY STAFF  None | Moderator | Owner
MINSEC CMS       No repository access | GitHub Repository Editor
```

- Visitor: 공개 콘텐츠 읽기.
- Member: 기본 프로필 수정, Space 글·댓글 작성, 좋아요, 신고.
- Creator: 승인된 Works와 Projects 공개, Team Up과 Event 등록. Moderator나 Owner라고 자동으로 Creator가 되지 않는다.
- Moderator: 신고 처리, 게시글 숨김·복구, 공지 등록·해제. Creator 콘텐츠를 직접 게시할 권한은 별도 Creator 상태가 있을 때만 가진다.
- Owner: Moderator 권한과 Creator 승인, Moderator/Owner 지정·해제, Featured 선정, 서비스 운영 설정.
- GitHub Repository Editor: MINSEC Projects/Play/Devlog/Profile을 편집한다. Supabase의 Creator·Moderator·Owner와 자동 연동하지 않는다.
- `Admin`은 관리 화면의 이름으로만 사용하고 DB 역할 이름은 `moderator`와 `owner`로 통일한다.
- 일반 가입은 Google/GitHub OAuth가 우선이다. 이메일+비밀번호 가입은 1차 범위에서 제외한다.

현재 DB에는 `admins.role = owner | moderator`와 별도의 `creator_approvals`가 구현되어 있다. 어느 한쪽의 상태가 다른 쪽 권한을 자동으로 부여하지 않는다.

## Profile과 연락처

- Profile은 직군, 소개, 관심 분야, 사용 도구, 프로젝트 참여 상태를 중심으로 표시한다. 학교·학과는 선택 정보다. 기존 입학·졸업 연도 데이터는 유지하지만 프로필과 사람들 카드에는 표시하지 않는다.
- 참여 상태는 초록 점과 `프로젝트 참여 가능`, 노란 점과 `프로젝트 참여 조건 협의`, 회색 점과 `현재 프로젝트 참여 어려움`으로 표시한다. `hidden`은 표시하지 않는다.
- 공개 프로필에 표시하는 연락처는 Supabase Auth 이메일과 분리된 사용자 입력값이다.
- MVP 연락 수단은 Email, Discord, GitHub, X, 개인 사이트로 제한하며 전화번호는 지원하지 않는다.
- 연락처마다 `public`, `members`, `private` 공개 범위를 둔다. 기본값은 `members` 또는 `private`이며 사용자가 명시적으로 공개한 값만 HTML과 API에 노출한다.

## Works, Projects와 참여 이력

- Work는 프로젝트와 연결되지 않은 개인 작업도 등록할 수 있다.
- Project는 기간, 분야, 결과물, 참여자, 역할과 연결된 Team Up을 기록하는 중심 객체다.
- `project_memberships`는 최소한 `project_id`, `user_id`, `role`, `description`, `status`, `invited_by`, `created_at`, `confirmed_at`을 가진다.
- 참여 상태는 `pending`, `accepted`, `rejected`로 관리한다. 참여자 본인이 확인한 `accepted` 이력만 Project 페이지와 공개 Profile의 Project Experience에 표시한다.
- 평점과 협업 후기는 MVP에 넣지 않는다. 확인된 객관적 참여 이력만 축적한다.

## 비밀글과 파일

- 게시글 비밀번호는 계정 비밀번호와 완전히 별개다.
- 비밀번호 원문은 저장하지 않고 강한 단방향 해시만 비공개 스키마에 저장한다.
- 본문·댓글·첨부파일 접근은 DB/RLS/RPC에서 검사한다. `noindex`를 보안 수단으로 사용하지 않는다.
- 작성자와 Community Staff는 별도 비밀번호 입력 없이 읽을 수 있다.
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
- Community Staff는 Supabase의 Moderator/Owner 역할을 사용한다.
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
