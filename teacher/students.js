import { CFG, $, db, esc } from "./common.js";
import { guard, getPassword } from "./auth.js";

const className = CFG.CLASS_NAME || "학급";
document.title = className + " · 학생 명단";
$("siteTitle").textContent = className + " 학생 명단";

let rows = [];

function say(id, text, kind) {
  $(id).textContent = text;
  $(id).className = "msg " + (kind || "");
  if (text && kind === "ok") setTimeout(() => { if ($(id).textContent === text) $(id).textContent = ""; }, 3500);
}

guard(async () => {
  $("addForm").addEventListener("submit", onSave);
  $("tbody").addEventListener("click", onRowClick);
  await load();
});

async function load() {
  const { data, error } = await db.rpc("list_students_all", { p_password: getPassword() });
  if (error) return say("listMsg", "명단을 불러오지 못했습니다: " + error.message, "err");
  rows = data || [];
  render();
}

function render() {
  if (!rows.length) {
    $("tbody").innerHTML = '<tr><td colspan="4">명단이 비어 있습니다. 위에서 추가해 주세요.</td></tr>';
    return;
  }
  $("tbody").innerHTML = rows.map((s) =>
    '<tr data-no="' + s.no + '"' + (s.active ? '' : ' class="dim"') + '>' +
      '<td class="num">' + s.no + '</td>' +
      '<td>' + esc(s.name) + '</td>' +
      '<td>' + (s.active ? '<span class="tag">보임</span>' : '<span class="tag off">숨김</span>') + '</td>' +
      '<td class="rowbtns">' +
        '<button class="sm ghost" data-act="rename">이름 고치기</button>' +
        '<button class="sm ghost" data-act="toggle">' + (s.active ? "숨기기" : "다시 보이기") + '</button>' +
        '<button class="sm danger" data-act="del">삭제</button>' +
      '</td></tr>').join("");
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
    say("addMsg", exists ? (no + "번 이름을 " + name + "(으)로 바꿨습니다.") : (no + "번 " + name + " 학생을 넣었습니다."), "ok");
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
    if (btn.dataset.act === "rename") {
      const name = window.prompt(no + "번 학생의 새 이름을 적어 주세요.", s.name);
      if (name === null) return;
      if (!name.trim()) return say("listMsg", "이름이 비어 있습니다.", "err");
      await save(no, name.trim(), s.active);
      say("listMsg", "이름을 바꿨습니다.", "ok");
    } else if (btn.dataset.act === "toggle") {
      await save(no, s.name, !s.active);
      say("listMsg", s.active ? (no + "번을 학생 화면에서 숨겼습니다.") : (no + "번을 다시 보이게 했습니다."), "ok");
    } else {
      if (!window.confirm(
        no + "번 " + s.name + " 학생을 명단에서 완전히 지울까요?\n\n" +
        "이미 쓴 활동 기록과 성적·상담 기록은 지워지지 않고 남습니다.\n" +
        "잠깐 빼 두실 거면 '숨기기'를 쓰시는 편이 낫습니다.")) return;
      const { error } = await db.rpc("delete_student", { p_password: getPassword(), p_no: no });
      if (error) throw error;
      say("listMsg", no + "번을 지웠습니다.", "ok");
    }
    await load();
  } catch (err) {
    say("listMsg", "오류: " + (err.message || err), "err");
  }
}
