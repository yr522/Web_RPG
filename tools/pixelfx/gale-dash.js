// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 넣고 node tools/render.mjs melee/gale-dash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/gale_dash.png (가로 한 줄 6프레임, 마지막 빈 프레임 뺌)
import { fit, clamp, ease } from "../../core/index.js";

// 질풍참: 돌진하는 몸 앞에 뾰족한 바람 쐐기, 뒤로 흘러가는 바람 줄. 무채색 (게임에서 원소 색을 곱해 입힘)
export const meta = {
  name: "Gale Dash",
  desc: "A sharp wind wedge leads a forward dash: it snaps out in front of the body, streaks rush back past it, then it thins and blows away. Greyscale, for tinting.",
  tags: ["melee", "dash", "charge", "wind", "directional", "one-shot"],
  size: [100, 32],
  origin: [27, 16],
  duration: 0.3,
  loop: false,
  fps: 20,
  bg: "dark",
  options: {
    palette: ["#454545", "#7a7a7a", "#b0b0b0", "#e0e0e0", "#ffffff"],
    seed: 1,
  },
};

const OUT = 0.05, FADE = 0.2, END = 0.3;
// 바람 줄: y, 길이, 시작 x, 속도, 밝기 단계
const STREAKS = [
  [-9, 16, 20, 1.0, 2], [-6, 26, 30, 1.3, 3], [-3, 20, 16, 0.9, 2], [0, 34, 26, 1.5, 4],
  [3, 22, 22, 1.1, 3], [6, 28, 12, 1.2, 2], [9, 14, 28, 0.8, 1], [-12, 10, 8, 0.7, 1], [12, 12, 4, 0.9, 1],
];

export function draw(p, t, o) {
  const C = fit(o.palette, 5);
  if (t >= END) return;
  const grow = 0.35 + 0.65 * ease.outExpo(clamp((t + 0.01) / OUT, 0, 1));
  const fade = clamp((t - FADE) / (END - FADE), 0, 1);
  const TX = 18 + 24 * grow - 4 * fade;        // 끝: 몸 앞으로 쭉 나감
  const L = 30 * grow * (1 - 0.6 * fade);       // 쐐기 길이
  const H = 10 * (1 - 0.6 * fade);                     // 쐐기 반높이
  if (L < 2 || H < 1) return;

  // 바람 줄: 쐐기 뒤에서 몸 뒤로 빠르게 흘러감
  for (const [y, len, x0, v, k] of STREAKS) {
    const x = TX - 6 - x0 - v * t * 110;
    if (x < -24) continue;
    const l = Math.min(len * (1 - fade) * (0.4 + 0.6 * grow), x + 26);
    if (l < 2) continue;
    p.line(x, y, x - l, y, (u) => C[u < 0.25 ? k + 1 > 4 ? 4 : k + 1 : k], (u) => (u > 0.7 ? 1 - (u - 0.7) / 0.3 : 1) * (1 - fade));
  }

  // 쐐기 바깥: 끝은 밝게, 뒤로 갈수록 어둡게, 뒤쪽은 V 자로 파임
  const notch = L * 0.45;
  const shade = (x) => { const u = (TX - x) / L; return u < 0.2 ? C[4] : u < 0.45 ? C[3] : u < 0.75 ? C[2] : C[1]; };
  p.poly([[TX, 0], [TX - L, -H], [TX - L + notch, 0], [TX - L, H]], (x) => shade(x), 1);
  // 안쪽 밝은 심
  const l2 = L * 0.7, h2 = H * 0.4;
  p.poly([[TX, 0], [TX - l2, -h2], [TX - l2 + notch * 0.6, 0], [TX - l2, h2]], C[4], 1 - fade * 0.5);
  // 위쪽 날 선은 밝게, 아래쪽은 한 단계 어둡게 (위에서 빛)
  p.line(TX, 0, TX - L, -H, (u) => (u < 0.5 ? C[4] : C[3]), 1);
  p.line(TX, 0, TX - L, H, (u) => (u < 0.3 ? C[3] : C[1]), 1);
  // 터져 나오는 첫 프레임 끝 반짝임
  if (t < OUT + 0.03) { p.px(TX + 1, 0, C[4]); p.px(TX + 2, 0, C[3]); p.px(TX - 1, -1, C[4]); p.px(TX - 1, 1, C[4]); }
}
