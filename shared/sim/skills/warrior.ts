// 검사(검사) 스킬 — 프로토타입 v0.4.7 그대로 이식
import { ELEMENTS, type Element } from '../../data/elements';
import { HINT, HOERYU, ILSEOM, MOVE_SKILL, WARRIOR_REACH as R } from '../../data/classes';
import { MONSTERS } from '../../data/monsters';
import type { PlayerAction, PlayerState } from '../entities';
import type { ClassSkills, SkillWorld } from './types';

const color = (e: Element | null) => (e ? ELEMENTS[e].color : '#dddddd');
const cx = (p: PlayerState) => p.x + p.w / 2;
const cy = (p: PlayerState) => p.y + p.h / 2;

export const WARRIOR_CAN: Record<string, (w: SkillWorld, p: PlayerState) => true | string> = {
  cheonbung: (_w, p) => p.cbWindow > 0 || '일섬→월참→질풍참→회류참 순서로 이어야 해!',
};

export const WARRIOR_START: Record<string, (w: SkillWorld, p: PlayerState, chain: boolean) => void> = {
  basic(w, p) {
    p.action = {
      name: 'basic', t: 0, dur: 0.2,
      events: [
        // 베기 그림 (임시 Smear): 0.04초마다 한 장, 판정이 나오는 0.08초에 휘두르는 장면
        { at: 0, fn: () => w.fx({ kind: 'anim', anim: 'smear_h1', x: cx(p), y: cy(p), face: p.face, owner: p.id, dx: 12, dy: -6, life: 0.2 }) },
        { at: 0.08, fn: () => w.addHB(p, { dx: -6, dy: -30, w: R.basicW, h: 52, coef: 0.6, elem: null, kb: 120, life: 0.06, skill: 'basic' }) },
      ],
      end: () => { p.lockT = 0.16; },
    };
  },

  ilseom(w, p, chain) {
    const el = w.elemOf(p, 'ilseom'), c = color(el);
    const hit = () => w.addHB(p, { dx: -6, dy: -46, w: R.ilseomW, h: 78, coef: ILSEOM.coef, elem: el, order: 0, chain, kb: 110, life: 0.06, skill: 'ilseom' });
    // 베기 그림 (ilseom_slash, 원소 색): 위→아래 한 번
    const slash = () => w.fx({ kind: 'anim', anim: 'ilseom_slash', x: cx(p), y: cy(p), face: p.face, owner: p.id, dx: 0, dy: 0, color: c, life: 0.27 });
    p.action = {
      name: 'ilseom', t: 0, dur: 0.24,
      events: [{ at: 0, fn: slash }, { at: 0.02, fn: hit }],
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
    const el = w.elemOf(p, 'jilpung'), sp = R.jilpung.speed;
    w.chainText(p, 'jilpung', chain);
    // 돌진 앞 바람 쐐기 (칸 가운데 50 과 몸 중심 27 의 차이 23 × 배율 3 = 69 에서 캐릭터 쪽으로 당김)
    w.fx({ kind: 'anim', anim: 'gale_dash', x: cx(p), y: cy(p), face: p.face, owner: p.id, dx: 48, dy: 0, color: color(el), life: 0.3 });
    p.action = {
      name: 'dash', skill: 'jilpung', t: 0, dur: R.jilpung.time, noGravity: true, inv: true,
      update: () => {
        p.vx = sp * p.face;
        p.vy = 0;
        w.fx({ kind: 'ghost', x: p.x, y: p.y, w: p.w, h: p.h, color: color(el), life: 0.18 });
      },
      // 연계(combo 3)는 그대로 두고 4식 회류참으로 이어 감
      end: () => { p.vx *= 0.25; },
    };
    w.addHB(p, { center: true, dx: 0, dy: 0, w: 84, h: 84, coef: MOVE_SKILL.jilpung.coef, elem: el, order: 2, chain, kb: 260, kbAng: 0, life: R.jilpung.time, skill: 'jilpung' });
  },

  /** 회류참 (4식): 땅에서 뒤로 물러나며 앞쪽을 넓게 긁어 몬스터를 내 앞으로 끌어모음. 이어서 천붕 */
  hoeryu(w, p, chain) {
    const H = HOERYU, el = w.elemOf(p, 'hoeryu'), c = color(el), face = p.face;
    w.chainText(p, 'hoeryu', chain);
    const feet = p.y + p.h;
    const rect = face > 0
      ? { x: p.x - H.behind, y: feet - H.h, w: H.behind + p.w + H.front, h: H.h + 20 }
      : { x: p.x - H.front, y: feet - H.h, w: H.front + p.w + H.behind, h: H.h + 20 };
    const inRect = (e: { x: number; y: number; w: number; h: number }) => e.x < rect.x + rect.w && e.x + e.w > rect.x && e.y < rect.y + rect.h && e.y + e.h > rect.y;
    // 끌어올 몬스터 (보스·허수아비는 제자리), 가까운 순
    const pulled = w.enemies
      .filter(e => !e.dead && !e.held && !MONSTERS[e.mob].boss && MONSTERS[e.mob].ai !== 'dummy' && inRect(e))
      .sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
    w.addHB(p, { abs: rect, coef: H.coef, elem: el, order: 3, chain, kb: 0, launch: -90, life: 0.05, face, skill: 'hoeryu' });
    // 파도 검기 + 발밑 먼지 (땅에 고정, 시작점에서 몸을 따라 그어짐). 칸 가운데 (88, 28) 와 기준점 (154, 50) 의 차이 × 배율 2
    w.fx({ kind: 'anim', anim: 'flow_slash', x: p.x + p.w / 2, y: feet, face, dx: -132, dy: -44, color: c, life: 0.47 });
    const act: PlayerAction = {
      name: 'hoeryu', t: 0, dur: H.time, inv: true,
      events: [{ at: 0.02, fn: () => {} }],
      update: dt => {
        p.face = face;
        p.vx = -face * H.back / H.time;
        w.fx({ kind: 'ghost', x: p.x, y: p.y, w: p.w, h: p.h, color: c, life: 0.15 });
        // 끌려오는 몬스터: 내 앞으로 모임 (겹치지 않게 조금씩 떨어져서)
        pulled.forEach((e, i) => {
          if (e.dead) return;
          const tx = p.x + p.w / 2 + face * (H.gather + i * 14) - e.w / 2;
          e.x += (tx - e.x) * Math.min(1, dt * 14);
          e.vx = 0; e.stun = Math.max(e.stun, 0.35); e.leap = 'none';
        });
      },
      end: () => {
        p.vx = 0;
        if (w.learned(p, 'cheonbung') && p.combo === 4) p.cbWindow = 1.2;
        p.combo = 0;
      },
    };
    p.action = act;
  },

  cheonbung(w, p, chain) {
    const el = w.elemOf(p, 'cheonbung'), c = color(el);
    p.cbWindow = 0;
    w.float(cx(p), p.y - 30, '오의 · 천붕!', c, 20, 0.9);
    // 연속 베기 그림 (모으기 1칸 + 베기 5칸, 몸 중심)
    w.fx({ kind: 'anim', anim: 'cheonbung', x: cx(p), y: cy(p), face: p.face, owner: p.id, dx: 0, dy: 0, color: c, life: 0.67 });
    const events = [];
    for (let i = 0; i < 5; i++) {
      events.push({
        at: 0.06 + i * 0.11, fn: () => {
          w.addHB(p, { center: true, dx: 0, dy: 0, w: R.cheonbung.w, h: R.cheonbung.h, coef: 1.1, elem: el, order: 4, chain, kb: i === 4 ? 260 : 60, launch: i === 4 ? -380 : -90, life: 0.05, skill: 'cheonbung' });
          if (i === 4) w.fx({ kind: 'ring', x: cx(p), y: cy(p), color: c, r0: 20, r1: R.cheonbung.w * 0.55, life: 0.4 });
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
