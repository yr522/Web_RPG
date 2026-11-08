// 상점 물건 (기획서 7장)
export type ItemId = 'hp' | 'mp' | 'reset';

export const ITEMS: Record<ItemId, { name: string; icon: string; price: number; desc: string; bulk: number[] }> = {
  hp: { name: 'HP 포션', icon: '🧪', price: 30, desc: 'HP 50 회복 (1번 키)', bulk: [1, 10] },
  mp: { name: 'MP 포션', icon: '💧', price: 30, desc: 'MP 40 회복 (2번 키)', bulk: [1, 10] },
  reset: { name: '스킬트리 초기화 주문서', icon: '📜', price: 1000, desc: '배운 스킬을 모두 초기화. 교수님께 원소를 다시 골라 배울 수 있어. 스킬 레벨은 유지돼.', bulk: [1] },
};

export const POTION = { hp: 50, mp: 40, cooldown: 0.8 };
