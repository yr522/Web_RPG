// 직업 3종 (기획서 2장, 14장 수치)
import { ALL_ELEMENTS, type Element } from './elements';

export type ClassId = 'warrior' | 'mage' | 'archer';
export type StatId = 'str' | 'dex' | 'int';

export interface ClassDef {
  name: string;
  hp: number;
  mp: number;
  regen: number;
  main: StatId;
  /** 기본 스킬 4개 (Z A S D 순서, 교수님한테 순서대로 배움) */
  skills: [string, string, string, string];
  /** 힌트 스킬 2개: [2라인 힌트, 3라인 힌트] (스킬트리 문서 2장) */
  hints: [string, string];
  /** 패시브 2개: [직업 정체성, 단순 스탯] */
  passives: [string, string];
  /** 추가 이동기 (스킬 트리 Lv3 줄 2번째 칸). 검사는 4식 회류참 */
  move?: string;
  professor: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: { name: '검사', hp: 150, mp: 100, regen: 1.5, main: 'str', skills: ['ilseom', 'wolcham', 'jilpung', 'cheonbung'], hints: ['hyeolseom', 'heullyeo'], passives: ['geomgil', 'armor'], move: 'hoeryu', professor: '검술과 바르크 교수' },
  mage: { name: '마법사', hp: 110, mp: 140, regen: 2.5, main: 'int', skills: ['madan', 'gidung', 'pado', 'haebang'], hints: ['ssiat', 'gwedo'], passives: ['gongmyeong', 'maxmp'], move: 'teleport', professor: '마법학과 엘린 교수' },
  archer: { name: '궁수', hp: 125, mp: 110, regen: 2, main: 'dex', skills: ['hwasal', 'sasl', 'soyong', 'hwasalbi'], hints: ['deot', 'geurimja'], passives: ['jeongryeong', 'crit'], move: 'doyak', professor: '궁술과 시엘 교수' },
};

export interface SkillDef {
  name: string;
  short?: string;
  cd: number;
  mp: number;
  elements: Element[];
  /** 패시브 (키에 등록 안 됨, 원소 없음) */
  passive?: boolean;
}

export const SKILLS: Record<string, SkillDef> = {
  basic: { name: '기본 공격', cd: 0, mp: 0, elements: [] },
  ilseom: { name: '일섬', cd: 0, mp: 0, elements: ALL_ELEMENTS },
  wolcham: { name: '월참', cd: 2.5, mp: 9, elements: ['fire', 'water', 'light'] },
  jilpung: { name: '질풍참', cd: 3, mp: 3, elements: ['fire', 'light'] },
  cheonbung: { name: '천붕', cd: 0, mp: 22, elements: ALL_ELEMENTS },
  madan: { name: '마력탄', cd: 0, mp: 0, elements: ALL_ELEMENTS },
  gidung: { name: '원소 기둥', cd: 7, mp: 27, elements: ['fire', 'water', 'earth'] },
  pado: { name: '원소 파도', cd: 9, mp: 33, elements: ['fire', 'earth'] },
  haebang: { name: '마력 해방', cd: 60, mp: 30, elements: [] },
  hwasal: { name: '마법 화살', cd: 0, mp: 0, elements: ALL_ELEMENTS },
  sasl: { name: '사슬 화살', cd: 3.5, mp: 3, elements: ['earth', 'water', 'dark'] },
  soyong: { name: '소용돌이 화살', short: '소용돌이', cd: 10, mp: 30, elements: ['earth', 'light', 'dark'] },
  hwasalbi: { name: '화살비', cd: 12, mp: 33, elements: ['fire', 'light'] },
  // 추가 이동기 (쿨타임·MP 는 질풍참·사슬 화살 수준). 회류참은 검사 연계 4식
  hoeryu: { name: '회류참', cd: 3.5, mp: 5, elements: ['water', 'earth', 'dark'] },
  teleport: { name: '텔레포트', short: '텔포', cd: 3, mp: 3, elements: [] },
  doyak: { name: '후방 도약', short: '도약', cd: 3.5, mp: 3, elements: ['fire', 'water', 'light'] },
  // 힌트 스킬 (2라인·3라인 맛보기)
  hyeolseom: { name: '혈섬', cd: 8, mp: 21, elements: ['dark', 'water'] },
  heullyeo: { name: '흘려베기', cd: 10, mp: 24, elements: ['water', 'light'] },
  ssiat: { name: '마력 씨앗', short: '씨앗', cd: 6, mp: 12, elements: ['light', 'earth'] },
  gwedo: { name: '궤도탄', cd: 7, mp: 24, elements: ['water', 'dark'] },
  deot: { name: '덫', cd: 8, mp: 21, elements: ['fire', 'earth'] },
  geurimja: { name: '그림자 화살', short: '그림자', cd: 9, mp: 24, elements: ['light', 'dark'] },
  // 패시브
  geomgil: { name: '검의 길', cd: 0, mp: 0, elements: [], passive: true },
  armor: { name: '슈퍼아머 확률 증가', short: '슈퍼아머', cd: 0, mp: 0, elements: [], passive: true },
  gongmyeong: { name: '원소 공명', cd: 0, mp: 0, elements: [], passive: true },
  maxmp: { name: '최대 MP 증가', short: '최대 MP', cd: 0, mp: 0, elements: [], passive: true },
  jeongryeong: { name: '정령의 숨결', short: '정령', cd: 0, mp: 0, elements: [], passive: true },
  crit: { name: '치명타 확률 증가', short: '치명타', cd: 0, mp: 0, elements: [], passive: true },
};

