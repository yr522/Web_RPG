// 몬스터 (기획서 10장, 14장 수치)

/** 몬스터 종류 */
export type MonsterId = 'training_doll' | 'training_doll_x' | 'slime' | 'slime_elem' | 'honey_slime' | 'beast' | 'guard_a' | 'guard_b' | 'guard_c' | 'guard_d' | 'golem' | 'guard_boss' | 'dummy';

/**
 * 움직임 종류
 * - slime: 돌아다니며 폴짝, 쫓아올 때 웅크렸다 크게 점프 (SLIME_AI)
 * - walker: 돌아다니다가 보이면 걸어서 쫓아옴 (점프 없음)
 * - charger: 걸어서 쫓아오다가 가끔 멈춰 부들부들 떨고 앞으로 돌진 (CHARGER_AI)
 * - flyer: 공중에 떠서 플레이어 쪽으로 날아옴, 부딪히기만 (FLYER_AI)
 * - golem: 보스. 천천히 쫓아오며 내려치기·돌진 (GOLEM_AI, 보안장치 오브 BOSS_ORB)
 * - snail: 꿀 슬라임(달팽이). 천천히 다가오다가 가까우면 제자리에서 점액을 휘두름, 맞으면 둔화 (SNAIL_AI)
 * - dummy: 훈련장 허수아비. 제자리에 서 있고, 안 밀리고, 안 죽고, 부딪혀도 피해 없음. 머리 위에 초당 피해 (DUMMY)
 */
export type MonsterAi = 'slime' | 'snail' | 'walker' | 'charger' | 'flyer' | 'golem' | 'dummy';

export interface MonsterDef {
  name: string;
  /** 이 몬스터를 잡는 목표 레벨 (수치 맞춤용, 화면에 안 띄움. 확인: npm run curve) */
  level?: number;
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
  /** 그림이 없으면 이 몬스터 그림을 빌려 씀 (크기는 w·h 에 맞춤) */
  look?: MonsterId;
  /** 잡으면 확률로 떨어뜨리는 물건. max = 이만큼 가지고 있으면(바닥에 떨어진 것 포함) 안 떨어뜨림, quest = 이 퀘스트를 하는 중일 때만 */
  /** group 이 같은 것끼리는 한 번만 굴려서 그중 하나만 떨어짐 (각 chance 를 더한 확률) */
  drops?: readonly { item: string; chance: number; max?: number; quest?: string; group?: string }[];
}

/** 경비기계 A·B 고철: 녹슨 고철 30% 또는 쓸만한 고철 15% (둘이 같이 안 떨어짐). 2026-11-25: 쓸만한 고철 5% → 15% (생일잔치 대 장장이 의뢰 사냥 경험치가 너무 커서) */
const SCRAP_DROPS = [{ item: 'scrap_rusty', chance: 0.3, group: 'scrap' }, { item: 'scrap_good', chance: 0.15, group: 'scrap' }];

