// 몬스터 (기획서 10장, 14장 수치)
export const SLIME = {
  normal: { name: '슬라임', hp: 140, exp: 10, touch: 8, gold: [5, 9] as const },
  elemental: { name: '원소 슬라임', hp: 260, exp: 20, touch: 12, gold: [12, 18] as const },
  w: 42,
  h: 30,
};

/** 슬라임 행동 수치 */
export const SLIME_AI = {
  /** 플레이어를 알아채는 거리 */
  sight: 260,
  /** 가끔 하는 작은 폴짝 (돌아다닐 때) */
  hopEvery: [3, 6] as const,
  hopPower: [220, 300] as const,
  /** 큰 점프: 웅크렸다가 플레이어 쪽으로 뛰어듦 (쫓아올 때) */
  leapEvery: [2.5, 4.5] as const,
  leapChance: 0.6,
  crouchTime: 0.45,
  leapVy: -560,
  leapVx: 230,
};

export const COIN = { life: 30, blinkLast: 5, size: 14 };
