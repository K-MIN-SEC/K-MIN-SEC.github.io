# Content Target Registry migration 설계

상태: **설계 초안 — 실제 Supabase에 실행하지 않음**

현재 `project_likes`, `project_comments`, `space_likes`, `space_comments`, `reports`는 그대로 유지한다. 새 모델을 추가하고 데이터와 권한을 대조한 뒤 읽기 경로를 전환한다.

## Registry 모델

```sql
create table public.content_targets (
  id uuid primary key default gen_random_uuid(),
  namespace text not null check (namespace in ('minsec', 'space')),
  content_type text not null,
  external_id text not null,
  owner_id uuid references auth.users(id) on delete set null,
  parent_id uuid references public.content_targets(id) on delete restrict,
  visibility text not null check (visibility in ('public', 'member', 'secret', 'private')),
  status text not null default 'visible' check (status in ('visible', 'hidden', 'deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (namespace, content_type, external_id)
);
```

`parent_id`는 댓글처럼 다른 대상의 접근권한을 물려받는 콘텐츠에 사용한다. 댓글도 Registry 대상을 하나 가지므로 신고가 게시글과 댓글을 같은 FK로 가리킬 수 있다. 순환 참조는 등록 함수에서 거부하고, 일반 클라이언트에 Registry 직접 쓰기 권한을 주지 않는다.

초기 대상은 다음처럼 매핑한다.

| 기존 대상 | namespace | content_type | external_id | visibility |
| --- | --- | --- | --- | --- |
| 프로젝트 | `minsec` | `project` | 프로젝트 slug | `public` |
| Devlog | `minsec` | `devlog` | 글 slug | `public` |
| Space 게시글 | `space` | `space_post` | 게시글 UUID | 원문의 공개 설정 |
| 기존 댓글 | 원문의 namespace | `comment` | 댓글 UUID | 부모에서 상속 |

추후 Works, Team Up, Event도 각각 원문 UUID로 등록한다.

## 새 반응 테이블

```sql
create table public.comments_v2 (
  id uuid primary key default gen_random_uuid(),
  content_target_id uuid not null references public.content_targets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  display_name text not null,
  body text not null,
  status text not null default 'visible' check (status in ('visible','hidden','deleted')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.reactions_v2 (
  content_target_id uuid not null references public.content_targets(id) on delete restrict,
  user_id uuid not null references auth.users(id) on delete cascade,
  reaction_type text not null default 'like' check (reaction_type = 'like'),
  created_at timestamptz not null default now(),
  primary key (content_target_id, user_id, reaction_type)
);

create table public.reports_v2 (
  id uuid primary key default gen_random_uuid(),
  content_target_id uuid not null references public.content_targets(id) on delete restrict,
  reporter_id uuid references auth.users(id) on delete set null,
  reason text not null,
  status text not null default 'open' check (status in ('open','resolved','dismissed')),
  target_snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
```

Registry와 반응 테이블은 모두 RLS를 켠다. 작성은 공개된 RPC로만 처리해 다음 검사를 한 트랜잭션에서 수행한다.

1. target UUID가 실제로 존재한다.
2. target과 모든 부모가 `visible`이다.
3. `public`은 누구나 읽고 Member만 쓴다.
4. `member`는 로그인한 사용자만 접근한다.
5. `secret` Space 글은 `can_read_space()` 결과까지 확인한다.
6. `private`는 소유자 또는 Admin만 접근한다.
7. 댓글 생성 시 댓글 자체의 Registry 대상도 함께 생성한다.

클라이언트가 `visibility`, `status`, `owner_id`, `parent_id`를 직접 바꾸는 권한은 갖지 않는다. 정적 MINSEC 대상은 GitHub Actions가 제한된 관리자 RPC로 동기화하되, service-role 키를 빌드 결과나 브라우저로 보내지 않는다.

## 데이터 이전

모든 단계는 건수 검증 실패 시 rollback되는 트랜잭션으로 작성한다.

1. `content_targets`와 v2 테이블·함수·RLS만 추가한다.
2. 현재 Projects/Devlog slug를 `minsec` 대상으로 등록한다.
3. `space_posts`를 `space_post` 대상으로 등록한다. `is_secret`과 `status`를 visibility/status로 복사한다.
4. `project_comments`와 `space_comments`를 `comments_v2`로 복사한다. 기존 댓글 UUID를 유지하고 댓글 Registry를 만든다.
5. 기존 likes를 `reactions_v2`로 복사한다.
6. 기존 reports의 대상 유형을 Registry 대상으로 해석해 `reports_v2`로 복사하고 원문 요약을 snapshot에 남긴다.
7. 원본별 전체/visible/hidden 건수, 사용자별 소유권, 고아 대상 0건, 중복 반응 0건을 비교한다.
8. 기존 쓰기와 v2 쓰기를 함께 수행하는 짧은 호환 기간을 둔다. 실패 시 전체 쓰기를 취소한다.
9. 증분 데이터를 다시 대조한 뒤 읽기 경로를 v2로 바꾼다.
10. 기존 테이블은 최소 한 번의 운영 검증 기간 동안 읽기 전용으로 보존한다.

## 삭제와 되돌리기

원문 삭제 시 Registry 행은 바로 지우지 않고 `status='deleted'`로 바꾼다. 연결된 댓글·반응은 일반 조회에서 숨긴다. 신고는 snapshot과 함께 보존한다. 보존 기간이 지난 뒤 reports를 먼저 정리하고 Registry를 물리 삭제한다.

전환 전 rollback은 새 테이블 쓰기를 중단하고 기존 테이블만 계속 사용한다. 전환 후 rollback은 v2 기간에 생성된 댓글·반응을 기존 형식으로 역동기화한 뒤 읽기 경로를 돌린다. 이 역동기화 검증 없이 v2 테이블을 삭제하지 않는다.

## 실행 전 필수 결정

- 신고 및 삭제 데이터 보존 기간
- 댓글의 표시 이름을 snapshot으로 둘지 Profiles를 실시간 참조할지
- GitHub CMS 변경 시 Registry 동기화 작업의 인증 방식
- Creator Space의 Works/Team Up/Event별 공개 상태와 원문 접근 함수