export const MONSTERS: Record<MonsterId, MonsterDef> = {
  slime: {
    // 크기 1.2배 (42×30 → 50×36, 2026-11-18)
    // 2026-11-25 레벨 잠금: 목표 Lv 2~3, 경험치 10 → 8
    name: '슬라임', level: 2, hp: 140, exp: 8, touch: 8, gold: [5, 9], w: 50, h: 36, ai: 'slime', speed: [40, 60], chase: 1.7,
    drops: [{ item: 'slime_gel', chance: 0.4 }, { item: 'slime_armor', chance: 0.03 }, { item: 'slime_ring', chance: 0.03 }],
  },
  slime_elem: {
    // 크기 1.2배 (42×30 → 50×36, 2026-11-20, 슬라임과 같게)
    // 2026-11-25: 목표 Lv 4~5, 경험치 20 → 14
    name: '원소 슬라임', level: 4, hp: 260, exp: 14, touch: 12, gold: [12, 18], w: 50, h: 36, ai: 'slime', speed: [40, 60], chase: 1.7, elemental: true,
    // 원소 구슬 10% (2026-11-21, 점액과 따로 굴림)
    drops: [{ item: 'slime_gel', chance: 0.4 }, { item: 'elem_orb', chance: 0.1 }, { item: 'slime_armor', chance: 0.03 }, { item: 'slime_ring', chance: 0.03 }],
  },
  // 꿀 슬라임 (영주님의 생일잔치, 2026-11-21): 세기는 원소 슬라임과 같음. 그림 assets/img/sprites/enemies/03_honeySlime
  honey_slime: {
    // 2026-11-25: 생일잔치 목표 Lv 10~12 → 체력 260 → 560, 피해 12 → 17 (경험치는 꿀 50개 사냥이 너무 커지지 않게 18, 레벨은 퀘스트 보상으로 맞춤)
    name: '꿀 슬라임', level: 10, hp: 560, exp: 18, touch: 17, gold: [12, 18], w: 50, h: 36, ai: 'snail', speed: [30, 45], chase: 1.5,
    drops: [{ item: 'honey', chance: 0.7 }],
  },
  // 들짐승 (영지 가도, 2026-11-21): 황소 + 하이에나. 임시 그림, 수치 임시. 걸어서 쫓아오다 돌진
  beast: {
    // 2026-11-25: 목표 Lv 11~12 → 체력 480 → 720, 피해 18 → 24, 경험치 32 → 48
    name: '들짐승', level: 11, hp: 720, exp: 48, touch: 24, gold: [20, 30], w: 64, h: 42, ai: 'charger', speed: [45, 60], chase: 1.6,
    drops: [{ item: 'rawhide', chance: 0.2 }],
  },
  // 마법공학의 유산 (임시 그림, 수치 임시)
  // 훈련 인형 (튜토리얼 · 훈련실, 2026-11-25): Lv 1~2. 마법으로 움직이는 나무 인형, 그림은 코드로 그린 임시
  training_doll: { name: '훈련 인형', level: 1, hp: 90, exp: 5, touch: 5, gold: [2, 4], w: 36, h: 58, ai: 'walker', speed: [35, 50], chase: 1.4 },
  // 합동 훈련실에서 폭주한 훈련 인형 (스토리 전용 약화판 정예: 정예 배수를 받아도 체력 90×4 = 360)
  training_doll_x: { name: '폭주한 훈련 인형', level: 2, hp: 90, exp: 10, touch: 6, gold: [10, 15], w: 36, h: 58, ai: 'walker', speed: [40, 55], chase: 1.5, look: 'training_doll' },
  // 2026-11-25 레벨 잠금: 마법공학의 유산 목표 Lv 5~10 에 맞춰 체력·피해를 낮춤 (예전엔 Lv 10~15 에 맞던 수치)
  guard_a: {
    name: '경비기계A', level: 5, hp: 200, exp: 20, touch: 13, gold: [20, 30], w: 44, h: 52, ai: 'walker', speed: [45, 60], chase: 1.6,
    drops: SCRAP_DROPS,
  },
  guard_b: {
    name: '경비기계B', level: 6, hp: 370, exp: 28, touch: 18, gold: [30, 45], w: 56, h: 58, ai: 'charger', speed: [35, 45], chase: 1.5,
    drops: [{ item: 'workshop_key', chance: 0.05, max: 1, quest: 'mg9' }, ...SCRAP_DROPS],
  },
  guard_c: { name: '경비기계C', level: 8, hp: 500, exp: 38, touch: 22, gold: [35, 50], w: 50, h: 60, ai: 'walker', speed: [40, 50], chase: 1.5 },
  guard_d: { name: '경비기계D', level: 7, hp: 210, exp: 30, touch: 15, gold: [25, 35], w: 34, h: 26, ai: 'flyer', speed: [60, 80], chase: 1.4 },
  // 던전 잊힌 공방 마지막 방 (그림은 경비기계C 를 키워서 임시)
  guard_boss: { name: '고대 수호기계', level: 10, hp: 3900, exp: 200, touch: 25, gold: [150, 220], w: 80, h: 96, ai: 'charger', speed: [40, 50], chase: 1.4, boss: true, look: 'guard_c' },
  golem: { name: '마법 골렘', level: 9, hp: 4250, exp: 300, touch: 17, gold: [300, 400], w: 138, h: 210, ai: 'golem', speed: [42, 42], chase: 1, boss: true,
    // 무기: 셋 중 하나만 (합 20%, 직업 상관없이)
    drops: [...['golem_sword', 'golem_staff', 'golem_bow'].map(item => ({ item, chance: 0.2 / 3, group: 'golem_weapon' })), { item: 'golem_gloves', chance: 0.2 }] },
  // 훈련장 허수아비 (그림 임시). HP 는 표시용이 아니라 맞은 피해를 세는 그릇 (매 틱 다시 채움)
  dummy: { name: '허수아비', hp: 1e9, exp: 0, touch: 0, gold: [0, 0], w: 34, h: 64, ai: 'dummy', speed: [0, 0], chase: 0 },
};

