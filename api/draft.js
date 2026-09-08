// ============================================================
//  생활기록부 초안 만들기 - Vercel 서버 함수
//
//  ⚠️ 이 파일은 학생의 브라우저가 아니라 Vercel 서버에서만 실행됩니다.
//     그래서 OpenAI 키를 여기서 쓰더라도 사이트 소스에는 드러나지 않습니다.
//     키는 이 파일에 직접 쓰지 말고, 반드시 Vercel 환경변수로 넣으세요.
//
//  Vercel → 프로젝트 → Settings → Environment Variables 에 3개를 넣습니다.
//    OPENAI_API_KEY    sk-... (OpenAI에서 발급받은 키)
//    TEACHER_PASSWORD  supabase.sql 에 넣은 선생님 비밀번호와 같은 값
//    OPENAI_MODEL      (선택) 안 넣으면 gpt-5.6-luna 를 씁니다
// ============================================================

const API_URL = "https://api.openai.com/v1/chat/completions";
const DEFAULT_MODEL = "gpt-5.6-luna";

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.status(405).json({ error: "POST 요청만 받습니다." });
    return;
  }

  const key = process.env.OPENAI_API_KEY;
  const teacherPassword = process.env.TEACHER_PASSWORD;

  if (!key) {
    res.status(500).json({ error: "Vercel 환경변수 OPENAI_API_KEY 가 설정되지 않았습니다." });
    return;
  }
  if (!teacherPassword) {
    res.status(500).json({ error: "Vercel 환경변수 TEACHER_PASSWORD 가 설정되지 않았습니다." });
    return;
  }

  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    res.status(400).json({ error: "요청 형식이 잘못되었습니다." });
    return;
  }
  if (!body) {
    res.status(400).json({ error: "요청 내용이 비어 있습니다." });
    return;
  }

  // 선생님만 쓸 수 있게 잠급니다. (학생이 키를 쓰지 못하도록)
  if (String(body.password || "").trim() !== String(teacherPassword).trim()) {
    res.status(401).json({ error: "비밀번호가 맞지 않습니다." });
    return;
  }

  const records = Array.isArray(body.records) ? body.records.slice(0, 20) : [];
  if (!records.length) {
    res.status(400).json({ error: "초안을 쓸 기록이 없습니다." });
    return;
  }

  const category = String(body.category || "자율활동");
  const length = Math.min(1200, Math.max(150, Number(body.length) || 500));
  const student = body.student || {};

  const material = records.map((r, i) => {
    const lines = [`[기록 ${i + 1}] ${r.date || ""} ${r.title || ""}`.trim()];
    if (r.content) lines.push(`- 활동 내용: ${r.content}`);
    if (r.role) lines.push(`- 학생이 맡은 역할과 기여: ${r.role}`);
    if (r.reflection) lines.push(`- 학생이 배우고 느낀 점: ${r.reflection}`);
    return lines.join("\n");
  }).join("\n\n");

  const system = [
    "당신은 대한민국 초·중·고 교사의 학교생활기록부 작성을 돕는 조력자입니다.",
    "교사가 제공한 학생 활동 기록만을 근거로 창의적 체험활동 특기사항 초안을 씁니다.",
    "",
    "반드시 지킬 것:",
    "1. 제공된 기록에 없는 활동·수상·성과·수치는 절대 지어내지 않는다.",
    "2. 문장은 명사형으로 끝맺는다. (예: ~함, ~을 보임, ~하였음)",
    "3. 학생 이름이나 '학생은' 같은 주어를 쓰지 않는다.",
    "4. '활동 → 학생이 맡은 역할과 구체적 행동 → 그로써 드러난 역량이나 변화' 순서로 이어 쓴다.",
    "5. '성실함', '훌륭함' 같은 추상적 칭찬만 나열하지 않고, 그렇게 판단한 근거가 되는 행동을 함께 쓴다.",
    "6. 줄바꿈 없이 이어지는 한 문단으로 쓴다.",
    "7. 다른 설명이나 머리말 없이 특기사항 문장만 출력한다.",
  ].join("\n");

  const user = [
    `영역: ${category} 특기사항`,
    `대상: ${student.no || ""}번 학생`,
    `분량: 공백 포함 ${length}자 안팎`,
    "",
    "아래는 학생이 직접 남긴 활동 기록입니다.",
    "",
    material,
  ].join("\n");

  try {
    const r = await fetch(API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || DEFAULT_MODEL,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
      }),
    });

    const data = await r.json().catch(() => null);

    if (!r.ok) {
      const detail = data?.error?.message || `OpenAI 오류 (${r.status})`;
      res.status(502).json({ error: `OpenAI가 거절했습니다: ${detail}` });
      return;
    }

    const text = data?.choices?.[0]?.message?.content?.trim();
    if (!text) {
      res.status(502).json({ error: "초안이 비어 있습니다. 잠시 뒤 다시 시도해 주세요." });
      return;
    }

    res.status(200).json({ text, used: records.length });
  } catch (err) {
    res.status(500).json({ error: "OpenAI에 연결하지 못했습니다: " + (err.message || err) });
  }
};
