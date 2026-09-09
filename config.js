// ============================================================
//  이 파일만 고치면 우리 반 사이트가 됩니다.
//  (다른 파일은 건드리지 않아도 됩니다)
// ============================================================

window.CLASS_CONFIG = {

  // ── 1. Supabase 연결 정보 ──────────────────────────────────
  SUPABASE_URL: "https://rklwgzzqagnocyuynmgv.supabase.co",
  SUPABASE_KEY: "sb_publishable_ShiLG6aBfZspwCTH5h29qA_FeMOVfDJ",

  // ── 2. 학급 이름 ──────────────────────────────────────────
  CLASS_NAME: "1학년 9반",
  SCHOOL_YEAR: "2026학년도",

  // ── 3. 학생 명단 ──────────────────────────────────────────
  STUDENTS: [
    { no: 0,   name: "우상도" },   // 시험용 — 다 써 보신 뒤 이 줄을 지우세요
    { no: 1,   name: "곽서진" },
    { no: 2,   name: "권민정" },
    { no: 3,   name: "김나윤" },
    { no: 4,   name: "김수연" },
    { no: 5,   name: "김시현" },
    { no: 6,   name: "김예윤" },
    { no: 7,   name: "김인애" },
    { no: 8,   name: "김해나" },
    { no: 9,   name: "김효연" },
    { no: 10,  name: "박시현" },
    { no: 11,  name: "송가현" },
    { no: 12,  name: "안소연" },
    { no: 13,  name: "안예주" },
    { no: 14,  name: "안채윤" },
    { no: 15,  name: "여승연" },
    { no: 16,  name: "예채원" },
    { no: 17,  name: "오다윤" },
    { no: 18,  name: "오수연" },
    { no: 19,  name: "오윤하" },
    { no: 20,  name: "윤정원" },
    { no: 21,  name: "이세아" },
    { no: 22,  name: "이유빈" },
    { no: 23,  name: "이지유" },
    { no: 24,  name: "이채연" },
    { no: 25,  name: "이채윤" },
    { no: 26,  name: "임슬빈" },
    { no: 27,  name: "정지민" },
    { no: 28,  name: "진현성" },
    { no: 29,  name: "최서윤" },
    { no: 30,  name: "허시현" },
    { no: 31,  name: "최현서" },
  ],

  // ── 4. 활동 영역 ──────────────────────────────────────────
  //    simple: true       역할·느낀 점 칸을 쓰지 않습니다 (간단히 기록)
  //    photo: "required"  사진을 반드시 올려야 합니다
  //    photo: "off"       사진 칸을 아예 숨깁니다
  CATEGORIES: [
    { name: "자율활동" },
    { name: "진로활동" },
    { name: "독서활동" },
    { name: "개인 장점 기록활동" },
    { name: "사진보관함", photo: "required", simple: true },
    { name: "게시판", simple: true },
    { name: "기타" },
  ],

  // ── 5. 영역당 최대 개수 ───────────────────────────────────
  //    이 숫자를 바꾸면 supabase.sql 의 max_per_category 도
  //    같은 숫자로 바꾸고 다시 Run 해야 실제로 적용됩니다.
  MAX_PER_CATEGORY: 3,

  // ── 6. 생기부 초안 (선생님용 화면에서만 보입니다) ─────────
  AI: {
    ENABLED: true,
    // "prompt" — 프롬프트를 만들어 주면 ChatGPT·Claude에 붙여넣기 (무료)
    // "api"    — OpenAI 키로 사이트에서 바로 초안 생성 (Vercel 환경변수 필요)
    MODE: "prompt",
    ENDPOINT: "/api/draft",
    DEFAULT_LENGTH: 500,

    // 만들 수 있는 초안 종류
    //  label   화면에 보일 이름
    //  from    자료로 쓸 활동 영역들 (여러 개 적으면 모두 모아서 씁니다)
    //  length  생기부 입력 한도 글자 수 — 초안이 이 글자 수를 넘지 않게 씁니다
    //  kind    "summary" 면 행동특성 및 종합의견 문체, 없으면 특기사항 문체
    TARGETS: [
      { label: "자율활동", from: ["자율활동"], length: 500 },
      { label: "진로활동", from: ["진로활동"], length: 500 },
      { label: "종합의견", from: ["개인 장점 기록활동"], kind: "summary", length: 300 },
    ],
  },

  // ── 7. 학생들에게 보여줄 안내 문구 ────────────────────────
  NOTICE: "활동이 끝나면 그날 안에 기록해 두세요. 구체적으로 쓸수록 생활기록부에 그대로 반영하기 좋습니다.",
};
