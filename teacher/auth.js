/* 선생님용 사이트 세 화면이 함께 쓰는 잠금 장치 */
import { $, db, configured } from "./common.js";

const SESSION_KEY = "class-record-teacher";

let password = "";
export const getPassword = () => password;

const remember = (pw) => { try { sessionStorage.setItem(SESSION_KEY, pw); } catch {} };
const recall   = () => { try { return sessionStorage.getItem(SESSION_KEY) || ""; } catch { return ""; } };
const forget   = () => { try { sessionStorage.removeItem(SESSION_KEY); } catch {} };

function say(text, kind) {
  const el = $("lockMsg");
  if (!el) return;
  el.textContent = text;
  el.className = "msg " + (kind || "");
}

/* 비밀번호가 맞는지 서버에 물어봅니다 (자료는 서버가 검사한 뒤에만 내줍니다) */
async function verify(pw) {
  const { error } = await db.rpc("list_students_all", { p_password: pw });
  return !error ? { ok: true } : { ok: false, message: error.message || "" };
}

export async function guard(onReady) {
  if (!configured) {
    if ($("setupWarning")) $("setupWarning").hidden = false;
    say("Supabase 연결 정보가 설정되지 않았습니다.", "err");
    return;
  }

  async function open(pw, quiet) {
    const r = await verify(pw);
    if (!r.ok) {
      if (!quiet) {
        say(r.message.includes("비밀번호")
          ? "비밀번호가 맞지 않습니다."
          : "설정 문제로 열지 못했습니다 → " + r.message, "err");
      }
      forget();
      return false;
    }
    password = pw;
    remember(pw);
    $("lockCard").hidden = true;
    $("main").hidden = false;
    if ($("lockBtn")) $("lockBtn").hidden = false;
    await onReady();
    return true;
  }

  $("lockForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    $("lockSubmit").disabled = true;
    say("확인하는 중…");
    await open($("pw").value);
    $("lockSubmit").disabled = false;
  });

  if ($("lockBtn")) {
    $("lockBtn").addEventListener("click", (e) => {
      e.preventDefault();
      forget();
      location.reload();
    });
  }

  const saved = recall();
  if (saved) await open(saved, true);
}