/**
 * 허수아비 딜 측정 (tools/skillDps.ts 와 같은 방식: 측정 시간 동안 준 피해 ÷ 시간, 쉬는 시간도 포함).
 * 처음 때린 순간부터 재기 시작, idle 초 동안 안 때리면 측정 끝 (마지막 값이 남아 있음). 시간이 minTime 초보다 짧으면 minTime 으로 나눔
 */
export const DUMMY = { idle: 3, minTime: 1 };

/**
 * 정예몹: 사냥터 몬스터가 나올 때(다시 나올 때도) chance 확률로 정예가 됨 (보스·한 번만 나오는 몬스터·안전 지대·던전은 제외, 던전은 정해 둔 자리만).
 * 체력·몸통 피해·경험치·골드 배수, 크기 배율. 특성 하나가 붙음. overlay = 몸 위에 계속 도는 그림 이펙트 (client vfx.ts 이름)
 */
export type EliteAffix = 'swift' | 'iron' | 'rage';
export const ELITE = {
  chance: 0.03, hp: 4, touch: 1.5, exp: 4, gold: 4, size: 1.3,
  color: '#ffd24a',
  affixes: {
    /** 빠름 */
    swift: { name: '신속', speed: 1.6, overlay: 'buff_haste_loop' },
    /** 받는 피해 줄고 안 밀림 */
    iron: { name: '강철', taken: 0.6, overlay: 'buff_protect_shield_loop' },
    /** HP 가 below 아래로 내려가면 빨라지고 세짐 */
    rage: { name: '분노', below: 0.5, speed: 1.5, touch: 1.5, overlay: 'buff_rage_loop' },
  } satisfies Record<EliteAffix, { name: string; overlay: string } & Record<string, unknown>>,
};
export const ELITE_AFFIXES = Object.keys(ELITE.affixes) as EliteAffix[];

/**
 * 레벨 차이 경험치 (2026-11-25): 플레이어가 몬스터 목표 레벨(level)보다 free 레벨 넘게 높으면
 * 넘는 레벨마다 per 씩 줄어듦 (최소 min 배). 낮은 몬스터만 잡아서 최대 레벨까지 가는 걸 막음
 */
export const EXP_GAP = { free: 3, per: 0.15, min: 0.1 };
export const expGapMult = (playerLv: number, mobLv: number | undefined) =>
  mobLv === undefined ? 1 : Math.max(EXP_GAP.min, 1 - Math.max(0, playerLv - mobLv - EXP_GAP.free) * EXP_GAP.per);

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

/**
 * 꿀 슬라임(달팽이) 행동: 쫓아오다가 플레이어가 앞쪽 range(가로)·높이 차 rangeY 안이면 멈춰서 휘두름.
 * every 초마다 한 번 (슬라임 큰 점프와 비슷한 빈도). windup 초 준비(3번 그림) → swing 초 휘두름(4번 그림), 휘두르는 순간 맞으면 피해 dmg + 둔화
 */
