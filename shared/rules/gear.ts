// 장비 한 개(가방 칸)의 능력치 · 부가효과 굴리기 · 대장장이(강화·수리·옵션). 화면은 모른다.
import { itemDef, itemGrade, type BonusId, type EquipSlot } from '../data/items';
import {
  ENHANCE, ENHANCE_MAX, ENHANCE_PROTECT, OPTIONS, OPTION_POOL, OPT_CHANCE, OPT_MAX, OPT_MAX_TIER, OPT_UP_COST, REROLL_COST,
  enhanceMult, repairCost, type OptionId,
} from '../data/gear';
import { countItem, equipBonus, equippedSlot, removeItem, type BagEntry } from './inventory';
import { REPAIR_INGOT, enhanceIngot } from '../data/craft';
import type { SaveData } from '../sim/save';

export type Rng = () => number;
export type Bonus = Partial<Record<BonusId, number>>;

/** 이 값들은 정수로 (근력 등은 소수점이 어색해서) */
const INT_KEYS: BonusId[] = ['str', 'dex', 'int', 'hp', 'mp'];

/** 강화까지 반영한 장비 기본 능력치 */
export function baseBonus(e: BagEntry): Bonus {
  const b = itemDef(e.id)?.bonus ?? {}, m = enhanceMult(e.enh ?? 0), out: Bonus = {};
  for (const k of Object.keys(b) as BonusId[]) {
    const v = (b[k] ?? 0) * m;
    out[k] = INT_KEYS.includes(k) ? Math.round(v) : Math.round(v * 10) / 10;
  }
  return out;
}

/** 옵션 한 줄의 값 */
export const optionValue = (o: { id: OptionId; tier: number }) => Math.round(OPTIONS[o.id].per * o.tier * 10) / 10;

/** 장비 한 개가 주는 전부 (기본 × 강화 + 옵션). 파괴된 장비는 0 */
export function itemBonus(e: BagEntry): Bonus {
  if (e.broken) return {};
  const out = baseBonus(e);
  for (const o of e.opts ?? []) out[o.id] = (out[o.id] ?? 0) + optionValue(o);
  return out;
}

/**
 * 안 끼고 있는 장비를 끼면 능력치가 얼마나 바뀌는지 (끼면 들어갈 칸의 장비와 비교, 0 인 것은 뺌).
 * 끼고 있거나, 장비가 아니거나, 파괴됐으면 null
 */
export function compareGear(s: SaveData, e: BagEntry): { k: BonusId; v: number }[] | null {
  const part = itemDef(e.id)?.part;
  if (!part || e.broken || equippedSlot(s, e.uid)) return null;
  // 반지는 비어 있는 칸부터 (toggleEquip 과 같은 순서)
  const slot: EquipSlot = part === 'ring' ? (s.equip.ring1 === undefined ? 'ring1' : s.equip.ring2 === undefined ? 'ring2' : 'ring1') : part;
  // 끼기 전·후 전체 장비 능력치 차이 (세트 효과 포함)
  const b = equipBonus(s), a = equipBonus({ ...s, equip: { ...s.equip, [slot]: e.uid } });
  return (Object.keys(a) as BonusId[]).map(k => ({ k, v: Math.round((a[k] - b[k]) * 10) / 10 })).filter(x => x.v !== 0);
}

/** 이 장비에 아직 없는 옵션 중 하나 */
function pickOption(e: BagEntry, rng: Rng, except: OptionId[] = []): OptionId | null {
  const part = itemDef(e.id)?.part;
  if (!part) return null;
  const pool = OPTION_POOL[part].filter(id => !except.includes(id));
  return pool.length ? pool[Math.floor(rng() * pool.length)] : null;
}

/** 드롭된 장비: 확률로 옵션을 붙인다 (등급별 최대 개수) */
export function rollOptions(e: BagEntry, rng: Rng) {
  const g = itemGrade(itemDef(e.id));
  if (!g) return;
  const opts: { id: OptionId; tier: number }[] = [];
  for (let i = 0; i < OPT_MAX[g] && i < OPT_CHANCE.length; i++) {
    if (rng() >= OPT_CHANCE[i]) break;
    const id = pickOption(e, rng, opts.map(o => o.id));
    if (!id) break;
    opts.push({ id, tier: 1 });
  }
  if (opts.length) e.opts = opts;
}

