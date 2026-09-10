import {
  CFG, $, configured, db, fetchStudents, CATEGORIES, catByName,
  MAX_PER_CATEGORY, esc, fmtDate, today, photoUrl, shrinkImage, uploadPhoto,
} from "./common.js";

let STUDENTS = [];

if (!configured) $("setupWarning").hidden = false;

/* ── 화면 초기값 ───────────────────────────────────── */
const className = CFG.CLASS_NAME || "학급";
document.title = `${className} 활동 기록장`;
$("siteTitle").textContent = `${className} 활동 기록장`;
$("siteSub").textContent = `${CFG.SCHOOL_YEAR || ""} 활동 기록`.trim();
$("notice").textContent = CFG.NOTICE || "";
if (!CFG.NOTICE) $("notice").hidden = true;

for (const c of CATEGORIES) {
  $("category").add(new Option(c.name, c.name));
  $("fCategory").add(new Option(c.name, c.name));
}
$("activityDate").value = today();

/* 학생 명단을 데이터베이스에서 불러와 번호 목록을 채웁니다 */
(async () => {
  STUDENTS = await fetchStudents();
  const sel = $("studentNo");
  for (const s of STUDENTS) sel.add(new Option(`${s.no}번 ${s.name}`, String(s.no)));
  if (!STUDENTS.length) sel.options[0].textContent = "— 명단을 불러오지 못했습니다 —";
  await tryRestore();
})();

for (const el of document.querySelectorAll("textarea[maxlength]")) {
  const out = document.querySelector(`[data-count="${el.id}"]`);
  if (!out) continue;
  const upd = () => (out.textContent = el.value.length);
  el.addEventListener("input", upd);
  upd();
}

function say(text, kind) {
  const el = $("formMsg");
  el.textContent = text;
  el.className = "msg " + (kind || "");
  if (kind === "ok") setTimeout(() => { if (el.textContent === text) el.textContent = ""; }, 4000);
}

/* ── 상태 ──────────────────────────────────────────── */
let me = null;        // { no, name }
let myPin = "";       // 이번 접속에만 기억합니다
let posts = [];       // 내 기록
let pickedBlob = null; // 새로 고른 사진 (줄인 것)
let photoAction = "keep";

const SESSION_KEY = "class-record-student";

function sayLogin(text, kind) {
  const el = $("loginMsg");
  el.textContent = text;
  el.className = "msg " + (kind || "");
}

/* ── 번호 + PIN 으로 들어가기 ──────────────────────── */
$("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return sayLogin("Supabase 연결 정보가 아직 설정되지 않았습니다.", "err");

  const s = STUDENTS.find((x) => String(x.no) === $("studentNo").value);
  if (!s) return sayLogin("번호를 골라 주세요.", "err");
  const pin = $("loginPin").value.trim();
  if (!pin) return sayLogin("PIN을 넣어 주세요.", "err");

  const btn = $("loginBtn");
  btn.disabled = true;
  sayLogin("확인하는 중…");
  const ok = await signIn(s, pin);
  btn.disabled = false;
  if (!ok) return;

  $("loginPin").value = "";
  sayLogin("");
  try { sessionStorage.setItem(SESSION_KEY, JSON.stringify({ no: s.no, pin })); } catch {}
});

/* 번호와 PIN이 맞는지 서버에 물어보고, 맞으면 화면을 엽니다 */
async function signIn(s, pin) {
  const { data, error } = await db.rpc("list_my_activities", {
    p_student_no: s.no, p_pin: pin,
  });
  if (error) {
    sayLogin(loginError(error.message), "err");
    return false;
  }
  me = s;
  myPin = pin;
  posts = data || [];
  $("loginCard").hidden = true;
  $("whoCard").hidden = false;
  $("whoName").textContent = `${s.no}번 ${s.name} 기록장`;
  $("studentName").value = s.name;
  $("formCard").hidden = false;
  $("listSection").hidden = false;
  resetForm();
  renderQuota();
  renderCategoryOptions();
  render();
  return true;
}

