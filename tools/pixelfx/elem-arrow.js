// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/projectiles/ 에 넣고 node tools/render.mjs projectiles/elem-arrow 로 그림)
// 게임용 PNG (가로 한 줄 12프레임 반복): arrow.png {"layer":"color"} · arrow_core.png {"layer":"core"} · arrow_big.png {"layer":"color","big":true} · arrow_big_core.png {"layer":"core","big":true} · 박힌 화살 (1칸): arrow_still.png {"layer":"color","big":true,"still":true} · arrow_still_core.png {"layer":"core","big":true,"still":true}
import { fit, WHITE } from "../../core/index.js";

// 궁수 화살 (날아가는 동안 반복). 무채색: 게임에서 원소 색을 곱해 입힘.
// 두 겹: layer "color" = 화살 몸·깃·바람 줄 (밝은 무채색), layer "core" = 흰 심 (색 안 입힘)
// big: 더 큰 화살. 화살촉에서 나온 작은 알갱이가 몸통을 따라 흐르다 깃에서 퍼짐
// still: 박혀서 멈춘 화살 (바람 줄·알갱이·펄럭임 없음)
// 원점 = 화살촉 끝, 오른쪽을 향함
export const meta = {
  name: "Element Arrow",
  desc: "A greyscale arrow in flight for tinting: white core, shaft, fluttering fletching, air streaks; the big one sheds motes from its head that run down the shaft and fan out.",
  tags: ["projectile", "arrow", "bow", "directional", "loop", "tint"],
  size: [80, 28],
  origin: [72, 14],
  duration: 0.4,
  loop: true,
  fps: 30,
  bg: "sky",
  options: {
    palette: ["#7a7a7a", "#a8a8a8", "#cfcfcf", "#ececec", "#ffffff"],
    layer: "both",
    big: false,
    still: false,
    seed: 3,
  },
};

const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const frac = (v) => v - Math.floor(v);

export function draw(p, t, o) {
  const C = fit(o.palette, 5), big = !!o.big, still = !!o.still, D = meta.duration;
  const color = o.layer !== "core", core = o.layer !== "color";
  const ph = t / D, fr = Math.floor(t * 30 + 1e-6);
  const LEN = big ? 36 : 24;        // 촉 끝에서 깃 끝까지
  const HL = big ? 8 : 5, HW = big ? 4 : 2;   // 화살촉 길이·반폭
  const SW = big ? 1 : 0;           // 몸통 반두께 (0 = 1px)
  const left = -meta.origin[0] + 1;

  // 바람 줄: 촉과 깃에서 뒤로 흘러감 (반복 이음매 없게 정수 바퀴)
  if (color && !still) {
    const n = big ? 7 : 5;
    for (let i = 0; i < n; i++) {
      const u = frac(ph * 2 + i / n + hash(i, 1) * 0.3);
      const fromHead = hash(i, 2) < 0.5;
      const y = (hash(i, 3) < 0.5 ? -1 : 1) * ((fromHead ? HW : HW + 1) + 1 + Math.round(u * 2));
      const x0 = (fromHead ? -HL : -LEN + 4) - u * (big ? 34 : 22);
      const l = (big ? 10 : 6) + hash(i, 4) * 8;
      if (x0 - l < left) continue;
      p.line(Math.round(x0), y, Math.round(x0 - l), y, (k) => C[k < 0.3 ? 3 : 1], (k) => (1 - k) * (1 - u * 0.7));
    }
  }

  // 몸통
  for (let x = -LEN + 3; x <= -HL; x++) {
    for (let y = -SW; y <= SW; y++) if (color) p.px(x, y, y < 0 ? C[3] : y > 0 ? C[1] : SW === 0 ? C[3] : C[2]);
    if (core && SW > 0) p.px(x, 0, WHITE);  // 작은 화살 몸통은 1px 라 색만
  }

  // 깃: 위아래로 펄럭 (세 자세)
  const flap = still ? 0 : Math.floor(hash(fr, 7) * 3) - 1;
  const fl = big ? 9 : 6, fh = big ? 4 : 3;
  for (const s of [-1, 1]) {
    for (let i = 0; i < fl; i++) {
      const x = -LEN + i, h = Math.round(fh * (1 - i / fl) + (s < 0 ? flap : -flap) * 0.5 * (1 - i / fl));
      for (let k = 1; k <= h; k++) if (color) p.px(x, s * (SW + k), k === h ? C[1] : s < 0 ? C[3] : C[2]);
    }
  }
  if (color) p.px(-LEN - 1, 0, C[2]);

  // 화살촉: 위 비스듬한 면은 밝게, 아래는 한 단계 어둡게, 가운데 흰 심
  for (let i = 0; i <= HL; i++) {
    const x = -i, w = Math.round((HW * i) / HL);
    for (let y = -w; y <= w; y++) {
      if (color) p.px(x, y, y < 0 ? C[4] : y > 0 ? C[2] : C[3]);
      if (core && Math.abs(y) <= (big ? 1 : 0) && i < HL) p.px(x, y, WHITE);
    }
  }
  if (core) p.px(1, 0, WHITE);
  // 촉을 따라 지나가는 반짝임
  const g = frac(ph * 2);
  if (core && !still && g < 0.3) { const gx = -Math.round((g / 0.3) * HL); p.px(gx, -1, WHITE); if (big) p.px(gx, -2, WHITE); }

  // 큰 화살: 촉에서 나온 알갱이가 몸통을 따라 흐르다가 깃을 지나며 퍼짐
  if (big && !still) {
    const N = 14;
    for (let i = 0; i < N; i++) {
      const u = frac(ph * 2 + i / N + hash(i, 11) * 0.05);     // 0 = 촉, 1 = 퍼져 사라짐
      const side = hash(i, 12) < 0.5 ? -1 : 1;
      const run = LEN + 14;
      const x = -HL + 2 - u * run * (0.9 + hash(i, 13) * 0.2);
      const pastFletch = Math.max(0, (-x - LEN + 6) / 14);       // 깃에 닿은 뒤 0 → 1
      const y = side * (SW + 2 + Math.round(hash(i, 14) * 1.2) + Math.round(pastFletch * pastFletch * (4 + hash(i, 15) * 6)));
      if (x < left || u > 0.97) continue;
      const fade = pastFletch > 0.6 ? (hash(i * 7 + fr, 16) < pastFletch - 0.4 ? 0 : 1) : 1;  // 퍼지며 깜빡이듯 사라짐
      if (!fade) continue;
      const xi = Math.round(x);
      if (color) { p.px(xi, y, u < 0.3 ? C[4] : C[3]); if (pastFletch < 0.2 && hash(i, 17) < 0.5) p.px(xi + 1, y, C[2]); }
      if (core && u < 0.35) p.px(xi, y, WHITE);
    }
  }
}
