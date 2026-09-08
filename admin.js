import {
  CFG, $, configured, db, STUDENTS, CATEGORIES, catByName, esc, photoUrl,
} from "./common.js";

if (!configured) $("setupWarning").hidden = false;

const className = CFG.CLASS_NAME || "학급";
document.title = `${className} · 선생님용`;
$("siteTitle").textContent = `${className} 선생님용`;

const AI = CFG.AI || {};
const SESSION_KEY = "class-record-teacher";

for (const s of STUDENTS) {
  $("fStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
  $("aiStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
}
for (const c of CATEGORIES) $("fCategory").add(new Option(c.name, c.name));
for (const name of (AI.TARGETS || ["자율활동"])) $("aiCategory").add(new Option(name, name));
if (AI.DEFAULT_LENGTH) $("aiLength").value = String(AI.DEFAULT_LENGTH);

let password = "";
let posts = [];

function say(id, t, kind) {
  $(id).textContent = t;
  $(id).className = "msg " + (kind || "");
  if (t && kind === "ok") setTimeout(() => { if ($(id).textContent === t) $(id).textContent = ""; }, 4000);
}

/* ── 잠금 해제 ─────────────────────────────────────── */
const remember = (pw) => { try { sessionStorage.setItem(SESSION_KEY, pw); } catch {} };
const recall = () => { try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } };
const forget = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} };

async function unlock(pw, quiet) {
  if (!db) { say("lockMsg", "Supabase 연결 정보가 설정되지 않았습니다.", "err"); return false; }
  const { data, error } = await db.rpc("list_all_activities", { p_password: pw });
  if (error) {
    if (!quiet) say("lockMsg", "비밀번호가 맞지 않습니다.", "err");
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

/* ── 목록 ──────────────────────────────────────────── */
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

/* ── CSV ───────────────────────────────────────────── */
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

  const csv = "﻿" + [head.map(q).join(","), ...body].join("\r\n");
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

/* ── AI 생기부 초안 ────────────────────────────────── */
$("aiBtn").addEventListener("click", async () => {
  const no = Number($("aiStudent").value);
  const student = STUDENTS.find((s) => s.no === no);
  const category = $("aiCategory").value;
  const records = posts.filter((p) => p.student_no === no && p.category === category);

  if (!student) return say("aiMsg", "학생을 골라 주세요.", "err");
  if (!records.length)
    return say("aiMsg", `${student.no}번 ${student.name} 학생의 「${category}」 기록이 없습니다.`, "err");

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
        length: Number($("aiLength").value) || 500,
        student: { no: student.no, name: student.name },
        records: records.map((p) => ({
          date: p.activity_date, title: p.title,
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
$("aiCopy").addEventListener("click", () => copyText($("aiOut").value, "aiMsg"));

/* ── 시작 ──────────────────────────────────────────── */
const saved = recall();
if (saved) unlock(saved, true);
