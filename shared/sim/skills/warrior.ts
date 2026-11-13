// 검사(검사) 스킬 — 프로토타입 v0.4.7 그대로 이식
import { ELEMENTS, type Element } from '../../data/elements';
import { HINT } from '../../data/classes';
import type { PlayerState } from '../entities';
import type { ClassSkills, SkillWorld } from './types';

const color = (e: Element | null) => (e ? ELEMENTS[e].color : '#dddddd');
const cx = (p: PlayerState) => p.x + p.w / 2;
const cy = (p: PlayerState) => p.y + p.h / 2;

export const WARRIOR_CAN: Record<string, (w: SkillWorld, p: PlayerState) => true | string> = {
  cheonbung: (_w, p) => p.cbWindow > 0 || '일섬→월참→질풍참 순서로 이어야 해!',
};

export const WARRIOR_START: Record<string, (w: SkillWorld, p: PlayerState, chain: boolean) => void> = {
  basic(w, p) {
    p.action = {
      name: 'basic', t: 0, dur: 0.2,
      events: [{
        at: 0.08, fn: () => {
          w.addHB(p, { dx: -6, dy: -30, w: 52, h: 52, coef: 0.6, elem: null, kb: 120, life: 0.06, skill: 'basic' });
          w.fx({ kind: 'arc', x: cx(p) + p.face * 8, y: cy(p), face: p.face, r: 30, a0: -0.8, a1: 0.8, color: '#dddddd', w: 5, life: 0.12 });
        },
      }],
      end: () => { p.lockT = 0.16; },
    };
  },

  ilseom(w, p, chain) {
    const el = w.elemOf(p, 'ilseom'), c = color(el);
    const hit = (i: number) => {
      w.addHB(p, { dx: -10, dy: -44, w: 88, h: 74, coef: 1.0, elem: el, order: 0, chain, kb: 110, life: 0.06, skill: 'ilseom' });
      w.fx({ kind: 'arc', x: cx(p) + p.face * 6, y: cy(p) - 4, face: p.face, r: i ? 50 : 58, a0: i ? 0.9 : -1.2, a1: i ? -1.2 : 0.9, color: c, w: 7, life: 0.14 });
    };
    p.action = {
      name: 'ilseom', t: 0, dur: 0.24,
      events: [{ at: 0.02, fn: () => hit(0) }, { at: 0.15, fn: () => hit(1) }],
      end: () => { p.lockT = 0.18; },
      update: () => { p.vx = p.onGround ? p.face * 40 : p.cmd.move * 130; },
    };
  },

  wolcham(w, p, chain) {
    const el = w.elemOf(p, 'wolcham'), c = color(el), up = p.cmd.up;
    w.chainText(p, 'wolcham', chain);
    if (up && p.onGround) p.vy = -330;
    p.action = {
      name: 'wolcham', t: 0, dur: 0.26, superArmor: true,
      events: [{
        at: 0.05, fn: () => {
          if (up) {
            w.addHB(p, { dx: -16, dy: -112, w: 86, h: 134, coef: 1.6, elem: el, order: 1, chain, kb: 50, launch: -620, life: 0.08, skill: 'wolcham' });
            w.fx({ kind: 'arc', x: cx(p), y: cy(p) - 20, face: p.face, r: 72, a0: 1.1, a1: -1.9, color: c, w: 11, life: 0.2 });
          } else {
            w.addHB(p, { dx: -6, dy: -50, w: 114, h: 88, coef: 1.8, elem: el, order: 1, chain, kb: 320, life: 0.08, skill: 'wolcham' });
            w.fx({ kind: 'arc', x: cx(p), y: cy(p) - 4, face: p.face, r: 78, a0: -1.4, a1: 1.4, color: c, w: 12, life: 0.2 });
          }
        },
      }],
      update: () => { if (p.onGround) p.vx = p.face * 30; },
    };
  },

  jilpung(w, p, chain) {
    // 바라보는 방향으로 곧장 돌진 (각도 조절 없음 — 궁수 사슬 화살과 차별화)
    const el = w.elemOf(p, 'jilpung'), sp = 1000;
    w.chainText(p, 'jilpung', chain);
    p.action = {
      name: 'dash', skill: 'jilpung', t: 0, dur: 0.22, noGravity: true, inv: true,
      update: () => {
        p.vx = sp * p.face;
        p.vy = 0;
        w.fx({ kind: 'ghost', x: p.x, y: p.y, w: p.w, h: p.h, color: color(el), life: 0.18 });
      },
      end: () => {
        p.vx *= 0.25;
        if (w.learned(p, 'cheonbung') && p.combo === 3) p.cbWindow = 1.2;
        p.combo = 0;
      },
    };
    w.addHB(p, { center: true, dx: 0, dy: 0, w: 84, h: 84, coef: 2.4, elem: el, order: 2, chain, kb: 260, kbAng: 0, life: 0.22, skill: 'jilpung' });
  },

  cheonbung(w, p, chain) {
    const el = w.elemOf(p, 'cheonbung'), c = color(el);
    p.cbWindow = 0;
    w.float(cx(p), p.y - 30, '오의 · 천붕!', c, 20, 0.9);
    const events = [];
    for (let i = 0; i < 5; i++) {
      events.push({
        at: 0.06 + i * 0.11, fn: () => {
          w.addHB(p, { center: true, dx: 0, dy: 0, w: 270, h: 170, coef: 1.1, elem: el, order: 3, chain, kb: i === 4 ? 260 : 60, launch: i === 4 ? -380 : -90, life: 0.05, skill: 'cheonbung' });
          for (let j = 0; j < 3; j++) {
            const ang = w.rng() * Math.PI, len = 130 + w.rng() * 40;
            const mx = cx(p) + (w.rng() - 0.5) * 160, my = cy(p) + (w.rng() - 0.5) * 80;
            w.fx({ kind: 'line', x1: mx - Math.cos(ang) * len / 2, y1: my - Math.sin(ang) * len / 2, x2: mx + Math.cos(ang) * len / 2, y2: my + Math.sin(ang) * len / 2, color: c, w: 5, life: 0.16 });
          }
          if (i === 4) w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: c, r0: 20, r1: 160, life: 0.4 });
        },
      });
    }
    p.action = { name: 'cheonbung', t: 0, dur: 0.58, noGravity: true, inv: true, events, update: () => { p.vx = 0; p.vy = 0; } };
  },
};

