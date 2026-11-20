// 마력탄 공통: 동그란 몸 (가운데 흰 심 + 회색 몸, 원소 색을 입힘) + 가장자리를 파직거리는 아주 얇은 플라즈마 곡선
import { WHITE } from "../../core/index.js";

export const R = 9, RC = 4;   // 몸 반지름, 흰 심 반지름

export const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** 몸: rf(θ) = 각도별 반지름 배율 (찌그러짐), a = 불투명도, core = 흰 심 반지름 */
export function drawBody(p, C, layer, { cx = 0, cy = 0, r = R, rc = RC, rf = null, a = 1 } = {}) {
  const color = layer !== "core", core = layer !== "color";
  const pad = Math.ceil(r * 1.6 + 4);
  for (let y = -pad; y <= pad; y++) for (let x = -pad; x <= pad; x++) {
    const d = Math.hypot(x, y), th = Math.atan2(y, x);
    const rr = r * (rf ? rf(th) : 1);
    const X = Math.round(cx + x), Y = Math.round(cy + y);
    if (color) {
      if (d <= rr) {
        const q = d / Math.max(rr, 0.01);
        const c = q < 0.55 ? C[4] : q < 0.8 ? C[3] : q < 0.94 ? C[2] : C[1];
        if (a >= 0.97) p.px(X, Y, c); else p.blend(X, Y, c, a);
      } else if (d <= rr + 3) {
        // 바깥 은은한 빛
        p.blend(X, Y, C[2], 0.3 * a * (1 - (d - rr) / 3));
      }
    }
    if (core && d <= rc * (rf ? Math.min(1, rf(th)) : 1)) {
      if (a >= 0.97) p.px(X, Y, WHITE); else p.blend(X, Y, WHITE, a);
    }
  }
}

/**
 * 플라즈마 곡선 하나: 각도 a0 에서 len 만큼, 반지름 r 근처를 들쭉날쭉 따라감 (1px).
 * seed 로 모양이 정해짐. out: 바깥으로 뻗는 정도 (0 = 가장자리에 붙음, 1 = 바깥으로 갈라져 나감)
 */
export function plasmaArc(p, c, { cx = 0, cy = 0, r = R, a0, len, seed, jit = 1.3, out = 0, alpha = 1, white = null }) {
  const n = Math.max(3, Math.round(Math.abs(len) * r / 2.2));
  let px = null, py = null;
  for (let i = 0; i <= n; i++) {
    const u = i / n, th = a0 + len * u;
    const j = (hash(seed, i) - 0.5) * 2 * jit;
    const rr = r + j + out * u * (3 + hash(seed, 99) * 3);
    const x = cx + Math.cos(th) * rr, y = cy + Math.sin(th) * rr;
    if (px !== null) {
      p.line(Math.round(px), Math.round(py), Math.round(x), Math.round(y), c, alpha);
      if (white && hash(seed, i + 300) < 0.35) white(Math.round(x), Math.round(y));
    }
    px = x; py = y;
  }
}
