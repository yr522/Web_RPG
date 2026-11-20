// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 넣고 node tools/render.mjs melee/crayon-slash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/ilseom_slash.png ({"layer":"color"}) · ilseom_slash_core.png ({"layer":"core"}), 가로 한 줄 (마지막 빈 프레임 뺌)
import { fit, clamp, ease, WHITE } from "../../core/index.js";

// 일섬: 눈높이에서 본 납작한 초승달 궤적. 납작한 크레용 붓으로 그은 듯 두껍고 끝은 사각으로 끊김.
// 붓털 줄마다 마른 붓 틈·찢긴 꼬리, 바깥엔 속도 줄. 무채색 (게임에서 원소 색을 곱함), 흰 심은 core 층.
export const meta = {
  name: "Crayon Slash",
  desc: "A wide, flat crescent swing painted with a flat crayon brush: thick body, square-cut ends, dry-brush streaks and a torn, motion-blurred tail.",
  tags: ["melee", "slash", "sword", "brush", "directional", "one-shot"],
  size: [128, 52],
  origin: [44, 33],
  duration: 0.27,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#b4b4b4", "#d8d8d8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// 궤적: 기울어진 납작한 타원 (눈높이에서 본 가로 원)
const CX = 6, RX = 60, RY = 12, TILT = 0.1;
const A0 = -2.5, A1 = 0.32;               // 위 뒤 → 앞 → 앞 아래
const SWEEP = 0.075, TAIL0 = 0.07, END = 0.25;
const WMAX = 18, WMIN = 7;                  // 붓 두께 (가운데 / 양 끝)

function at(s) {
  const a = A0 + (A1 - A0) * s;
  const ex = RX * Math.cos(a), ey = RY * Math.sin(a);
  const c = Math.cos(TILT), sn = Math.sin(TILT);
  const x = CX + ex * c - ey * sn, y = ex * sn + ey * c;
  // 안쪽 법선 (타원 중심 쪽)
  const tx = -RX * Math.sin(a), ty = RY * Math.cos(a);
  const rtx = tx * c - ty * sn, rty = tx * sn + ty * c;
  const L = Math.hypot(rtx, rty) || 1;
  return { x, y, nx: rty / L, ny: -rtx / L };
}
const width = (s) => WMIN + (WMAX - WMIN) * Math.pow(Math.sin(Math.PI * clamp(s, 0, 1)), 0.7);

export function draw(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const f = Math.floor(t * 30 + 1e-6);
  const head = ease.outQuart(clamp((t + 0.022) / SWEEP, 0, 1));
  const tailK = ease.inQuad(clamp((t - TAIL0) / (END - TAIL0), 0, 1));
  const fade = clamp((t - 0.12) / (END - 0.12), 0, 1);
  const thin = 1 - 0.45 * fade;               // 끝날수록 붓 자국이 얇아짐
  const drawColor = o.layer !== "core", drawCore = o.layer !== "color";
  const STEP = 1 / 420;

  // 붓털 줄 (안쪽으로 d 픽셀)
  for (let d = 0; d <= WMAX; d++) {
    const r1 = hash(d + 11, 3), r2 = hash(d + 37, 5);
    // 줄마다 꼬리가 다르게 찢김 + 머리 뒤로 끌리는 모션 블러 길이
    const tail = clamp(tailK * (1.05 + 0.35 * r1) - 0.05, 0, 1);
    const blur = 0.06 + 0.16 * r2 * (1 - fade);
    const s0 = Math.max(0, tail - blur), s1 = head;
    if (s1 <= s0) continue;
    const u = d / WMAX;                         // 0 바깥 → 1 안쪽
    for (let s = s0; s <= s1; s += STEP) {
      const w = width(s) * thin;
      if (d > w) continue;
      // 마른 붓 틈: 줄마다 다른 박자의 끊김 (머리 가까이는 꽉 참)
      const near = (s1 - s) < 0.06;
      // 길게 끊기는 크레용 결: 바깥 가장자리는 단단하고 안쪽·꼬리 쪽일수록 많이 비어 있음
      const seg = Math.floor(s * (7 + r1 * 9) + r2 * 5);
      const gapN = hash(d * 7 + seg, 9);
      const dry = u * u * 0.75 + (1 - (s - s0) / Math.max(1e-3, s1 - s0)) * 0.2 + 0.35 * fade;
      if (!near && d > 1 && gapN < dry) continue;
      if (s < tail && r2 < 0.45) continue;
      const inBlur = s < tail;                  // 꼬리 앞 흐린 부분
      const k = inBlur ? (s - s0) / Math.max(1e-4, tail - s0) : 1;
      const pt = at(s);
      const x = Math.round(pt.x + pt.nx * d), y = Math.round(pt.y + pt.ny * d);
      const edge = d >= w - 1;                  // 안쪽 가장자리: 한 단계 어둡게
      if (drawColor) {
        const tone = 1 - u * 0.6 + (hash(d + 5, seg) - 0.5) * 0.25;
        let ci = tone > 0.8 ? 4 : tone > 0.55 ? 3 : tone > 0.3 ? 2 : 1;
        if (edge) ci -= 1;
        if (inBlur) ci = Math.max(0, ci - 2);
        if (fade > 0.55) ci = Math.max(0, ci - 1);
        p.px(x, y, C[ci]);
      }
      if (drawCore && !inBlur && u < 0.18 * (1 - fade) + 0.04 && gapN > 0.4 && (s1 - s) < 0.55 - 0.4 * fade && fade < 0.8) p.px(x, y, WHITE);
    }
  }

  // 속도 줄: 궤적 바깥·안쪽을 따라 짧게, 머리를 따라옴
  if (drawColor) {
    for (let i = 0; i < 6; i++) {
      const r = hash(i + 70, f >> 1), r3 = hash(i + 90, 1);
      const off = i % 2 ? -(2 + Math.round(r3 * 3)) : WMAX + 2 + Math.round(r3 * 3);
      const e = head - 0.04 - r * 0.25 - fade * 0.2;
      const b = e - (0.08 + hash(i + 50, 2) * 0.18) * (1 - fade);
      if (e <= 0 || b >= e) continue;
      for (let s = Math.max(0, b); s <= e; s += STEP * 2) {
        const pt = at(s), k = (s - b) / (e - b);
        const dd = off > 0 ? Math.min(off, width(s) * thin + 2 + (off - WMAX - 2)) : off;
        p.dot(Math.round(pt.x + pt.nx * dd), Math.round(pt.y + pt.ny * dd), C[k > 0.6 ? 3 : 1], k * (1 - fade));
      }
    }
  }
}
