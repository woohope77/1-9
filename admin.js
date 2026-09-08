import {
  CFG, $, configured, db, STUDENTS, CATEGORIES, catByName, esc, photoUrl,
} from "./common.js";

if (!configured) $("setupWarning").hidden = false;

const className = CFG.CLASS_NAME || "학급";
document.title = `${className} · 선생님용`;
$("siteTitle").textContent = `${className} 선생님용`;

const AI = CFG.AI || {};
// "prompt" = 프롬프트만 만들어 주고 ChatGPT·Claude에 붙여넣기 (무료)
// "api"    = OpenAI 키를 써서 사이트에서 바로 초안 생성 (Vercel 환경변수 필요)
const AI_MODE = String(AI.MODE || "prompt").toLowerCase();
const SESSION_KEY = "class-record-teacher";

for (const s of STUDENTS) {
  $("fStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
  $("aiStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
}
for (const c of CATEGORIES) $("fCategory").add(new Option(c.name, c.name));

/* 초안 종류: 문자열이면 같은 이름의 영역에서 특기사항을 씁니다.
   객체면 label(화면 이름) · from(자료로 쓸 영역들) · kind("activity"|"summary") · length(기본 글자 수) */
const TARGETS = (AI.TARGETS || ["자율활동"]).map((t) =>
  typeof t === "string"
    ? { label: t, from: [t], kind: "activity" }
    : {
        label: t.label || (t.from && t.from[0]) || "초안",
        from: (t.from && t.from.length ? t.from : [t.label]).filter(Boolean),
        kind: t.kind || "activity",
        length: t.length,
      });
const targetByLabel = (l) => TARGETS.find((t) => t.label === l) || TARGETS[0];

for (const t of TARGETS) $("aiCategory").add(new Option(t.label, t.label));
if (AI.DEFAULT_LENGTH) $("aiLength").value = String(AI.DEFAULT_LENGTH);

/* 종류를 바꾸면 그 종류의 기본 글자 수로 맞춰 줍니다 */
$("aiCategory").addEventListener("change", () => {
  const t = targetByLabel($("aiCategory").value);
  if (t.length && [...$("aiLength").options].some((o) => o.value === String(t.length)))
    $("aiLength").value = String(t.length);
});

let password = "";
let posts = [];

function say(id, t, kind) {
  $(id).textContent = t;
  $(id).className = "msg " + (kind || "");
  if (t && kind === "ok") setTimeout(() => { if ($(id).textContent === t) $(id).textContent = ""; }, 4000);
}

/* ── 잠금 해제 ───────────────────────────────────── */
const remember = (pw) => { try { sessionStorage.setItem(SESSION_KEY, pw); } catch {} };
const recall = () => { try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } };
const forget = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} };

async function unlock(pw, quiet) {
  if (!db) { say("lockMsg", "Supabase 연결 정보가 설정되지 않았습니다.", "err"); return false; }
  const { data, error } = await db.rpc("list_all_activities", { p_password: pw });
  if (error) {
    if (!quiet) {
      const m = error.message || "";
      // 진짜 '비밀번호 틀림'과 설정 문제를 구분해서 보여 줍니다.
      say("lockMsg", m.includes("비밀번호")
        ? "비밀번호가 맞지 않습니다."
        : "설정 문제로 열지 못했습니다 → " + m, "err");
    }
    forget();
    return false;
  }
  password = pw;
  posts = data || [];
  remember(pw);
  $("lockCard").hidden = true;
  $("main").hidden = false;
  $("lockBtn").hidden = false;
  $("aiCard").hidden = !AI.ENABLED;
  render();
  return true;
}

$("lockForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  $("lockSubmit").disabled = true;
  say("lockMsg", "확인하는 중…");
  await unlock($("pw").value);
  $("lockSubmit").disabled = false;
});

$("lockBtn").addEventListener("click", (e) => {
  e.preventDefault();
  forget();
  location.reload();
});

/* ── 목록 ────────────────────────────────────────── */
async function reload() {
  const { data, error } = await db.rpc("list_all_activities", { p_password: password });
  if (error) return say("msg", "불러오기 실패: " + error.message, "err");
  posts = data || [];
  render();
}

