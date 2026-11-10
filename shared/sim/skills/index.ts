// 직업별 스킬 모음
import type { ClassId } from '../../data/classes';
import type { ClassSkills } from './types';
import { WARRIOR } from './warrior';
import { MAGE } from './mage';
import { ARCHER } from './archer';

export const CLASS_SKILLS: Record<ClassId, ClassSkills> = { warrior: WARRIOR, mage: MAGE, archer: ARCHER };
