// 몬스터 (기획서 10장, 14장 수치)

/** 몬스터 종류 */
export type MonsterId = 'slime' | 'slime_elem' | 'guard_a' | 'guard_b' | 'guard_c' | 'guard_d' | 'golem';

/**
 * 움직임 종류
 * - slime: 돌아다니며 폴짝, 쫓아올 때 웅크렸다 크게 점프 (SLIME_AI)
 * - walker: 돌아다니다가 보이면 걸어서 쫓아옴 (점프 없음)
 * - charger: 걸어서 쫓아오다가 가끔 멈춰 부들부들 떨고 앞으로 돌진 (CHARGER_AI)
 * - flyer: 공중에 떠서 플레이어 쪽으로 날아옴, 부딪히기만 (FLYER_AI)
 * - golem: 보스. 천천히 쫓아오며 내려치기·돌진 (GOLEM_AI, 보안장치 오브 BOSS_ORB)
 */
export type MonsterAi = 'slime' | 'walker' | 'charger' | 'flyer' | 'golem';

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
  /** 보스: 맞아도 안 밀리고 경직 없음, 소용돌이에 안 끌려감 */
  boss?: boolean;
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
  guard_c: { name: '경비기계C', hp: 800, exp: 55, touch: 26, gold: [35, 50], w: 50, h: 60, ai: 'walker', speed: [40, 50], chase: 1.5 },
  guard_d: { name: '경비기계D', hp: 350, exp: 40, touch: 18, gold: [25, 35], w: 34, h: 26, ai: 'flyer', speed: [60, 80], chase: 1.4 },
  golem: { name: '마법 골렘', hp: 6000, exp: 400, touch: 20, gold: [300, 400], w: 92, h: 140, ai: 'golem', speed: [21, 21], chase: 1, boss: true },
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

/** 날아다니는 몬스터: 알아채는 거리(가로·세로 다), 둥실둥실 */
export const FLYER_AI = { sight: 360, bob: 18, bobSpeed: 2.5 };

/** 마법 골렘 (보스) */
export const GOLEM_AI = {
  /** 다음 패턴까지 */
  every: [2, 3] as const,
  /** 1. 전방 내려치기: 플레이어가 앞쪽 이 거리 안이면. 예고 후 앞쪽 범위(폭·높이)에 피해 */
  slamRange: 170,
  slamWindup: 0.8,
  slamW: 190,
  slamH: 150,
  slamDmg: 45,
  slamRecover: 0.7,
  /** 2. 돌진: 플레이어가 멀면 이 확률로. 예고할 때 방향을 정하고, 그 뒤로는 플레이어와 상관없이 벽까지. 맞으면 기절 */
  chargeChance: 0.45,
  chargeWindup: 0.9,
  chargeSpeed: 210,
  chargeDmg: 30,
  stunTime: 3,
  /** 3. 오브에 이만큼 맞으면 기절 + 받는 피해 배수 */
  groggyHits: 3,
  groggyTime: 6,
  groggyMult: 2,
};

/** 골렘 방 천장의 보안장치 (푸른 오브): 주기적으로 플레이어를 조준 → 그 방향으로 발사. 골렘도 맞음 */
export const BOSS_ORB = { every: 4.5, aimTime: 1.1, speed: 520, r: 12, dmg: 25 };

export const COIN = { life: 30, blinkLast: 5, size: 14 };
/** 땅에 떨어진 물건 (줍는 범위 크기, 사라지는 시간은 COIN 과 같음) */
export const ITEM_DROP = { size: 24 };
