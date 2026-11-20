// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 _shield.js 와 함께 넣고 node tools/render.mjs melee/guard-shield 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/guard_shield.png ({"layer":"color"}) · guard_shield_core.png ({"layer":"core"}), 가로 한 줄 (반복)
import { fit, clamp, WHITE } from "../../core/index.js";
import { SH, shieldPt, drawShield, hash, frac } from "./_shield.js";

// 흘려베기 받아내기 (반복): 몸 바로 앞에 세운 반구 방패 ")". 방패 앞에서 나온 알갱이가 가장자리를 따라
// 위·아래 끝으로 흘러 몸 쪽(뒤)으로 빠지고, 끝을 벗어나면 아주 조금 퍼지며 사라짐 (몸 뒤로는 안 넘어감).
export const meta = {
  name: "Guard Shield",
  desc: "A glowing half-dome guard held right in front of the body; motes stream from its face along the rim to the tips and slip back, fanning out a little before fading.",
  tags: ["melee", "guard", "shield", "block", "loop"],
  size: [52, 56],
  origin: [22, 28],
  duration: 0.6,
  loop: true,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#8a8a8a", "#c8c8c8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const N = 22, BACK = 18;     // 알갱이 수, 끝을 벗어난 뒤 뒤로 가는 거리 (몸 중심 뒤로 안 넘어가게)

export function draw(p, t, o) {
  const C = fit(o.palette, 5);
  const ph = t / meta.duration;
  const drawColor = o.layer !== "core", drawCore = o.layer !== "color";
  // 방패: 은은하게 숨 쉬듯 밝기 변함 + 빛 띠가 앞→끝으로 흐름
  const breathe = 1;
  drawShield(p, C, drawColor && drawCore ? "both" : drawColor ? "color" : "core", { a: breathe, shimmer: frac(ph * 2) * 0.5 + 0.5 });

  // 알갱이: 한 바퀴 = 루프의 절반 (2번 돎, 이음새 없음)
  for (let i = 0; i < N; i++) {
    const side = i % 2 ? 1 : -1;                     // 1 = 아래 끝으로, -1 = 위 끝으로
    const u = frac(ph * 2 + i / N + hash(i, 1) * 0.07);
    const out = 5 + hash(i, 2) * 2;                // 가장자리 바로 바깥
    const EDGE = 0.62;                                  // 이 시간까지는 가장자리를 탐
    let x, y, a, bright;
    if (u < EDGE) {
      // 앞(조금 위아래로 흩어진 곳)에서 끝까지, 끝으로 갈수록 빨라짐
      const k = u / EDGE, th0 = side * (0.05 + hash(i, 3) * 0.35);
      const th = th0 + (side * Math.PI / 2 - th0) * (k * k * 0.6 + k * 0.4);
      const pt = shieldPt(th, out);
      x = pt.x; y = pt.y; a = Math.min(1, k * 4); bright = 1;
    } else {
      // 끝을 벗어남: 뒤로 미끄러지며 아주 조금 퍼지고 사라짐
      const k = (u - EDGE) / (1 - EDGE);
      const tip = shieldPt(side * Math.PI / 2, out);
      const spread = (hash(i, 4) - 0.3) * 4 * k * k;
      x = tip.x - BACK * (1 - Math.pow(1 - k, 2)) * (0.6 + 0.4 * hash(i, 5));
      y = tip.y + side * spread;
      a = 1 - k; bright = 1 - k;
    }
    if (drawColor) {
      const X = Math.round(x), Y = Math.round(y), c = C[bright > 0.6 ? 3 : 2];
      p.dot(X, Y, c, a); p.dot(X + 1, Y, c, a); p.dot(X, Y + 1, c, a); p.dot(X + 1, Y + 1, c, a * 0.8);
      // 짧은 꼬리 (지나온 쪽)
      p.dot(Math.round(x) + (u < EDGE ? 0 : 1), Math.round(y) - (u < EDGE ? side : 0), C[1], a * 0.6);
      p.light(x, y, C[3], 0.06 * a);
    }
    if (drawCore && bright > 0.75 && a > 0.6 && hash(i, 6) > 0.3) p.px(Math.round(x), Math.round(y), WHITE);
  }
}