// ---------- 힌트 스킬 ----------
/** 혈섬 (2라인 암살자 힌트): 빠른 베기 + 출혈 */
WARRIOR_START.hyeolseom = (w, p) => {
  const el = w.elemOf(p, 'hyeolseom'), c = color(el);
  p.action = {
    name: 'hyeolseom', t: 0, dur: 0.22,
    events: [{
      at: 0.05, fn: () => {
        w.addHB(p, { dx: -6, dy: -46, w: 104, h: 80, coef: HINT.hyeolseom.coef, elem: el, kb: 140, life: 0.06, skill: 'hyeolseom' });
        w.fx({ kind: 'arc', x: cx(p) + p.face * 4, y: cy(p) - 2, face: p.face, r: 64, a0: -1.0, a1: 1.0, color: c, w: 6, life: 0.16 });
        w.fx({ kind: 'arc', x: cx(p) + p.face * 10, y: cy(p) - 2, face: p.face, r: 52, a0: -0.8, a1: 0.8, color: '#d04050', w: 3, life: 0.2 });
      },
    }],
    end: () => { p.lockT = 0.16; },
    update: () => { if (p.onGround) p.vx = p.face * 30; },
  };
};

/** 흘려베기 (3라인 수호기사 힌트): 받아내기 자세 → 받은 피해에 비례한 베기 */
WARRIOR_START.heullyeo = (w, p) => {
  const H = HINT.heullyeo, el = w.elemOf(p, 'heullyeo'), c = color(el);
  const guard = { taken: 0 };
  w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: c, r0: 40, r1: 30, life: 0.25 });
  p.action = {
    name: 'guard', skill: 'heullyeo', t: 0, dur: H.guard, superArmor: true, guard,
    update: () => { p.vx = 0; },
    end: () => {
      const coef = Math.min(H.maxCoef, H.coef + H.perHp * guard.taken / p.stats.maxHp);
      const big = coef > H.coef;
      p.action = {
        name: 'heullyeo', t: 0, dur: 0.24, superArmor: true,
        events: [{
          at: 0.04, fn: () => {
            w.addHB(p, { dx: -10, dy: -60, w: big ? 150 : 124, h: 104, coef, elem: el, kb: 320, life: 0.08, skill: 'heullyeo' });
            w.fx({ kind: 'arc', x: cx(p), y: cy(p) - 4, face: p.face, r: big ? 96 : 80, a0: 1.4, a1: -1.4, color: c, w: big ? 16 : 11, life: 0.22 });
          },
        }],
        update: () => { p.vx = 0; },
        end: () => { p.lockT = 0.2; },
      };
    },
  };
};

export const WARRIOR: ClassSkills = {
  can: WARRIOR_CAN,
  start: WARRIOR_START,
  walk: { basic: 1, ilseom: 1, wolcham: 1, cheonbung: 1, hyeolseom: 1 },
  auto: ['basic', 'ilseom'],
};
