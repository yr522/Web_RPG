// 저장 데이터 형태 + 능력치 계산 (기획서 5장 공식)
import { CLASSES, type ClassId, type StatId } from '../data/classes';
import type { Element } from '../data/elements';
import type { MapId } from '../data/maps';

export type Gender = 'M' | 'F';

export interface SaveData {
  version: 1;
  name: string;
  cls: ClassId;
  gender: Gender;
  level: number;
  exp: number;
  gold: number;
  stats: Record<StatId, number>;
  statPts: number;
  /** 배운 스킬 → 고른 원소 (원소 없는 스킬은 null) */
  learned: Record<string, Element | null>;
  skillLevels: Record<string, number>;
  inventory: { hp: number; mp: number; reset: number };
  map: MapId;
  quests: Record<string, { active: boolean; count: number }>;
  /** 마지막으로 수업을 들은 날 (낮밤 주기 번호) */
  attendedCycle: number;
  /** 테스트용 시간 당기기 (ms) */
  timeOffset: number;
  kills: number;
}

export function newSave(name: string, cls: ClassId, gender: Gender): SaveData {
  return {
    version: 1, name, cls, gender, level: 1, exp: 0, gold: 0,
    stats: { str: 5, dex: 5, int: 5 }, statPts: 0,
    learned: {}, skillLevels: {},
    inventory: { hp: 3, mp: 3, reset: 0 },
    map: 'school',
    quests: {}, attendedCycle: -1, timeOffset: 0, kills: 0,
  };
}

/** 예전 저장 데이터에 새 항목이 없으면 기본값으로 채운다 */
export function normalizeSave(s: SaveData): SaveData {
  const d = newSave(s.name, s.cls, s.gender);
  return { ...d, ...s, inventory: { ...d.inventory, ...s.inventory }, stats: { ...d.stats, ...s.stats } };
}

export interface DerivedStats { maxHp: number; maxMp: number; regen: number; speed: number; atk: number }

export function deriveStats(s: SaveData): DerivedStats {
  const c = CLASSES[s.cls], st = s.stats;
  return {
    maxHp: Math.round(c.hp + (s.level - 1) * 8 + (st.str - 5) * 6),
    maxMp: Math.round(c.mp + (s.level - 1) * 5),
    regen: c.regen * (1 + (st.int - 5) * 0.08),
    speed: Math.min(420, 260 + (st.dex - 5) * 6),
    atk: 20 + (st[c.main] - 5) * 1.6,
  };
}
