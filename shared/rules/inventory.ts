// 인벤토리·장비. 저장 데이터(SaveData)만 다루고 화면은 모른다.
//
// 가방은 BAG_SIZE 칸짜리 고정 배열. 빈 칸은 null 로 남는다 (자동 정렬은 정렬 버튼을 눌렀을 때만).
// 장비는 껴도 가방에서 사라지지 않고 자리를 차지한다. 장비창은 "어느 장비(uid)를 끼고 있는지"만 기억한다.
import { BAG_SIZE, STORAGE_SIZE, BONUS_NAMES, EQUIP_SLOTS, ITEMS, itemDef, sellPrice, type BonusId, type EquipSlot, type ItemKind } from '../data/items';
import type { StatId } from '../data/classes';
import type { OptionId } from '../data/gear';
import { itemBonus } from './gear';
import { GEAR_SETS } from '../data/sets';
import type { SaveData } from '../sim/save';

/** 가방 한 칸. 장비는 1개씩 따로(uid 로 구별), 나머지는 같은 것끼리 한 칸에 쌓인다 */
export interface BagEntry {
  id: string; n: number; uid?: number;
  /** 장비만: 강화 수치, 부가효과(옵션 종류·단계), 파괴됨 */
  enh?: number;
  opts?: { id: OptionId; tier: number }[];
  broken?: true;
}
export type Bag = (BagEntry | null)[];

export const BAG_FULL = '가방이 가득 찼어';

export const stackable = (id: string) => itemDef(id)?.kind !== 'equip';
export const emptyBag = (): Bag => Array.from({ length: BAG_SIZE }, () => null);
export const emptyStorage = (): Bag => Array.from({ length: STORAGE_SIZE }, () => null);

/**
 * 창고에 맡기기: 가방 index 칸을 통째로 창고(box)에 (쌓이는 물건은 같은 것이 있으면 합침).
 * 끼고 있는 장비는 못 맡김. box 는 개인 창고(s.storage) 또는 공용 창고(캐릭터끼리 같이 씀)
 */
export function depositItem(s: SaveData, box: Bag, index: number): { ok: boolean; msg?: string } {
  const e = s.bag[index];
  if (!e) return { ok: false };
  if (e.uid !== undefined && equippedSlot(s, e.uid)) return { ok: false, msg: '끼고 있는 장비는 못 맡겨' };
  const same = stackable(e.id) ? box.find(x => x?.id === e.id) : undefined;
  if (same) same.n += e.n;
  else {
    const free = box.indexOf(null);
    if (free < 0) return { ok: false, msg: '창고가 가득 찼어' };
    box[free] = { ...e };
  }
  s.bag[index] = null;
  return { ok: true };
}

/** 창고에서 꺼내기: 창고 index 칸을 통째로 가방에. 장비는 이 캐릭터의 새 번호(uid)를 받음 (공용 창고에서 다른 캐릭터 장비를 꺼낼 때 번호가 겹치지 않게) */
export function withdrawItem(s: SaveData, box: Bag, index: number): { ok: boolean; msg?: string } {
  const e = box[index];
  if (!e) return { ok: false };
  if (stackable(e.id)) {
    if (!addItem(s, e.id, e.n)) return { ok: false, msg: BAG_FULL };
  } else {
    const free = s.bag.indexOf(null);
    if (free < 0) return { ok: false, msg: BAG_FULL };
    s.bag[free] = { ...e, uid: s.nextUid++ };
  }
  box[index] = null;
  return { ok: true };
}

export function countItem(s: SaveData, id: string) {
  let n = 0;
  for (const e of s.bag) if (e?.id === id) n += e.n;
  return n;
}

const freeSlots = (s: SaveData) => s.bag.reduce((n, e) => n + (e ? 0 : 1), 0);

/** 가방에 넣을 자리가 있는지 */
export function canAdd(s: SaveData, id: string, n = 1) {
  const need = stackable(id) ? (s.bag.some(e => e?.id === id) ? 0 : 1) : n;
  return need <= freeSlots(s);
}

/** 가방에 넣기 (앞쪽 빈 칸부터). 자리가 없으면 아무것도 안 넣고 false */
export function addItem(s: SaveData, id: string, n = 1) {
  if (!itemDef(id) || n <= 0 || !canAdd(s, id, n)) return false;
  if (stackable(id)) {
    const e = s.bag.find(x => x?.id === id);
    if (e) { e.n += n; return true; }
    s.bag[s.bag.indexOf(null)] = { id, n };
    return true;
  }
  for (let i = 0; i < n; i++) s.bag[s.bag.indexOf(null)] = { id, n: 1, uid: s.nextUid++ };
  return true;
}

