// 낮밤 하늘색 (프로토타입 v0.4.7 그대로). 바뀌기 직전 7% 구간에서 부드럽게 섞인다.
import { timeInfo, type DayPhase } from '@shared/sim/clock';

interface Pal { top: number; mid: number; bot: number; castle: number; hill: number; win: number; stars: number; orb: number; orbY: number }
const PAL: Pal[] = [
  { top: 0x4a5fa8, mid: 0xe79a6b, bot: 0xf3cf9a, castle: 0x3d3466, hill: 0x4c3f6a, win: 0.25, stars: 0.05, orb: 0xffb066, orbY: 150 },
  { top: 0x3a86d8, mid: 0x86c3f0, bot: 0xcfe8ff, castle: 0x6f80a8, hill: 0x5a8a5c, win: 0.0, stars: 0, orb: 0xfff2a8, orbY: 75 },
  { top: 0x141238, mid: 0x2a2160, bot: 0x3b2d5c, castle: 0x1d1846, hill: 0x231c45, win: 0.55, stars: 0.75, orb: 0xf4f0c8, orbY: 90 },
];

const mix = (a: number, b: number, f: number) => {
  const ch = (c: number, s: number) => (c >> s) & 255;
  let out = 0;
  for (const s of [16, 8, 0]) out |= Math.round(ch(a, s) + (ch(b, s) - ch(a, s)) * f) << s;
  return out;
};

export type Palette = Pal & { phase: DayPhase };

export function palette(ms: number): Palette {
  const ti = timeInfo(ms), a = PAL[ti.phase], b = PAL[(ti.phase + 1) % 3];
  const f = ti.frac > 0.93 ? (ti.frac - 0.93) / 0.07 : 0;
  return {
    phase: ti.phase,
    top: mix(a.top, b.top, f), mid: mix(a.mid, b.mid, f), bot: mix(a.bot, b.bot, f),
    castle: mix(a.castle, b.castle, f), hill: mix(a.hill, b.hill, f), orb: mix(a.orb, b.orb, f),
    win: a.win + (b.win - a.win) * f, stars: a.stars + (b.stars - a.stars) * f, orbY: a.orbY + (b.orbY - a.orbY) * f,
  };
}
