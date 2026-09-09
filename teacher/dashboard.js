import {
  CFG, $, db, fetchStudents, catByName, esc, fmtDate, today,
} from "./common.js";
import { guard, getPassword } from "./auth.js";

const AI = CFG.AI || {};
const SUM_LIMIT = Number(AI.SUMMARY_LENGTH) || 300;
const className = CFG.CLASS_NAME || "학급";

document.title = className + " · 학생 대시보드";
$("siteTitle").textContent = className + " 학생 대시보드";
$("sumLimit").textContent = SUM_LIMIT;

/* 기록 종류 — 화면 이름과 프롬프트에 쓸 이름 */
const KINDS = [
  { key: "grade",       label: "성적",      forPrompt: "성적 자료" },
  { key: "counsel",     label: "상담",      forPrompt: "상담 기록" },
  { key: "observation", label: "관찰 장점", forPrompt: "선생님이 관찰한 장점" },
  { key: "career",      label: "진로·독서", forPrompt: "진로 희망과 독서" },
  { key: "own",         label: "학생 기록", forPrompt: "학생이 직접 쓴 활동 기록" },
];

let students = [];
let notes = [];
let own = [];
let editing = null;

const me = () => students.find((s) => String(s.no) === $("student").value);

function say(id, text, kind) {
  const el = typeof id === "string" ? $(id) : id;
  if (!el) return;
  el.textContent = text;
  el.className = "msg " + (kind || "");
  if (text && kind === "ok") setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 3500);
}

guard(async () => {
  students = await fetchStudents();
  const sel = $("student");
  sel.innerHTML = "";
  for (const s of students) sel.add(new Option(s.no + "번 " + s.name, String(s.no)));
  sel.addEventListener("change", load);

  for (const f of document.querySelectorAll(".addform")) {
    const d = f.querySelector('[data-f="date"]');
    if (d) d.value = today();
    f.addEventListener("submit", onAdd);
  }
  document.body.addEventListener("click", onListClick);

  $("sourcePicks").innerHTML = KINDS.map((k) =>
    '<label class="pick"><input type="checkbox" value="' + k.key + '" checked> ' + k.label + "</label>").join("");

  $("sumBtn").addEventListener("click", buildSummary);
  $("sumCopy").addEventListener("click", () => copy($("sumOut").value, "sumMsg"));
  $("sumOut").addEventListener("input", () => {
    $("sumOutNote").textContent = $("sumOut").value.length + "자 · 복사해서 ChatGPT나 Claude 대화창에 붙여넣으세요";
  });
  $("sumCheck").addEventListener("input", countCheck);

  await load();
});

async function load() {
  const s = me();
  if (!s) return;
  editing = null;

  const [r1, r2] = await Promise.all([
    db.rpc("list_notes", { p_password: getPassword(), p_student_no: s.no }),
    db.rpc("list_all_activities", { p_password: getPassword() }),
  ]);
  if (r1.error) return say("sumMsg", "기록을 불러오지 못했습니다: " + r1.error.message, "err");
  notes = r1.data || [];
  own = (r2.error ? [] : (r2.data || [])).filter((a) => a.student_no === s.no);

  renderTally();
  for (const k of KINDS) if (k.key !== "own") renderList(k.key);
  renderOwn();
  countCheck();
}

function renderTally() {
  $("tally").innerHTML = KINDS.map((k) => {
    const n = k.key === "own" ? own.length : notes.filter((x) => x.kind === k.key).length;
    return '<span class="qchip">' + k.label + " <b>" + n + "</b></span>";
  }).join("");
}

function bitsOf(d) {
  const b = [];
  if (d.term) b.push(esc(d.term));
  if (d.score !== undefined && d.score !== null && d.score !== "") b.push(esc(d.score) + "점");
  if (d.grade) b.push(esc(d.grade));
  if (d.books) b.push("책: " + esc(d.books));
  return b;
}

function renderList(kind) {
  const box = document.querySelector('[data-list="' + kind + '"]');
  const rows = notes.filter((n) => n.kind === kind)
    .sort((a, b) => String(a.note_date).localeCompare(String(b.note_date)));
  if (!rows.length) { box.innerHTML = '<div class="emptysm">아직 기록이 없습니다.</div>'; return; }
  box.innerHTML = rows.map((n) => {
    const d = n.data || {};
    return '<div class="note" data-id="' + n.id + '">' +
      '<div class="ntop">' +
        (n.title ? '<span class="ntitle">' + esc(n.title) + "</span>" : "") +
        bitsOf(d).map((b) => '<span class="tag">' + b + "</span>").join("") +
        '<span class="date">' + fmtDate(n.note_date) + "</span>" +
      "</div>" +
      (n.body ? '<p class="nbody">' + esc(n.body) + "</p>" : "") +
      (d.action ? '<p class="naction">조치 · ' + esc(d.action) + "</p>" : "") +
      '<div class="btns">' +
        '<button class="sm ghost" data-act="edit">수정</button>' +
        '<button class="sm danger" data-act="del">삭제</button>' +
      "</div></div>";
  }).join("");
}

