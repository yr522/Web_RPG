// 인벤토리·장비. 저장 데이터(SaveData)만 다루고 화면은 모른다.
//
// 가방은 BAG_SIZE 칸짜리 고정 배열. 빈 칸은 null 로 남는다 (자동 정렬은 정렬 버튼을 눌렀을 때만).
// 장비는 껴도 가방에서 사라지지 않고 자리를 차지한다. 장비창은 "어느 장비(uid)를 끼고 있는지"만 기억한다.
import { BAG_SIZE, EQUIP_SLOTS, ITEMS, itemDef, type EquipSlot, type ItemKind } from '../data/items';
import type { StatId } from '../data/classes';
import type { SaveData } from '../sim/save';

/** 가방 한 칸. 장비는 1개씩 따로(uid 로 구별), 나머지는 같은 것끼리 한 칸에 쌓인다 */
export interface BagEntry { id: string; n: number; uid?: number }
export type Bag = (BagEntry | null)[];

export const BAG_FULL = '가방이 가득 찼어';

export const stackable = (id: string) => itemDef(id)?.kind !== 'equip';
export const emptyBag = (): Bag => Array.from({ length: BAG_SIZE }, () => null);

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
  let slot: EquipSlot;
  if (d.part === 'ring') slot = s.equip.ring1 === undefined ? 'ring1' : s.equip.ring2 === undefined ? 'ring2' : 'ring1';
  else slot = d.part;
  s.equip[slot] = e.uid;
  return null;
}

export function unequip(s: SaveData, slot: EquipSlot): string | null {
  if (s.equip[slot] === undefined) return '빈 칸이야';
  delete s.equip[slot];
  return null;
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
export function equipBonus(s: SaveData): Record<StatId, number> {
  const b: Record<StatId, number> = { str: 0, dex: 0, int: 0 };
  for (const slot of Object.keys(EQUIP_SLOTS) as EquipSlot[]) {
    const e = equippedEntry(s, slot), bonus = e ? itemDef(e.id)?.bonus : undefined;
    if (bonus) for (const k of Object.keys(bonus) as StatId[]) b[k] += bonus[k] ?? 0;
  }
  return b;
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
