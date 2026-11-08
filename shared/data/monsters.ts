// 몬스터 (기획서 10장, 14장 수치)
export const SLIME = {
  normal: { name: '슬라임', hp: 140, exp: 10, touch: 8, gold: [5, 9] as const },
  elemental: { name: '원소 슬라임', hp: 260, exp: 20, touch: 12, gold: [12, 18] as const },
  w: 42,
  h: 30,
};
