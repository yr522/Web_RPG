// 연금술 (2026-11-21, 개인 공방에서만 제작). 제작 창(J)에서 레시피를 골라 개수를 정하고 [제작].
// 재료는 [제작]을 누를 때 가져가고, 대기열에서 한 개씩 차례로 만들어져 가방에 들어감 (실제 시간, 게임을 꺼도 진행)
export const ALCHEMY = {
  /** 대기열 칸 수 ([제작]을 누른 횟수 기준, 같은 물건도 따로 한 칸) */
  queueMax: 3,
  /** 1개 만드는 데 걸리는 시간 (초, 임시) */
  time: 3,
  /** 한 번에 입력할 수 있는 최대 개수 */
  maxN: 99,
};

export interface AlchemyRecipe {
  id: string;
  /** 만들어지는 물건 */
  out: string;
  /** 재료 (최대 4종류, 1번부터 순서대로 칸에 채워짐). 개수 = 1개 만들 때 */
  mats: { item: string; n: number }[];
}

/** 2026-11-21 유저: 테스트 레시피 */
export const ALCHEMY_RECIPES: AlchemyRecipe[] = [
  { id: 'hp', out: 'hp', mats: [{ item: 'slime_gel', n: 1 }, { item: 'honey', n: 1 }] },
  { id: 'honey_shake', out: 'honey_shake', mats: [{ item: 'honey', n: 2 }] },
];
export const alchemyRecipe = (id: string) => ALCHEMY_RECIPES.find(r => r.id === id) ?? null;

/** 제작할 수 있는 맵 (개인 공방) */
export const CRAFT_MAP = 'my_workshop';
