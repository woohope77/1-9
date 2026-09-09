import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

export const CFG = window.CLASS_CONFIG || {};
export const $ = (id) => document.getElementById(id);

export const configured =
  !!CFG.SUPABASE_URL && !!CFG.SUPABASE_KEY &&
  CFG.SUPABASE_URL.startsWith("http") && !CFG.SUPABASE_URL.includes("여기에");

export const db = configured ? createClient(CFG.SUPABASE_URL, CFG.SUPABASE_KEY) : null;

export const MAX_PER_CATEGORY = CFG.MAX_PER_CATEGORY || 3;
export const PHOTO_BUCKET = "photos";

/* 활동 영역: 문자열로 적어도, 옵션 객체로 적어도 모두 받아 줍니다. */
export const CATEGORIES = (CFG.CATEGORIES || ["자율활동"]).map((c) =>
  typeof c === "string" ? { name: c } : { ...c });

export const catByName = (name) =>
  CATEGORIES.find((c) => c.name === name) || { name };

/* 학생 명단은 데이터베이스에서 가져옵니다 (config.js 의 STUDENTS 는 예비용) */
export async function fetchStudents() {
  if (db) {
    const { data, error } = await db.rpc("list_students");
    if (!error && Array.isArray(data) && data.length) return data;
  }
  return CFG.STUDENTS || [];
}

export const esc = (s) =>
  String(s ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const fmtDate = (d) => {
  const [y, m, day] = String(d).split("-");
  return `${y}. ${Number(m)}. ${Number(day)}.`;
};

export const today = () => new Date().toLocaleDateString("sv-SE"); // YYYY-MM-DD

export function photoUrl(path) {
  if (!path || !configured) return "";
  return `${CFG.SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/public/${PHOTO_BUCKET}/${path}`;
}

/* 휴대폰 사진을 가로세로 1600px 안쪽으로 줄여 JPEG 로 바꿉니다. */
export function shrinkImage(file, maxSide = 1600, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const cv = document.createElement("canvas");
      cv.width = w; cv.height = h;
      cv.getContext("2d").drawImage(img, 0, 0, w, h);
      cv.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("사진을 변환하지 못했습니다."))),
        "image/jpeg", quality);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("사진 파일을 읽지 못했습니다."));
    };
    img.src = url;
  });
}

export async function uploadPhoto(blob, studentNo) {
  const name = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const path = `${studentNo}/${name}`;
  const { error } = await db.storage
    .from(PHOTO_BUCKET)
    .upload(path, blob, { contentType: "image/jpeg", upsert: false });
  if (error) throw new Error("사진 올리기 실패: " + error.message);
  return path;
}
