// ============================================================
//  선생님용 사이트 설정
//  ⚠️ 이 주소는 학생에게 알려 주지 마세요.
// ============================================================

window.CLASS_CONFIG = {

  // ── 1. Supabase 연결 정보 (학생용과 같은 값) ──────────────
  SUPABASE_URL: "https://rklwgzzqagnocyuynmgv.supabase.co",
  SUPABASE_KEY: "sb_publishable_ShiLG6aBfZspwCTH5h29qA_FeMOVfDJ",

  // ── 2. 학급 이름 ──────────────────────────────────────────
  CLASS_NAME: "1학년 9반",
  SCHOOL_YEAR: "2026학년도",

  // ── 3. 활동 영역 (학생용과 같게 맞춰 주세요) ──────────────
  CATEGORIES: [
    { name: "자율활동" },
    { name: "진로활동" },
    { name: "독서활동" },
    { name: "개인 장점 기록활동" },
    { name: "사진보관함", photo: "required", simple: true },
    { name: "게시판", simple: true },
    { name: "기타" },
  ],

  MAX_PER_CATEGORY: 3,

  // ── 4. 생기부 초안 ────────────────────────────────────────
  AI: {
    ENABLED: true,
    // "prompt" — 프롬프트를 만들어 ChatGPT·Claude에 붙여넣기 (무료)
    // "api"    — OpenAI 키로 사이트에서 바로 생성 (Vercel 환경변수 필요)
    MODE: "prompt",
    ENDPOINT: "/api/draft",
    DEFAULT_LENGTH: 500,

    // 활동 기록 화면의 특기사항 초안
    TARGETS: [
      { label: "자율활동", from: ["자율활동"], length: 500 },
      { label: "진로활동", from: ["진로활동"], length: 500 },
    ],

    // 대시보드의 행동특성 및 종합의견 한도
    SUMMARY_LENGTH: 300,
  },

  STUDENTS: [],
};
