// 인벤토리·장비. 저장 데이터(SaveData)만 다루고 화면은 모른다.
import { BAG_SIZE, EQUIP_SLOTS, itemDef, type EquipSlot } from '../data/items';
import type { StatId } from '../data/classes';
import type { SaveData } from '../sim/save';

/** 가방 한 칸. 장비는 1개씩 따로, 나머지는 같은 것끼리 한 칸에 쌓인다 */
export interface BagEntry { id: string; n: number }

export const stackable = (id: string) => itemDef(id)?.kind !== 'equip';

export function countItem(s: SaveData, id: string) {
  let n = 0;
  for (const e of s.bag) if (e.id === id) n += e.n;
  return n;
}

/** 가방에 넣을 자리가 있는지 */
export function canAdd(s: SaveData, id: string, n = 1) {
  const need = stackable(id) ? (s.bag.some(e => e.id === id) ? 0 : 1) : n;
  return s.bag.length + need <= BAG_SIZE;
}

export const BAG_FULL = '가방이 가득 찼어';

/** 가방에 넣기. 자리가 없으면 아무것도 안 넣고 false */
export function addItem(s: SaveData, id: string, n = 1) {
  if (!itemDef(id) || n <= 0) return false;
  if (!canAdd(s, id, n)) return false;
  if (stackable(id)) {
    const e = s.bag.find(x => x.id === id);
    if (e) e.n += n;
    else s.bag.push({ id, n });
  } else for (let i = 0; i < n; i++) s.bag.push({ id, n: 1 });
  return true;
}

/** 가진 만큼만 뺀다. 다 빼면 true */
export function removeItem(s: SaveData, id: string, n = 1) {
  if (countItem(s, id) < n) return false;
  for (let i = s.bag.length - 1; i >= 0 && n > 0; i--) {
    const e = s.bag[i];
    if (e.id !== id) continue;
    const k = Math.min(n, e.n);
    e.n -= k; n -= k;
    if (e.n <= 0) s.bag.splice(i, 1);
  }
  return true;
}

/** 가방 index 칸의 장비를 낀다. 그 부위에 이미 있던 장비는 가방으로 */
export function equipFromBag(s: SaveData, index: number): string | null {
  const e = s.bag[index], d = e && itemDef(e.id);
  if (!e || !d?.part) return '장착할 수 없는 물건이야';
  let slot: EquipSlot;
  if (d.part === 'ring') slot = !s.equip.ring1 ? 'ring1' : !s.equip.ring2 ? 'ring2' : 'ring1';
  else slot = d.part;
  const old = s.equip[slot];
  s.bag.splice(index, 1);
  s.equip[slot] = e.id;
  if (old) s.bag.splice(index, 0, { id: old, n: 1 });
  return null;
}

export function unequip(s: SaveData, slot: EquipSlot): string | null {
  const id = s.equip[slot];
  if (!id) return '빈 칸이야';
  if (!canAdd(s, id)) return BAG_FULL;
  delete s.equip[slot];
  s.bag.push({ id, n: 1 });
  return null;
}

/** 장비로 오른 능력치 */
export function equipBonus(s: SaveData): Record<StatId, number> {
  const b: Record<StatId, number> = { str: 0, dex: 0, int: 0 };
  for (const slot of Object.keys(EQUIP_SLOTS) as EquipSlot[]) {
    const id = s.equip[slot], bonus = id ? itemDef(id)?.bonus : undefined;
    if (bonus) for (const k of Object.keys(bonus) as StatId[]) b[k] += bonus[k] ?? 0;
  }
  return b;
}

/** 장비까지 더한 능력치 */
export function totalStats(s: SaveData): Record<StatId, number> {
  const b = equipBonus(s);
  return { str: s.stats.str + b.str, dex: s.stats.dex + b.dex, int: s.stats.int + b.int };
}
