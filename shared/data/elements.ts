// 원소 5종 · 상성 · 반응 (기획서 3장)
export type Element = 'fire' | 'water' | 'earth' | 'light' | 'dark';

export const ELEMENTS: Record<Element, { name: string; color: string; icon: string }> = {
  fire: { name: '불', color: '#ff5a3c', icon: '🔥' },
  water: { name: '물', color: '#3ca0ff', icon: '💧' },
  earth: { name: '땅', color: '#4fc35a', icon: '🌿' },
  light: { name: '빛', color: '#ffd84a', icon: '✨' },
  dark: { name: '어둠', color: '#b06cff', icon: '🌑' },
};
export const NO_ELEMENT = { name: '무속성', color: '#c8c8e0', icon: '' };
export const ALL_ELEMENTS: Element[] = ['fire', 'water', 'earth', 'light', 'dark'];

/** 공격 원소 → 유리한 대상 원소 */
export const STRONG_AGAINST: Record<Element, Element> = {
  fire: 'earth', earth: 'water', water: 'fire', light: 'dark', dark: 'light',
};

export const reactionKey = (a: Element, b: Element) => [a, b].sort().join('+');
export const REACTIONS: Record<string, { name: string; element: Element }> = {
  'earth+fire': { name: '발화', element: 'fire' },
  'fire+water': { name: '증발', element: 'water' },
  'earth+water': { name: '생명', element: 'earth' },
  'fire+light': { name: '작열', element: 'light' },
  'dark+fire': { name: '흑염', element: 'dark' },
  'dark+water': { name: '심연', element: 'dark' },
  'earth+light': { name: '개화', element: 'earth' },
};
