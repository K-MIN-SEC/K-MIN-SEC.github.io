# Space 0004 적용·복구 절차

상태: 2026-09-13 실제 Supabase 적용 완료. 공개 0004 컬럼/RPC와 익명 권한 검증 통과, 로그인 Member·Storage 왕복 QA 대기.

## 영향

`0004_private_posts_files_notices.sql`은 기존 `space_posts`에 `is_secret`, `is_notice`를 기본 `false`로 추가한다. 기존 공개 글의 내용은 바꾸지 않는다. Space 글 생성은 직접 INSERT에서 보안 RPC로 전환하고, 게시글·댓글·좋아요 조회 RLS를 교체한다. 비밀번호 해시와 임시 열람권한은 API에 노출되지 않는 `private` 스키마에 저장한다. 첨부파일용 `space-files` bucket은 항상 private이다.

## 적용 전 확인

1. migrations 0001–0003이 적용되어 있고 `space_posts`, `space_comments`, `space_likes`, `admins` RLS가 켜져 있는지 확인한다.
2. 연결된 프론트의 `PUBLIC_SPACE_EXTENDED`가 비어 있거나 `false`인지 확인한다.
3. 기존 테이블의 행 수를 기록한다.
4. `node scripts/test-community.mjs`와 확장 모드 빌드를 통과시킨다.
5. migration 0004 전체를 한 트랜잭션으로 실행한다.
6. 기존 공개 글이 비회원에게 계속 보이고 직접 익명 쓰기가 거절되는지 확인한다.
7. 시험 계정으로 공개글, 비밀글, 댓글, 좋아요, 첨부 업로드·다운로드·삭제와 Admin 공지를 검증한다.
8. 성공한 뒤에만 배포 환경의 `PUBLIC_SPACE_EXTENDED=true`를 설정한다.

## 적용 후 검증 기준

- 비밀글은 일반 feed 목록에 나타나지 않는다.
- 공유받은 직접 링크에는 잠금 안내만 나오며 제목·본문·댓글·파일명이 노출되지 않는다.
- 비밀번호를 맞힌 로그인 Member만 1시간 동안 읽을 수 있다.
- 작성자와 Admin은 게시글 비밀번호 없이 읽을 수 있다.
- 비밀번호를 변경하면 기존 Member의 임시 열람권한이 즉시 사라진다.
- 15분 동안 5회 실패하면 그 계정의 추가 시도가 잠긴다.
- private 첨부파일은 public URL로 열리지 않으며 같은 접근 함수가 허용한 요청만 다운로드한다.
- 비밀글은 공지로 등록할 수 없다.
- 게시글 삭제 시 attachment metadata와 Storage object가 함께 제거된다.

## 복구

프론트 오류가 있으면 먼저 `PUBLIC_SPACE_EXTENDED=false`로 되돌려 기존 공개 Space UI를 사용한다. 아직 비밀글이나 첨부가 한 건도 없고 구조 자체를 제거해야 할 때만 별도의 검토를 거쳐 DDL rollback을 작성한다.

비밀글 또는 첨부가 한 건이라도 생긴 뒤에는 예전의 `status='visible'` 공개 정책으로 돌아가면 안 된다. 그 정책은 비밀 본문을 공개할 수 있다. 이때는 DB 보안 정책과 private bucket을 유지하고 프론트만 비활성화한 뒤 roll-forward 수정한다.

실행 전 확인용 쿼리:

```sql
select count(*) from public.space_posts;
select count(*) from public.space_comments;
select count(*) from public.space_likes;
select tablename, rowsecurity
from pg_tables
where schemaname='public' and tablename like 'space_%'
order by tablename;
```