function filtered() {
  const fs = $("fStudent").value, fc = $("fCategory").value;
  const from = $("fFrom").value, to = $("fTo").value;
  const ft = $("fText").value.trim().toLowerCase();

  return posts
    .filter((p) => {
      if (fs && String(p.student_no) !== fs) return false;
      if (fc && p.category !== fc) return false;
      if (from && p.activity_date < from) return false;
      if (to && p.activity_date > to) return false;
      if (ft) {
        const hay = `${p.title} ${p.content} ${p.role} ${p.reflection} ${p.student_name}`.toLowerCase();
        if (!hay.includes(ft)) return false;
      }
      return true;
    })
    .sort((a, b) => a.student_no - b.student_no ||
      a.category.localeCompare(b.category, "ko") ||
      a.activity_date.localeCompare(b.activity_date));
}

function render() {
  const rows = filtered();
  $("listCount").textContent = `${rows.length}건 / 전체 ${posts.length}건`;
  $("tbody").innerHTML = rows.map((p) => {
    const url = photoUrl(p.photo_path);
    return `<tr>
      <td class="num">${p.student_no}</td>
      <td>${esc(p.student_name)}</td>
      <td class="num">${esc(p.activity_date)}</td>
      <td>${esc(p.category)}</td>
      <td>${esc(p.title)}</td>
      <td>${esc(p.content)}</td>
      <td>${esc(p.role)}</td>
      <td>${esc(p.reflection)}</td>
      <td>${url ? `<a href="${esc(url)}" target="_blank" rel="noopener">
             <img class="thumb" src="${esc(url)}" alt="사진" loading="lazy"></a>` : ""}</td>
    </tr>`;
  }).join("");
  $("emptyBox").innerHTML = rows.length ? "" :
    `<div class="empty">${posts.length ? "조건에 맞는 기록이 없습니다." : "아직 등록된 기록이 없습니다."}</div>`;
}

for (const id of ["fStudent", "fCategory", "fFrom", "fTo", "fText"])
  $(id).addEventListener("input", render);

$("resetBtn").addEventListener("click", () => {
  for (const id of ["fStudent", "fCategory", "fFrom", "fTo", "fText"]) $(id).value = "";
  $("draft").hidden = true; $("copyBtn").hidden = true;
  render();
});