/**
 * 전직 전 스킬 트리 (직업당 8칸). row = 줄(열리는 레벨 UNLOCK_LEVELS[row]), col = 0 기본 · 1 2라인 힌트 · 2 3라인 힌트 · 3 패시브
 * 스킬트리 문서 2장 "여는 순서": Lv1 기본1 / Lv3 기본2·패시브1 / Lv6 기본3·2라인 힌트 / Lv10 기본4·3라인 힌트·패시브2
 */
export interface TreeCell { id: string; row: number; col: number }
export function skillTree(cls: ClassId): TreeCell[] {
  const c = CLASSES[cls];
  return [
    ...c.skills.map((id, row) => ({ id, row, col: 0 })),
    { id: c.hints[0], row: 2, col: 1 },
    { id: c.hints[1], row: 3, col: 2 },
    { id: c.passives[0], row: 1, col: 3 },
    { id: c.passives[1], row: 3, col: 3 },
    ...(c.move ? [{ id: c.move, row: 1, col: 1 }] : []),
  ];
}
/** 직업 스킬 전부 (기본·힌트·패시브) */
export const classSkillIds = (cls: ClassId) => skillTree(cls).map(c => c.id);
/** 키에 등록할 수 있는 직업 스킬 (패시브 빼고) */
export const classActiveIds = (cls: ClassId) => classSkillIds(cls).filter(id => !SKILLS[id].passive);
/** 이 스킬을 배울 수 있는 레벨 */
export function unlockLevel(cls: ClassId, id: string) {
  const c = skillTree(cls).find(o => o.id === id);
  return c ? UNLOCK_LEVELS[c.row] : Infinity;
}

/**
 * 힌트 스킬·패시브 수치 (임시, 스킬트리 문서 "정할 것"). lv = 스킬 레벨 1~5
 */
/** 이동기 (질풍참·사슬 화살): 쿨타임 짧고 MP 적게, 대신 피해 낮게 */
export const MOVE_SKILL = { jilpung: { coef: 1.6 }, sasl: { coef: 1.4 } };
/**
 * 검사 판정·거리 (테스터 의견으로 늘림, 2026-11-17).
 * basicW·ilseomW = 앞으로 닿는 폭(px) (52 → 72, 106 → 136),
 * jilpung = 돌진 속도·시간 (거리 220 → 280px), cheonbung = 판정 상자 폭·높이 (270×170 → 460×260)
 */
/** 검사 초식 연계 순서 (제1초 ~ 제5초). 천붕은 회류참까지 이어야 열림 */
export const WARRIOR_CHAIN = ['ilseom', 'wolcham', 'jilpung', 'hoeryu', 'cheonbung'];
/**
 * 검사 회류참 (4식): 땅에서 뒤로 back(px) 물러나며(time 초, 무적) 앞쪽을 넓게 긁어 몬스터를 끌어옴.
 * 판정: 몸 앞 front · 몸 뒤 behind · 발에서 위로 h. 끌려온 몬스터는 내 앞 gather(px) 쪽으로 모임 (보스는 안 끌려옴)
 */
