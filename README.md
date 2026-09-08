# 학급 활동 기록장

학생이 활동을 직접 기록하고, 선생님이 학기 말에 그 기록을 모아
생활기록부 자료로 쓰기 위한 학급 사이트입니다.

## 파일

| 파일 | 하는 일 |
|---|---|
| `index.html` `app.js` | 학생 화면. 번호를 고르면 **본인 기록만** 보이고 새로 씁니다. |
| `admin.html` `admin.js` | 선생님 화면. **비밀번호를 넣어야** 열립니다. |
| `common.js` `style.css` | 두 화면이 함께 쓰는 코드와 디자인. |
| `config.js` | 학급 이름·학생 명단·활동 영역. **여기만 고치면 됩니다.** |
| `supabase.sql` | Supabase에 한 번 붙여넣고 실행할 데이터베이스 설정. |
| `api/draft.js` | 생활기록부 초안을 쓰는 서버 함수. OpenAI 키를 숨겨 주는 역할. |

## 이렇게 동작합니다

- **활동 영역**: 자율활동 · 진로활동 · 독서활동 · 개인 장점 기록활동 · 사진보관함 · 게시판 · 기타
- **영역당 최대 3개**까지 쓸 수 있고, 수정과 삭제는 언제든 됩니다.
  다 채운 영역은 고를 수 없게 되고, 하나를 지우면 다시 쓸 수 있습니다.
- 학생은 **자기 글만** 봅니다. 전체 기록은 선생님 비밀번호로만 열립니다.
- **사진보관함**은 사진이 필수, 나머지 영역은 사진이 선택입니다.
  휴대폰 사진은 올릴 때 자동으로 1600px·JPEG로 줄여 저장합니다.
- **사진보관함·게시판**은 '역할'과 '느낀 점' 칸 없이 간단히 씁니다.

---

## 설치 순서

### 1 · GitHub 계정과 저장소

1. https://github.com → **Sign up** → 요금제는 **Free**
2. **+** → **New repository** → 이름 `class-record` → **Public** → **Create repository**
3. **uploading an existing file** → 압축 푼 폴더의 파일을 모두 끌어다 놓기
   (`api` 폴더째로 함께 올려야 초안 기능이 동작합니다) → **Commit changes**

### 2 · Supabase 프로젝트

1. https://supabase.com → **Start your project** → **New project**
   - Name `class-record` / Database Password는 따로 적어 두기 / Region **Northeast Asia (Seoul)**
2. **SQL Editor** → **New query** → `supabase.sql` 전체를 붙여넣기
3. ⚠️ 붙여넣기 전에 맨 위 `'change-me-8282'` 를 **선생님 비밀번호**로 바꿉니다. (한 곳만)
4. **Run** → `Success` 가 나오면 완료
5. **Table Editor**에 `activities`, **Storage**에 `photos`가 보이면 정상입니다.

### 3 · config.js 채우기

1. Supabase의 **Connect** 버튼(또는 Settings → API Keys)에서 복사
   - **Project URL** — `https://○○○○.supabase.co`
   - **Publishable key** — `sb_publishable_…` (예전 프로젝트는 `anon public`, `eyJ…`)
2. GitHub에서 `config.js` → 연필 **Edit** → 위 두 값과 학급 이름·학생 명단을 고치고 **Commit changes**

### 4 · Vercel 배포

1. https://vercel.com → **Sign Up** → **Continue with GitHub** → **Personal**(무료)
2. **Add New… → Project** → `class-record` 옆 **Import** → 그대로 **Deploy**
3. 나온 주소 `class-record-○○○○.vercel.app` 가 우리 반 사이트입니다.

### 5 · AI 초안 기능 켜기 (원하실 때만)

1. https://platform.openai.com → **API keys** → **Create new secret key** → 복사
   (결제 수단 등록과 소액 충전이 필요합니다)
2. Vercel → 프로젝트 → **Settings** → **Environment Variables** 에 아래를 넣습니다.

   | 이름 | 값 |
   |---|---|
   | `OPENAI_API_KEY` | `sk-...` (방금 만든 키) |
   | `TEACHER_PASSWORD` | `supabase.sql`에 넣은 선생님 비밀번호와 **같은 값** |
   | `OPENAI_MODEL` | (선택) 비워 두면 `gpt-5.6-luna` 를 씁니다 |

3. **Deployments** → 맨 위 배포의 ⋯ → **Redeploy** (환경변수는 다시 배포해야 적용됩니다)
4. 선생님 화면에 **생활기록부 초안 만들기** 칸이 생깁니다.
   학생과 영역을 고르고 **초안 쓰기**를 누르면 그 학생의 해당 영역 기록만 근거로 초안이 나옵니다.

> **API 키를 왜 config.js에 넣지 않나요?**
> `config.js`는 사이트를 여는 누구나 그대로 읽을 수 있는 파일입니다. 거기에 키를 적으면
> 학생이든 외부인이든 키를 가져다 쓸 수 있고, 요금은 선생님께 청구됩니다.
> `api/draft.js`는 학생 브라우저가 아니라 Vercel 서버에서만 실행되기 때문에,
> 키를 환경변수로 넣어 두면 사이트 어디에도 드러나지 않습니다.
> 초안 기능은 선생님 비밀번호를 통과한 요청만 처리하도록 한 번 더 잠가 두었습니다.

---

## 학기 중에 자주 쓰는 것들

- **명단·영역 변경** → GitHub에서 `config.js` 수정 → Commit → 1분 뒤 반영
  (영역당 개수를 바꾸려면 `supabase.sql`의 `max_per_category`도 같이 바꿔 다시 Run)
- **기록 내려받기** → 선생님 화면 → **엑셀(CSV)로 내려받기** (엑셀에서 한글 안 깨짐)
- **학생별로 묶어 보기** → 한 학생의 모든 기록이 항목별로 묶여 나옵니다. 복사해서 한글·워드에 붙여넣기
- **학생이 PIN을 잊었을 때** → 삭제·수정 창에 **선생님 비밀번호**를 넣으면 됩니다
- **원본 보기** → Supabase → Table Editor → `activities`, 사진은 Storage → `photos`

## 알아두실 점

- 주소를 아는 사람은 번호를 골라 그 학생의 기록을 볼 수 있습니다. 학급 안에서만 주소를 공유해 주세요.
- AI 초안은 **초안**입니다. 실제로 관찰하신 내용과 맞는지 확인하고 고쳐서 사용해 주세요.
  생활기록부는 교사가 직접 확인하고 책임지고 기록하는 자료입니다.
- 사진은 1장 5MB, 이미지 파일만 올라갑니다. 글을 지워도 사진 파일은 남으니
  정리가 필요하면 Supabase → Storage에서 지우시면 됩니다.
- 무료 요금제 기준: Supabase 저장공간 넉넉, Vercel 배포 무제한.
  OpenAI만 사용한 만큼 과금되는데, 학생 30명 × 2개 영역 초안이 커피 한 잔 값보다 적게 나옵니다.
- Supabase 무료 프로젝트는 일주일 넘게 아무도 접속하지 않으면 일시 정지됩니다.
  대시보드의 **Restore**를 누르면 바로 되살아납니다.