/** 가진 만큼만 뺀다. 다 빼면 true. 끼고 있던 장비가 빠지면 장비창에서도 빠진다 */
export function removeItem(s: SaveData, id: string, n = 1) {
  if (countItem(s, id) < n) return false;
  for (let i = s.bag.length - 1; i >= 0 && n > 0; i--) {
    const e = s.bag[i];
    if (e?.id !== id) continue;
    const k = Math.min(n, e.n);
    e.n -= k; n -= k;
    if (e.n <= 0) {
      s.bag[i] = null;
      if (e.uid !== undefined) unequipUid(s, e.uid);
    }
  }
  return true;
}

/** 이 장비를 끼고 있는 칸 (안 끼고 있으면 null) */
export function equippedSlot(s: SaveData, uid: number | undefined): EquipSlot | null {
  if (uid === undefined) return null;
  for (const slot of Object.keys(EQUIP_SLOTS) as EquipSlot[]) if (s.equip[slot] === uid) return slot;
  return null;
}

/** 장비 칸에 끼고 있는 가방 물건 */
export function equippedEntry(s: SaveData, slot: EquipSlot): BagEntry | null {
  const uid = s.equip[slot];
  return uid === undefined ? null : s.bag.find(e => e?.uid === uid) ?? null;
}

function unequipUid(s: SaveData, uid: number) {
  const slot = equippedSlot(s, uid);
  if (slot) delete s.equip[slot];
}

/** 가방 index 칸의 장비: 안 끼고 있으면 끼고, 끼고 있으면 벗는다. 그 부위에 있던 장비는 벗겨진다 */
export function toggleEquip(s: SaveData, index: number): string | null {
  const e = s.bag[index], d = e && itemDef(e.id);
  if (!e || !d?.part || e.uid === undefined) return '장착할 수 없는 물건이야';
  if (equippedSlot(s, e.uid)) { unequipUid(s, e.uid); return null; }
  if (e.broken) return '파괴된 장비야. 대장장이에게 수리하자';
  let slot: EquipSlot;
  if (d.part === 'ring') slot = s.equip.ring1 === undefined ? 'ring1' : s.equip.ring2 === undefined ? 'ring2' : 'ring1';
  else slot = d.part;
  s.equip[slot] = e.uid;
  return null;
}

/**
 * 가방 index 칸의 장비를 장비 칸 slot 에 (끌어다 놓기). 부위가 안 맞으면 아무것도 안 함 ('' 반환).
 * 반지를 반지1 ↔ 반지2 로 옮기면 두 칸이 서로 바뀐다
 */
export function equipTo(s: SaveData, index: number, slot: EquipSlot): string | null {
  const e = Number.isInteger(index) ? s.bag[index] : null, d = e && itemDef(e.id);
  if (!e || !d?.part || e.uid === undefined) return '';
  const fits = d.part === 'ring' ? slot === 'ring1' || slot === 'ring2' : d.part === slot;
  if (!fits) return '';
  const cur = equippedSlot(s, e.uid);
  if (cur === slot) return null;
  if (e.broken) return '파괴된 장비야. 대장장이에게 수리하자';
  const other = s.equip[slot];
  if (cur) {
    if (other !== undefined) s.equip[cur] = other;
    else delete s.equip[cur];
  }
  s.equip[slot] = e.uid;
  return null;
}

/** 가방 index 칸에서 n 개 꺼낸다 (바닥에 버리기, 없으면 전부). 끼고 있는 장비는 못 꺼냄 (null) */
export function takeBagEntry(s: SaveData, index: number, n?: number): BagEntry | null {
  const e = Number.isInteger(index) ? s.bag[index] : null;
  if (!e || equippedSlot(s, e.uid)) return null;
  const k = n === undefined ? e.n : Math.floor(n);
  if (!(k >= 1)) return null;
  if (k < e.n) { e.n -= k; return { id: e.id, n: k }; }
  s.bag[index] = null;
  return e;
}

/** 꺼냈던 칸을 가방에 다시 (바닥에서 줍기). 장비는 강화·부가효과 그대로, 쌓이는 물건은 같은 것과 합침 */
export function putBagEntry(s: SaveData, e: BagEntry): boolean {
  if (stackable(e.id)) return addItem(s, e.id, e.n);
  const i = s.bag.indexOf(null);
  if (i < 0) return false;
  s.bag[i] = { ...e, uid: s.nextUid++ };
  return true;
}

export function unequip(s: SaveData, slot: EquipSlot): string | null {
  if (s.equip[slot] === undefined) return '빈 칸이야';
  delete s.equip[slot];
  return null;
}

/** 매점에 팔기: 가방 index 칸에서 n 개. 받은 골드를 돌려줌 (못 팔면 이유 글) */
export function sellItem(s: SaveData, index: number, n: number): { gold: number } | string {
  const e = Number.isInteger(index) ? s.bag[index] : null;
  if (!e) return '없는 물건이야';
  const price = sellPrice(e.id);
  if (price <= 0) return '팔 수 없는 물건이야';
  if (equippedSlot(s, e.uid)) return '착용 중인 장비야';
  const k = Math.max(1, Math.min(e.n, Math.floor(n) || 1));
  e.n -= k;
  if (e.n <= 0) s.bag[index] = null;
  s.gold += price * k;
  return { gold: price * k };
}

