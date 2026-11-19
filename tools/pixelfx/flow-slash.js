// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 넣고 node tools/render.mjs melee/flow-slash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/flow_slash.png ({"layer":"color"}) · flow_slash_core.png ({"layer":"core"}), 가로 한 줄 15프레임 (마지막 빈 프레임 뺌)
import { fit, clamp, ease, WHITE } from "../../core/index.js";

// 회류참: 뒤로 미끄러지며 한 번 휘두름. 앞쪽 끝에서 도착점까지 물결 검기 두 줄이 한 번에 그어지고,
// 발밑에는 시작점에서 도착점까지 긁힌 줄. 땅에 고정 (시작점 몸 중심 x, 발 y 가 원점).
// 두 겹: layer "color" = 바깥 (밝은 무채색, 원소 색을 곱함), layer "core" = 흰 심 (색 안 입힘)
export const meta = {
  name: "Flow Slash",
  desc: "Sliding back, one sweep leaves two wave-shaped sword trails from the far reach to where the slide ends, and a scrape line along the floor; a white core inside a tintable rim.",
  tags: ["melee", "slash", "wave", "slide", "retreat", "directional", "one-shot"],
  size: [160, 48],
  origin: [98, 36],
  duration: 0.5,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#8a8a8a", "#b4b4b4", "#d6d6d6", "#efefef", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

// 게임 수치 (1 칸 = 화면 3px): 앞 165px → 55, 뒤로 280px → 93, 미끄러지는 시간 0.32초
const FRONT = 55, BACK = -93, SLIDE = 0.32, FADE = 0.16, END = SLIDE + FADE;
const MID = -14; // 검기 가운데 높이 (발 위)
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

// 물결 두 줄: 곡선 두 번 (사인 한 주기), 위아래로 조금 어긋나게 겹쳐 흐름
const WAVES = [
  { amp: 6, ph: 0, w: 4.4, dy: 1 },
  { amp: 5, ph: 0.7, w: 2.4, dy: -7 },
];
const span = FRONT - BACK;
const waveY = (W, x) => MID + W.dy + W.amp * Math.sin(((FRONT - x) / span) * Math.PI * 2 + W.ph);
// 두께: 앞쪽 끝·뒤쪽 끝은 가늘게, 앞쪽 1/3 이 가장 두꺼움
const thick = (W, x) => { const u = (FRONT - x) / span; return W.w * Math.sin(Math.PI * Math.pow(clamp(u, 0, 1), 0.65)); };

export function draw(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const f = Math.floor(t * 30 + 1e-6);
  const color = o.layer !== "core", core = o.layer !== "color";
  // 검기 머리: 앞 끝에서 도착점까지 빠르게 (빨리 나가고 끝에서 몸을 따라잡음)
  const head = FRONT - span * ease.outCubic(clamp(t / (SLIDE * 0.85), 0, 1));
  // 사라짐: 앞쪽부터 지워지며 전체가 가늘어짐
  const fade = clamp((t - SLIDE) / FADE, 0, 1);
  const tailCut = FRONT - span * ease.inQuad(fade);
  const thin = 1 - 0.6 * fade;

  for (let x = Math.floor(head); x <= Math.min(FRONT, tailCut); x++) {
    const fromHead = x - head; // 머리 근처는 더 밝게
    for (const W of WAVES) {
      const yc = waveY(W, x), th = thick(W, x) * thin;
      if (th < 0.5) continue;
      if (color) {
        for (let y = Math.round(yc - th); y <= Math.round(yc + th); y++) {
          const v = Math.abs(y - yc) / th;
          const c = v > 0.75 ? C[1] : v > 0.45 ? C[2] : C[3];
          p.px(x, y, fromHead < 4 ? C[4] : c);
        }
        // 위쪽 가장자리에서 뒤로 날리는 짧은 결 (흐름 느낌)
        if (hash(x, W.ph * 10 + 3) < 0.12 && x > head + 3) p.line(x, Math.round(yc - th - 1), x + 3 + Math.round(hash(x, f) * 4), Math.round(yc - th - 1), C[2], (k) => 1 - k);
      }
      if (core) {
        const cth = th * 0.4;
        if (cth >= 0.3) for (let y = Math.round(yc - cth); y <= Math.round(yc + cth); y++) p.px(x, y, WHITE);
      }
    }
  }
  // 검기 머리의 반짝임
  if (core && t < SLIDE) { const yh = waveY(WAVES[0], head); p.px(head - 1, Math.round(yh), WHITE); p.px(head - 2, Math.round(yh), WHITE); }

  // 슬라이딩: 발밑 긁힌 줄, 시작점(0)에서 몸을 따라 도착점까지
  const feet = BACK * clamp(t / SLIDE, 0, 1);
  const sCut = -Math.abs(BACK) * ease.inQuad(fade);
  for (let x = Math.floor(feet); x <= Math.min(0, sCut); x++) {
    const near = x - feet; // 발 근처는 두껍고 밝게
    if (color) {
      p.px(x, -1, near < 10 ? C[3] : C[1]);
      if (near < 18) p.px(x, -2, near < 6 ? C[3] : C[1]);
    }
    if (core) p.px(x, -1, WHITE);
  }
  // 발 앞에 튀는 작은 먼지
  if (color && t < SLIDE) for (let i = 0; i < 4; i++) {
    const r = hash(i + 7, f);
    p.px(Math.round(feet + 2 + r * 8), -2 - Math.round(hash(i + 30, f) * 4), C[2]);
  }
}
