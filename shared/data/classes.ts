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
  professor: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: { name: '검사', hp: 150, mp: 100, regen: 7, main: 'str', skills: ['ilseom', 'wolcham', 'jilpung', 'cheonbung'], hints: ['hyeolseom', 'heullyeo'], passives: ['geomgil', 'armor'], professor: '검술과 바르크 교수' },
  mage: { name: '마법사', hp: 110, mp: 140, regen: 10, main: 'int', skills: ['madan', 'gidung', 'pado', 'haebang'], hints: ['ssiat', 'gwedo'], passives: ['gongmyeong', 'maxmp'], professor: '마법학과 엘린 교수' },
  archer: { name: '궁수', hp: 125, mp: 110, regen: 8, main: 'dex', skills: ['hwasal', 'sasl', 'soyong', 'hwasalbi'], hints: ['deot', 'geurimja'], passives: ['jeongryeong', 'crit'], professor: '궁술과 시엘 교수' },
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
  wolcham: { name: '월참', cd: 2.5, mp: 6, elements: ['fire', 'water', 'light'] },
  jilpung: { name: '질풍참', cd: 6, mp: 12, elements: ['fire', 'light'] },
  cheonbung: { name: '천붕', cd: 0, mp: 15, elements: ALL_ELEMENTS },
  madan: { name: '마력탄', cd: 0, mp: 0, elements: ALL_ELEMENTS },
  gidung: { name: '원소 기둥', cd: 7, mp: 18, elements: ['fire', 'water', 'earth'] },
  pado: { name: '원소 파도', cd: 9, mp: 22, elements: ['fire', 'earth'] },
  haebang: { name: '마력 해방', cd: 60, mp: 20, elements: [] },
  hwasal: { name: '마법 화살', cd: 0, mp: 0, elements: ALL_ELEMENTS },
  sasl: { name: '사슬 화살', cd: 7, mp: 14, elements: ['earth', 'water', 'dark'] },
  soyong: { name: '소용돌이 화살', short: '소용돌이', cd: 10, mp: 20, elements: ['earth', 'light', 'dark'] },
  hwasalbi: { name: '화살비', cd: 12, mp: 22, elements: ['fire', 'light'] },
  // 힌트 스킬 (2라인·3라인 맛보기)
  hyeolseom: { name: '혈섬', cd: 8, mp: 14, elements: ['dark', 'water'] },
  heullyeo: { name: '흘려베기', cd: 10, mp: 16, elements: ['water', 'light'] },
  ssiat: { name: '마력 씨앗', short: '씨앗', cd: 6, mp: 8, elements: ['light', 'earth'] },
  gwedo: { name: '궤도탄', cd: 7, mp: 16, elements: ['water', 'dark'] },
  deot: { name: '덫', cd: 8, mp: 14, elements: ['fire', 'earth'] },
  geurimja: { name: '그림자 화살', short: '그림자', cd: 9, mp: 16, elements: ['light', 'dark'] },
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

/** 마법사 기본 공격(기본 공격·마력탄): 쏘는 순간 뒤로 밀려남. dist(px)를 time(초) 동안 미끄러지듯. 공중에서도 */
/** 체력이 0 이 되면 최대 이만큼(초) 쓰러져 있다가 깨어나는 곳으로 (그동안 조작 불가, 무적). [부활하기]를 누르면 바로 */
export const DOWN_TIME = 20;

export const MAGE_RECOIL = { dist: 20, time: 0.1 };
/**
 * 마법사 기본 공격 타이밍 (초). 묵직하게: 처음 값의 2배.
 * shot = 쏘는 순간, dur = 동작 끝, lock = 끝난 뒤 다음 행동까지 쉬는 시간.
 * 마력탄은 마력 해방 중 절반.
 */
export const MAGE_SHOT = {
  basic: { shot: 0.16, dur: 0.4, lock: 0.4 },
  madan: { shot: 0.36, dur: 0.44, lock: 0.56 },
};

export const expNeed = (level: number) => 40 + (level - 1) * 25;