export const HOERYU = { back: 280, time: 0.32, front: 165, behind: 40, h: 156, coef: 1.4, gather: 46 };
export const WARRIOR_REACH = {
  basicW: 72, ilseomW: 136,
  jilpung: { speed: 1000, time: 0.28 },
  cheonbung: { w: 460, h: 260 },
};
/**
 * 마법사 텔레포트: 바라보는 방향으로 dist(px) 순간이동 (↑ 를 누르고 쓰면 위로 up). time 초 동안 사라졌다가 나타남(그동안 무적), 나타난 뒤 inv 초 더 무적
 */
export const TELEPORT = { dist: 220, up: 160, time: 0.12, inv: 0.25 };
/**
 * 궁수 후방 도약: 바라보는 반대쪽으로 back(px), 높이 height 까지 rise 초 동안 떠오르고, 가장 높은 곳에서 hover 초 떠 있다가, fall 초 동안 내려옴 (내내 무적).
 * 떠 있는 동안 화살 n 발이 앞 땅 spots(px, 뛴 자리에서 앞으로)에 차례로 박힘. beats = 가장 높은 곳에서 각 화살이 나타나는 시각 (뒤로 갈수록 간격이 짧음)
 * 화살 하나: 박힐 자리에서 사선(ang, 수평에서 아래로 라디안)으로 dist(px) 떨어진 공중에 appear 초 동안 나타나고, hold 초 멈췄다가, drop 초 동안 점점 빨라지며 박힘.
 * 박힌 뒤 stay 초 남았다가 fade 초 동안 사라짐. 그림 길이 len(px), 땅속으로 sink(px) 들어감
 * 판정: 박힌 자리 가운데로 가로 hitW, 높이 hitH (그림보다 넉넉), 한 발 계수 coef
 */
export const DOYAK = {
  back: 260, height: 90, rise: 0.25, hover: 0.42, fall: 0.25,
  n: 3, coef: 1.2, spots: [150, 215, 280], beats: [0, 0.17, 0.3],
  arrow: { ang: 0.95, dist: 120, appear: 0.08, hold: 0.07, drop: 0.12, stay: 0.55, fade: 0.35, len: 72, sink: 6 },
  hitW: 100, hitH: 120,
};
/** 궁수 소용돌이 화살: 끌어당기는 반지름(px) (테스터 의견으로 210 → 300, 2026-11-17, 그 뒤 0.8배 → 240, 2026-11-19) */
export const SOYONG_PULL_R = 240;
/** 소용돌이 안 잔 피해 (무속성): n번, first 초 뒤부터 gap 초마다, 한 번에 계수 coef. 큰 한 방(화살)은 따로 3.2 */
export const SOYONG_TICK = { n: 4, first: 0.1, gap: 0.12, coef: 0.35 };
/** 궁수 기본 공격·마법 화살 사거리: 바로 떼면 min, 최대 충전이면 max */
export const ARROW_RANGE = { min: 200, max: 800 };
/** 사슬 화살 조준 각도 바뀌는 속도 (라디안/초) */
export const AIM_TURN = 4.0;
/** MP 회복: 지능 1 마다 회복량 +이만큼 (5 기준) */
export const INT_REGEN = 0.12;
/**
 * 방어력: 받는 피해 × (1 − 방어 / (방어 + k)), 최대 cap 까지 줄임 (기획서 5장)
 * k = 100 이면 방어력 25 → 20%, 50 → 33%, 100 → 50%
 */
export const DEFENSE = { k: 100, cap: 0.75 };

