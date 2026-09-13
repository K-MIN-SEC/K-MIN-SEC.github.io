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
- 실제 0009 적용은 보류: Supabase Run query 자동 승인 검토가 운영 변경 경고에 대한 명시적 승인과 독립적인 전체 payload/rollback 검증 부족을 이유로 거절했다. 사용자에게 정확한 0009 적용 승인을 요청한 상태이며 승인 전 실행하지 않는다.
- Cloudflare 계정이 아직 없으므로 원격 Creator Space 서비스는 미배포다. 로컬 서버는 4322에서 실행한다.
- 실제 GitHub 편집권한 동의와 저장 왕복 QA는 아직 수행하지 않았다. 코드 구현/빌드 성공과 실제 운영 검증을 구분한다.