function loginError(m) {
  m = String(m || "");
  if (m.includes("PIN이 맞지")) return "번호나 PIN이 맞지 않습니다. 다시 확인해 주세요.";
  if (m.includes("아직 PIN")) return "이 번호는 아직 PIN이 없습니다. 선생님께 PIN을 받아 주세요.";
  return "들어가지 못했습니다 → " + m;
}

/* 새로고침해도 이번 접속 동안은 그대로 있게 합니다 */
async function tryRestore() {
  let saved = null;
  try { saved = JSON.parse(sessionStorage.getItem(SESSION_KEY) || "null"); } catch {}
  if (!saved || !db) return;
  const s = STUDENTS.find((x) => x.no === saved.no);
  if (!s) return;
  const ok = await signIn(s, saved.pin);
  if (!ok) { try { sessionStorage.removeItem(SESSION_KEY); } catch {} sayLogin(""); }
}

$("logoutBtn").addEventListener("click", () => {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  me = null; myPin = ""; posts = [];
  resetForm();
  $("whoCard").hidden = true;
  $("quota").hidden = true;
  $("formCard").hidden = true;
  $("listSection").hidden = true;
  $("loginCard").hidden = false;
  $("studentNo").value = "";
  $("loginPin").value = "";
  sayLogin("나왔습니다. 수고했어요!", "ok");
});

/* ── 불러오기 ──────────────────────────────────────── */
async function load() {
  if (!db || !me) return;
  const { data, error } = await db.rpc("list_my_activities", {
    p_student_no: me.no, p_pin: myPin,
  });
  if (error) {
    $("list").innerHTML =
      `<div class="empty">기록을 불러오지 못했습니다.<br><small>${esc(error.message)}</small></div>`;
    return;
  }
  posts = data || [];
  renderQuota();
  renderCategoryOptions();
  render();
}

const countIn = (name) => posts.filter((p) => p.category === name).length;

function renderQuota() {
  $("quota").hidden = false;
  $("quota").innerHTML = CATEGORIES.map((c) => {
    const n = countIn(c.name);
    const full = n >= MAX_PER_CATEGORY;
    return `<span class="qchip${full ? " full" : ""}">${esc(c.name)}
      <b>${n}/${MAX_PER_CATEGORY}</b></span>`;
  }).join("");
}

/* 이미 3개를 채운 영역은 고를 수 없게 합니다 (수정 중인 글의 영역은 제외) */
function renderCategoryOptions() {
  const editingCat = $("editId").value
    ? (posts.find((p) => p.id === $("editId").value) || {}).category
    : null;
  for (const opt of $("category").options) {
    const n = countIn(opt.value);
    const full = n >= MAX_PER_CATEGORY && opt.value !== editingCat;
    opt.disabled = full;
    opt.textContent = full ? `${opt.value} (다 썼어요)` : opt.value;
  }
  const cur = $("category").value;
  if (!cur || $("category").selectedOptions[0]?.disabled) {
    const first = [...$("category").options].find((o) => !o.disabled);
    $("category").value = first ? first.value : "";
  }
  applyCategoryRules();
}

/* 영역에 따라 칸을 켜고 끕니다 */
function applyCategoryRules() {
  const c = catByName($("category").value);
  const simple = !!c.simple;

  for (const f of document.querySelectorAll("[data-detail]")) f.hidden = simple;
  $("role").required = !simple;
  $("reflection").required = !simple;

  const photoMode = c.photo || "optional";
  $("photoField").hidden = photoMode === "off";
  $("photoReq").hidden = photoMode !== "required";
  $("photo").required = photoMode === "required" && !$("editId").value && !pickedBlob;

  $("contentTip").textContent = simple ? "자유롭게 쓰세요" : "무엇을, 어떻게 했는지";
  $("titleTip").textContent =
    c.name === "독서활동" ? "예) 『긴긴밤』 읽기"
    : c.name === "사진보관함" ? "예) 체육대회 단체 사진"
    : c.name === "게시판" ? "예) 우리 반에 하고 싶은 말"
    : "예) 학급 체육대회 응원 준비";
}
$("category").addEventListener("change", applyCategoryRules);

