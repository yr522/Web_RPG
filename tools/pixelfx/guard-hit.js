// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 _shield.js 와 함께 넣고 node tools/render.mjs melee/guard-hit 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/guard_hit.png ({"layer":"color"}) · guard_hit_core.png ({"layer":"core"}), 가로 한 줄 (마지막 빈 프레임 뺌)
import { fit, clamp, WHITE } from "../../core/index.js";
import { shieldPt, hash } from "./_shield.js";

// 흘려베기 받아내기 중 맞았을 때 (한 번): 방패 겉면에서 알갱이가 확 뿜어져 나와 공기 중에 떠서 퍼지며 사라짐 (중력 없음)
export const meta = {
  name: "Guard Hit",
  desc: "Motes burst off the face of a guard shield when it takes a blow and drift weightlessly apart, slowing and fading in the air.",
  tags: ["melee", "guard", "shield", "block", "impact", "one-shot"],
  size: [76, 76],
  origin: [22, 38],
  duration: 0.55,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#8a8a8a", "#c8c8c8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const N = 28, DRAG = 6;

export function draw(p, t, o) {
  const C = fit(o.palette, 5);
  const drawColor = o.layer !== "core", drawCore = o.layer !== "color";
  for (let i = 0; i < N; i++) {
    const delay = hash(i, 1) * 0.04;
    const tt = t - delay;
    const life = 0.32 + hash(i, 2) * 0.2;
    if (tt < 0 || tt > life) continue;
    const th = (hash(i, 3) - 0.5) * 2.6;               // 방패 위 나오는 자리
    const base = shieldPt(th, 4);
    const ang = Math.atan2(base.ny, base.nx) + (hash(i, 4) - 0.5) * 1.4;
    const sp = 80 + hash(i, 5) * 110;
    const go = sp * (1 - Math.exp(-DRAG * tt)) / DRAG;  // 빠르게 나갔다가 멈추듯 느려짐
    const drift = (hash(i, 6) - 0.6) * 10 * tt;          // 공기 중에 살짝 떠다님
    const x = base.x + Math.cos(ang) * go, y = base.y + Math.sin(ang) * go + drift;
    const k = tt / life, a = k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4;
    const big = hash(i, 7) > 0.65 && k < 0.5;
    if (drawColor) {
      const X = Math.round(x), Y = Math.round(y), c = C[k < 0.35 ? 3 : k < 0.7 ? 2 : 1];
      p.dot(X, Y, c, a); p.dot(X + 1, Y, c, a); p.dot(X, Y + 1, c, a); p.dot(X + 1, Y + 1, c, a * 0.8);
      if (big) { p.dot(X + 2, Y, C[2], a); p.dot(X, Y + 2, C[2], a); }
      // 나가는 동안 짧은 꼬리
      if (k < 0.3) p.dot(Math.round(x - Math.cos(ang) * 2), Math.round(y - Math.sin(ang) * 2), C[1], a * 0.7);
      p.light(x, y, C[3], 0.08 * a);
    }
    if (drawCore && k < 0.4) { p.px(Math.round(x), Math.round(y), WHITE); if (big) p.px(Math.round(x) + 1, Math.round(y), WHITE); }
  }
  // 맞는 순간 방패 겉면 번쩍 (짧게)
  if (t < 0.07) {
    const a = 1 - t / 0.07;
    for (let i = 0; i <= 40; i++) {
      const pt = shieldPt(-1.2 + 2.4 * i / 40, 4);
      if (drawColor) p.blend(Math.round(pt.x), Math.round(pt.y), C[3], 0.7 * a);
      if (drawCore && a > 0.5) p.px(Math.round(pt.x), Math.round(pt.y), WHITE);
    }
  }
}
