import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const CFG = window.CLASS_CONFIG || {};
const $ = (id) => document.getElementById(id);

/* ── 설정 확인 ─────────────────────────────────────── */
const configured =
  CFG.SUPABASE_URL && CFG.SUPABASE_KEY &&
  CFG.SUPABASE_URL.startsWith("http") && !CFG.SUPABASE_URL.includes("여기에");

if (!configured) $("setupWarning").hidden = false;

const db = configured ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

/* ── 화면 초기값 ───────────────────────────────────── */
document.title = `${CFG.CLASS_NAME || "학급"} 활동 기록장`;
$("siteTitle").textContent = `${CFG.CLASS_NAME || "학급"} 활동 기록장`;
$("siteSub").textContent = `${CFG.SCHOOL_YEAR || ""} 자율활동 기록`.trim();
$("notice").textContent = CFG.NOTICE || "";
if (!CFG.NOTICE) $("notice").hidden = true;

const students = CFG.STUDENTS || [];
const categories = CFG.CATEGORIES || ["자율활동"];

for (const s of students) {
  $("studentNo").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
  $("fStudent").add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
}
$("studentNo").selectedIndex = -1;
for (const c of categories) {
  $("category").add(new Option(c, c));
  $("fCategory").add(new Option(c, c));
}
$("activityDate").value = new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD (현지 시각)

$("studentNo").addEventListener("change", () => {
  const s = students.find((x) => String(x.no) === $("studentNo").value);
  $("studentName").value = s ? s.name : "";
});

for (const el of document.querySelectorAll("textarea[maxlength]")) {
  const out = document.querySelector(`[data-count="${el.id}"]`);
  if (!out) continue;
  const upd = () => (out.textContent = el.value.length);
  el.addEventListener("input", upd);
  upd();
}

/* ── 유틸 ──────────────────────────────────────────── */
const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const fmtDate = (d) => {
  const [y, m, day] = String(d).split("-");
  return `${y}. ${Number(m)}. ${Number(day)}.`;
};

function say(text, kind) {
  const el = $("formMsg");
  el.textContent = text;
  el.className = "msg " + (kind || "");
  if (kind === "ok") setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 4000);
}

/* ── 목록 ──────────────────────────────────────────── */
let posts = [];

async function load() {
  if (!db) { render(); return; }
  const { data, error } = await db.rpc("list_activities");
  if (error) {
    $("list").innerHTML =
      `<div class="empty">글을 불러오지 못했습니다.<br><small>${esc(error.message)}</small></div>`;
    return;
  }
  posts = data || [];
  render();
}

function render() {
  const fs = $("fStudent").value, fc = $("fCategory").value;
  const ft = $("fText").value.trim().toLowerCase();

  const rows = posts.filter((p) => {
    if (fs && String(p.student_no) !== fs) return false;
    if (fc && p.category !== fc) return false;
    if (ft) {
      const hay = `${p.title} ${p.content} ${p.role} ${p.reflection} ${p.student_name}`.toLowerCase();
      if (!hay.includes(ft)) return false;
    }
    return true;
  });

  $("listCount").textContent = posts.length ? `${rows.length}건 / 전체 ${posts.length}건` : "";

  if (!rows.length) {
    $("list").innerHTML = `<div class="empty">${
      posts.length ? "조건에 맞는 기록이 없습니다." : "아직 등록된 기록이 없습니다. 첫 기록을 남겨 보세요."
    }</div>`;
    return;
  }

  $("list").innerHTML = rows.map((p) => `
    <article class="post" data-id="${p.id}">
      <div class="top">
        <span class="who">${p.student_no}번 ${esc(p.student_name)}</span>
        <span class="tag">${esc(p.category)}</span>
        <span class="date">${fmtDate(p.activity_date)}</span>
      </div>
      <h3>${esc(p.title)}</h3>
      <dl>
        <dt>활동 내용</dt><dd>${esc(p.content)}</dd>
        <dt>역할 및 기여</dt><dd>${esc(p.role)}</dd>
        <dt>배우고 느낀 점</dt><dd>${esc(p.reflection)}</dd>
      </dl>
      <div class="btns">
        <button class="sm ghost" data-act="edit">수정</button>
        <button class="sm danger" data-act="del">삭제</button>
      </div>
    </article>`).join("");
}

