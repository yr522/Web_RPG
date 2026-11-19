// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/arcane/ 에 넣고 node tools/render.mjs arcane/elem-vortex 로 그림)
// 게임용 PNG (4칸씩 여러 줄): vortex.png {"layer":"color"} · vortex_core.png {"layer":"core"}
import { fit, WHITE } from "../../core/index.js";

// 궁수 소용돌이 (반복): 범위 안의 알갱이가 나선 팔을 그리며 중심으로 빨려 들어가고,
// 범위 밖에서는 알갱이가 중력 없이 천천히 퍼져 나감. 원점 = 소용돌이 중심. 1 칸 = 화면 2px (반지름 150 = 300px)
// 두 겹: layer "color" (밝은 무채색, 원소 색을 곱함), layer "core" (흰 심, 색 안 입힘)
export const meta = {
  name: "Element Vortex",
  desc: "A true whirlpool for tinting: motes spiral in along three arms to a bright eye; outside its rim, loose motes drift slowly away with no gravity.",
  tags: ["arcane", "vortex", "whirlpool", "pull", "loop", "tint"],
  size: [360, 360],
  origin: [180, 180],
  duration: 0.6,
  loop: true,
  fps: 20,
  bg: "dark",
  options: {
    palette: ["#6a6a6a", "#969696", "#c0c0c0", "#e4e4e4", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

export const R = 150;
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const frac = (v) => v - Math.floor(v);

/** 범위 안 안개: 반투명 덩어리가 소용돌이와 같이 천천히 돔. 범위 원 밖으로는 안 나감. k = 크기 배율 */
export function drawFog(p, ph, C, k = 1, alpha = 1) {
  const RY = R * 0.92 * k;
  // 바탕: 범위 전체를 옅게, 가장자리는 부드럽게
  p.disc(0, 0, RY, C[1], (d) => 0.3 * alpha * (d < 0.8 ? 1 : (1 - d) / 0.2));
  // 덩어리: 자리마다 크기가 정해져 있어서 한 칸씩 돌면 반복 이음매 없음
  const N = 16;
  for (let i = 0; i < N; i++) {
    const th = ((i + ph) / N) * Math.PI * 2 + 0.3;
    const rr = (0.3 + 0.38 * (0.5 + 0.5 * Math.sin(th * 3 + 1))) * RY;
    const size = (24 + 14 * (0.5 + 0.5 * Math.sin(th * 2))) * k;
    const x = Math.cos(th) * rr, y = Math.sin(th) * rr;
    const lim = Math.min(size, RY - Math.hypot(x, y));
    if (lim < 3) continue;
    p.disc(Math.round(x), Math.round(y), lim, (d) => (d < 0.4 ? C[2] : C[1]), (d) => 0.24 * alpha * (1 - d * d));
  }
}

/** 소용돌이 팔 (터짐에서도 줄어드는 모습으로 씀). k = 크기 배율, spin = 추가 회전 */
export function drawSwirl(p, ph, C, color, core, k = 1, spin = 0, alpha = 1) {
  const ARMS = 3, PER = 46;
  const rot = ph * Math.PI * 2 * (1 / 3) + spin; // 한 바퀴의 1/3 마다 같은 모양 (팔 3개) → 이음매 없음
  for (let a = 0; a < ARMS; a++) {
    for (let i = 0; i < PER; i++) {
      const id = a * PER + i;
      const u = frac(ph + i / PER + hash(id, 1) * 0.04);      // 0 = 바깥, 1 = 중심
      const r = R * k * Math.pow(1 - u, 0.85) * (0.92 + hash(id, 2) * 0.16);
      if (r < 3) continue;
      const th = rot + (a / ARMS) * Math.PI * 2 + 3.4 * Math.log(R / Math.max(r / k, 4)) * 0.55 + (hash(id, 3) - 0.5) * 0.35;
      const x = Math.cos(th) * r, y = Math.sin(th) * r * 0.92;
      // 진행 방향(안쪽으로 감기는 방향)으로 짧은 꼬리
      const tl = 2 + Math.round((1 - u) * 5 * k);
      const tx = Math.cos(th - 0.35) * (r + tl), ty = Math.sin(th - 0.35) * (r + tl) * 0.92;
      const near = 1 - r / (R * k);
      const c = near > 0.75 ? C[4] : near > 0.45 ? C[3] : near > 0.2 ? C[2] : C[1];
      const al = Math.min(1, u * 6) * alpha;
      if (color) { p.line(Math.round(x), Math.round(y), Math.round(tx), Math.round(ty), c, (q) => (1 - q * 0.8) * al); if (near > 0.1) p.line(Math.round(x), Math.round(y) + 1, Math.round(tx), Math.round(ty) + 1, near > 0.5 ? c : C[1], (q) => (1 - q) * al * 0.9); }
      if (core && near > 0.6 && hash(id, 4) < 0.6) p.dot(Math.round(x), Math.round(y), WHITE, al);
    }
  }
}

export function draw(p, t, o) {
  const C = fit(o.palette, 5), ph = t / meta.duration;
  const color = o.layer !== "core", core = o.layer !== "color";

  if (color) drawFog(p, ph, C);

  // 범위 테두리: 끊긴 점선 원이 천천히 돔
  if (color) for (let i = 0; i < 90; i++) {
    const th = (i / 90) * Math.PI * 2 + ph * (Math.PI * 2 / 90) * 3;
    if (i % 6 > 2) continue;
    p.dot(Math.round(Math.cos(th) * R), Math.round(Math.sin(th) * R * 0.92), C[1], 0.7);
  }

  drawSwirl(p, ph, C, color, core);

  // 중심 눈: 밝은 원, 살짝 맥박
  const pulse = 1 + 0.25 * Math.sin(ph * Math.PI * 2 * 2);
  if (color) p.circle(0, 0, 7 * pulse, C[3]);
  if (core) p.circle(0, 0, 4 * pulse, WHITE);

  // 범위 밖: 알갱이가 중력 없이 천천히 퍼져 나감
  const M = 64;
  for (let i = 0; i < M; i++) {
    const u = frac(ph + i / M + hash(i, 21) * 0.3);
    const th = hash(i, 22) * Math.PI * 2 + u * 0.15;
    const r = R + 4 + u * 24;
    const x = Math.round(Math.cos(th) * r), y = Math.round(Math.sin(th) * r * 0.92);
    const al = u < 0.2 ? u / 0.2 : 1 - (u - 0.2) / 0.8;
    // 나타날 땐 흐리게, 멀어지면 깜빡이며 사라짐
    if (u < 0.12 || (u > 0.7 && hash(i * 3 + Math.floor(ph * 12), 25) < (u - 0.7) / 0.3)) continue;
    if (color) { p.px(x, y, u < 0.4 ? C[3] : C[2]); if (hash(i, 23) < 0.4) p.px(x + 1, y, C[1]); }
    if (core && u < 0.25 && hash(i, 24) < 0.4) p.dot(x, y, WHITE, al);
  }
}
