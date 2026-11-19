// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/impacts/ 에 넣고 node tools/render.mjs impacts/elem-ground-pop 로 그림)
// 게임용 PNG (가로 한 줄, 마지막 빈 칸 뺌): ground_pop.png {"layer":"color"} · ground_pop_core.png {"layer":"core"}
import { fit, clamp, ease, WHITE } from "../../core/index.js";

// 궁수 도약 화살이 땅에 박힐 때 (한 번, 작게): 땅이 뾰족하게 솟았다 가라앉고, 납작한 충격파 고리가 바닥을 따라 퍼지고, 흙 조각이 튐.
// 원점 = 박힌 자리 (땅 줄, y = 0 이 바닥 윗면). 두 겹: layer "color" (무채색, 원소 색을 곱함), layer "core" (흰 심)
export const meta = {
  name: "Element Ground Pop",
  desc: "A small, tintable ground pop where an arrow sticks: shards of floor jut up and sink back, a flat shock ring rolls out along the floor, a few chips hop away.",
  tags: ["impact", "ground", "shockwave", "small", "one-shot", "tint"],
  size: [72, 44],
  origin: [36, 34],
  duration: 0.45,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#5c5c5c", "#8a8a8a", "#b4b4b4", "#dcdcdc", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function draw(p, t, o) {
  if (t >= meta.duration) return;
  const C = fit(o.palette, 5);
  const color = o.layer !== "core", core = o.layer !== "color";

  // 납작한 충격파 고리: 바닥을 따라 빠르게 퍼지고 옅어짐 (뒤쪽 반은 흐리게)
  const rk = clamp(t / 0.22, 0, 1);
  if (rk < 1) {
    const rx = 5 + 27 * ease.outCubic(rk), ry = rx * 0.28, al = 1 - rk;
    for (let i = 0; i < 64; i++) {
      const th = (i / 64) * Math.PI * 2, x = Math.round(Math.cos(th) * rx), y = Math.round(Math.sin(th) * ry);
      const front = Math.sin(th) > 0;
      if (color) p.dot(x, y, front ? C[3] : C[1], al * (front ? 1 : 0.6));
      if (core && front && rk < 0.5) p.dot(x, y, WHITE, al);
    }
  }

  // 땅이 솟음: 뾰족한 조각들이 빠르게 솟았다가 천천히 가라앉음
  const SH = [[-9, 8, -0.45, 3], [-2, 13, -0.1, 4], [6, 10, 0.3, 3], [14, 5, 0.6, 2]];
  SH.forEach(([sx, h, lean, w], i) => {
    const t0 = 0.01 * i, k = clamp((t - t0) / 0.07, 0, 1), down = clamp((t - 0.16 - t0) / 0.24, 0, 1);
    const hh = h * ease.outBack(k) * (1 - ease.inQuad(down));
    if (hh < 1) return;
    const tipX = sx + lean * hh, mid = -hh * 0.55, kink = (hash(i, 9) - 0.5) * 2;
    // 왼쪽 면 밝게, 오른쪽 면 어둡게
    if (color) {
      // 울퉁불퉁한 바위 조각: 가운데쯤 한 번 꺾임
      p.poly([[sx - w, 1], [sx - w * 0.6 + kink + lean * -mid, mid], [tipX, -hh], [sx + lean * 2, 1]], C[3]);
      p.poly([[sx + lean * 2, 1], [tipX, -hh], [sx + w * 0.7 + lean * -mid, mid + 1], [sx + w, 1]], C[1]);
    }
    if (core && down < 0.4) p.dot(Math.round(tipX), Math.round(-hh), WHITE);
  });

  // 흙 조각: 위로 튀었다 떨어짐
  for (let i = 0; i < 7; i++) {
    const t0 = 0.02, tt = t - t0;
    if (tt < 0) continue;
    const vx = (hash(i, 1) - 0.5) * 150, vy = -90 - hash(i, 2) * 110;
    const x = (hash(i, 3) - 0.5) * 10 + vx * tt, y = vy * tt + 0.5 * 1100 * tt * tt;
    if (y > 1) continue;
    if (color) { p.px(Math.round(x), Math.round(y), hash(i, 4) < 0.5 ? C[2] : C[1]); if (hash(i, 5) < 0.4) p.px(Math.round(x) + 1, Math.round(y), C[1]); }
    if (core && tt < 0.08) p.dot(Math.round(x), Math.round(y), WHITE);
  }
}
