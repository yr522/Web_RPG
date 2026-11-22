// 주먹질 (2026-11-22): 맞는 무기를 안 끼면 Z(기본 공격)가 이것으로 바뀜. 세 직업 공통, 공격력은 근력으로 (stats.punchAtk)
// 판정·시간은 검사 기본 공격과 같고, 그림은 검사 공격 모션 (PlayerAvatar)
import { PUNCH, WARRIOR_REACH as R } from '../../data/classes';
import type { PlayerState } from '../entities';
import type { SkillWorld } from './types';

export function startPunch(w: SkillWorld, p: PlayerState) {
  p.action = {
    name: 'punch', t: 0, dur: PUNCH.dur,
    events: [{ at: PUNCH.hitAt, fn: () => w.addHB(p, { dx: -6, dy: -30, w: R.basicW, h: 52, coef: PUNCH.coef, elem: null, kb: 120, life: 0.06, skill: 'punch' }) }],
    end: () => { p.lockT = PUNCH.lock; },
  };
}
