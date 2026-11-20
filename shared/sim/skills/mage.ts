// 마법사 스킬 — 프로토타입 v0.4.7 그대로 이식
// 캐스팅 중에는 이동 불가, 맞아도 안 끊김(슈퍼아머)
import { ELEMENTS, type Element } from '../../data/elements';
import { GIDUNG, HINT, MADAN_COEF, MAGE_SHOT, PADO, TELEPORT } from '../../data/classes';
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


export const MAGE: ClassSkills = {
  can: {
    haebang: (_w, p) => p.buffT <= 0 || '이미 해방 중',
    ssiat: (w, p) => !!w.nearestFront(p, HINT.ssiat.range) || '범위 안에 몬스터가 없어',
  },

  start: {
    basic(w, p) {
      const T = MAGE_SHOT.basic;
      p.action = {
        name: 'basic', t: 0, dur: T.dur,
        events: [{ at: T.shot, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 18, y: cy(p) - 4, vx: p.face * 520, vy: 0, range: 220, size: 14, coef: 0.6, elem: null, kb: 100, skill: 'basic' }); } }],
        update: () => { if (p.onGround) p.vx = 0; },
        end: () => { p.lockT = T.lock; },
      };
    },

    madan(w, p) {
      const el = w.elemOf(p, 'madan'), cm = castMult(p), T = MAGE_SHOT.madan;
      p.action = {
        name: 'cast', skill: 'madan', t: 0, dur: T.dur * cm, superArmor: true, cast: true, castEnd: T.shot * cm,
        events: [{ at: T.shot * cm, fn: () => { w.addProj(p, { kind: 'orb', x: cx(p) + p.face * 20, y: cy(p) - 4, vx: p.face * 640, vy: 0, range: 400, size: 18, coef: MADAN_COEF, elem: el, kb: 160, skill: 'madan' }); } }],
        update: () => { p.vx = 0; },
        end: () => { p.lockT = T.lock * cm; },
      };
    },

    /** 원소 기둥 = 마력 토네이도 (설치기): 내 앞 발밑에 생겨 잠시 머물며 범위 안 적을 연달아 때림 */
    gidung(w, p) {
      const G = GIDUNG, el = w.elemOf(p, 'gidung');
      castAction(p, 'gidung', G.cast, () => {
        const tx = Math.max(w.bounds.l + G.w / 2, Math.min(w.bounds.r - G.w / 2, cx(p) + p.face * G.dist)), by = p.y + p.h;
        // 토네이도 (World 가 tick 마다 때리고, 키를 한 번 더 누르면 움직임). 그림은 화면 쪽이 tornadoes 를 보고 붙임
        w.addTornado({ owner: p, x: tx, by, dir: 0, t: 0, life: G.time, tick: G.first, elem: el, color: color(el) });
        p.lockT = 0.3;
      });
    },

    /** 원소 파도: 앞으로 불길이 하나씩 나란히 생겨 타오르다 생긴 순서대로 사라짐 */
    pado(w, p) {
      const P = PADO, el = w.elemOf(p, 'pado'), c = color(el);
      castAction(p, 'pado', P.cast, () => {
        const face = p.face, px = cx(p), feet = p.y + p.h;
        p.lockT = (P.n - 1) * P.gap + 0.06;
        for (let i = 0; i < P.n; i++) {
          const x = face > 0 ? px + P.start + i * P.segW : px - P.start - (i + 1) * P.segW;
          const rect = { x, y: feet - P.h, w: P.segW, h: P.h };
          const hit = () => w.addHB(p, { abs: rect, coef: P.coef, elem: el, kb: P.kb, face, launch: P.launch, life: 0.06, light: true, skill: 'pado' });
          w.later(p, i * P.gap, () => {
            hit();
            w.fx({ kind: 'anim', anim: 'pado_flame', x: x + P.segW / 2, y: feet, face, color: c, hold: P.hold, life: P.hold + P.fade });
          });
          w.later(p, i * P.gap + P.tick, hit);
        }
      });
    },

    haebang(w, p) {
      castAction(p, 'haebang', 0.4, () => {
        // 쿨타임 60초는 버프가 끝난 뒤부터 (World 가 버프 끝날 때 건다)
        p.buffT = HAEBANG_TIME; p.cd.haebang = 0;
        w.float(cx(p), p.y - 30, '마력 해방!', '#c8b8ff', 22, 1.0);
      });
    },

    /** 텔레포트 (이동기): 사라졌다가 바라보는 방향(↑ 면 위)으로 나타남. 사라진 동안 무적 */
    teleport(w, p) {
      const T = TELEPORT, up = p.cmd.up, c = '#c8b8ff';
      const nx = up ? p.x : Math.max(w.bounds.l, Math.min(w.bounds.r - p.w, p.x + p.face * T.dist));
      const ny = up ? Math.max(w.bounds.top, p.y - T.up) : p.y;
      w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: c, r0: 26, r1: 4, life: 0.2 });
      w.fx({ kind: 'line', x1: cx(p), y1: cy(p), x2: nx + p.w / 2, y2: ny + p.h / 2, color: c, w: 2, life: 0.15 });
      p.action = {
        name: 'blink', skill: 'teleport', t: 0, dur: T.time, noGravity: true, inv: true,
        update: () => { p.vx = 0; p.vy = 0; },
        end: () => {
          p.x = nx; p.y = ny; p.vx = 0; p.vy = 0; p.onGround = false;
          p.invT = Math.max(p.invT, T.inv);
          w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: c, r0: 4, r1: 34, life: 0.25 });
        },
      };
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