/** 가방 칸 옮기기: 빈 칸이면 옮기고, 물건이 있으면 서로 자리를 바꾼다 */
export function moveItem(s: SaveData, from: number, to: number): string | null {
  const ok = (i: number) => Number.isInteger(i) && i >= 0 && i < s.bag.length;
  if (!ok(from) || !ok(to) || !s.bag[from]) return '옮길 수 없어';
  if (from === to) return null;
  [s.bag[from], s.bag[to]] = [s.bag[to], s.bag[from]];
  return null;
}

const KIND_ORDER: ItemKind[] = ['equip', 'use', 'etc'];
const ID_ORDER = Object.keys(ITEMS);

/** 자동 정렬: 장비 → 소비 → 기타, 같은 종류는 아이템 목록 순서, 빈 칸은 뒤로 */
export function sortBag(s: SaveData) {
  const items = s.bag.filter((e): e is BagEntry => !!e);
  const key = (e: BagEntry) => [KIND_ORDER.indexOf(itemDef(e.id)?.kind ?? 'etc'), ID_ORDER.indexOf(e.id), e.uid ?? 0];
  items.sort((a, b) => {
    const ka = key(a), kb = key(b);
    return ka[0] - kb[0] || ka[1] - kb[1] || ka[2] - kb[2];
  });
  s.bag = [...items, ...emptyBag()].slice(0, BAG_SIZE);
}

/** 장비로 오른 능력치 */
export function equipBonus(s: SaveData): Record<BonusId, number> {
  const b = Object.fromEntries(Object.keys(BONUS_NAMES).map(k => [k, 0])) as Record<BonusId, number>;
  for (const slot of Object.keys(EQUIP_SLOTS) as EquipSlot[]) {
    const e = equippedEntry(s, slot);
    if (!e) continue;
    const bonus = itemBonus(e);
    for (const k of Object.keys(bonus) as BonusId[]) b[k] += bonus[k] ?? 0;
  }
  // 세트 효과
  for (const { set, n } of wornSets(s)) {
    for (const ef of GEAR_SETS[set].effects) {
      if (n < ef.n) continue;
      for (const k of Object.keys(ef.bonus) as BonusId[]) b[k] += ef.bonus[k] ?? 0;
    }
  }
  return b;
}

/** 끼고 있는 장비 id (파괴된 것 빼고, 같은 것은 한 번) */
export function wornIds(s: SaveData): string[] {
  const ids = new Set<string>();
  for (const slot of Object.keys(EQUIP_SLOTS) as EquipSlot[]) {
    const e = equippedEntry(s, slot);
    if (e && !e.broken) ids.add(e.id);
  }
  return [...ids];
}

/** 세트마다 끼고 있는 개수 (1개 이상인 세트만) */
export function wornSets(s: SaveData): { set: string; n: number }[] {
  const worn = wornIds(s);
  return Object.keys(GEAR_SETS)
    .map(set => ({ set, n: GEAR_SETS[set].items.filter(i => worn.includes(i)).length }))
    .filter(x => x.n > 0);
}

/** 장비까지 더한 능력치 */
export function totalStats(s: SaveData): Record<StatId, number> {
  const b = equipBonus(s);
  return { str: s.stats.str + b.str, dex: s.stats.dex + b.dex, int: s.stats.int + b.int };
}

/**
 * 예전 저장 형태를 지금 형태로:
 * - 가방이 빈 칸 없는 목록이었던 때 → 60칸 배열
 * - 장비창에 아이템 id 를 적던 때(장비가 가방에서 빠졌음) → 가방에 다시 넣고 uid 로 연결
 */
export function migrateBag(s: SaveData, oldInventory?: Record<string, number>) {
  const raw = (s.bag ?? []) as (BagEntry | null)[];
  const oldEquip = (s.equip ?? {}) as Record<string, unknown>;
  s.nextUid ??= 1;
  if (raw.length !== BAG_SIZE || raw.some(e => e && itemDef(e.id)?.kind === 'equip' && e.uid === undefined)) {
    s.bag = emptyBag();
    for (const e of raw) if (e) addItem(s, e.id, e.n);
    if (oldInventory) for (const [id, n] of Object.entries(oldInventory)) addItem(s, id, n);
  }
  const equip: SaveData['equip'] = {};
  s.equip = equip;
  for (const [slot, v] of Object.entries(oldEquip) as [EquipSlot, unknown][]) {
    if (typeof v === 'number') equip[slot] = v;
    else if (typeof v === 'string' && addItem(s, v)) {
      // 방금 넣은 장비 (uid 가 제일 큰 것)
      equip[slot] = s.nextUid - 1;
    }
  }
}
