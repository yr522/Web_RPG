// 마법사 스킬 — 프로토타입 v0.4.7 그대로 이식
// 캐스팅 중에는 이동 불가, 맞아도 안 끊김(슈퍼아머)
import { ELEMENTS, type Element } from '../../data/elements';
import { HINT, MAGE_RECOIL, MAGE_SHOT } from '../../data/classes';
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
    ssiat: (w, p) => !!w.nearestFront(p, HINT.ssiat.range) || '범위 안에 몬스터가 없어',
  },

  start: {
    basic(w, p) {
      const T = MAGE_SHOT.basic;
      p.action = {
        name: 'basic', t: 0, dur: T.dur,
        events: [{ at: T.shot, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 18, y: cy(p) - 4, vx: p.face * 520, vy: 0, range: 220, size: 14, coef: 0.6, elem: null, kb: 100, skill: 'basic' }); recoil(p); } }],
        update: () => { if (p.onGround) p.vx = 0; },
        end: () => { p.lockT = T.lock; },
      };
    },

    madan(w, p) {
      const el = w.elemOf(p, 'madan'), cm = castMult(p), T = MAGE_SHOT.madan;
      p.action = {
        name: 'cast', skill: 'madan', t: 0, dur: T.dur * cm, superArmor: true, cast: true, castEnd: T.shot * cm,
        events: [{ at: T.shot * cm, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 20, y: cy(p) - 4, vx: p.face * 640, vy: 0, range: 400, size: 18, coef: 1.3, elem: el, kb: 160, skill: 'madan' }); recoil(p); } }],
        update: () => { p.vx = 0; },
        end: () => { p.lockT = T.lock * cm; },
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

    // ---------- 힌트 스킬 ----------
    /** 마력 씨앗 (2라인 빛술사 힌트): 앞쪽 가장 가까운 적 1명에게 심음 → 그 적이 죽거나 일정 피해를 받으면 터지며 MP 회복 */
    ssiat(w, p) {
      const el = w.elemOf(p, 'ssiat'), c = color(el), t = w.nearestFront(p, HINT.ssiat.range)!;
      castAction(p, 'ssiat', 0.3, () => {
        p.lockT = 0.2;
        if (t.dead) return;
        w.addHB(p, { abs: { x: t.x, y: t.y, w: t.w, h: t.h }, coef: HINT.ssiat.coef, elem: el, kb: 0, launch: -80, life: 0.05, light: true, skill: 'ssiat' });
        w.fx({ kind: 'line', x1: cx(p) + p.face * 16, y1: cy(p) - 6, x2: t.x + t.w / 2, y2: t.y + t.h / 2, color: c, w: 2, life: 0.2 });
        w.fx({ kind: 'ring', x: t.x + t.w / 2, y: t.y + t.h / 2, color: c, r0: 30, r1: 6, life: 0.3 });
      });
    },

    /** 궤도탄 (3라인 마도학자 힌트): 몸 주위를 도는 마력구가 가까운 적에게 하나씩 유도돼 꽂힘 */
    gwedo(w, p) {
      const H = HINT.gwedo, el = w.elemOf(p, 'gwedo');
      castAction(p, 'gwedo', 0.3, () => {
        p.lockT = 0.2;
        for (let i = 0; i < H.n; i++) {
          const o = w.addProj(p, { kind: 'orb', x: cx(p), y: cy(p), vx: H.speed, vy: 0, range: 900, size: 14, coef: H.coef, elem: el, kb: 90, skill: 'gwedo' });
          o.orbit = { ang: (i / H.n) * Math.PI * 2, t: H.orbit, wait: i * H.gap };
        }
      });
    },
  },

  walk: {},
  auto: ['basic', 'madan'],
};
