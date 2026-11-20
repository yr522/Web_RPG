// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/arcane/ 에 _mana.js 와 함께 넣고 node tools/render.mjs arcane/mana-orb 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/mana_orb.png ({"layer":"color"}) · mana_orb_core.png ({"layer":"core"}), 가로 한 줄 (반복)
import { fit, WHITE } from "../../core/index.js";
import { R, hash, drawBody, plasmaArc } from "./_mana.js";

// 마법사 마력탄 (날아가는 동안 반복): 두꺼운 동그란 마력 덩어리. 가운데 흰 심, 둘레는 회색 (원소 색).
// 가장자리에 아주 얇은 플라즈마 곡선이 불규칙하게 생겼다 사라지며 파직거림. 동그란 모양은 그대로.
export const meta = {
  name: "Mana Orb",
  desc: "A thick round mana bolt with a white-hot heart; hair-thin plasma filaments crawl and crackle irregularly around its rim without breaking the circle.",
  tags: ["arcane", "projectile", "orb", "plasma", "loop"],
  size: [42, 42],
  origin: [21, 21],
  duration: 0.5,
  loop: true,
  fps: 24,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#8a8a8a", "#c8c8c8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const FR = 12;   // 루프 프레임 수 (0.5초 × 24)

export function draw(p, t, o) {
  const C = fit(o.palette, 5);
  const f = Math.round(t * 24) % FR;
  const ph = f / FR;
  const layer = o.layer;
  const drawColor = layer !== "core", drawCore = layer !== "color";
  // 몸: 살짝 숨 쉼 (동그란 모양은 유지)
  const r = R + 0.5 * Math.sin(ph * Math.PI * 2);
  drawBody(p, C, layer, { r });
  // 플라즈마: 2프레임마다 새로 생기는 곡선 3~4개 + 매 프레임 떨림. 가장자리 바로 위·바깥
  const white = drawCore ? (x, y) => p.px(x, y, WHITE) : null;
  for (let k = 0; k < 2; k++) {
    const ep = Math.floor(f / 2) + k * 101;          // 곡선 묶음 (2프레임 유지)
    const cnt = 2 + Math.floor(hash(ep, 1) * 2);
    for (let i = 0; i < cnt; i++) {
      const s = ep * 17 + i;
      if (k === 1 && hash(s, 2) < 0.6) continue;      // 둘째 묶음은 가끔만
      const a0 = hash(s, 3) * Math.PI * 2;
      const len = (0.5 + hash(s, 4) * 0.8) * (hash(s, 5) < 0.5 ? 1 : -1);
      const rr = r + 0.5 + hash(s, 6) * 1.5;
      if (drawColor) plasmaArc(p, C[4], { r: rr, a0, len, seed: s * 31 + f, jit: 1.1 });
      else plasmaArc(p, C[4], { r: rr, a0, len, seed: s * 31 + f, jit: 1.1, alpha: 0, white });
    }
  }
  // 가끔 가장자리에서 튀는 짧은 불꽃
  if (hash(f, 7) < 0.5) {
    const th = hash(f, 8) * Math.PI * 2;
    if (drawColor) plasmaArc(p, C[3], { r: r + 1, a0: th, len: 0.35, seed: f * 7 + 3, jit: 0.8, out: 1 });
  }
}
