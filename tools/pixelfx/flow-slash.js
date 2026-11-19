// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 넣고 node tools/render.mjs melee/flow-slash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/flow_slash.png ({"layer":"color"}) · flow_slash_core.png ({"layer":"core"}), 가로 한 줄 14프레임 (마지막 빈 프레임 뺌)
import { fit, clamp, ease, WHITE } from "../../core/index.js";

// 회류참: 뒤로 미끄러지며 한 번 휘두름. 시작점에서 몸을 따라 파도처럼 출렁이는 검기 하나가 그어지고,
// 뒤로 갈수록·시간이 지날수록 가늘어져 도착 직전에 사라짐. 발밑엔 불규칙한 먼지.
// 땅에 고정 (시작점 몸 중심 x, 발 y 가 원점). 1 칸 = 화면 2px.
// 두 겹: layer "color" = 바깥 (밝은 무채색, 원소 색을 곱함), layer "core" = 흰 심 (색 안 입힘)
export const meta = {
  name: "Flow Slash",
  desc: "Sliding back, one wave-shaped sword trail follows the body from the start point, ragged and uneven, thinning out before the slide ends; dust kicks up at the heels.",
  tags: ["melee", "slash", "wave", "slide", "retreat", "directional", "one-shot"],
  size: [176, 56],
  origin: [154, 50],
  duration: 0.46,
  loop: false,
  fps: 30,
  bg: "ground",
  options: {
    palette: ["#8a8a8a", "#b4b4b4", "#d6d6d6", "#efefef", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

// 게임 수치: 뒤로 280px → 140 칸, 0.32초
const BACK = -140, SLIDE = 0.32, END = 0.46;
const HAND = 5, HAND_Y = -11;      // 칼끝 = 손: 몸 중심보다 앞, 키의 절반쯤 높이
const START = HAND;
const SPAN = 0.8;                  // 미끄러진 길이의 이 비율에서 두께 0 (도착 직전 사라짐)
const MAXW = 5.5;                  // 가장 두꺼운 곳 반두께 (검기 가운데)
const AGE = 0.14;                  // 그어진 뒤 사라지기까지 = 검기 길이 (늘 일정)
const DUST = 0.6;                  // 이 나이 비율부터 꼬리가 가루로 흩어짐
const hash = (a, b) => { let h = (a * 374761393 + b * 668265263) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

const bodyX = (t) => BACK * clamp(t / SLIDE, 0, 1);
// 칼끝은 손에 붙어 몸과 같이 움직임
const headX = (t) => bodyX(t) + HAND;
const sOf = (x) => clamp((START - x) / -BACK, 0, 1);
const drawnAt = (x) => SLIDE * sOf(x);
// 궤도: 손에서 나온 뒤 한 번 크게 휘는 부드러운 곡선 (그어진 뒤 천천히 위로 펼쳐짐)
const waveY = (x, age) => {
  const s = sOf(x);
  const grow = ease.inOutSine(clamp(age / AGE, 0, 1));
  let off = -12 * Math.sin(s * 10 + 0.9) - 3;
  if (off > 0) off *= 0.5;
  return HAND_Y + grow * off;
};
// 도착 직전에 사라지도록 뒤쪽 끝에서 전체 굵기를 줄임
const taper = (x) => { const s = sOf(x); return s >= SPAN ? 0 : Math.pow(1 - s / SPAN, 0.5); };

// 게임에서 그림이 캐릭터보다 한 프레임 늦게 시작해서, 그림 쪽 시간을 한 프레임 앞당김
const LEAD = 1 / 30;

export function draw(p, t0, o) {
  const t = t0 + LEAD;
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const color = o.layer !== "core", core = o.layer !== "color";
  const head = headX(t), f = Math.floor(t0 * 30 + 1e-6);

  let prevY = null;
  for (let x = Math.ceil(head); x <= START; x++) {
    const age = t - drawnAt(x);
    const u = age / AGE;               // 0 = 손, 1 = 꼬리 끝
    if (u >= 1) continue;
    // 굵기: 손에서 얇게 시작 → 가운데 굵게 → 꼬리로 얇게
    const th = MAXW * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.15)), 0.9) * taper(x) * Math.min(1, (START - x + 1) / 8) * (0.9 + 0.1 * Math.sin(x * 0.7));
    const yc = waveY(x, age);
    const py = prevY ?? yc; prevY = yc;
    if (th < 0.35) continue;
    const top = Math.min(yc, py) - th, bot = Math.max(yc, py) + th * 0.8;
    const hot = x - head < 2;
    // 꼬리: 가루로 흩어짐 (남는 점이 줄고, 위로 날리며 깜빡임)
    const dust = clamp((u - DUST) / (1 - DUST), 0, 1);
    for (let y = Math.round(top); y <= Math.round(bot); y++) {
      let px = x, py2 = y;
      if (dust > 0) {
        const r = hash(x * 131 + y, f);
        if (r < dust * 1.1) continue;
        px = x + Math.round(hash(x, y + 300) * 3 * dust);
        py2 = y - Math.round(hash(x + 7, y) * 4 * dust);
      }
      const v = y < yc ? (yc - y) / (yc - top || 1) : (y - yc) / (bot - yc || 1);
      if (color) p.px(px, py2, hot ? C[4] : v > 0.7 ? C[1] : v > 0.35 ? C[2] : C[3]);
      if (core && v < 0.38 && dust < 0.5) p.px(px, py2, WHITE);
    }
  }
  // 칼끝 반짝임
  if (core && t < SLIDE * SPAN * 0.9) { const y = Math.round(HAND_Y); p.px(Math.ceil(head), y, WHITE); p.px(Math.ceil(head) - 1, y, WHITE); }

  // 발밑 먼지: 몸이 지나간 자리에서 불규칙하게 튀어 오름
  for (let i = 0; i < 46; i++) {
    const t0 = (i / 46) * SLIDE * 0.95 + hash(i, 41) * 0.01;
    const age = t - t0, life = 0.12 + hash(i, 42) * 0.16;
    if (age < 0 || age > life) continue;
    const x0 = bodyX(t0) + (hash(i, 43) - 0.3) * 10;
    const vx = 10 + hash(i, 44) * 40, vy = -(20 + hash(i, 45) * 60);
    const x = Math.round(x0 + vx * age), y = Math.round(-1 + vy * age + 160 * age * age);
    if (y > 0) continue;
    const k = age / life, big = hash(i, 46) < 0.25 && k < 0.5;
    if (color) { p.px(x, y, k < 0.4 ? C[3] : C[1]); if (big) p.px(x + 1, y, C[2]); }
    if (core && k < 0.25 && hash(i, 47) < 0.4) p.px(x, y, WHITE);
  }
}