/* ── 사진 고르기 ───────────────────────────────────── */
$("photo").addEventListener("change", async () => {
  const file = $("photo").files[0];
  if (!file) return;
  if (!file.type.startsWith("image/")) {
    say("사진 파일만 올릴 수 있습니다.", "err");
    $("photo").value = "";
    return;
  }
  try {
    pickedBlob = await shrinkImage(file);
    photoAction = "replace";
    $("photoImg").src = URL.createObjectURL(pickedBlob);
    $("photoNote").textContent = `${Math.round(pickedBlob.size / 1024)}KB 로 줄여서 저장합니다`;
    $("photoPreview").hidden = false;
    $("photo").required = false;
    say("");
  } catch (e) {
    say(e.message, "err");
  }
});

$("photoClear").addEventListener("click", () => {
  pickedBlob = null;
  photoAction = $("editId").value ? "remove" : "keep";
  $("photo").value = "";
  $("photoPreview").hidden = true;
  $("photoImg").removeAttribute("src");
  applyCategoryRules();
});

/* ── 목록 ──────────────────────────────────────────── */
function render() {
  const fc = $("fCategory").value;
  const ft = $("fText").value.trim().toLowerCase();

  const rows = posts.filter((p) => {
    if (fc && p.category !== fc) return false;
    if (ft) {
      const hay = `${p.title} ${p.content} ${p.role} ${p.reflection}`.toLowerCase();
      if (!hay.includes(ft)) return false;
    }
    return true;
  });

  $("listCount").textContent = posts.length ? `${rows.length}건 / 내 기록 ${posts.length}건` : "";

  if (!rows.length) {
    $("list").innerHTML = `<div class="empty">${
      posts.length ? "조건에 맞는 기록이 없습니다." : "아직 쓴 기록이 없습니다. 첫 기록을 남겨 보세요."
    }</div>`;
    return;
  }

  $("list").innerHTML = rows.map((p) => {
    const c = catByName(p.category);
    const url = photoUrl(p.photo_path);
    return `
    <article class="post" data-id="${p.id}">
      <div class="top">
        <span class="tag">${esc(p.category)}</span>
        <span class="date">${fmtDate(p.activity_date)}</span>
      </div>
      <h3>${esc(p.title)}</h3>
      ${url ? `<a class="shot" href="${esc(url)}" target="_blank" rel="noopener">
                 <img src="${esc(url)}" alt="${esc(p.title)} 사진" loading="lazy"></a>` : ""}
      <dl>
        ${p.content ? `<dt>${c.simple ? "내용" : "활동 내용"}</dt><dd>${esc(p.content)}</dd>` : ""}
        ${!c.simple && p.role ? `<dt>역할 및 기여</dt><dd>${esc(p.role)}</dd>` : ""}
        ${!c.simple && p.reflection ? `<dt>배우고 느낀 점</dt><dd>${esc(p.reflection)}</dd>` : ""}
      </dl>
      <div class="btns">
        <button class="sm ghost" data-act="edit">수정</button>
        <button class="sm danger" data-act="del">삭제</button>
      </div>
    </article>`;
  }).join("");
}

for (const id of ["fCategory", "fText"]) $(id).addEventListener("input", render);

