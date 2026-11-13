// 저장 데이터 형태 + 능력치 계산 (기획서 5장 공식)
import { CLASSES, PASSIVE, classActiveIds, CREATE_STAT_POINTS, DEFAULT_NAME, NAME_MAX, SLOT_KEYS, START_STAT, type ClassId, type SlotKey, type StatId } from '../data/classes';
import type { Element } from '../data/elements';
import type { MapId } from '../data/maps';
import { START_ITEMS, itemDef, type EquipSlot } from '../data/items';
import { questDef } from '../data/quests';
import type { QuestSave } from '../rules/quests';
import { addItem, emptyBag, migrateBag, totalStats, type Bag } from '../rules/inventory';

export type Gender = 'M' | 'F';

/** 저장 형태 번호. 저장 형태가 바뀌면 올리고 MIGRATIONS 에 바꾸는 방법을 적는다 */
export const SAVE_VERSION = 2;

export interface SaveData {
  version: number;
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
  /** 스킬 포인트: 스킬 초기화 주문서를 쓰면 수업으로 올린 레벨(Lv1 넘는 만큼)이 돌아옴. 스킬 창에서 배운 스킬에 찍는다 */
  skillPts: number;
  /** 스킬 키에 등록한 스킬 (키 → 직업 스킬 id) */
  skillKeys: Partial<Record<SlotKey, string>>;
  /** 가방 (BAG_SIZE 칸, 빈 칸 = null) */
  bag: Bag;
  /** 장비 칸 → 끼고 있는 가방 장비의 uid (장비는 껴도 가방에 남아 있다) */
  equip: Partial<Record<EquipSlot, number>>;
  /** 다음에 새로 얻는 장비에 붙일 번호 */
  nextUid: number;
  map: MapId;
  /** 퀘스트 상태. done = 한 번이라도 끝냄 */
  quests: Record<string, QuestSave>;
  /** 핀 꽂은 퀘스트 (꽂은 순서, 최대 QUEST_PIN_MAX) */
  questPins: string[];
  /** 퀘스트를 받거나 끝낼 때마다 1씩 오르는 번호 (받은 순서·끝낸 순서 정렬용) */
  questSeq: number;
  /** 이야기 진행 플래그 (이름 → 숫자). 대사 조건·효과에서 씀 */
  flags: Record<string, number>;
  /** 마지막으로 수업을 들은 날 (낮밤 주기 번호) */
  attendedCycle: number;
  /** 테스트용 시간 당기기 (ms) */
  timeOffset: number;
  kills: number;
}

/** 처음 스킬 키: Z A S D 에 직업 스킬 4개를 순서대로 */
export function defaultSkillKeys(cls: ClassId): Partial<Record<SlotKey, string>> {
  const out: Partial<Record<SlotKey, string>> = {};
  CLASSES[cls].skills.forEach((id, i) => { out[SLOT_KEYS[i]] = id; });
  return out;
}

export function newSave(name: string, cls: ClassId, gender: Gender): SaveData {
  const s: SaveData = {
    version: SAVE_VERSION, name, cls, gender, level: 1, exp: 0, gold: 0,
    stats: { str: START_STAT, dex: START_STAT, int: START_STAT }, statPts: 0,
    learned: {}, skillLevels: {}, skillPts: 0, skillKeys: defaultSkillKeys(cls),
    bag: emptyBag(), equip: {}, nextUid: 1,
    map: 'school',
    quests: {}, questPins: [], questSeq: 0, flags: {}, attendedCycle: -1, timeOffset: 0, kills: 0,
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

/**
 * 저장 형태 바꾸기: MIGRATIONS[n] = n 번 형태 → n+1 번 형태.
 * 예전 저장 데이터는 불러올 때 지금 형태까지 차례로 바꾼다.
 */
type OldSave = Record<string, unknown> & { version?: number };
const MIGRATIONS: Record<number, (s: OldSave) => void> = {
  // 1 → 2: 퀘스트 목표가 여러 개가 됨 (count → counts)
  1: s => {
    const qs = (s.quests ?? {}) as Record<string, { active: boolean; count?: number; done?: boolean }>;
    for (const st of Object.values(qs)) {
      (st as unknown as QuestSave).counts = [st.count ?? 0];
      delete st.count;
    }
  },
};

/** 예전 저장 데이터를 지금 형태로 바꾸고, 빠진 항목은 기본값으로 채우고, 이제 없는 퀘스트·물건은 지운다 */
export function normalizeSave(raw: SaveData): SaveData {
  const old = raw as unknown as OldSave;
  for (let v = old.version ?? 1; v < SAVE_VERSION; v++) MIGRATIONS[v]?.(old);
  const s = old as unknown as SaveData;
  const d = newSave(s.name, s.cls, s.gender);
  const out: SaveData = { ...d, ...s, version: SAVE_VERSION, stats: { ...d.stats, ...s.stats }, equip: { ...s.equip }, skillKeys: { ...(s.skillKeys ?? d.skillKeys) }, quests: { ...s.quests }, questPins: [...(s.questPins ?? [])] };
  // 예전 소지품 { hp, mp, reset } → 가방, 예전 가방·장비 형태 → 지금 형태
  const inv = (s as unknown as { inventory?: Record<string, number> }).inventory;
  if (!s.bag) out.bag = inv ? [] : d.bag;
  migrateBag(out, inv);
  delete (out as unknown as { inventory?: unknown }).inventory;
  cleanSave(out);
  return out;
}

/** 데이터에서 지운 퀘스트·물건이 저장에 남아 있으면 정리 (테스트 퀘스트·장비를 지워도 저장이 안 깨지게) */
function cleanSave(s: SaveData) {
  for (const [id, st] of Object.entries(s.quests)) {
    const q = questDef(id);
    if (!q) { delete s.quests[id]; continue; }
    // 목표 수가 바뀌었으면 숫자 칸을 맞춤
    st.counts = q.goals.map((_, i) => st.counts?.[i] ?? 0);
  }
  s.questPins = s.questPins.filter(id => s.quests[id]?.active);
  // 다른 직업 스킬·없는 스킬이 키에 있으면 빼기
  for (const [k, id] of Object.entries(s.skillKeys) as [SlotKey, string][]) if (!classActiveIds(s.cls).includes(id)) delete s.skillKeys[k];
  s.bag = s.bag.map(e => (e && itemDef(e.id) && e.n > 0 ? e : null));
  for (const [slot, uid] of Object.entries(s.equip) as [EquipSlot, number][]) {
    if (!s.bag.some(e => e?.uid === uid)) delete s.equip[slot];
  }
}

/** 패시브 레벨 (안 배웠으면 0). rules/progress 를 부르면 순환이라 여기 따로 */
const plv = (s: SaveData, id: string) => (id in s.learned ? s.skillLevels[id] ?? 1 : 0);

export interface DerivedStats { maxHp: number; maxMp: number; regen: number; speed: number; atk: number }

export function deriveStats(s: SaveData): DerivedStats {
  const c = CLASSES[s.cls], st = totalStats(s);
  return {
    maxHp: Math.round(c.hp + (s.level - 1) * 8 + (st.str - 5) * 6),
    maxMp: Math.round((c.mp + (s.level - 1) * 5) * (1 + PASSIVE.maxmp.pct * plv(s, 'maxmp'))),
    regen: c.regen * (1 + (st.int - 5) * 0.08),
    speed: Math.min(420, 260 + (st.dex - 5) * 6),
    atk: 20 + (st[c.main] - 5) * 1.6,
  };
}