/* ── CSV ─────────────────────────────────────────── */
$("csvBtn").addEventListener("click", () => {
  const rows = filtered();
  if (!rows.length) return say("msg", "내려받을 기록이 없습니다.", "err");

  const head = ["번호","이름","활동날짜","활동영역","활동명","활동내용","역할및기여","배우고느낀점","사진주소","작성시각"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((p) => [
    p.student_no, p.student_name, p.activity_date, p.category, p.title,
    p.content, p.role, p.reflection, photoUrl(p.photo_path),
    new Date(p.created_at).toLocaleString("ko-KR"),
  ].map(q).join(","));

  const csv = "\ufeff" + [head.map(q).join(","), ...body].join("\r\n");
  download(`${className}_활동기록_${new Date().toLocaleDateString("sv-SE")}.csv`,
           csv, "text/csv;charset=utf-8");
  say("msg", `${rows.length}건을 내려받았습니다.`, "ok");
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── 학생별로 묶어 보기 ────────────────────────────── */
$("draftBtn").addEventListener("click", () => {
  const rows = filtered();
  if (!rows.length) return say("msg", "정리할 기록이 없습니다.", "err");
  $("draft").textContent = groupText(rows);
  $("draft").hidden = false;
  $("copyBtn").hidden = false;
  const people = new Set(rows.map((r) => r.student_no)).size;
  say("msg", `${people}명, ${rows.length}건을 정리했습니다.`, "ok");
});

function groupText(rows) {
  const by = new Map();
  for (const p of rows) {
    const key = `${p.student_no}|${p.student_name}`;
    if (!by.has(key)) by.set(key, []);
    by.get(key).push(p);
  }
  const out = [];
  for (const [key, list] of [...by.entries()].sort(
    (a, b) => Number(a[0].split("|")[0]) - Number(b[0].split("|")[0]))) {
    const [no, name] = key.split("|");
    out.push(`━━━ ${no}번 ${name} (${list.length}건) ━━━`);
    for (const p of list) out.push("\n" + recordText(p));
    out.push("\n");
  }
  return out.join("\n").trim();
}

function recordText(p) {
  const c = catByName(p.category);
  const lines = [`[${p.activity_date} · ${p.category}] ${p.title}`];
  if (p.content) lines.push(`· 내용: ${p.content}`);
  if (!c.simple && p.role) lines.push(`· 역할 및 기여: ${p.role}`);
  if (!c.simple && p.reflection) lines.push(`· 배우고 느낀 점: ${p.reflection}`);
  if (p.photo_path) lines.push(`· 사진: ${photoUrl(p.photo_path)}`);
  return lines.join("\n");
}

$("copyBtn").addEventListener("click", () => copyText($("draft").textContent, "msg"));

async function copyText(text, msgId) {
  try {
    await navigator.clipboard.writeText(text);
    say(msgId, "복사했습니다.", "ok");
  } catch {
    say(msgId, "자동 복사가 막혀 있습니다. 내용을 직접 선택해 Ctrl+C 해 주세요.", "err");
  }
}

/* ── 생기부 초안 ─────────────────────────────────── */

/* 화면 문구를 방식에 맞게 바꿉니다 */
function applyAiMode() {
  const hint = document.querySelector("#aiCard .hint");
  const note = document.querySelector("#aiCard .note-inline");
  if (AI_MODE === "prompt") {
    document.querySelector("#aiCard h2").textContent = "생활기록부 초안 프롬프트 만들기";
    if (hint) hint.textContent =
      "고른 학생의 해당 영역 기록을 넣은 프롬프트를 만들어 드립니다. 복사해서 ChatGPT나 Claude 대화창에 붙여넣으면 초안이 나옵니다.";
    $("aiBtn").textContent = "프롬프트 만들기";
    if (note) note.textContent =
      "AI가 쓴 초안은 그대로 쓰지 마시고, 실제로 관찰하신 내용과 맞는지 확인하고 고쳐서 사용해 주세요.";
  }
}
applyAiMode();

/* 기록들을 프롬프트에 넣을 형태로 정리합니다 */
function materialOf(records, showCategory) {
  return records.map((r, i) => {
    const head = showCategory
      ? `[기록 ${i + 1}] ${r.activity_date} · ${r.category} · ${r.title}`
      : `[기록 ${i + 1}] ${r.activity_date} ${r.title}`;
    const lines = [head.trim()];
    if (r.content) lines.push(`- 활동 내용: ${r.content}`);
    if (r.role) lines.push(`- 학생이 맡은 역할과 기여: ${r.role}`);
    if (r.reflection) lines.push(`- 학생이 배우고 느낀 점: ${r.reflection}`);
    return lines.join("\n");
  }).join("\n\n");
}

/* 행동특성 및 종합의견 초안 프롬프트 */
function buildSummaryPrompt(length, records) {
  return [
    "아래는 우리 반 학생 한 명이 한 학년 동안 스스로 남긴 기록입니다.",
    "이 기록만을 근거로 학교생활기록부 '행동특성 및 종합의견' 초안을 써 주세요.",
    "",
    "[지켜 주실 것]",
    "1. 제공된 기록에 없는 사실·수상·성과·수치는 절대 지어내지 마세요.",
    "2. 문장은 명사형으로 끝맺습니다. (~함, ~을 보임, ~하였음)",
    "3. 학생 이름이나 '학생은' 같은 주어를 쓰지 않습니다.",
    "4. 학생의 성격·태도·강점을 먼저 제시하고, 그렇게 판단한 근거가 되는 구체적인 행동이나 장면을 이어 씁니다.",
    "5. '성실함', '착함' 같은 추상적 평가만 나열하지 말고 반드시 근거가 되는 행동을 함께 씁니다.",
    "6. 한 해 동안의 변화나 성장이 기록에 드러나면 그 흐름이 보이도록 씁니다.",
    "7. 단점을 지적하기보다 앞으로의 성장 가능성으로 표현합니다. 기록에 없는 단점은 쓰지 않습니다.",
    "8. 줄바꿈 없이 이어지는 한 문단으로 씁니다.",
    "9. 다른 설명이나 머리말 없이 종합의견 문장만 출력합니다.",
    `10. 분량은 공백 포함 ${length}자 안팎으로 맞춰 주세요.`,
    "",
    "[학생이 남긴 기록]",
    materialOf(records, true),
  ].join("\n");
}

/* 창의적 체험활동 특기사항 초안 프롬프트 */
function buildPrompt(category, length, records) {
  const material = materialOf(records, false);

  return [
    `아래는 우리 반 학생 한 명의 「${category}」 활동 기록입니다.`,
    `이 기록만을 근거로 학교생활기록부 창의적 체험활동 특기사항 초안을 써 주세요.`,
    "",
    "[지켜 주실 것]",
    "1. 제공된 기록에 없는 활동·수상·성과·수치는 절대 지어내지 마세요.",
    "2. 문장은 명사형으로 끝맺습니다. (~함, ~을 보임, ~하였음)",
    "3. 학생 이름이나 '학생은' 같은 주어를 쓰지 않습니다.",
    "4. '활동 → 학생이 맡은 역할과 구체적 행동 → 그로써 드러난 역량이나 변화' 순서로 이어 씁니다.",
    "5. '성실함', '훌륭함' 같은 추상적 칭찬만 나열하지 말고, 그렇게 판단한 근거가 되는 행동을 함께 씁니다.",
    "6. 줄바꿈 없이 이어지는 한 문단으로 씁니다.",
    "7. 다른 설명이나 머리말 없이 특기사항 문장만 출력합니다.",
    `8. 분량은 공백 포함 ${length}자 안팎으로 맞춰 주세요.`,
    "",
    "[활동 기록]",
    material,
  ].join("\n");
}

$("aiBtn").addEventListener("click", async () => {
  const no = Number($("aiStudent").value);
  const student = STUDENTS.find((s) => s.no === no);
  const target = targetByLabel($("aiCategory").value);
  const category = target.label;
  const length = Number($("aiLength").value) || 500;
  const records = posts
    .filter((p) => p.student_no === no && target.from.includes(p.category))
    .sort((a, b) => a.activity_date.localeCompare(b.activity_date));

  if (!student) return say("aiMsg", "학생을 골라 주세요.", "err");
  if (!records.length)
    return say("aiMsg",
      `${student.no}번 ${student.name} 학생의 「${target.from.join(", ")}」 기록이 없습니다.`, "err");

  // 무료 방식: 프롬프트만 만들어 줍니다
  if (AI_MODE === "prompt") {
    $("aiOut").value = target.kind === "summary"
      ? buildSummaryPrompt(length, records)
      : buildPrompt(category, length, records);
    $("aiLen").textContent = $("aiOut").value.length;
    $("aiOutWrap").hidden = false;
    $("aiCopy").hidden = false;
    say("aiMsg", `기록 ${records.length}건을 넣었습니다. 복사해서 붙여넣으세요.`, "ok");
    return;
  }

  $("aiBtn").disabled = true;
  say("aiMsg", "초안을 쓰는 중… (10초쯤 걸립니다)");

  try {
    const res = await fetch(AI.ENDPOINT || "/api/draft", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        password,
        className,
        category,
        kind: target.kind,
        length,
        student: { no: student.no, name: student.name },
        records: records.map((p) => ({
          date: p.activity_date, title: p.title, category: p.category,
          content: p.content, role: p.role, reflection: p.reflection,
        })),
      }),
    });

    if (res.status === 404) {
      say("aiMsg", "초안 기능이 아직 배포되지 않았습니다. api/draft.js 를 올리고 Vercel 환경변수를 넣어 주세요.", "err");
      return;
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      say("aiMsg", data.error || `오류가 났습니다 (${res.status})`, "err");
      return;
    }

    $("aiOut").value = data.text || "";
    $("aiLen").textContent = ($("aiOut").value || "").length;
    $("aiOutWrap").hidden = false;
    $("aiCopy").hidden = false;
    say("aiMsg", `기록 ${records.length}건을 바탕으로 썼습니다.`, "ok");
  } catch (err) {
    say("aiMsg", "연결하지 못했습니다: " + (err.message || err), "err");
  } finally {
    $("aiBtn").disabled = false;
  }
});

$("aiOut").addEventListener("input", () => {
  $("aiLen").textContent = $("aiOut").value.length;
});
if (AI_MODE === "prompt") {
  const counter = $("aiOutWrap").querySelector(".counter");
  if (counter) counter.innerHTML =
    '<span id="aiLen">0</span>자 · 아래 <b>복사</b>를 누르고 ChatGPT나 Claude 대화창에 붙여넣으세요';
}
$("aiCopy").addEventListener("click", () => copyText($("aiOut").value, "aiMsg"));

/* ── 시작 ────────────────────────────────────────── */
const saved = recall();
if (saved) unlock(saved, true);