export const HINT = {
  /** 혈섬: 베기 + 출혈 (tick 초마다 공격력 × tickCoef × 레벨 배율, time 초 동안 + 이동 속도 slow 만큼 느려짐, 보스는 안 느려짐) */
  hyeolseom: { coef: 1.2, bleedTime: 5, tick: 1, tickCoef: 0.3, slow: 0.3 },
  /** 흘려베기: guard 초 받아내기 (슈퍼아머, 받는 피해 × taken). 받은 피해 / 최대 HP × perHp 만큼 계수 증가, 최대 maxCoef */
  heullyeo: { guard: 0.8, taken: 0.5, coef: 1.5, perHp: 6, maxCoef: 4.5 },
  /** 마력 씨앗: 심을 때 coef 피해, 그 적에게 burstDmg 만큼 피해를 주거나 죽이면 터지며 MP mp 회복 */
  ssiat: { coef: 0.5, range: 460, burstDmg: 150, mp: 15 },
  /** 궤도탄: n 개가 몸 주위를 orbit 초 돌다가 range 안 적에게 하나씩(gap 초 간격) 유도 */
  gwedo: { n: 3, coef: 0.9, orbit: 4, range: 260, gap: 0.25, r: 44, speed: 620 },
  /** 덫: 앞 dist 거리 바닥에 설치, arm 초 뒤부터 작동, life 초 유지, 동시에 max 개. 불 = 폭발, 땅 = 묶기(rootTime 초, 보스는 안 묶임) */
  deot: { dist: 40, arm: 0.3, life: 12, max: 2, boomCoef: 2.4, boomW: 150, rootCoef: 1.2, rootTime: 2.5 },
  /** 그림자 화살: 관통 coef + 적의 잃은 HP × lostPct 추가 피해 (최대 공격력 × capCoef) */
  geurimja: { coef: 1.6, range: 520, lostPct: 0.12, capCoef: 3 },
};

export const PASSIVE = {
  /** 검의 길: 연계 인정 시간 +window초/Lv, 연계 보너스 +bonus/Lv (기본 0.9초, +20%) */
  geomgil: { window: 0.06, bonus: 0.03 },
  /** 슈퍼아머 확률: 맞을 때 이 확률(/Lv)로 넉백 안 당함 */
  armor: { chance: 0.08 },
  /** 원소 공명: 마지막으로 맞힌 원소와 다른 원소로 맞히면 +bonus/Lv 피해 */
  gongmyeong: { bonus: 0.05 },
  /** 최대 MP +pct/Lv */
  maxmp: { pct: 0.04 },
  /** 정령의 숨결: 풀차징 마법 화살에 정령 화살 1발 (본 화살 피해 × (base + perLv × (Lv-1))) */
  jeongryeong: { base: 0.3, perLv: 0.1 },
  /** 치명타 확률 +chance/Lv, 치명타 피해 mult 배 (기본 치명타 확률 0) */
  crit: { chance: 0.02, mult: 1.5 },
};

/** 연계 보너스 기본값 (검사) */
export const COMBO = { window: 0.9, bonus: 0.2 };

/** 스킬 슬롯 키. Z A S D = 직업 스킬 4개, Q W E = 추가 슬롯(용도 미정) */
export const SLOT_KEYS = ['Z', 'A', 'S', 'D', 'Q', 'W', 'E'] as const;
export type SlotKey = (typeof SLOT_KEYS)[number];
/** 직업 스킬 슬롯별 해금 레벨 (Z A S D) */
export const UNLOCK_LEVELS = [1, 3, 6, 10];
export const MAX_SKILL_LEVEL = 5;

/** 능력치 시작값 (근력·민첩·지능 모두) */
export const START_STAT = 5;
/** 캐릭터 생성 때 직접 나눠 주는 포인트. 안 쓴 포인트는 남은 포인트로 넘어간다 */
export const CREATE_STAT_POINTS = 5;
export const NAME_MAX = 10;
export const DEFAULT_NAME = '견습생';

/** 체력이 0 이 되면 최대 이만큼(초) 쓰러져 있다가 깨어나는 곳으로 (그동안 조작 불가, 무적). [부활하기]를 누르면 바로 */
export const DOWN_TIME = 20;

/**
 * 마법사 기본 공격 타이밍 (초). 테스터 의견으로 줄임 (2026-11-17, 살짝 딜레이만): 기본 공격 0.8 → 0.4초, 마력탄 1.0 → 0.45초 마다 한 발.
 * 쏠 때 뒤로 밀려나던 반동은 없앰.
 * shot = 쏘는 순간, dur = 동작 끝, lock = 끝난 뒤 다음 행동까지 쉬는 시간.
 * 마력탄은 마력 해방 중 절반.
 */
export const MAGE_SHOT = {
  basic: { shot: 0.1, dur: 0.2, lock: 0.2 },
  madan: { shot: 0.15, dur: 0.22, lock: 0.23 },
};
/** 마력탄 계수 (1.3 → 1.5, 2026-11-17 보스전에서 마법사가 약해서) */
export const MADAN_COEF = 1.5;

export const expNeed = (level: number) => 40 + (level - 1) * 25;
