# 0006 보안·운영 권한 적용 계획

상태: 실제 Supabase 0006·0007 적용 및 GitHub Pages 배포 완료

`0006_security_roles_limits_files.sql`과 `0007_lock_direct_community_writes.sql`은 기존 데이터를 삭제하지 않는 단계별 migration이다. 기존 `admins` 행은 첫 적용 시 `owner`가 되며, 이후 추가되는 관리자는 기본 `moderator`다.

## 변경 범위

- Owner: 커뮤니티 운영자·다른 Owner를 이메일로 지정하거나 해제할 수 있다.
- Moderator: 신고, 숨김, 공지, 커뮤니티 게시글·댓글 관리만 수행한다.
- MINSEC Projects/Play/Devlog/Profile 편집: 계속 GitHub 저장소 권한으로만 수행한다. Supabase 역할과 연결하지 않는다.
- 게시글: 계정당 시간당 6개, 24시간당 20개.
- 댓글: 계정당 시간당 30개.
- 좋아요 변경: 계정당 시간당 120회.
- 신고: 계정당 시간당 10개이며 실제로 읽을 수 있는 대상만 허용한다.
- 첨부 예약: 계정당 24시간 20개, 글당 5개, 파일당 10MB.
- 새 ZIP 업로드를 중지하고 이미지, PDF, TXT, HWP/HWPX, DOCX, XLSX, ODS를 허용한다.

Supabase Auth 자체의 로그인 제한은 별개다. Cloudflare Turnstile과 IP 기반 제한은 Creator Space 서버 배포 단계에서 추가한다. 정적 브라우저 코드만으로 Turnstile 비밀키 검증을 구현하지 않는다.

## 적용 결과

1. 로컬 migration 검사와 Astro build를 통과했다.
2. SQL Editor에서 `0006_security_roles_limits_files.sql`을 적용했다.
3. 새 RPC를 사용하는 사이트 클라이언트를 배포했다.
4. `0007_lock_direct_community_writes.sql`을 적용해 직접 쓰기 우회 경로를 닫았다.
5. 공개 배포에서 비회원 조회와 쓰기 거부를 재검증했다.
6. Owner 계정의 Admin 역할 관리 화면을 확인했다.

별도 Member 계정을 이용한 전체 브라우저 왕복 QA는 남아 있다. 글·댓글·좋아요·신고·허용 문서 업로드를 실제 사용자 흐름으로 확인한다.

## 복구

migration 실행 직후 문제가 생기면 사이트 배포를 보류한다. 이미 새 클라이언트를 배포했다면 이전 커밋으로 먼저 되돌린 뒤 아래 쓰기 권한을 임시 복구한다.

```sql
grant insert on public.project_comments, public.space_comments, public.project_likes, public.space_likes, public.reports to authenticated;
grant delete on public.project_likes, public.space_likes to authenticated;
```

새 역할·제한 테이블과 함수는 기존 조회를 방해하지 않으므로 즉시 삭제하지 않는다. 새로 지정한 운영자 정보와 제한 기록을 대조한 뒤 별도 migration으로 제거한다. 기존 첨부파일이나 게시글은 삭제하지 않는다.

## 남는 제한

확장자와 MIME 유형 검사는 악성 문서의 내부 내용을 판별하지 못한다. 공개 학과 서비스에서는 파일을 브라우저에서 바로 실행하지 않고 다운로드로만 제공하며, Creator Space 서버 단계에서 바이러스 검사 또는 업로드 격리 절차를 추가한다.
