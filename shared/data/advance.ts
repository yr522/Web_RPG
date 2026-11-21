// 전직 (2026-11-21 뼈대): 교수님 퀘스트 메뉴에서 전직 시험(adv)을 받고, 다 하면 교수님께 보고하면서 3갈래 중 하나를 고름.
// 고른 갈래는 플래그 adv_line (1·2·3, 0 = 전직 전). 갈래 이름·원소는 document/스킬트리_v0.1.md 1장. 전직 스킬은 아직 없음
import type { ClassId } from './classes';
import type { Element } from './elements';

/** 전직 시험을 받을 수 있는 레벨 (임시) */
export const ADVANCE = { level: 15, quest: 'adv', flag: 'adv_line' };

export interface AdvanceLine { name: string; elems: Element[] }

/** 직업별 전직 갈래 (1·2·3라인 순서) */
export const ADVANCE_LINES: Record<ClassId, AdvanceLine[]> = {
  warrior: [
    { name: '사무라이', elems: ['fire', 'light'] },
    { name: '암살자', elems: ['dark', 'water'] },
    { name: '수호기사', elems: ['water', 'light'] },
  ],
  mage: [
    { name: '원소술사', elems: ['fire', 'water', 'earth', 'light', 'dark'] },
    { name: '빛술사', elems: ['light', 'earth'] },
    { name: '마도학자', elems: ['water', 'dark'] },
  ],
  archer: [
    { name: '엘프 궁수', elems: ['earth', 'water'] },
    { name: '인간의 길', elems: ['fire', 'earth'] },
    { name: '일식 사수', elems: ['light', 'dark'] },
  ],
};