export const SNAIL_AI = { every: [2.5, 4.5] as const, range: 80, rangeY: 60, windup: 0.4, swing: 0.3, dmg: 17 };
/** 둔화 (꿀 슬라임 점액): time 초 동안 걷는 속도 × (1 − slow) */
export const SLOW_DEBUFF = { time: 3, slow: 0.4 };

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
  slamRange: 230,
  slamWindup: 0.8,
  /** 범위: 골렘 가운데부터 앞으로 slamW, 바닥에서 slamH (플레이어 키 46 의 절반 + 조금 → 점프로 피함). 예고 동안 반투명 상자 */
  slamW: 400,
  slamH: 32,
  slamDmg: 38,
  slamRecover: 0.7,
  /** 가까이 붙어 있어도 내려치기를 이만큼 연달아 쓰면 다음은 돌진 */
  slamsBeforeCharge: 3,
  /** 2. 돌진: 플레이어가 멀면 이 확률로. 예고할 때 방향을 정하고, 그 뒤로는 플레이어와 상관없이 벽까지. 맞으면 기절 */
  chargeChance: 0.2,
  /** 돌진 안 쓰고 넘어갔을 때 다음 판단까지 (초) */
  chargeSkipCd: [2, 3] as const,
  chargeWindup: 1.6,
  chargeSpeed: 210,
  chargeDmg: 26,
  stunTime: 3,
  /** 3. 오브에 이만큼 맞으면 기절 + 받는 피해 배수 */
  groggyHits: 3,
  groggyTime: 6,
  groggyMult: 2,
};

/**
 * 골렘 방 천장의 보안장치 (푸른 오브): 주기적으로 조준선을 띄움 → track 초 동안 플레이어를 따라감 → 방향을 정하고 aimTime 초 뒤 발사. 골렘도 맞음
 */
export const BOSS_ORB = { every: 4.5, track: 1.6, aimTime: 0.6, speed: 520, r: 30, dmg: 21 };

/** 노멀부터 골렘 추가 패턴 */
export const GOLEM_NORMAL = {
  /** 치명적: 대지 붕괴. HP 가 이 비율 아래로 처음 내려갈 때마다. 예고(바닥 전체 붉은 상자) 뒤 땅에 서 있으면 최대 HP × hpPct 피해 → 점프나 공중으로 피함 */
  quakeAt: [0.75, 0.5, 0.25],
  quakeWindup: 1.6,
  quakeHpPct: 0.6,
  quakeRecover: 1.0,
  /** 환경: 천장 잔해. every 초마다 n 개 (하나는 플레이어 위). warn 초 예고(세로 띠) 뒤 떨어져서 폭 w 범위에 피해 */
  rubbleEvery: [5, 7] as const,
  rubbleN: 3,
  rubbleWarn: 1.0,
  rubbleW: 64,
  rubbleDmg: 26,
};

/** 하드에서만 바뀌는 골렘 패턴: 잔해에 맞으면 rubbleStun 초 기절, 대지 붕괴는 즉사 (점프로 피하는 건 같음) */
export const GOLEM_HARD = { rubbleStun: 1, quakeKill: true };

export const COIN = { life: 30, blinkLast: 5, size: 14 };
/** 떨어진 골드 동전 그림: 동전 하나의 금액이 min 이상이면 그 동전 (위에서부터 검사) */
export const COIN_KINDS = [
  { min: 100, img: 'gold' },
  { min: 50, img: 'silver' },
  { min: 10, img: 'iron' },
  { min: 0, img: 'bronze' },
] as const;
export type CoinImg = (typeof COIN_KINDS)[number]['img'];
export const coinKind = (amt: number): CoinImg => COIN_KINDS.find(k => amt >= k.min)!.img;
/** 동전 그림 한 바퀴: 프레임 수와 초당 프레임, 그림 배율 (16px 그림 × scale) */
export const COIN_ANIM = { frames: 6, fps: 6, scale: 2 };
/** 땅에 떨어진 물건 (줍는 범위 크기, 사라지는 시간은 COIN 과 같음) */
export const ITEM_DROP = {
  size: 24,
  /** 인벤토리에서 버린 물건: 이 시간(초) 동안 아무도 못 주움 (붉은 틴트) */
  lock: 2,
};