function renderOwn() {
  if (!own.length) { $("ownList").innerHTML = '<div class="emptysm">학생이 아직 쓴 기록이 없습니다.</div>'; return; }
  $("ownList").innerHTML = own
    .sort((a, b) => String(a.activity_date).localeCompare(String(b.activity_date)))
    .map((a) => {
      const c = catByName(a.category);
      return '<div class="note"><div class="ntop">' +
        '<span class="ntitle">' + esc(a.title) + "</span>" +
        '<span class="tag">' + esc(a.category) + "</span>" +
        '<span class="date">' + fmtDate(a.activity_date) + "</span></div>" +
        (a.content ? '<p class="nbody">' + esc(a.content) + "</p>" : "") +
        (!c.simple && a.role ? '<p class="naction">역할 · ' + esc(a.role) + "</p>" : "") +
        (!c.simple && a.reflection ? '<p class="naction">느낀 점 · ' + esc(a.reflection) + "</p>" : "") +
        "</div>";
    }).join("");
}

function readForm(form) {
  const get = (f) => { const el = form.querySelector('[data-f="' + f + '"]'); return el ? el.value.trim() : ""; };
  const data = {};
  for (const f of ["term", "score", "grade", "action", "books"]) {
    const v = get(f);
    if (v !== "") data[f] = f === "score" ? Number(v) : v;
  }
  return { title: get("title"), body: get("body"), date: get("date") || today(), data };
}

function clearForm(form) {
  for (const el of form.querySelectorAll('input[type="text"], input[type="number"], textarea')) el.value = "";
  const d = form.querySelector('[data-f="date"]');
  if (d) d.value = today();
}

async function onAdd(e) {
  e.preventDefault();
  const form = e.currentTarget;
  const kind = form.dataset.add;
  const msg = document.querySelector('[data-msg="' + kind + '"]');
  const s = me();
  if (!s) return;
  const v = readForm(form);
  if (!v.title && !v.body) return say(msg, "내용을 적어 주세요.", "err");
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;
  try {
    if (editing && editing.kind === kind) {
      const { data, error } = await db.rpc("update_note", {
        p_password: getPassword(), p_id: editing.id, p_date: v.date,
        p_title: v.title, p_body: v.body, p_data: v.data,
      });
      if (error) throw error;
      if (!data) throw new Error("기록을 찾지 못했습니다.");
      say(msg, "수정했습니다.", "ok");
      editing = null;
      btn.textContent = "추가";
    } else {
      const { error } = await db.rpc("add_note", {
        p_password: getPassword(), p_student_no: s.no, p_kind: kind,
        p_date: v.date, p_title: v.title, p_body: v.body, p_data: v.data,
      });
      if (error) throw error;
      say(msg, "추가했습니다.", "ok");
    }
    clearForm(form);
    await load();
  } catch (err) {
    say(msg, "오류: " + (err.message || err), "err");
  } finally {
    btn.disabled = false;
  }
}

