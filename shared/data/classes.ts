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
  skills: [string, string, string, string];
  professor: string;
}

export const CLASSES: Record<ClassId, ClassDef> = {
  warrior: { name: '검사', hp: 150, mp: 100, regen: 7, main: 'str', skills: ['ilseom', 'wolcham', 'jilpung', 'cheonbung'], professor: '검술과 바르크 교수' },
  mage: { name: '마법사', hp: 110, mp: 140, regen: 10, main: 'int', skills: ['madan', 'gidung', 'pado', 'haebang'], professor: '마법학과 엘린 교수' },
  archer: { name: '궁수', hp: 125, mp: 110, regen: 8, main: 'dex', skills: ['hwasal', 'sasl', 'soyong', 'hwasalbi'], professor: '궁술과 시엘 교수' },
};

export interface SkillDef {
  name: string;
  short?: string;
  cd: number;
  mp: number;
  elements: Element[];
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
  hwasalbi: { name: '화살비', cd: 12, mp: 22, elements: ALL_ELEMENTS },
};

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

export const expNeed = (level: number) => 40 + (level - 1) * 25;
