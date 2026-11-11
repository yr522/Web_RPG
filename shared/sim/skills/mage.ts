// 마법사 스킬 — 프로토타입 v0.4.7 그대로 이식
// 캐스팅 중에는 이동 불가, 맞아도 안 끊김(슈퍼아머)
import { ELEMENTS, type Element } from '../../data/elements';
import { MAGE_RECOIL } from '../../data/classes';
import type { PlayerState } from '../entities';
import type { ClassSkills } from './types';

const color = (e: Element | null) => (e ? ELEMENTS[e].color : '#dddddd');
const cx = (p: PlayerState) => p.x + p.w / 2;
const cy = (p: PlayerState) => p.y + p.h / 2;

/** 마력 해방 버프 시간 (초) */
export const HAEBANG_TIME = 10;
/** 마력 해방 중: 캐스팅 시간 배율 */
export const castMult = (p: PlayerState) => (p.buffT > 0 ? 0.5 : 1);

/** 캐스팅이 끝나면 onCast */
function castAction(p: PlayerState, name: string, time: number, onCast: () => void) {
  p.action = { name: 'cast', skill: name, t: 0, dur: time * castMult(p), superArmor: true, cast: true, update: () => { p.vx = 0; }, end: onCast };
}

/** 기본 공격 반동: 쏘는 순간(공격 그림 2번째 칸) 바라보는 반대쪽으로 밀려남 */
const recoil = (p: PlayerState) => { p.push = -p.face * MAGE_RECOIL.dist; };

const GIDUNG_RANGE = 460;

export const MAGE: ClassSkills = {
  can: {
    gidung: (w, p) => !!w.nearestFront(p, GIDUNG_RANGE) || '범위 안에 몬스터가 없어',
    haebang: (_w, p) => p.buffT <= 0 || '이미 해방 중',
  },

  start: {
    basic(w, p) {
      p.action = {
        name: 'basic', t: 0, dur: 0.2,
        events: [{ at: 0.08, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 18, y: cy(p) - 4, vx: p.face * 520, vy: 0, range: 220, size: 14, coef: 0.6, elem: null, kb: 100, skill: 'basic' }); recoil(p); } }],
        update: () => { if (p.onGround) p.vx = 0; },
        end: () => { p.lockT = 0.2; },
      };
    },

    madan(w, p) {
      const el = w.elemOf(p, 'madan'), cm = castMult(p);
      p.action = {
        name: 'cast', skill: 'madan', t: 0, dur: 0.22 * cm, superArmor: true, cast: true, castEnd: 0.18 * cm,
        events: [{ at: 0.18 * cm, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 20, y: cy(p) - 4, vx: p.face * 640, vy: 0, range: 400, size: 18, coef: 1.3, elem: el, kb: 160, skill: 'madan' }); recoil(p); } }],
        update: () => { p.vx = 0; },
        end: () => { p.lockT = 0.28 * cm; },
      };
    },

    gidung(w, p) {
      const el = w.elemOf(p, 'gidung'), t = w.nearestFront(p, GIDUNG_RANGE)!;
      let tx = t.x + t.w / 2, by = t.y + t.h;
      castAction(p, 'gidung', 0.5, () => {
        // 캐스팅 동안 몬스터가 움직였으면 따라간다 (죽었으면 처음 자리)
        if (!t.dead) { tx = t.x + t.w / 2; by = t.y + t.h; }
        const rect = { x: tx - 38, y: by - 220, w: 76, h: 220 };
        w.fx({ kind: 'pillar', x: tx, by, w: 76, h: 220, color: color(el), life: 0.55 });
        for (let i = 0; i < 3; i++) {
          w.later(p, i * 0.12, () => w.addHB(p, { abs: rect, coef: 1.3, elem: el, kb: 0, launch: i === 2 ? -460 : -160, life: 0.05, light: i < 2, skill: 'gidung' }));
        }
        p.lockT = 0.3;
      });
    },

    pado(w, p) {
      const el = w.elemOf(p, 'pado'), c = color(el);
      castAction(p, 'pado', 0.6, () => {
        const face = p.face, px = cx(p), feet = p.y + p.h, segW = 62;
        p.lockT = 7 * 0.055 + 0.06;
        for (let i = 0; i < 8; i++) {
          w.later(p, i * 0.055, () => {
            const x = face > 0 ? px + 24 + i * segW : px - 24 - (i + 1) * segW;
            w.addHB(p, { abs: { x, y: feet - 60, w: segW, h: 60 }, coef: 1.5, elem: el, kb: 80, face, launch: -220, life: 0.06, light: true, skill: 'pado' });
            w.fx({ kind: 'flame', x, y: feet, w: segW, h: 60, color: c, life: 0.45 });
          });
        }
      });
    },

    haebang(w, p) {
      castAction(p, 'haebang', 0.4, () => {
        // 쿨타임 60초는 버프가 끝난 뒤부터 (World 가 버프 끝날 때 건다)
        p.buffT = HAEBANG_TIME; p.cd.haebang = 0;
        w.float(cx(p), p.y - 30, '마력 해방!', '#c8b8ff', 22, 1.0);
        w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: '#c8b8ff', r0: 10, r1: 120, life: 0.5 });
      });
    },
  },

  walk: {},
  auto: ['basic', 'madan'],
};
