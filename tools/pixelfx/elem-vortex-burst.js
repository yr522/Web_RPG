// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/arcane/ 에 elem-vortex.js 와 함께 넣고 node tools/render.mjs arcane/elem-vortex-burst 로 그림)
// 게임용 PNG (4칸씩 여러 줄): vortex_burst.png {"layer":"color"} · vortex_burst_core.png {"layer":"core"}
import { fit, clamp, ease, WHITE } from "../../core/index.js";
import { drawSwirl, R } from "./elem-vortex.js";

// 궁수 소용돌이 터짐 (한 번): 화살이 중심에 닿으면 소용돌이가 빠르게 줄어들며 사라지고,
// 충격파 고리가 퍼지고 파편이 튀어 나가다 느려지며 살짝 떨어짐. 원점 = 중심. 1 칸 = 화면 2px
export const meta = {
  name: "Element Vortex Burst",
  desc: "The whirlpool collapses fast into its eye and bursts: a white flash, a shockwave ring racing out, and shards that fly, drag to a stop and sag.",
  tags: ["arcane", "vortex", "burst", "shockwave", "one-shot", "tint"],
  size: [360, 360],
  origin: [180, 180],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#6a6a6a", "#969696", "#c0c0c0", "#e4e4e4", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const SHRINK = 0.12, RING = 0.34;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const C = fit(o.palette, 5);
  const color = o.layer !== "core", core = o.layer !== "color";

  // 소용돌이가 빠르게 감기며 줄어듦
  if (t < SHRINK) {
    const k = 1 - ease.inQuad(t / SHRINK);
    drawSwirl(p, t / 0.6, C, color, core, k, t * 40, 1);
  }

  // 번쩍: 중심 흰 원이 커졌다 사라짐
  if (t < 0.14) {
    const r = 6 + 14 * ease.outCubic(t / 0.06) * (1 - clamp((t - 0.06) / 0.08, 0, 1));
    if (color) p.circle(0, 0, r + 2, C[3]);
    if (core) p.circle(0, 0, r, WHITE);
  }

  // 충격파 고리
  if (t < RING) {
    const u = t / RING, r = 8 + (R - 8) * ease.outCubic(u), w = Math.max(2, Math.round(8 * (1 - u)));
    for (let i = 0; i < 220; i++) {
      const th = (i / 220) * Math.PI * 2;
      for (let j = 0; j < w; j++) {
        const rr = r - j, x = Math.round(Math.cos(th) * rr), y = Math.round(Math.sin(th) * rr * 0.92);
        if (color) { if (j === 0 && u < 0.75) p.px(x, y, C[4]); else p.dot(x, y, j < 2 ? C[3] : C[1], (1 - u) * (1 - j / (w + 1))); }
        if (core && j === 1 && u < 0.6) p.px(x, y, WHITE);
      }
    }
  }

  // 파편: 바깥으로 튀어 나가다 공기 저항으로 느려지고 살짝 떨어짐
  const N = 84, DRAG = 4.5, G = 160;
  for (let i = 0; i < N; i++) {
    const t0 = hash(i, 1) * 0.04, a = t - t0;
    const life = 0.28 + hash(i, 2) * 0.24;
    if (a < 0 || a > life) continue;
    const th = hash(i, 3) * Math.PI * 2, v = 260 + hash(i, 4) * 420;
    const d = (v / DRAG) * (1 - Math.exp(-DRAG * a));
    const x = Math.cos(th) * d, y = Math.sin(th) * d * 0.92 + 0.5 * G * a * a;
    // 꼬리: 지금 속도 방향 반대로
    const sp = v * Math.exp(-DRAG * a), vx = Math.cos(th) * sp, vy = Math.sin(th) * sp * 0.92 + G * a;
    const n = Math.hypot(vx, vy) || 1, tl = Math.min(16, 2 + sp * 0.035);
    const k = a / life, c = k < 0.3 ? C[4] : k < 0.6 ? C[3] : C[2];
    if (color) p.line(Math.round(x), Math.round(y), Math.round(x - (vx / n) * tl), Math.round(y - (vy / n) * tl), c, (q) => (1 - q) * (1 - k * 0.6));
    if (color && hash(i, 5) < 0.4) p.px(Math.round(x) + 1, Math.round(y), c);
    if (core && k < 0.35) p.px(Math.round(x), Math.round(y), WHITE);
  }
}
