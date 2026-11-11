// 몬스터 (기획서 10장, 14장 수치)

/** 몬스터 종류 */
export type MonsterId = 'slime' | 'slime_elem' | 'guard_a' | 'guard_b';

/**
 * 움직임 종류
 * - slime: 돌아다니며 폴짝, 쫓아올 때 웅크렸다 크게 점프 (SLIME_AI)
 * - walker: 돌아다니다가 보이면 걸어서 쫓아옴 (점프 없음)
 * - charger: 걸어서 쫓아오다가 가끔 멈춰 부들부들 떨고 앞으로 돌진 (CHARGER_AI)
 */
export type MonsterAi = 'slime' | 'walker' | 'charger';

export interface MonsterDef {
  name: string;
  hp: number;
  exp: number;
  /** 부딪히면 주는 피해 */
  touch: number;
  gold: readonly [number, number];
  w: number;
  h: number;
  ai: MonsterAi;
  /** 돌아다니는 속도 [최소, 최대] (쫓을 때는 chase 배) */
  speed: readonly [number, number];
  chase: number;
  /** 원소 몬스터 (원소 상성이 크게 먹음) */
  elemental?: boolean;
  /** 잡으면 확률로 떨어뜨리는 물건. max = 이만큼 가지고 있으면(바닥에 떨어진 것 포함) 안 떨어뜨림, quest = 이 퀘스트를 하는 중일 때만 */
  drops?: readonly { item: string; chance: number; max?: number; quest?: string }[];
}

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime: {
    name: '슬라임', hp: 140, exp: 10, touch: 8, gold: [5, 9], w: 42, h: 30, ai: 'slime', speed: [40, 60], chase: 1.7,
    drops: [{ item: 'slime_gel', chance: 0.4 }],
  },
  slime_elem: {
    name: '원소 슬라임', hp: 260, exp: 20, touch: 12, gold: [12, 18], w: 42, h: 30, ai: 'slime', speed: [40, 60], chase: 1.7, elemental: true,
    drops: [{ item: 'slime_gel', chance: 0.4 }],
  },
  // 마법공학의 유산 (임시 그림, 수치 임시)
  guard_a: { name: '경비기계A', hp: 420, exp: 30, touch: 16, gold: [20, 30], w: 44, h: 52, ai: 'walker', speed: [45, 60], chase: 1.6 },
  guard_b: {
    name: '경비기계B', hp: 650, exp: 45, touch: 22, gold: [30, 45], w: 56, h: 58, ai: 'charger', speed: [35, 45], chase: 1.5,
    drops: [{ item: 'workshop_key', chance: 0.05, max: 1, quest: 'mg9' }],
  },
};

/** 몬스터를 알아채는 거리 등 (모든 몬스터 공통) */
export const MONSTER_AI = {
  /** 플레이어를 알아채는 거리 */
  sight: 260,
  /** 쫓을 때 플레이어와 가로 거리가 이 안이면 방향 유지 + 멈춤 */
  chaseDeadZone: 8,
};

/** 슬라임 행동 수치 */
export const SLIME_AI = {
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

/** 돌진형 행동 수치: 쫓아오다가 가끔 멈춰 떨고(예고) 앞으로 돌진 */
export const CHARGER_AI = {
  every: [2.5, 4] as const,
  /** 플레이어가 이 가로 거리 안에 있을 때만 돌진 */
  range: 220,
  windup: 0.6,
  dashTime: 0.45,
  dashSpeed: 420,
};

export const COIN = { life: 30, blinkLast: 5, size: 14 };
/** 땅에 떨어진 물건 (줍는 범위 크기, 사라지는 시간은 COIN 과 같음) */
export const ITEM_DROP = { size: 24 };
