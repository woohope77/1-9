import { CFG, $, db, esc } from "./common.js";
import { guard, getPassword } from "./auth.js";

const className = CFG.CLASS_NAME || "학급";
document.title = `${className} · 학생 명단`;
$("siteTitle").textContent = `${className} 학생 명단`;

let rows = [];

function say(id, text, kind) {
  $(id).textContent = text;
  $(id).className = "msg " + (kind || "");
  if (text && kind === "ok") setTimeout(() => { if ($(id).textContent === text) $(id).textContent = ""; }, 3500);
}

guard(async () => {
  $("addForm").addEventListener("submit", onSave);
  $("tbody").addEventListener("click", onRowClick);
  $("genEmpty").addEventListener("click", () => generate(false));
  $("genAll").addEventListener("click", () => generate(true));
  $("copyList").addEventListener("click", copyList);
  await load();
});

async function load() {
  const { data, error } = await db.rpc("list_students_all", { p_password: getPassword() });
  if (error) return say("listMsg", "명단을 불러오지 못했습니다: " + error.message, "err");
  rows = data || [];
  render();
}

function render() {
  renderSheet();
  if (!rows.length) {
    $("tbody").innerHTML = `<tr><td colspan="5">명단이 비어 있습니다. 위에서 추가해 주세요.</td></tr>`;
    return;
  }
  $("tbody").innerHTML = rows.map((s) => `
    <tr data-no="${s.no}"${s.active ? "" : ' class="dim"'}>
      <td class="num">${s.no}</td>
      <td>${esc(s.name)}</td>
      <td>${s.pin
            ? `<code>${esc(s.pin)}</code>`
            : '<span class="tag off">없음</span>'}</td>
      <td>${s.active
            ? '<span class="tag">보임</span>'
            : '<span class="tag off">숨김</span>'}</td>
      <td class="rowbtns">
        <button class="sm ghost" data-act="pin">PIN 정하기</button>
        <button class="sm ghost" data-act="rename">이름 고치기</button>
        <button class="sm ghost" data-act="toggle">${s.active ? "숨기기" : "다시 보이기"}</button>
        <button class="sm danger" data-act="del">삭제</button>
      </td>
    </tr>`).join("");
}

/* ── PIN 나눠 주기 ─────────────────────────────────── */
function sheetText() {
  return rows
    .filter((s) => s.active)
    .map((s) => `${String(s.no).padStart(2, " ")}번  ${s.name}\t${s.pin || "(없음)"}`)
    .join("\n");
}

function renderSheet() {
  $("pinSheet").value = sheetText();
  const none = rows.filter((s) => s.active && !s.pin).length;
  if (none) say("pinMsg", `PIN이 아직 없는 학생 ${none}명`, "err");
}

function newPin(used) {
  for (let i = 0; i < 200; i++) {
    const p = String(Math.floor(Math.random() * 10000)).padStart(4, "0");
    if (!used.has(p) && !/^(\d)\1{3}$/.test(p) && p !== "1234" && p !== "0123") {
      used.add(p);
      return p;
    }
  }
  return String(Math.floor(Math.random() * 100000)).padStart(5, "0");
}

async function setPin(no, pin) {
  const { error } = await db.rpc("set_student_pin", {
    p_password: getPassword(), p_no: no, p_pin: pin,
  });
  if (error) throw error;
}

async function generate(all) {
  const targets = rows.filter((s) => s.active && (all || !s.pin));
  if (!targets.length) return say("pinMsg", "새로 만들 학생이 없습니다.", "ok");
  if (all && !window.confirm(
    `${targets.length}명 모두의 PIN을 새로 만듭니다.\n\n` +
    `지금까지 나눠 준 PIN은 쓸 수 없게 되니, 새 PIN을 다시 알려 주셔야 합니다.\n계속할까요?`)) return;

  const used = new Set(rows.map((s) => s.pin).filter(Boolean));
  say("pinMsg", "만드는 중…");
  try {
    for (const s of targets) await setPin(s.no, newPin(used));
    await load();
    say("pinMsg", `${targets.length}명의 PIN을 만들었습니다. '명단 복사'로 옮겨 적으세요.`, "ok");
  } catch (err) {
    say("pinMsg", "오류: " + (err.message || err), "err");
  }
}

async function copyList() {
  const text = sheetText();
  try {
    await navigator.clipboard.writeText(text);
    say("pinMsg", "복사했습니다. 한글이나 메모장에 붙여 넣으세요.", "ok");
  } catch {
    $("pinSheet").closest("details").open = true;
    $("pinSheet").select();
    say("pinMsg", "아래 칸의 내용을 직접 복사해 주세요.", "err");
  }
}

async function save(no, name, active) {
  const { error } = await db.rpc("save_student", {
    p_password: getPassword(), p_no: no, p_name: name, p_active: active,
  });
  if (error) throw error;
}

async function onSave(e) {
  e.preventDefault();
  const no = Number($("no").value);
  const name = $("name").value.trim();
  if (!name) return say("addMsg", "이름을 적어 주세요.", "err");
  if (!Number.isInteger(no)) return say("addMsg", "번호는 숫자로 적어 주세요.", "err");

  const exists = rows.find((r) => r.no === no);
  try {
    await save(no, name, exists ? exists.active : true);
    say("addMsg", exists ? `${no}번 이름을 ${name}(으)로 바꿨습니다.` : `${no}번 ${name} 학생을 넣었습니다.`, "ok");
    $("no").value = ""; $("name").value = "";
    await load();
  } catch (err) {
    say("addMsg", "저장 실패: " + (err.message || err), "err");
  }
}

async function onRowClick(e) {
  const btn = e.target.closest("button[data-act]");
  if (!btn) return;
  const no = Number(btn.closest("tr").dataset.no);
  const s = rows.find((r) => r.no === no);
  if (!s) return;

  try {
    if (btn.dataset.act === "pin") {
      const pin = window.prompt(
        `${no}번 ${s.name} 학생의 PIN을 정합니다.\n숫자 4~8자리. 비워 두면 PIN을 없앱니다.`,
        s.pin || "");
      if (pin === null) return;
      await setPin(no, pin.trim());
      say("listMsg", pin.trim() ? `${no}번 PIN을 정했습니다.` : `${no}번 PIN을 없앴습니다.`, "ok");
    } else if (btn.dataset.act === "rename") {
      const name = window.prompt(`${no}번 학생의 새 이름을 적어 주세요.`, s.name);
      if (name === null) return;
      if (!name.trim()) return say("listMsg", "이름이 비어 있습니다.", "err");
      await save(no, name.trim(), s.active);
      say("listMsg", "이름을 바꿨습니다.", "ok");
    } else if (btn.dataset.act === "toggle") {
      await save(no, s.name, !s.active);
      say("listMsg", s.active ? `${no}번을 학생 화면에서 숨겼습니다.` : `${no}번을 다시 보이게 했습니다.`, "ok");
    } else {
      if (!window.confirm(
        `${no}번 ${s.name} 학생을 명단에서 완전히 지울까요?\n\n` +
        `이미 쓴 활동 기록과 성적·상담 기록은 지워지지 않고 남습니다.\n` +
        `잠깐 빼 두실 거면 '숨기기'를 쓰시는 편이 낫습니다.`)) return;
      const { error } = await db.rpc("delete_student", { p_password: getPassword(), p_no: no });
      if (error) throw error;
      say("listMsg", `${no}번을 지웠습니다.`, "ok");
    }
    await load();
  } catch (err) {
    say("listMsg", "오류: " + (err.message || err), "err");
  }
}
