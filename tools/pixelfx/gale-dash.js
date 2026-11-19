// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 넣고 node tools/render.mjs melee/gale-dash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/gale_dash.png (가로 한 줄 6프레임, 마지막 빈 프레임 뺌). 바깥 층은 --opts {"layer":"color"}, 흰 심 gale_dash_core.png 는 {"layer":"core"}
import { fit, clamp, ease, WHITE } from "../../core/index.js";

// 질풍참: 돌진하는 몸 앞에 뾰족한 바람 쐐기. 줄마다 뒤로 끌리는 속도 줄로 모양이 흩어짐.
// 두 겹으로 뽑는다: layer "color" = 바깥 (밝은 무채색, 게임에서 원소 색을 곱함), layer "core" = 가운데 흰 심 (색 안 입힘)
export const meta = {
  name: "Gale Dash",
  desc: "A sharp wind wedge leads a forward dash, its body torn into speed streaks that drag back behind it; a white-hot core inside a tintable rim.",
  tags: ["melee", "dash", "charge", "wind", "directional", "one-shot"],
  size: [100, 32],
  origin: [27, 16],
  duration: 0.3,
  loop: false,
  fps: 20,
  bg: "dark",
  options: {
    palette: ["#8a8a8a", "#b4b4b4", "#d6d6d6", "#efefef", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const OUT = 0.05, FADE = 0.2, END = 0.3;
// 줄·프레임마다 고정된 흔들림 (매번 같은 그림)
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

export function draw(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const f = Math.floor(t * 20 + 1e-6);
  const grow = 0.4 + 0.6 * ease.outExpo(clamp((t + 0.01) / OUT, 0, 1));
  const fade = clamp((t - FADE) / (END - FADE), 0, 1);
  const TX = 14 + 22 * grow - 3 * fade;          // 쐐기 끝
  const L = 30 * grow * (1 - 0.5 * fade);        // 쐐기 길이
  const H = 9 * (1 - 0.5 * fade);                // 쐐기 반높이
  const drawColor = o.layer !== "core", drawCore = o.layer !== "color";
  const left = -26;

  if (drawColor) {
    // 쐐기 몸: 줄마다 앞 끝은 뾰족한 선, 뒤 끝은 들쭉날쭉 길게 끌림 (끊긴 조각도 섞음)
    for (let y = -Math.floor(H); y <= Math.floor(H); y++) {
      const u = Math.abs(y) / H;
      const front = TX - u * L * 0.85;
      const r1 = hash(y + 50, f), r2 = hash(y + 90, f + 7);
      const tail = L * (0.35 + 0.35 * (1 - u)) + r1 * 22 * (1 - fade * 0.5);
      const back = Math.max(left, front - tail);
      // 앞쪽 단단한 부분
      const solid = Math.max(back, front - L * (0.25 + 0.2 * (1 - u)));
      p.line(Math.round(front), y, Math.round(solid), y, (k) => C[k < 0.3 ? 4 : 3], 1);
      // 뒤로 끌리는 부분: 한두 번 끊김, 뒤로 갈수록 어둡고 흐려짐
      const gap = r2 < 0.55 ? Math.round(2 + r2 * 6) : 0;
      const s2 = solid - gap;
      if (s2 > back + 1) p.line(Math.round(s2), y, Math.round(back), y, (k) => C[k < 0.4 ? 2 : k < 0.75 ? 1 : 0], (k) => (k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4) * (1 - fade));
    }
    // 쐐기 밖 위아래로 날리는 짧은 속도 줄
    for (let i = 0; i < 7; i++) {
      const r = hash(i, f), s = i % 2 ? 1 : -1;
      const y = s * Math.round(H + 2 + r * 3);
      const x = TX - 6 - hash(i + 20, f) * L;
      const l = 6 + hash(i + 40, f) * 16;
      if (x - l < left) continue;
      p.line(Math.round(x), y, Math.round(x - l), y, (k) => C[k < 0.3 ? 3 : 1], (k) => (1 - k) * (1 - fade));
    }
  }

  if (drawCore) {
    // 가운데 흰 심: 뾰족한 모양 그대로, 뒤로 짧게 끌림
    const h2 = Math.max(1, Math.floor(H * 0.45));
    for (let y = -h2; y <= h2; y++) {
      const u = Math.abs(y) / (h2 + 1);
      const front = TX - 1 - u * L * 0.6;
      const tail = L * 0.45 * (1 - u * 0.6) + hash(y + 200, f) * 10;
      const back = Math.max(left, front - tail);
      p.line(Math.round(front), y, Math.round(back), y, WHITE, (k) => (k < 0.65 ? 1 : 1 - (k - 0.65) / 0.35));
    }
    if (t < OUT + 0.03) { p.px(TX + 1, 0, WHITE); p.px(TX + 2, 0, WHITE); }
  }
}
