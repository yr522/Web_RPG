// 연금술 (2026-11-21, 개인 공방에서만 제작). 제작 창(J)에서 레시피를 골라 개수를 정하고 [제작].
// 재료는 [제작]을 누를 때 가져가고, 대기열 칸이 차례로 만들어짐 (실제 시간, 게임을 꺼도 진행).
// 한 칸(한 번 누른 개수 전부)이 다 돼야 [수령]으로 가방에 받음
export const ALCHEMY = {
  /** 대기열 칸 수 ([제작]을 누른 횟수 기준, 같은 물건도 따로 한 칸) */
  queueMax: 3,
  /** 한 번에 입력할 수 있는 최대 개수 */
  maxN: 99,
};

export interface AlchemyRecipe {
  id: string;
  /** 만들어지는 물건 */
  out: string;
  /** 재료 (최대 4종류, 1번부터 순서대로 칸에 채워짐). 개수 = 1개 만들 때 */
  mats: { item: string; n: number }[];
  /** 기본으로 같이 드는 것 (결과물 옆 작은 칸, 예: 빈 병) */
  base?: { item: string; n: number };
  /** 1개 만드는 데 걸리는 시간 (초) */
  time: number;
}

/** 2026-11-21 유저: 테스트 레시피. HP 포션의 슬라임 점액 → 푸른나비초 (2026-11-22) */
export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  { id: 'hp', out: 'hp', mats: [{ item: 'blue_herb', n: 1 }, { item: 'honey', n: 1 }], base: { item: 'empty_bottle', n: 1 }, time: 3 },
  { id: 'honey_shake', out: 'honey_shake', mats: [{ item: 'honey', n: 2 }], base: { item: 'empty_bottle', n: 1 }, time: 3 },
];
/** 재료 + 기본 재료 (필요 개수 계산용) */
export const recipeNeeds = (r: AlchemyRecipe) => (r.base ? [...r.mats, r.base] : r.mats);
export const alchemyRecipe = (id: string) => ALCHEMY_RECIPES.find(r => r.id === id) ?? null;

/** 제작할 수 있는 맵 (개인 공방) */
export const CRAFT_MAP = 'my_workshop';
