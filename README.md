# 학급 자율활동 기록 게시판

학생들이 자율활동 내용을 직접 기록하고, 선생님이 학기 말에 그 기록을 모아
생활기록부 작성 자료로 쓰기 위한 학급 사이트입니다.

- **index.html** — 학생용. 활동을 기록하고 목록을 봅니다.
- **admin.html** — 선생님용. 필터·엑셀 내려받기·학생별 초안 만들기.
- **config.js** — 학급 이름, 학생 명단, Supabase 연결 정보. **이 파일만 고치면 됩니다.**
- **supabase.sql** — Supabase에 한 번만 붙여넣고 실행할 데이터베이스 설정.

---

## 설치 순서 (약 30분)

### 1단계 · GitHub 계정 만들기 (코드 보관소)

1. https://github.com 접속 → **Sign up**
2. 이메일, 비밀번호, 사용자 이름(영문) 입력 → 이메일로 온 인증 코드 입력
3. 요금제는 **Free**를 선택합니다.

### 2단계 · 저장소를 만들고 파일 올리기

1. 오른쪽 위 **+** → **New repository**
2. Repository name에 `class-record` 입력
3. **Public** 선택 (Private이어도 되지만 Public이 설정이 간단합니다)
4. **Create repository** 클릭
5. 다음 화면에서 **uploading an existing file** 링크 클릭
6. 압축을 푼 폴더 안의 파일 **7개를 모두 선택해서 끌어다 놓기**
   (index.html, admin.html, config.js, app.js, admin.js, style.css, README.md)
7. 아래 **Commit changes** 클릭

> `supabase.sql`은 올려도 되고 안 올려도 됩니다. 웹사이트 동작과는 무관합니다.

### 3단계 · Supabase 계정과 프로젝트 만들기 (데이터 보관소)

1. https://supabase.com 접속 → **Start your project** → GitHub 계정으로 로그인하면 편합니다.
2. **New project** 클릭
   - Name: `class-record`
   - Database Password: 아무 비밀번호나 만들어 **따로 적어 두세요** (분실 시 재설정 필요)
   - Region: **Northeast Asia (Seoul)** 선택
3. 생성까지 1~2분 기다립니다.
4. 왼쪽 메뉴 **SQL Editor** → **New query**
5. `supabase.sql` 파일을 메모장으로 열어 **전체 복사** → 붙여넣기
   - 붙여넣기 전에 파일 안의 `'1234'` **두 군데**를 선생님만 아는 숫자로 바꾸세요.
     (글을 강제로 고치거나 지울 때 쓰는 교사용 마스터 PIN입니다)
6. 오른쪽 아래 **Run** 클릭 → `Success` 가 나오면 완료
7. 왼쪽 메뉴 **Table Editor**에 `activities` 테이블이 보이면 정상입니다.

### 4단계 · 연결 정보 복사해서 config.js 고치기

1. Supabase 화면 위쪽의 **Connect** 버튼 (또는 왼쪽 아래 **Settings → API Keys**)
2. 두 가지를 복사합니다.
   - **Project URL** — `https://xxxxxxxx.supabase.co` 형태
   - **Publishable key** — `sb_publishable_...` 형태
     (예전 프로젝트라면 `anon public` 키, `eyJ...` 형태여도 됩니다)
3. GitHub 저장소로 돌아가 **config.js** 클릭 → 연필 모양 **Edit** 아이콘
4. 맨 위 두 줄을 복사한 값으로 바꿉니다.

   ```js
   SUPABASE_URL: "https://xxxxxxxx.supabase.co",
   SUPABASE_KEY: "sb_publishable_...",
   ```

5. 이어서 `CLASS_NAME`, `STUDENTS`(우리 반 번호·이름)도 고칩니다.
6. **Commit changes** 클릭.

> 이 공개키는 원래 웹사이트에 노출되는 용도의 키입니다. 이 키만으로는
> 데이터베이스를 마음대로 열어볼 수 없도록 `supabase.sql`에서 잠가 두었습니다.

### 5단계 · Vercel로 배포하기 (사이트 주소 만들기)

1. https://vercel.com 접속 → **Sign Up** → **Continue with GitHub**
2. 목적은 **Personal / Hobby**(무료)를 선택합니다.
3. **Add New… → Project**
4. 방금 만든 `class-record` 저장소 옆 **Import** 클릭
5. 설정은 그대로 두고 **Deploy** 클릭 (별도 빌드 설정 필요 없음)
6. 1분쯤 뒤 `class-record-xxxx.vercel.app` 주소가 나옵니다. **이 주소가 우리 반 사이트입니다.**

### 6단계 · 학생들에게 안내

- 주소를 학급 알림장이나 QR코드로 공유합니다.
- 학생에게 안내할 내용
  1. 번호를 고르면 이름이 자동으로 채워집니다.
  2. 활동 내용 / 역할 / 느낀 점을 구체적으로 씁니다.
  3. **PIN 4자리는 꼭 기억**해야 나중에 수정·삭제할 수 있습니다.

---

## 나중에 고칠 일이 생기면

- **학생 명단·학급 이름 변경** → GitHub에서 `config.js` 수정 → Commit
  (Vercel이 자동으로 다시 배포합니다. 1분이면 반영됩니다)
- **기록 전체 내려받기** → 사이트의 `선생님용 모아보기` → `엑셀(CSV)로 내려받기`
- **생활기록부 초안 뽑기** → 같은 화면의 `학생별 초안 만들기` → `초안 전체 복사`
- **학생이 PIN을 잊었을 때** → 삭제 창에 교사용 마스터 PIN을 입력하면 지워집니다.
- **원본 데이터 직접 보기** → Supabase → Table Editor → `activities`

## 알아두실 점

- 주소를 아는 사람은 누구나 글을 읽고 쓸 수 있습니다. 학급 내부 공유용으로만 주소를 알려 주세요.
- 개인정보는 번호와 이름만 저장됩니다. 주민번호·연락처 등은 입력하지 않도록 지도해 주세요.
- 세 서비스 모두 이 정도 사용량에서는 무료 요금제로 충분합니다.
- Supabase 무료 프로젝트는 **일주일 이상 아무도 접속하지 않으면 일시 정지**될 수 있습니다.
  정지되면 Supabase 대시보드에서 **Restore** 버튼 한 번으로 되살릴 수 있습니다.
