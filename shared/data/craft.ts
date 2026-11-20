// 대장장이 제작 (2026-11-21, 수치 임시): 재료 + 형판(쓰면 사라짐) + 골드를 맡기면 한 개씩 차례로 만들어 줌.
// 실제 시간으로 흐름 → 게임을 꺼 둬도 그동안 만든 만큼 완성. 다 된 것은 대장장이에게 가서 받음
export const CRAFT = {
  /** 1개 만드는 데 걸리는 시간 (초) */
  time: 30,
  /** 한 번에 맡길 수 있는 최대 개수 (만드는 중 + 기다리는 것 + 다 됐는데 안 받은 것) */
  queueMax: 10,
};

export interface RecipeDef {
  id: string;
  /** 만들어지는 물건 */
  out: string;
  /** 재료 (형판 포함, 맡길 때 가져감) */
  mats: { item: string; n: number }[];
  gold: number;
}

export const RECIPES: RecipeDef[] = [
  { id: 'ingot_rusty', out: 'ingot_rusty', mats: [{ item: 'scrap_rusty', n: 10 }, { item: 'mold_rusty', n: 1 }], gold: 50 },
  { id: 'ingot_iron', out: 'ingot_iron', mats: [{ item: 'scrap_good', n: 5 }, { item: 'mold_iron', n: 1 }], gold: 200 },
];
export const recipeDef = (id: string) => RECIPES.find(r => r.id === id) ?? null;

/** 대장장이가 파는 형판 */
export const SMITH_SHOP = ['mold_rusty', 'mold_iron'];

/** 강화에 드는 주괴: 지금 강화 수치(+0 ~ +14) → 주괴 종류·개수 (골드와 함께) */
export function enhanceIngot(lv: number): { item: string; n: number } {
  if (lv < 5) return { item: 'ingot_rusty', n: 1 };
  if (lv < 10) return { item: 'ingot_iron', n: 1 };
  return { item: 'ingot_iron', n: 2 };
}
/** 수리에 드는 주괴 (골드와 함께) */
export const REPAIR_INGOT = { item: 'ingot_iron', n: 1 };
