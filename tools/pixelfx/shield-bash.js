// pixelfx 원본 (https://github.com/patch-gg/pixelfx 의 src/fx/melee/ 에 _shield.js 와 함께 넣고 node tools/render.mjs melee/shield-bash 로 그림)
// 게임용 PNG: assets/img/vfx/pixelfx/shield_bash.png ({"layer":"color"}) · shield_bash_core.png ({"layer":"core"}), 가로 한 줄 (마지막 빈 프레임 뺌)
import { fit, clamp, ease } from "../../core/index.js";
import { SH, drawShield } from "./_shield.js";

// 흘려베기 공격 (한 번): 받아내던 방패가 잔상을 남기며 앞으로 짧게 돌진 → 도착한 자리에서 방패 모양 그대로
// 잔상이 커지며 퍼짐. 커지는 속도가 빨라지며 반투명 → 빠르게 진해졌다가, 느려지며 다시 투명해짐 (공기 중에 오라가 퍼지는 느낌)
export const meta = {
  name: "Shield Bash",
  desc: "A guard shield lunges a short way forward trailing afterimages, then its shape swells outward as an aura: speeding up and solidifying fast, then slowing and fading into the air.",
  tags: ["melee", "shield", "bash", "aura", "directional", "one-shot"],
  size: [108, 132],
  origin: [22, 66],
  duration: 0.44,
  loop: false,
  fps: 30,
  bg: "dark",
  options: {
    palette: ["#2e2e2e", "#5c5c5c", "#8a8a8a", "#c8c8c8", "#ffffff"],
    layer: "both",
    seed: 1,
  },
};

const DASH = 30, T_DASH = 0.09;        // 돌진 거리(px)·시간
const A0 = 0.07, END = 0.44, KMAX = 2.6; // 오라 시작·끝, 최대 배율

const dashX = (t) => SH.x + DASH * ease.outCubic(clamp(t / T_DASH, 0, 1));

// 오라 퍼지는 정도: 처음엔 빨라지고(가속) 뒤로 갈수록 느려짐. 속도 = sin(π q^0.55) 를 적분해 0..1 로 맞춤
const S_TABLE = (() => { const n = 200, a = [0]; let s = 0; for (let i = 1; i <= n; i++) { s += Math.sin(Math.PI * Math.pow((i - 0.5) / n, 0.55)); a.push(s); } return a.map((v) => v / s); })();
const spread = (q) => { const f = clamp(q, 0, 1) * 200, i = Math.floor(f), r = f - i; return i >= 200 ? 1 : S_TABLE[i] * (1 - r) + S_TABLE[i + 1] * r; };

export function draw(p, t, o) {
  if (t >= END) return;
  const C = fit(o.palette, 5);
  const layer = o.layer === "core" ? "core" : o.layer === "color" ? "color" : "both";
  const drawColor = layer !== "core";

  // 잔상: 지나온 자리에 흐린 방패 (원래 자리부터)
  if (drawColor && t < T_DASH + 0.08) {
    for (let j = 1; j <= 5; j++) {
      const tj = t - j * 0.016;
      if (tj < -0.02) continue;
      const fade = 1 - clamp((t - T_DASH) / 0.08, 0, 1);
      drawShield(p, C, "color", { cx: dashX(Math.max(0, tj)), a: (0.5 - j * 0.08) * fade, soft: true, fill: 0, thick: 0.8 });
    }
  }

  // 방패 본체: 돌진하고, 오라로 바뀌며 사라짐
  const bodyA = 1 - clamp((t - T_DASH) / 0.06, 0, 1);
  if (bodyA > 0) drawShield(p, C, layer, { cx: dashX(t), a: bodyA, fill: 0.18 * bodyA });

  // 오라: 도착한 방패 모양 그대로 커지며 퍼짐
  if (t >= A0) {
    const q = (t - A0) / (END - A0);
    const k = 1 + (KMAX - 1) * spread(q);
    // 반투명 → 빠르게 진해짐 (q 0.22 에서 가장 진함) → 느려지며 투명
    const a = q < 0.22 ? 0.3 + 0.7 * ease.outQuad(q / 0.22) : Math.pow(1 - (q - 0.22) / 0.78, 1.4);
    // 방패 가운데를 기준으로 커지게 뒤쪽 줄도 조금 물림
    const cx = dashX(T_DASH) + SH.rx * 0.5 * (1 - k);
    if (layer !== "core") drawShield(p, C, "color", { cx, k, a, soft: true, fill: 0.2, thick: 1 + 0.4 * (k - 1) });
    if (layer !== "color") drawShield(p, C, "core", { cx, k, a: a * 0.5, soft: true, fill: 0 });
  }
}