for (const id of ["fStudent", "fCategory", "fText"]) $(id).addEventListener("input", render);

/* ── 등록 / 수정 ───────────────────────────────────── */
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return say("Supabase 연결 정보가 아직 설정되지 않았습니다.", "err");

  const pin = $("pin").value.trim();
  if (!/^\d{4,8}$/.test(pin)) return say("PIN은 숫자 4자리 이상으로 입력해 주세요.", "err");

  const btn = $("submitBtn");
  btn.disabled = true;
  const editing = $("editId").value;

  try {
    if (editing) {
      const { data, error } = await db.rpc("update_activity", {
        p_id: editing, p_pin: pin,
        p_date: $("activityDate").value,
        p_category: $("category").value,
        p_title: $("title").value,
        p_content: $("content").value,
        p_role: $("role").value,
        p_reflection: $("reflection").value,
      });
      if (error) throw error;
      if (!data) return say("PIN이 맞지 않습니다. 글을 쓸 때 정한 PIN을 확인해 주세요.", "err");
      say("수정되었습니다.", "ok");
      resetForm();
    } else {
      const { error } = await db.rpc("add_activity", {
        p_student_no: Number($("studentNo").value),
        p_student_name: $("studentName").value,
        p_date: $("activityDate").value,
        p_category: $("category").value,
        p_title: $("title").value,
        p_content: $("content").value,
        p_role: $("role").value,
        p_reflection: $("reflection").value,
        p_pin: pin,
      });
      if (error) throw error;
      say("등록되었습니다. 수고했어요!", "ok");
      const keepNo = $("studentNo").value, keepName = $("studentName").value;
      resetForm();
      $("studentNo").value = keepNo;
      $("studentName").value = keepName;
    }
    await load();
  } catch (err) {
    say("오류가 발생했습니다: " + (err.message || err), "err");
  } finally {
    btn.disabled = false;
  }
});

function resetForm() {
  $("form").reset();
  $("editId").value = "";
  $("studentName").value = "";
  $("activityDate").value = new Date().toLocaleDateString("sv-SE");
  $("submitBtn").textContent = "등록하기";
  $("cancelBtn").hidden = true;
  $("formTitle").textContent = "활동 기록하기";
  $("studentNo").disabled = false;
  for (const el of document.querySelectorAll("[data-count]")) el.textContent = "0";
}

$("cancelBtn").addEventListener("click", () => { resetForm(); say(""); });

/* ── 목록의 수정 / 삭제 버튼 ───────────────────────── */
$("list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".post").dataset.id;
  const p = posts.find((x) => x.id === id);
  if (!p) return;

  if (btn.dataset.act === "edit") {
    $("editId").value = p.id;
    $("studentNo").value = String(p.student_no);
    $("studentName").value = p.student_name;
    $("studentNo").disabled = true;
    $("activityDate").value = p.activity_date;
    $("category").value = p.category;
    $("title").value = p.title;
    $("content").value = p.content;
    $("role").value = p.role;
    $("reflection").value = p.reflection;
    $("pin").value = "";
    for (const el of document.querySelectorAll("textarea[maxlength]")) {
      const out = document.querySelector(`[data-count="${el.id}"]`);
      if (out) out.textContent = el.value.length;
    }
    $("formTitle").textContent = "기록 수정하기";
    $("submitBtn").textContent = "수정 저장";
    $("cancelBtn").hidden = false;
    say("PIN을 입력한 뒤 '수정 저장'을 누르세요.");
    window.scrollTo({ top: 0, behavior: "smooth" });
    return;
  }

  const pin = window.prompt(`"${p.title}" 기록을 삭제합니다.\n글을 쓸 때 정한 PIN을 입력하세요.`);
  if (pin === null) return;
  const { data, error } = await db.rpc("delete_activity", { p_id: id, p_pin: pin.trim() });
  if (error) return say("삭제 중 오류: " + error.message, "err");
  if (!data) return say("PIN이 맞지 않아 삭제하지 못했습니다.", "err");
  say("삭제되었습니다.", "ok");
  await load();
});

load();
