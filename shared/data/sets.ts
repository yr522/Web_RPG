// 세트 장비 (2026-11-21): 같은 세트 장비를 n 개 이상 끼면 효과가 켜짐. 같은 장비 2개(반지 2칸 등)는 1개로 셈
import type { BonusId } from './items';

export interface GearSet {
  name: string;
  /** 세트에 드는 장비 id. 배열 칸 = 그중 아무거나 하나 (직업별 무기 등) */
  items: (string | string[])[];
  /** n 개 이상 끼면 켜지는 효과 (n 오름차순) */
  effects: { n: number; bonus: Partial<Record<BonusId, number>> }[];
}

export const GEAR_SETS: Record<string, GearSet> = {
  slime: { name: '슬라임 세트', items: ['slime_armor', 'slime_ring'], effects: [{ n: 2, bonus: { def: 5 } }] },
  golem: { name: '마법 골렘 세트', items: [['golem_sword', 'golem_staff', 'golem_bow'], 'golem_gloves'], effects: [{ n: 2, bonus: { atk: 5, boss: 10 } }] },
};

/** 이 장비가 드는 세트 id (없으면 null) */
export const setOf = (item: string) => Object.keys(GEAR_SETS).find(k => GEAR_SETS[k].items.some(i => i === item || (Array.isArray(i) && i.includes(item)))) ?? null;
/** 세트 칸 하나를 끼고 있는지 */
export const setPartWorn = (part: string | string[], worn: string[]) => (Array.isArray(part) ? part.some(i => worn.includes(i)) : worn.includes(part));
/** 세트에서 끼고 있는 칸 수 */
export const setCount = (set: string, worn: string[]) => GEAR_SETS[set].items.filter(i => setPartWorn(i, worn)).length;