/* ── 등록 / 수정 ───────────────────────────────────── */
$("form").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!db) return say("Supabase 연결 정보가 아직 설정되지 않았습니다.", "err");
  if (!me) return say("먼저 번호를 골라 주세요.", "err");

  const cat = catByName($("category").value);
  const editing = $("editId").value;

  if (!editing && countIn(cat.name) >= MAX_PER_CATEGORY)
    return say(`「${cat.name}」 영역은 ${MAX_PER_CATEGORY}개까지만 쓸 수 있어요.`, "err");

  const simple = !!cat.simple;
  if (!simple && (!$("role").value.trim() || !$("reflection").value.trim()))
    return say("역할과 느낀 점을 모두 채워 주세요.", "err");

  const editingPost = editing ? posts.find((p) => p.id === editing) : null;
  const hasPhoto = pickedBlob || (photoAction !== "remove" && editingPost?.photo_path);
  if ((cat.photo || "optional") === "required" && !hasPhoto)
    return say("이 영역은 사진을 올려야 합니다.", "err");

  const btn = $("submitBtn");
  btn.disabled = true;
  const oldLabel = btn.textContent;

  try {
    let photoPath = null;
    if (pickedBlob) {
      btn.textContent = "사진 올리는 중…";
      photoPath = await uploadPhoto(pickedBlob, me.no);
    }
    btn.textContent = "저장하는 중…";

    if (editing) {
      const action = pickedBlob ? "replace" : (photoAction === "remove" ? "remove" : "keep");
      const { data, error } = await db.rpc("update_activity", {
        p_id: editing, p_pin: myPin,
        p_date: $("activityDate").value,
        p_category: cat.name,
        p_title: $("title").value,
        p_content: $("content").value,
        p_role: simple ? "" : $("role").value,
        p_reflection: simple ? "" : $("reflection").value,
        p_photo_action: action,
        p_photo_path: photoPath,
      });
      if (error) throw error;
      if (!data) { say("수정하지 못했습니다. 나갔다가 다시 들어와 주세요.", "err"); return; }
      say("수정되었습니다.", "ok");
    } else {
      const { error } = await db.rpc("add_activity", {
        p_student_no: me.no,
        p_pin: myPin,
        p_date: $("activityDate").value,
        p_category: cat.name,
        p_title: $("title").value,
        p_content: $("content").value,
        p_role: simple ? "" : $("role").value,
        p_reflection: simple ? "" : $("reflection").value,
        p_photo_path: photoPath,
      });
      if (error) throw error;
      say("등록되었습니다. 수고했어요!", "ok");
    }
    resetForm();
    await load();
  } catch (err) {
    say("오류가 발생했습니다: " + (err.message || err), "err");
  } finally {
    btn.disabled = false;
    btn.textContent = oldLabel;
  }
});

function resetForm() {
  $("form").reset();
  $("editId").value = "";
  pickedBlob = null;
  photoAction = "keep";
  $("photoPreview").hidden = true;
  $("photoImg").removeAttribute("src");
  $("studentName").value = me ? me.name : "";
  $("activityDate").value = today();
  $("submitBtn").textContent = "등록하기";
  $("cancelBtn").hidden = true;
  $("formTitle").textContent = "활동 기록하기";
  for (const el of document.querySelectorAll("[data-count]")) el.textContent = "0";
  renderCategoryOptions();
}

$("cancelBtn").addEventListener("click", () => { resetForm(); say(""); });

/* ── 목록의 수정 / 삭제 ────────────────────────────── */
$("list").addEventListener("click", async (e) => {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const id = btn.closest(".post").dataset.id;
  const p = posts.find((x) => x.id === id);
  if (!p) return;

  if (btn.dataset.act === "edit") {
    $("editId").value = p.id;
    renderCategoryOptions();
    $("category").value = p.category;
    $("activityDate").value = p.activity_date;
    $("title").value = p.title;
    $("content").value = p.content;
    $("role").value = p.role;
    $("reflection").value = p.reflection;
    pickedBlob = null;
    photoAction = "keep";
    const url = photoUrl(p.photo_path);
    if (url) {
      $("photoImg").src = url;
      $("photoNote").textContent = "올려 둔 사진";
      $("photoPreview").hidden = false;
    } else {
      $("photoPreview").hidden = true;
    }
    applyCategoryRules();
    for (const el of document.querySelectorAll("textarea[maxlength]")) {
      const out = document.querySelector(`[data-count="${el.id}"]`);
      if (out) out.textContent = el.value.length;
    }
    $("formTitle").textContent = "기록 수정하기";
    $("submitBtn").textContent = "수정 저장";
    $("cancelBtn").hidden = false;
    say("고친 뒤 '수정 저장'을 누르세요.");
    $("formCard").scrollIntoView({ behavior: "smooth", block: "start" });
    return;
  }

  if (!window.confirm(`"${p.title}" 기록을 정말 지울까요?\n지운 뒤에는 되돌릴 수 없습니다.`)) return;
  const { data, error } = await db.rpc("delete_activity", { p_id: id, p_pin: myPin });
  if (error) return say("삭제 중 오류: " + error.message, "err");
  if (!data) return say("지우지 못했습니다. 나갔다가 다시 들어와 주세요.", "err");
  say("삭제되었습니다.", "ok");
  if ($("editId").value === id) resetForm();
  await load();
});
