// 흘려베기 방패 공통: 몸 앞에 세운 반구의 옆모습 ")" (앞쪽 절반만). 오른쪽을 봄, (0, 0) = 몸 중심
import { WHITE } from "../../core/index.js";

export const SH = { x: 12, rx: 6, ry: 17 };   // 방패 뒤쪽 끝 줄 x, 앞으로 튀어나온 정도, 위아래 반높이

export const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
export const frac = (v) => v - Math.floor(v);

/** 방패 가장자리 위 한 점. th: -π/2 (위 끝) → 0 (앞) → π/2 (아래 끝). out: 바깥쪽으로 몇 px */
export function shieldPt(th, out = 0, cx = SH.x, k = 1) {
  const rx = SH.rx * k, ry = SH.ry * k;
  const x = cx + rx * Math.cos(th), y = ry * Math.sin(th);
  const nx = ry * Math.cos(th), ny = rx * Math.sin(th), L = Math.hypot(nx, ny) || 1;
  return { x: x + (nx / L) * out, y: y + (ny / L) * out, nx: nx / L, ny: ny / L };
}

/**
 * 방패 그리기 (픽셀마다 한 번씩 계산해서 겹침 없음).
 * layer: "color" = 은은한 회색 빛 테 (원소 색), "core" = 흰 심, "both"
 * a: 불투명도, k: 크기 배율, cx: 방패 뒤쪽 끝 줄 x, thick: 두께 배율, shimmer: 밝은 띠 자리 (0 위 끝 ~ 1 아래 끝),
 * soft: 진한 곳도 반투명으로, fill: 반구 안쪽 은은한 채움
 */
export function drawShield(p, C, layer, { a = 1, k = 1, cx = SH.x, thick = 1, shimmer = -1, soft = false, fill = 0.3 } = {}) {
  if (a <= 0.01) return;
  const rx = SH.rx * k, ry = SH.ry * k;
  const color = layer !== "core", core = layer !== "color";
  const wMax = 5 * thick * k, halo = 3 * k, pad = Math.ceil(wMax + halo + 1);
  const put = (x, y, c, al) => { if (al <= 0.01) return; if (!soft && al >= 0.97) p.px(x, y, c); else p.blend(x, y, c, Math.min(1, al)); };
  for (let y = Math.floor(-ry - pad); y <= Math.ceil(ry + pad); y++) {
    for (let x = Math.floor(cx - pad); x <= Math.ceil(cx + rx + pad); x++) {
      const X = x - cx, Y = y;
      let phi = Math.atan2(Y / ry, X / rx);
      let d, inside = false;
      if (Math.abs(phi) > Math.PI / 2) {
        // 몸 쪽: 위·아래 끝에서 둥글게 끊김
        const ty = Y < 0 ? -ry : ry;
        d = Math.hypot(X, Y - ty);
        phi = Y < 0 ? -Math.PI / 2 : Math.PI / 2;
      } else {
        const r = Math.hypot(X / rx, Y / ry), R = Math.hypot(rx * Math.cos(phi), ry * Math.sin(phi));
        d = (r - 1) * R;
        inside = d < 0;
      }
      const u = (phi + Math.PI / 2) / Math.PI;
      const taper = Math.pow(Math.sin(Math.PI * (0.06 + 0.88 * u)), 0.5);
      const w = (3.2 + 1.6 * taper) * thick * k, wc = (0.6 + 0.8 * taper) * thick * k;
      const ad = Math.abs(d);
      if (color) {
        const sh = shimmer >= 0 ? Math.max(0, 1 - Math.abs(u - shimmer) * 7) * 0.3 : 0;
        if (ad <= w) {
          const q = ad / w;
          const al = (q < 0.5 ? 1 : q < 0.8 ? 0.7 : 0.4) * a * (0.65 + 0.35 * taper) + sh;
          put(x, y, q < 0.45 ? C[3] : q < 0.75 ? C[2] : C[1], al);
        } else if (!inside && ad <= w + halo) {
          put(x, y, C[2], 0.25 * a * taper * (1 - (ad - w) / halo));
        } else if (inside && fill > 0 && X >= 0) {
          put(x, y, C[1], fill * a * (0.3 + 0.7 * Math.min(1, X / Math.max(1, rx))));
        }
      }
      if (core && ad <= wc) put(x, y, WHITE, !soft && a >= 0.97 && taper > 0.35 ? 1 : a * 0.7);
    }
  }
}
