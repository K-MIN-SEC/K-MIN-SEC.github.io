# Creator 기반 migration 적용 계획

대상: `0008_creator_foundation.sql`

상태: 실제 Supabase 적용 및 공개 비회원 권한 검증 완료

## 충돌과 영향

현재 DB에는 Creator 상태, 회원 Profile, Profile 연락처, Creator Project와 참여 확인 테이블이 없다. 이 migration은 새 테이블과 RPC만 추가하며 기존 MINSEC Projects, Space, 댓글, 좋아요, 신고, 비밀글과 첨부 데이터를 수정하지 않는다.

Community Staff의 `owner`/`moderator`와 Creator 상태는 독립적으로 검사한다. Moderator 또는 Owner가 되더라도 `creator_approvals.status='approved'`가 아니면 Creator Project를 만들 수 없다.

## 추가되는 구조

- `member_profiles`: 공개범위가 있는 Creator Space 프로필.
- `profile_contacts`: Auth 이메일과 분리된 Email/Discord/GitHub/X/Website 연락처.
- `creator_approvals`: 요청·승인·반려·해제 상태.
- `creator_projects`: Creator Space 프로젝트 기반 정보.
- `project_memberships`: `pending`·`accepted`·`rejected` 참여 확인.

모든 쓰기는 인증된 RPC를 통하며 브라우저의 직접 insert/update/delete 권한은 부여하지 않는다. 공개 Profile·연락처·Project·참여 이력은 RLS에서 공개범위와 승인 상태를 검사한다.

## 적용과 검증

1. 로컬 PGlite에서 migration 0001~0008을 연속 적용한다.
2. Creator 상태와 Community Staff 역할이 서로 독립인지 확인한다.
3. 승인 전 Project 생성이 거부되는지 확인한다.
4. 프로젝트 초대가 `pending`일 때 공개되지 않고, 참여자가 수락한 뒤에만 공개되는지 확인한다.
5. Profile과 연락처의 `public`·`members`·`private` 경계를 확인한다.
6. 실제 Supabase SQL Editor에서 0008을 적용한다.
7. Account와 Owner Admin UI를 배포한다.

## 복구

UI 문제는 `PUBLIC_CREATOR_FOUNDATION=false`로 Profile·Creator 신청 화면을 즉시 숨긴다. 이 플래그는 기존 Account·Space 기능에 영향을 주지 않는다.

DB 복구가 필요하면 먼저 아래 함수 실행 권한을 회수해 새 쓰기를 중지한다.

```sql
revoke execute on function public.upsert_member_profile(text,text,text,text,text,smallint,smallint,smallint,text,text[],text[],text,text),
  public.upsert_profile_contact(text,text,text),public.remove_profile_contact(text),public.request_creator_access(text),
  public.list_creator_approvals(),public.set_creator_status(text,text,text),
  public.create_creator_project(text,text,text,text,date,date,text,text,text),
  public.invite_project_member(uuid,text,text,text),public.respond_project_membership(uuid,text)
from authenticated;
```

새 테이블은 즉시 삭제하지 않는다. 실제 데이터가 생긴 뒤에는 내보내기와 건수 대조를 먼저 하고, `project_memberships` → `creator_projects` → `profile_contacts` → `creator_approvals` → `member_profiles` 순서의 별도 rollback migration으로 제거한다.
