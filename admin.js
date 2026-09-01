import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const CFG = window.CLASS_CONFIG || {};
const $ = (id) => document.getElementById(id);

const configured =
  CFG.SUPABASE_URL && CFG.SUPABASE_KEY &&
  CFG.SUPABASE_URL.startsWith("http") && !CFG.SUPABASE_URL.includes("여기에");
if (!configured) $("setupWarning").hidden = false;

const db = configured ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

const className = CFG.CLASS_NAME || "학급";
document.title = `${className} · 선생님용 모아보기`;
$("siteTitle").textContent = `${className} 기록 모아보기`;

for (const s of CFG.STUDENTS || []) $("fStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
for (const c of CFG.CATEGORIES || []) $("fCategory").add(new Option(c, c));

const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function say(t, kind) {
  $("msg").textContent = t;
  $("msg").className = "msg " + (kind || "");
  if (t) setTimeout(() => { if ($("msg").textContent === t) $("msg").textContent = ""; }, 4000);
}

let posts = [];

async function load() {
  if (!db) return;
  const { data, error } = await db.rpc("list_activities");
  if (error) { say("불러오기 실패: " + error.message, "err"); return; }
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
    .sort((a, b) =>
      a.student_no - b.student_no ||
      a.activity_date.localeCompare(b.activity_date));
}

function render() {
  const rows = filtered();
  $("listCount").textContent = `${rows.length}건 / 전체 ${posts.length}건`;
  $("tbody").innerHTML = rows.map((p) => `
    <tr>
      <td class="num">${p.student_no}</td>
      <td>${esc(p.student_name)}</td>
      <td class="num">${esc(p.activity_date)}</td>
      <td>${esc(p.category)}</td>
      <td>${esc(p.title)}</td>
      <td>${esc(p.content)}</td>
      <td>${esc(p.role)}</td>
      <td>${esc(p.reflection)}</td>
    </tr>`).join("");
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

/* ── CSV 내려받기 (엑셀 한글 깨짐 방지 BOM 포함) ───── */
$("csvBtn").addEventListener("click", () => {
  const rows = filtered();
  if (!rows.length) return say("내려받을 기록이 없습니다.", "err");

  const head = ["번호", "이름", "활동날짜", "활동영역", "활동명", "활동내용", "역할및기여", "배우고느낀점", "작성시각"];
  const q = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const body = rows.map((p) => [
    p.student_no, p.student_name, p.activity_date, p.category, p.title,
    p.content, p.role, p.reflection,
    new Date(p.created_at).toLocaleString("ko-KR"),
  ].map(q).join(","));

  const csv = "﻿" + [head.map(q).join(","), ...body].join("\r\n");
  const today = new Date().toLocaleDateString("sv-SE");
  download(`${className}_활동기록_${today}.csv`, csv, "text/csv;charset=utf-8");
  say(`${rows.length}건을 내려받았습니다.`, "ok");
});

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ── 학생별 초안 ───────────────────────────────────── */
$("draftBtn").addEventListener("click", () => {
  const rows = filtered();
  if (!rows.length) return say("정리할 기록이 없습니다.", "err");

  const byStudent = new Map();
  for (const p of rows) {
    const key = `${p.student_no}|${p.student_name}`;
    if (!byStudent.has(key)) byStudent.set(key, []);
    byStudent.get(key).push(p);
  }

  const out = [];
  for (const [key, list] of [...byStudent.entries()].sort(
    (a, b) => Number(a[0].split("|")[0]) - Number(b[0].split("|")[0]))) {
    const [no, name] = key.split("|");
    out.push(`━━━ ${no}번 ${name} (${list.length}건) ━━━`);
    for (const p of list) {
      out.push(`\n[${p.activity_date} · ${p.category}] ${p.title}`);
      out.push(`· 활동 내용: ${p.content}`);
      out.push(`· 역할 및 기여: ${p.role}`);
      out.push(`· 배우고 느낀 점: ${p.reflection}`);
    }
    out.push("\n");
  }

  $("draft").textContent = out.join("\n").trim();
  $("draft").hidden = false;
  $("copyBtn").hidden = false;
  say(`${byStudent.size}명, ${rows.length}건을 정리했습니다.`, "ok");
});

$("copyBtn").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText($("draft").textContent);
    say("복사했습니다. 한글이나 워드에 붙여넣으세요.", "ok");
  } catch {
    const r = document.createRange();
    r.selectNodeContents($("draft"));
    const sel = window.getSelection();
    sel.removeAllRanges(); sel.addRange(r);
    say("자동 복사가 막혀 있어 텍스트를 선택했습니다. Ctrl+C 를 누르세요.", "err");
  }
});

load();
