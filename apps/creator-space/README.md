# Creator Space

MINSEC와 독립적으로 실행하는 Astro SSR 서비스입니다. 공유 Supabase의 Auth·DB를 사용하며 origin 사이 자동 로그인 공유는 하지 않습니다.

## 실행

```sh
cd apps/creator-space
npm ci
# .env.example을 .env로 복사하고 공개 연결값 입력
npm run dev
```

주소: `http://127.0.0.1:4322/`. 작성·편집: `/studio/`, 프로필과 로그인: `/account/`, 운영: `/admin/`.

## 필요한 DB

저장소 루트의 migrations 0001–0009를 순서대로 적용합니다. 0009는 기존 테이블을 삭제하지 않는 추가형 migration입니다. 실제 운영 적용은 루트 `docs/authoring-completion-rollout.md`의 상태를 확인하세요.

## Cloudflare Workers 배포

1. Cloudflare 계정 가입·로그인은 사용자 본인이 완료합니다.
2. 이 디렉터리에서 `npx wrangler login`으로 배포 계정에 연결합니다.
3. `.env`의 `PUBLIC_SITE_URL`을 발급받은 HTTPS 서비스 origin으로 설정합니다. `PUBLIC_GOOGLE_LOGIN=true`, `PUBLIC_SPACE_EXTENDED=true`, `PUBLIC_CREATOR_FOUNDATION=true`도 지정합니다.
4. `npm run build` 후 `npm run deploy`를 실행합니다. Cloudflare 어댑터가 만드는 배포 설정을 Wrangler가 사용합니다.
5. Supabase Authentication URL Configuration에 `https://발급주소/account/`와 로컬 검증용 `http://127.0.0.1:4322/account/`를 Redirect URL로 추가합니다. MINSEC Site URL과 기존 redirect는 유지합니다.
6. GitHub Actions variable `CREATOR_SPACE_URL`에 새 origin을 등록하고 MINSEC Pages를 재배포하면 Community 링크가 새 서비스로 이동합니다.

서버 service-role 키는 사용하지 않습니다. SSR은 공개 키+RLS로 공개 HTML만 생성합니다. 비공개·회원전용 응답은 noindex이며 모든 페이지를 no-store로 처리합니다. `/sitemap.xml`은 public 데이터만 500개 단위로 나누어 제공합니다.

## 화면

- Works, Projects, Team Up, Events: 공개 목록·검색·상세
- Studio: 초안/전체/회원 공개, 작성·수정·삭제, 내 작업, 참여 요청 수락/거절
- Project: 역할·기간·결과물·연결된 Team Up, 참여 초대와 확인 이력
- Profile: 공개 포트폴리오와 Project Experience, 연락처별 공개 범위
- 게시판: 일반 Member 작성, 댓글·좋아요·신고·비밀글·보호된 파일 첨부·공지
- Admin: Creator 승인, Staff 권한, 신고 처리, 숨김·복구, Owner Featured

Creator 작품의 대표 이미지·영상은 HTTPS 링크를 등록합니다. 파일 자체 첨부는 게시판의 private storage 업로드를 사용하고, 작품의 관련 링크에 연결합니다. 새 작품 전용 파일 bucket은 아직 만들지 않았습니다.

## 검증과 제한

루트 `node scripts/test-community.mjs`에서 DB 역할별 테스트를 실행합니다. CI에서 두 서비스는 각각 빌드됩니다. 실제 OAuth 로그인·GitHub 편집권한 동의·Cloudflare 가입은 사용자 계정의 동의가 필요합니다. 해당 동의 및 실제 저장 왕복 검증 전에는 전체 운영 완료로 표시하지 않습니다.

기존 Space의 반응 모델은 유지하며 새 Creator 반응만 Registry FK를 사용합니다. MINSEC 정적 대상/기존 반응의 전체 전환은 별도 migration 대상입니다. 공유 컴포넌트는 초기 분리 시 복사본이며 수정 시 양쪽 검증이 필요합니다.
