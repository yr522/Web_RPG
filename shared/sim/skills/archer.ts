// 궁수 스킬 — 프로토타입 v0.4.7 그대로 이식
// 기본 공격·마법 화살: 꾹 눌러 충전 → 떼면 발사
import { ELEMENTS, type Element } from '../../data/elements';
import { GROUND_Y } from '../../data/maps';
import type { PlayerAction, PlayerState } from '../entities';
import type { ClassSkills, SkillWorld } from './types';

const color = (e: Element | null) => (e ? ELEMENTS[e].color : '#dddddd');
const cx = (p: PlayerState) => p.x + p.w / 2;
const cy = (p: PlayerState) => p.y + p.h / 2;

/** 꾹 눌러 충전하는 스킬 */
export const CHARGE_SKILLS = ['basic', 'hwasal'];
/** 충전 화면: 이 시간까지는 활을 당기기 시작하는 그림 */
export const DRAW_START_TIME = 0.12;

/**
 * 충전 → 떼면 발사 (power 1 = 마법 화살, 0.6 = 기본 공격).
 * 직전 화살을 쏜 직후에 눌러도 바로 당기기 시작하지만, 발사는 원래 쉬는 시간이 지난 뒤에만 된다.
 */
function chargeShot(w: SkillWorld, p: PlayerState, name: string, el: Element | null, power: number) {
  const prev = p.action;
  const minT = (prev && prev.name === 'recover' ? prev.dur - prev.t : 0) + p.lockT;
  p.lockT = 0;
  const act: PlayerAction = {
    name: 'charge', skill: name, elem: el, t: 0, dur: 6, g: 0, released: false, minT,
    update: () => {
      const a = act;
      if (!a.released) {
        a.g = Math.min(1, a.t / 1.0);
        if (!w.held(p, name)) a.released = true;
      }
      // 당기는 중에는 방향 고정 (뒤로 걸으며 거리 조절해도 앞으로 쏜다)
      if (a.released && a.t >= a.minT!) a.dur = a.t;
    },
    end: () => {
      const g = act.g ?? 0;
      w.addProj(p, {
        kind: 'arrow', x: cx(p) + p.face * 18, y: cy(p) - 6, vx: p.face * (520 + 900 * g), vy: 0, range: 110 + 690 * g, size: 14, len: 26 + 14 * g,
        coef: (0.8 + 2.4 * g) * power, elem: el, kb: 80 + 220 * g, skill: name,
      });
      if (g >= 1) w.float(cx(p), p.y - 26, '최대 충전!', color(el), 14, 0.6);
      p.action = { name: 'recover', t: 0, dur: 0.08 };
      p.lockT = 0.22;
    },
  };
  p.action = act;
}

/** 꾹 누르고 ↑↓ 로 부채꼴 조준 → 떼면 onFire(각도) */
function aimAction(w: SkillWorld, p: PlayerState, name: string, maxAng: number, onFire: (ang: number) => void) {
  const act: PlayerAction = {
    name: 'aim', skill: name, elem: w.elemOf(p, name), t: 0, dur: 1.6, ang: 0, noGravity: true, maxAng,
    update: dt => {
      const a = act;
      p.vx = 0; p.vy = 0;
      if (p.cmd.move) p.face = p.cmd.move;
      if (a.t > 0.12) {
        if (p.cmd.up) a.ang = Math.max(-maxAng, a.ang! - 2.2 * dt);
        if (p.cmd.down) a.ang = Math.min(maxAng, a.ang! + 2.2 * dt);
      }
      if (!w.held(p, name)) a.dur = a.t;
    },
    end: () => {
      const ang = act.ang;
      onFire(Number.isFinite(ang) ? ang! : 0);
    },
  };
  p.action = act;
}

