// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/arcane/ 에 _mana.js 와 함께 넣고 node tools/render.mjs arcane/mana-burst 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/mana_burst.png ({"layer":"color"}) · mana_burst_core.png ({"layer":"core"}), 가로 한 줄 (마지막 빈 프레임 뺌)
import { fit, clamp, ease, WHITE } from "../../core/index.js";
import { R, RC, hash, drawBody, plasmaArc } from "./_mana.js";

// 마력탄이 적에게 닿았을 때 (한 번): 동그란 몸이 울퉁불퉁 찌그러지며 찢어지고, 조각들이 플라즈마 곡선을 끌며 흩어짐
export const meta = {
  name: "Mana Burst",
  desc: "A mana orb on impact: its round body warps and tears apart, chunks fly off trailing crackling plasma filaments that fray and fade.",
  tags: ["arcane", "impact", "burst", "plasma", "one-shot"],
  size: [76, 76],
  origin: [38, 38],
  duration: 0.4,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#8a8a8a", "#c8c8c8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const NF = 9, NP = 7, NS = 10, DRAG = 8, END = 0.4;
const go = (sp, t) => sp * (1 - Math.exp(-DRAG * t)) / DRAG;   // 빠르게 나갔다 멈추듯

export function draw(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const layer = o.layer, drawColor = layer !== "core", drawCore = layer !== "color";
  const f = Math.floor(t * 30 + 1e-6);

  // 몸: 부풀며 울퉁불퉁 찌그러짐 → 찢어지며 사라짐
  const warp = ease.outQuad(clamp(t / 0.1, 0, 1));
  const bodyA = 1 - clamp((t - 0.05) / 0.1, 0, 1);
  if (bodyA > 0) {
    const ph = [hash(1, 1), hash(1, 2), hash(1, 3)].map((v) => v * Math.PI * 2);
    const rf = (th) => Math.max(0.15, 1 + warp * (0.28 * Math.sin(3 * th + ph[0] + t * 30) + 0.2 * Math.sin(5 * th + ph[1]) + 0.14 * Math.sin(7 * th + ph[2] - t * 40)));
    drawBody(p, C, layer, { r: R * (1 + 0.2 * warp), rc: RC * (1 + 0.4 * warp), rf, a: bodyA });
  }

  // 조각: 몸에서 떨어져 나와 흩어짐 (줄어들며 사라짐)
  for (let i = 0; i < NF; i++) {
    const t0 = 0.03 + hash(i, 1) * 0.04, tt = t - t0;
    const life = 0.18 + hash(i, 2) * 0.16;
    if (tt < 0 || tt > life) continue;
    const th = (i / NF) * Math.PI * 2 + (hash(i, 3) - 0.5) * 0.6;
    const d = R * 0.7 + go(110 + hash(i, 4) * 90, tt);
    const x = Math.cos(th) * d, y = Math.sin(th) * d;
    const k = tt / life, rad = (1.6 + hash(i, 5) * 1.2) * (1 - k * k);
    if (rad < 0.5) continue;
    if (drawColor) p.circle(Math.round(x), Math.round(y), rad, C[k < 0.4 ? 4 : k < 0.75 ? 3 : 2]);
    if (drawCore && k < 0.35) p.circle(Math.round(x), Math.round(y), Math.max(0.6, rad - 1.2), WHITE);
  }

  // 플라즈마 곡선: 갈라진 가장자리에서 바깥으로 갈라져 뻗고, 조각을 따라 끌리다 끊어짐
  if (t < 0.28) {
    const k = t / 0.28;
    for (let i = 0; i < NP; i++) {
      const s = i * 13 + (f >> 1) * 7;                   // 2프레임마다 모양이 바뀜 (파직)
      const th = hash(i, 11) * Math.PI * 2;
      const r = R * (1 + 0.2 * warp) + go(80 + hash(i, 12) * 60, t) * 0.7;
      const len = (0.4 + hash(i, 13) * 0.5) * (1 - k * 0.6) * (hash(i, 14) < 0.5 ? 1 : -1);
      const alpha = 1 - k;
      if (drawColor) plasmaArc(p, C[k < 0.5 ? 4 : 3], { r, a0: th, len, seed: s, jit: 0.9 + k * 1.4, out: 0.6, alpha });
      else if (k < 0.4) plasmaArc(p, C[4], { r, a0: th, len, seed: s, jit: 0.9 + k * 1.4, out: 0.6, alpha: 0, white: (x, y) => p.px(x, y, WHITE) });
    }
  }

  // 작은 불꽃: 빠르게 튀어 사라짐
  if (drawColor) {
    for (let i = 0; i < NS; i++) {
      const tt = t - hash(i, 21) * 0.05, life = 0.15 + hash(i, 22) * 0.15;
      if (tt < 0 || tt > life) continue;
      const th = hash(i, 23) * Math.PI * 2, d = R + go(180 + hash(i, 24) * 120, tt);
      const x = Math.cos(th) * d, y = Math.sin(th) * d, bx = Math.cos(th) * (d - 3), by = Math.sin(th) * (d - 3);
      p.line(Math.round(bx), Math.round(by), Math.round(x), Math.round(y), C[3], 1 - tt / life);
    }
  }
}