async function onListClick(e) {
  const btn = e.target.closest(".notelist button[data-act]");
  if (!btn) return;
  const card = btn.closest(".note");
  const id = card.dataset.id;
  if (!id) return;
  const n = notes.find((x) => x.id === id);
  if (!n) return;
  const form = document.querySelector('[data-add="' + n.kind + '"]');
  const msg = document.querySelector('[data-msg="' + n.kind + '"]');

  if (btn.dataset.act === "edit") {
    const set = (f, val) => { const el = form.querySelector('[data-f="' + f + '"]'); if (el) el.value = val == null ? "" : val; };
    const d = n.data || {};
    set("title", n.title); set("body", n.body); set("date", n.note_date);
    set("term", d.term); set("score", d.score); set("grade", d.grade);
    set("action", d.action); set("books", d.books);
    editing = { id: n.id, kind: n.kind };
    form.querySelector('button[type="submit"]').textContent = "수정 저장";
    say(msg, "고친 뒤 \u0027수정 저장\u0027을 누르세요.");
    form.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  if (!window.confirm("이 기록을 지울까요?")) return;
  const { data, error } = await db.rpc("delete_note", { p_password: getPassword(), p_id: id });
  if (error) return say(msg, "삭제 실패: " + error.message, "err");
  if (!data) return say(msg, "기록을 찾지 못했습니다.", "err");
  say(msg, "지웠습니다.", "ok");
  await load();
}

function materialFor(key) {
  if (key === "own") {
    return own.map((a) => {
      const c = catByName(a.category);
      const l = ["- " + a.activity_date + " [" + a.category + "] " + a.title];
      if (a.content) l.push("  내용: " + a.content);
      if (!c.simple && a.role) l.push("  맡은 역할: " + a.role);
      if (!c.simple && a.reflection) l.push("  배우고 느낀 점: " + a.reflection);
      return l.join("\n");
    });
  }
  return notes.filter((n) => n.kind === key).map((n) => {
    const d = n.data || {};
    const head = [n.note_date, n.title].filter(Boolean).join(" ");
    const extra = [];
    if (d.term) extra.push(d.term);
    if (d.score !== undefined && d.score !== null && d.score !== "") extra.push(d.score + "점");
    if (d.grade) extra.push(d.grade);
    const l = ["- " + head + (extra.length ? " (" + extra.join(", ") + ")" : "")];
    if (n.body) l.push("  " + n.body);
    if (d.action) l.push("  조치: " + d.action);
    if (d.books) l.push("  읽은 책: " + d.books);
    return l.join("\n");
  });
}

function buildSummary() {
  const s = me();
  if (!s) return;
  const picked = [...$("sourcePicks").querySelectorAll("input:checked")].map((i) => i.value);
  const blocks = [];
  for (const k of KINDS) {
    if (!picked.includes(k.key)) continue;
    const lines = materialFor(k.key);
    if (lines.length) blocks.push("[" + k.forPrompt + "]\n" + lines.join("\n"));
  }
  if (!blocks.length)
    return say("sumMsg", s.no + "번 " + s.name + " 학생의 자료가 아직 없습니다.", "err");

  const text = [
    "아래는 담임 교사가 한 학년 동안 모은 학생 한 명의 자료입니다.",
    "이 자료만을 근거로 학교생활기록부 \u0027행동특성 및 종합의견\u0027 초안을 써 주세요.",
    "",
    "[지켜 주실 것]",
    "1. 제공된 자료에 없는 사실·수상·성과·수치는 절대 지어내지 마세요.",
    "2. 문장은 명사형으로 끝맺습니다. (~함, ~을 보임, ~하였음)",
    "3. 학생 이름이나 \u0027학생은\u0027 같은 주어를 쓰지 않습니다.",
    "4. 성격·태도·강점을 먼저 제시하고, 그렇게 판단한 근거가 되는 구체적인 행동이나 장면을 이어 씁니다.",
    "5. \u0027성실함\u0027, \u0027착함\u0027 같은 추상적 평가만 나열하지 말고 반드시 근거가 되는 행동을 함께 씁니다.",
    "6. 한 해 동안의 변화나 성장이 자료에 드러나면 그 흐름이 보이도록 씁니다.",
    "7. 단점을 지적하기보다 앞으로의 성장 가능성으로 표현합니다. 자료에 없는 단점은 쓰지 않습니다.",
    "8. 점수나 등급 같은 수치는 그대로 옮겨 적지 말고, 학습 태도나 변화를 설명하는 근거로만 쓰세요.",
    "9. 상담에서 나온 개인적·가정사적 내용은 그대로 옮기지 말고, 학교생활에서 드러난 모습으로만 표현하세요.",
    "10. 줄바꿈 없이 이어지는 한 문단으로 씁니다.",
    "11. 다른 설명이나 머리말 없이 종합의견 문장만 출력합니다.",
    "12. 분량은 공백 포함 " + SUM_LIMIT + "자를 절대 넘으면 안 됩니다. 생활기록부 입력 한도라서 넘으면 못 씁니다.",
    "13. " + SUM_LIMIT + "자에 최대한 가깝게 쓰되, 넘지는 않도록 마지막에 글자 수를 세어 확인해 주세요.",
    "",
  ].concat(blocks).join("\n");

  $("sumOut").value = text;
  $("sumOutNote").textContent = text.length + "자 · 복사해서 ChatGPT나 Claude 대화창에 붙여넣으세요";
  $("sumOutWrap").hidden = false;
  $("sumCopy").hidden = false;
  $("sumCheckWrap").hidden = false;
  countCheck();
  say("sumMsg", "자료 " + blocks.length + "종을 넣었습니다. 복사해서 붙여넣으세요.", "ok");
}

function countCheck() {
  const n = $("sumCheck").value.length;
  const el = $("sumCheckMsg");
  el.textContent = n + " / " + SUM_LIMIT + "자" + (n > SUM_LIMIT ? "  (" + (n - SUM_LIMIT) + "자 초과)" : "");
  el.className = "counter" + (n === 0 ? "" : n > SUM_LIMIT ? " over" : " fit");
}

async function copy(text, msgId) {
  try {
    await navigator.clipboard.writeText(text);
    say(msgId, "복사했습니다.", "ok");
  } catch {
    say(msgId, "자동 복사가 막혀 있습니다. 내용을 직접 선택해 Ctrl+C 해 주세요.", "err");
  }
}