/** 사슬 화살이 날아가는 중 한 번 더 누르면: 화살 위치(허공)로 끌려감 */
export function startGrapple(w: SkillWorld, p: PlayerState) {
  const a = p.chainArrow;
  if (!a || a.dead) return;
  const tx = a.x, ty = a.y;
  a.dead = true; p.chainArrow = null; p.lockT = 0;
  p.ropeTo = { x: tx, y: ty };
  const act: PlayerAction = {
    name: 'grapple', t: 0, dur: 0.7, noGravity: true, inv: true,
    update: () => {
      const dx = tx - cx(p), dy = ty - cy(p), d = Math.hypot(dx, dy);
      if (d < 22) { act.dur = act.t; return; }
      p.vx = dx / d * 1400; p.vy = dy / d * 1400;
      w.fx({ kind: 'ghost', x: p.x, y: p.y, w: p.w, h: p.h, color: '#ccffee', life: 0.15 });
    },
    end: () => { p.vx *= 0.3; p.vy = Math.min(p.vy * 0.3, -200); },
  };
  p.action = act;
}

export const ARCHER: ClassSkills = {
  can: {},

  start: {
    basic(w, p) { chargeShot(w, p, 'basic', null, 0.6); },
    hwasal(w, p) { chargeShot(w, p, 'hwasal', w.elemOf(p, 'hwasal'), 1); },

    sasl(w, p) {
      aimAction(w, p, 'sasl', 1.1, ang => {
        const el = w.elemOf(p, 'sasl'), sp = 1150;
        p.chainArrow = w.addProj(p, {
          kind: 'chain', x: cx(p), y: cy(p) - 4, vx: Math.cos(ang) * sp * p.face, vy: Math.sin(ang) * sp, range: 540, size: 18, len: 34,
          coef: 2.0, elem: el, kb: 160, pierce: true, skill: 'sasl',
        });
        p.lockT = 540 / sp;
        p.action = { name: 'recover', t: 0, dur: 0.1, noGravity: true, update: () => { p.vx = 0; p.vy = 0; } };
      });
    },

    soyong(w, p) {
      const el = w.elemOf(p, 'soyong'), c = color(el);
      p.action = {
        name: 'draw', skill: 'soyong', elem: el, t: 0, dur: 0.24, superArmor: true, update: () => { p.vx = 0; },
        end: () => {
          const vx = cx(p) + p.face * 270, vy = cy(p) - 6;
          w.addVortex(p, { x: vx, y: vy, t: 0, life: 1.0, r: 210, color: c });
          p.lockT = 0.4 + 0.25;
          w.later(p, 0.4, () => {
            const sx = cx(p), sy = cy(p) - 6, dx = vx - sx, dy = vy - sy, d = Math.hypot(dx, dy) || 1;
            w.addProj(p, { kind: 'big', x: sx, y: sy, vx: dx / d * 1300, vy: dy / d * 1300, range: d + 200, size: 40, len: 54, coef: 3.2, elem: el, kb: 300, pierce: true, skill: 'soyong' });
          });
        },
      };
    },

    hwasalbi(w, p) {
      const el = w.elemOf(p, 'hwasalbi'), c = color(el);
      p.action = {
        name: 'draw', skill: 'hwasalbi', elem: el, t: 0, dur: 0.24, superArmor: true, update: () => { p.vx = 0; },
        end: () => {
          const zx = cx(p) + p.face * 230;
          p.lockT = 0.35 + 6 * 0.1 + 0.05;
          w.fx({ kind: 'line', x1: cx(p), y1: cy(p), x2: cx(p) + p.face * 40, y2: -20, color: c, w: 3, life: 0.25 });
          w.later(p, 0.35, () => w.fx({ kind: 'zone', x: zx - 160, w: 320, color: c, life: 0.8 }));
          for (let i = 0; i < 7; i++) {
            w.later(p, 0.35 + i * 0.1, () => {
              w.addHB(p, { abs: { x: zx - 160, y: 0, w: 320, h: GROUND_Y }, coef: 0.75, elem: el, kb: 20, launch: -60, life: 0.05, light: true, face: 1, skill: 'hwasalbi' });
              for (let j = 0; j < 6; j++) {
                const x = zx - 160 + w.rng() * 320, y = 80 + w.rng() * (GROUND_Y - 140);
                w.fx({ kind: 'line', x1: x, y1: y - 50, x2: x, y2: y + 10, color: c, w: 2, life: 0.15 });
              }
            });
          }
        },
      };
    },
  },

  // 충전하면서 걸으면 조금 느려진다
  walk: { charge: 0.8, recover: 1, draw: 1 },
  auto: [],
};
