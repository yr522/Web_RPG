// 직업별 스킬 모음
import type { ClassId } from '../../data/classes';
import type { ClassSkills } from './types';
import { WARRIOR } from './warrior';
import { MAGE } from './mage';
import { ARCHER } from './archer';

import { startPunch } from './punch';

// 주먹질은 세 직업 공통 (누르고 있으면 연타, 공격 중 이동 가능)
for (const cs of [WARRIOR, MAGE, ARCHER]) {
  cs.start.punch = startPunch;
  cs.auto.push('punch');
  cs.walk.punch = 1;
}

export const CLASS_SKILLS: Record<ClassId, ClassSkills> = { warrior: WARRIOR, mage: MAGE, archer: ARCHER };
