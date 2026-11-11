// 저장 데이터 형태 + 능력치 계산 (기획서 5장 공식)
import { CLASSES, CREATE_STAT_POINTS, DEFAULT_NAME, NAME_MAX, START_STAT, type ClassId, type StatId } from '../data/classes';
import type { Element } from '../data/elements';
import type { MapId } from '../data/maps';
import { START_ITEMS, type EquipSlot } from '../data/items';
import { addItem, emptyBag, migrateBag, totalStats, type Bag } from '../rules/inventory';

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
  /** 가방 (BAG_SIZE 칸, 빈 칸 = null) */
  bag: Bag;
  /** 장비 칸 → 끼고 있는 가방 장비의 uid (장비는 껴도 가방에 남아 있다) */
  equip: Partial<Record<EquipSlot, number>>;
  /** 다음에 새로 얻는 장비에 붙일 번호 */
  nextUid: number;
  map: MapId;
  /** 퀘스트 상태. done = 한 번이라도 끝냄 */
  quests: Record<string, { active: boolean; count: number; done?: boolean }>;
  /** 이야기 진행 플래그 (이름 → 숫자). 대사 조건·효과에서 씀 */
  flags: Record<string, number>;
  /** 마지막으로 수업을 들은 날 (낮밤 주기 번호) */
  attendedCycle: number;
  /** 테스트용 시간 당기기 (ms) */
  timeOffset: number;
  kills: number;
}

export function newSave(name: string, cls: ClassId, gender: Gender): SaveData {
  const s: SaveData = {
    version: 1, name, cls, gender, level: 1, exp: 0, gold: 0,
    stats: { str: START_STAT, dex: START_STAT, int: START_STAT }, statPts: 0,
    learned: {}, skillLevels: {},
    bag: emptyBag(), equip: {}, nextUid: 1,
    map: 'school',
    quests: {}, flags: {}, attendedCycle: -1, timeOffset: 0, kills: 0,
  };
  for (const it of START_ITEMS) addItem(s, it.id, it.n);
  return s;
}

/**
 * 캐릭터 생성 화면에서 만든 캐릭터. add = 생성 때 나눠 준 능력치 포인트.
 * 잘못된 값은 고쳐서 받는다 (나중에 서버도 같은 함수로 검사).
 */
export function createSave(name: string, cls: ClassId, gender: Gender, add: Record<StatId, number>): SaveData {
  const s = newSave(name.trim().slice(0, NAME_MAX) || DEFAULT_NAME, CLASSES[cls] ? cls : 'warrior', gender === 'F' ? 'F' : 'M');
  let left = CREATE_STAT_POINTS;
  for (const k of ['str', 'dex', 'int'] as StatId[]) {
    const n = Math.max(0, Math.min(left, Math.floor(add[k] || 0)));
    s.stats[k] += n;
    left -= n;
  }
  s.statPts = left;
  return s;
}

/** 예전 저장 데이터에 새 항목이 없으면 기본값으로 채운다 */
export function normalizeSave(s: SaveData): SaveData {
  const d = newSave(s.name, s.cls, s.gender);
  const out: SaveData = { ...d, ...s, stats: { ...d.stats, ...s.stats }, equip: { ...s.equip } };
  // 예전 소지품 { hp, mp, reset } → 가방, 예전 가방·장비 형태 → 지금 형태
  const old = (s as unknown as { inventory?: Record<string, number> }).inventory;
  if (!s.bag) out.bag = old ? [] : d.bag;
  migrateBag(out, old);
  delete (out as unknown as { inventory?: unknown }).inventory;
  return out;
}

export interface DerivedStats { maxHp: number; maxMp: number; regen: number; speed: number; atk: number }

export function deriveStats(s: SaveData): DerivedStats {
  const c = CLASSES[s.cls], st = totalStats(s);
  return {
    maxHp: Math.round(c.hp + (s.level - 1) * 8 + (st.str - 5) * 6),
    maxMp: Math.round(c.mp + (s.level - 1) * 5),
    regen: c.regen * (1 + (st.int - 5) * 0.08),
    speed: Math.min(420, 260 + (st.dex - 5) * 6),
    atk: 20 + (st[c.main] - 5) * 1.6,
  };
}
