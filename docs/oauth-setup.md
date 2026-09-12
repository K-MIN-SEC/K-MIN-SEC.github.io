# Google / GitHub OAuth 설정 체크리스트

코드는 OAuth 우선 화면으로 준비되어 있다. 공급자 Client ID/Secret 생성과 입력은 계정 보안 정보이므로 사이트 소유자가 진행한다.

## 공통 값

- Supabase callback: `https://rokbqyrmvvrfhwderfnu.supabase.co/auth/v1/callback`
- 로컬 복귀 주소: `http://127.0.0.1:4321/account/`
- GitHub Pages 복귀 주소: `https://k-min-sec.github.io/account/`

Creator Space가 생기면 해당 사이트의 `/account/` 주소를 Supabase Redirect URLs에 추가한다. 두 사이트는 같은 Supabase callback을 사용하지만 각 origin에 별도 로그인 세션을 저장한다.

## GitHub

1. GitHub Settings → Developer settings → OAuth Apps에서 새 앱을 만든다.
2. Homepage URL에는 공개 MINSEC 주소를 넣는다.
3. Authorization callback URL에는 위 Supabase callback을 정확히 넣는다.
4. 생성된 Client ID와 새 Client Secret을 Supabase Authentication → Providers → GitHub에 입력하고 활성화한다.
5. Secret은 `.env`, GitHub 저장소, 브라우저 코드에 넣지 않는다.

## Google

1. Google Cloud에서 프로젝트와 OAuth consent screen을 준비한다.
2. Web application OAuth client를 만든다.
3. Authorized JavaScript origins에 로컬 origin과 공개 origin을 추가한다.
4. Authorized redirect URIs에 위 Supabase callback을 추가한다.
5. Client ID/Secret을 Supabase Authentication → Providers → Google에 입력하고 활성화한다.
6. 최소 scope인 `openid`, 이메일, 기본 프로필만 사용한다.

## Supabase

1. Authentication → URL Configuration의 Site URL을 현재 기본 서비스 주소로 설정한다.
2. Redirect URLs에 로컬·GitHub Pages·향후 Creator Space의 정확한 Account 주소만 추가한다.
3. Google/GitHub provider를 활성화한 뒤 각각 한 번 로그인한다.
4. 같은 공급자 이메일이 기존 운영자 매직링크 계정과 자동으로 합쳐진다고 가정하지 않는다. 로그인 후 사용자 ID를 확인하고, 중복 계정이면 Supabase의 공식 identity linking 절차를 별도로 검토한다.
5. 기존 Admin 행이 가리키는 사용자 ID를 유지한다. 새 OAuth 사용자 ID에 Admin을 추가하기 전에는 현재 소유자와 동일한 계정인지 확인한다.

## 완료 기준

- 비회원 Account 화면에 Google/GitHub 버튼만 보인다.
- 각 공급자 로그인 후 `/account/`로 돌아오고 새로고침 뒤에도 세션이 유지된다.
- Member는 Space 글·댓글·좋아요·신고를 사용할 수 있다.
- 일반 Member에게 Admin 링크가 나타나지 않는다.
- 운영자 계정에만 Admin 링크가 나타난다.
- MINSEC에서 로그아웃해도 Creator Space의 별도 origin 세션을 자동으로 조작하지 않는다.