// ---------- 대장장이 ----------
type Res = { ok: boolean; msg?: string; banner?: string; statsChanged?: boolean };
const fail = (msg: string): Res => ({ ok: false, msg });

export function findGear(s: SaveData, uid: number) {
  const e = s.bag.find(x => x?.uid === uid) ?? null;
  return e && itemDef(e.id)?.kind === 'equip' ? e : null;
}

function pay(s: SaveData, cost: number) {
  if (s.gold < cost) return false;
  s.gold -= cost;
  return true;
}

export function enhance(s: SaveData, uid: number, protect: boolean, rng: Rng): Res {
  const e = findGear(s, uid);
  if (!e) return fail('장비가 없어');
  if (e.broken) return fail('먼저 수리해야 해');
  const lv = e.enh ?? 0;
  if (lv >= ENHANCE_MAX) return fail('최대 강화야');
  const t = ENHANCE[lv], ing = enhanceIngot(lv);
  if (countItem(s, ing.item) < ing.n) return fail(`${itemDef(ing.item)?.name ?? ing.item} ${ing.n}개가 필요해`);
  if (!pay(s, t.cost * (protect ? ENHANCE_PROTECT : 1))) return fail('골드가 부족해');
  removeItem(s, ing.item, ing.n);
  const r = rng();
  const name = itemDef(e.id)!.name;
  if (r < t.ok) {
    e.enh = lv + 1;
    return { ok: true, banner: `강화 성공! +${lv + 1} ${name}`, statsChanged: true };
  }
  if (r < t.ok + t.boom && !protect) {
    e.broken = true;
    for (const k of Object.keys(s.equip) as (keyof SaveData['equip'])[]) if (s.equip[k] === uid) delete s.equip[k];
    return { ok: true, banner: `${name} 파괴…`, statsChanged: true };
  }
  return { ok: true, msg: '강화 실패' };
}

export function repair(s: SaveData, uid: number): Res {
  const e = findGear(s, uid);
  if (!e?.broken) return fail('파괴된 장비가 아니야');
  if (countItem(s, REPAIR_INGOT.item) < REPAIR_INGOT.n) return fail(`${itemDef(REPAIR_INGOT.item)?.name ?? REPAIR_INGOT.item} ${REPAIR_INGOT.n}개가 필요해`);
  if (!pay(s, repairCost(e.enh ?? 0))) return fail('골드가 부족해');
  removeItem(s, REPAIR_INGOT.item, REPAIR_INGOT.n);
  delete e.broken;
  return { ok: true, msg: '수리 완료' };
}

/** 옵션 종류만 다시 뽑음 (칸 수·단계 그대로) */
export function reroll(s: SaveData, uid: number, rng: Rng): Res {
  const e = findGear(s, uid);
  if (!e?.opts?.length) return fail('옵션이 없는 장비야');
  if (!pay(s, REROLL_COST)) return fail('골드가 부족해');
  const used: OptionId[] = [];
  for (const o of e.opts) { o.id = pickOption(e, rng, used) ?? o.id; used.push(o.id); }
  return { ok: true, msg: '옵션 재설정', statsChanged: true };
}

/** 옵션 칸 하나 강화 (무조건 성공, 최대 OPT_MAX_TIER) */
export function optionUp(s: SaveData, uid: number, slot: number): Res {
  const o = findGear(s, uid)?.opts?.[slot];
  if (!o) return fail('없는 옵션이야');
  if (o.tier >= OPT_MAX_TIER) return fail('최대 단계야');
  if (!pay(s, OPT_UP_COST[o.tier])) return fail('골드가 부족해');
  o.tier++;
  return { ok: true, msg: `옵션 ${o.tier}단계`, statsChanged: true };
}
