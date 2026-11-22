import { describe, expect, it } from 'vitest';
import { ENHANCE, ENHANCE_MAX, OPT_MAX_TIER, OPTION_POOL, enhanceMult, repairCost } from '../shared/data/gear';
import { ITEMS, dropChance, itemDef, type ItemId } from '../shared/data/items';
import { baseBonus, compareGear, enhance, itemBonus, optionUp, repair, reroll, rollOptions } from '../shared/rules/gear';
import { CANT_WEAR, addItem, equipBonus, equipTo, equippedEntry, hasWeapon, toggleEquip } from '../shared/rules/inventory';
import { applyAction, keySkill } from '../shared/rules/progress';
import { mulberry32 } from '../shared/sim/rng';
import { deriveStats, newSave, normalizeSave, type SaveData } from '../shared/sim/save';

const fixed = (...vals: number[]) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

function withGear(id: ItemId, gold = 1e6): { s: SaveData; uid: number; idx: number } {
  const s = newSave('t', 'warrior', 'M');
  s.gold = gold;
  addItem(s, id);
  const idx = s.bag.findIndex(e => e?.id === id);
  // 강화·수리 재료 주괴
  addItem(s, 'ingot_rusty', 20); addItem(s, 'ingot_iron', 20);
  return { s, uid: s.bag[idx]!.uid!, idx };
}

describe('강화 표', () => {
  it('15칸, 확률 합은 1 이하, 비용은 오르기만', () => {
    expect(ENHANCE).toHaveLength(ENHANCE_MAX);
    for (const t of ENHANCE) expect(t.ok + t.boom).toBeLessThanOrEqual(1);
    for (let i = 1; i < ENHANCE.length; i++) expect(ENHANCE[i].cost).toBeGreaterThan(ENHANCE[i - 1].cost);
  });
  it('1~5강은 파괴 없음', () => {
    for (let i = 0; i < 5; i++) expect(ENHANCE[i].boom).toBe(0);
  });
  it('15강 = 기본 능력치 +90%', () => {
    expect(enhanceMult(0)).toBe(1);
    expect(enhanceMult(5)).toBeCloseTo(1.4);
    expect(enhanceMult(15)).toBeCloseTo(1.9);
  });
});

describe('대장장이 강화', () => {
  it('성공하면 +1, 골드 빠짐', () => {
    const { s, uid } = withGear('slime_armor', 1000);
    const r = enhance(s, uid, false, fixed(0));
    expect(r.ok).toBe(true);
    expect(s.bag.find(e => e?.uid === uid)!.enh).toBe(1);
    expect(s.gold).toBe(1000 - ENHANCE[0].cost);
  });
  it('골드가 모자라면 아무것도 안 바뀜', () => {
    const { s, uid } = withGear('slime_armor', 10);
    expect(enhance(s, uid, false, fixed(0)).ok).toBe(false);
    expect(s.gold).toBe(10);
  });
  it('파괴: 장비창에서 빠지고 낄 수 없음, 수리하면 강화 그대로', () => {
    const { s, uid, idx } = withGear('slime_armor');
    s.bag[idx]!.enh = 10;
    toggleEquip(s, idx);
    expect(s.equip.top).toBe(uid);
    const t = ENHANCE[10];
    enhance(s, uid, false, fixed(t.ok + t.boom / 2));
    expect(s.bag[idx]!.broken).toBe(true);
    expect(s.equip.top).toBeUndefined();
    expect(itemBonus(s.bag[idx]!)).toEqual({});
    expect(toggleEquip(s, idx)).not.toBeNull();
    const g = s.gold;
    expect(repair(s, uid).ok).toBe(true);
    expect(s.gold).toBe(g - repairCost(10));
    expect(s.bag[idx]!.broken).toBeUndefined();
    expect(s.bag[idx]!.enh).toBe(10);
  });
  it('파괴 방지: 비용 2배, 파괴 대신 실패', () => {
    const { s, uid, idx } = withGear('slime_armor', 1e6);
    s.bag[idx]!.enh = 10;
    const t = ENHANCE[10];
    enhance(s, uid, true, fixed(t.ok + t.boom / 2));
    expect(s.bag[idx]!.broken).toBeUndefined();
    expect(s.bag[idx]!.enh).toBe(10);
    expect(s.gold).toBe(1e6 - t.cost * 2);
  });
  it('강화·수리에 주괴가 듦 (+0~4 녹슨 1 · +5~9 녹슨 2 · +10~ 철 1, 수리 철 1), 없으면 못 함', async () => {
    const { countItem, removeItem } = await import('../shared/rules/inventory');
    const { s, uid, idx } = withGear('slime_armor');
    enhance(s, uid, false, fixed(0));
    expect(countItem(s, 'ingot_rusty')).toBe(19);
    s.bag[idx]!.enh = 5;
    enhance(s, uid, false, fixed(0));
    expect(countItem(s, 'ingot_rusty')).toBe(17);
    expect(countItem(s, 'ingot_iron')).toBe(20);
    s.bag[idx]!.enh = 10;
    enhance(s, uid, false, fixed(0));
    expect(countItem(s, 'ingot_iron')).toBe(19);
    s.bag[idx]!.broken = true;
    expect(repair(s, uid).ok).toBe(true);
    expect(countItem(s, 'ingot_iron')).toBe(18);
    removeItem(s, 'ingot_rusty', 17);
    s.bag[idx]!.enh = 0;
    const g = s.gold;
    expect(enhance(s, uid, false, fixed(0)).ok).toBe(false);
    expect(s.gold).toBe(g);
  });
  it('15강 넘게는 안 됨', () => {
    const { s, uid, idx } = withGear('slime_armor');
    s.bag[idx]!.enh = ENHANCE_MAX;
    expect(enhance(s, uid, false, fixed(0)).ok).toBe(false);
  });
  it('파괴된 장비는 강화 못 함', () => {
    const { s, uid, idx } = withGear('slime_armor');
    s.bag[idx]!.broken = true;
    expect(enhance(s, uid, false, fixed(0)).ok).toBe(false);
  });
  it('장비가 아닌 것은 대장장이가 안 받음', () => {
    const s = newSave('t', 'warrior', 'M');
    s.gold = 1e6;
    expect(enhance(s, 999, false, fixed(0)).ok).toBe(false);
  });
});

describe('옵션', () => {
  it('커먼은 최대 1개, 부위 목록 안에서만, 1단계로', () => {
    for (let seed = 1; seed < 300; seed++) {
      const { s, idx } = withGear('slime_ring');
      const e = s.bag[idx]!;
      rollOptions(e, mulberry32(seed));
      expect((e.opts ?? []).length).toBeLessThanOrEqual(1);
      for (const o of e.opts ?? []) {
        expect(OPTION_POOL.ring).toContain(o.id);
        expect(o.tier).toBe(1);
      }
    }
  });
  it('높은 등급은 여러 개, 겹치지 않음', () => {
    let three = 0;
    for (let seed = 1; seed < 2000; seed++) {
      const { s, idx } = withGear('grade_mythic');
      const e = s.bag[idx]!;
      rollOptions(e, mulberry32(seed));
      const ids = (e.opts ?? []).map(o => o.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(ids.length).toBeLessThanOrEqual(3);
      if (ids.length === 3) three++;
    }
    expect(three).toBeGreaterThan(0);
  });
  it('칸 강화는 무조건 성공, 최대 단계까지', () => {
    const { s, uid, idx } = withGear('slime_armor');
    s.bag[idx]!.opts = [{ id: 'def', tier: 1 }];
    for (let i = 1; i < OPT_MAX_TIER; i++) expect(optionUp(s, uid, 0).ok).toBe(true);
    expect(s.bag[idx]!.opts![0].tier).toBe(OPT_MAX_TIER);
    expect(optionUp(s, uid, 0).ok).toBe(false);
  });
  it('재설정은 종류만 바꾸고 칸 수·단계는 그대로, 겹치지 않음', () => {
    const { s, uid, idx } = withGear('grade_mythic');
    s.bag[idx]!.opts = [{ id: 'str', tier: 3 }, { id: 'atk', tier: 1 }, { id: 'crit', tier: 5 }];
    for (let seed = 1; seed < 100; seed++) {
      expect(reroll(s, uid, mulberry32(seed)).ok).toBe(true);
      const o = s.bag[idx]!.opts!;
      expect(o.map(x => x.tier)).toEqual([3, 1, 5]);
      expect(new Set(o.map(x => x.id)).size).toBe(3);
      for (const x of o) expect(OPTION_POOL.weapon).toContain(x.id);
    }
  });
  it('옵션 없는 장비는 재설정 못 함', () => {
    const { s, uid } = withGear('slime_armor');
    expect(reroll(s, uid, mulberry32(1)).ok).toBe(false);
  });
});

describe('능력치', () => {
  it('강화·옵션이 장착 능력치에 들어감', () => {
    const { s, idx } = withGear('slime_armor');
    const e = s.bag[idx]!;
    e.enh = 5;
    e.opts = [{ id: 'def', tier: 2 }];
    toggleEquip(s, idx);
    const b = equipBonus(s);
    expect(baseBonus(e).def).toBeCloseTo(4 * 1.4);
    expect(b.def).toBeCloseTo(4 * 1.4 + 6);
    expect(b.hp).toBe(14);
    expect(deriveStats(s).def).toBeCloseTo(b.def);
  });
  it('MP 소모 감소는 50%까지', () => {
    const { s, idx } = withGear('grade_mythic');
    s.bag[idx]!.opts = [{ id: 'mpCost', tier: 5 }];
    toggleEquip(s, idx);
    addItem(s, 'test_necklace');
    expect(deriveStats(s).mpCost).toBeLessThanOrEqual(0.5);
  });
  it('모든 장비 아이템은 부위·능력치가 있고, 부위마다 옵션 목록이 있음', () => {
    for (const id of Object.keys(ITEMS) as ItemId[]) {
      const d = itemDef(id)!;
      if (d.kind !== 'equip') continue;
      expect(d.part).toBeDefined();
      expect(d.bonus).toBeDefined();
      expect(OPTION_POOL[d.part!].length).toBeGreaterThan(0);
    }
  });
});

describe('메뉴 행동 · 저장', () => {
  it('applyAction 으로 대장장이 행동', () => {
    const { s, uid } = withGear('slime_armor');
    expect(applyAction(s, { type: 'smithEnhance', uid, protect: false }, 0, fixed(0)).ok).toBe(true);
    expect(s.bag.find(e => e?.uid === uid)!.enh).toBe(1);
  });
  it('강화·옵션·파괴가 저장 → 불러오기 뒤에도 남음', () => {
    const { s, idx } = withGear('slime_armor');
    s.bag[idx]!.enh = 7;
    s.bag[idx]!.opts = [{ id: 'hp', tier: 4 }];
    s.bag[idx]!.broken = true;
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.bag[idx]).toEqual(s.bag[idx]);
  });
});

describe('장비 비교', () => {
  it('빈 칸이면 장비 능력치 그대로, 끼고 있으면 차이', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'test_top'); addItem(s, 'slime_armor');
    const top = s.bag.find(e => e?.id === 'test_top')!, slime = s.bag.find(e => e?.id === 'slime_armor')!;
    expect(compareGear(s, slime)).toEqual([{ k: 'def', v: 4 }, { k: 'hp', v: 10 }]);
    toggleEquip(s, s.bag.indexOf(top));
    expect(compareGear(s, top)).toBeNull();
    // 슬라임 갑옷 (방어 4, HP 10) vs 테스트 상의 (근력 1, 방어 5)
    expect(compareGear(s, slime)).toEqual([{ k: 'str', v: -1 }, { k: 'def', v: -1 }, { k: 'hp', v: 10 }]);
  });
  it('반지는 빈 칸이 있으면 빈 칸과 비교', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'test_ring'); addItem(s, 'slime_ring');
    toggleEquip(s, s.bag.findIndex(e => e?.id === 'test_ring'));
    expect(compareGear(s, s.bag.find(e => e?.id === 'slime_ring')!)).toEqual([{ k: 'hp', v: 15 }, { k: 'mp', v: 10 }]);
  });
});

describe('세트 효과', () => {
  it('세트 장비를 다 끼면 효과가 켜지고, 하나 벗으면 꺼짐. 비교에도 세트 효과가 들어감', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'slime_armor'); addItem(s, 'slime_ring');
    const armor = s.bag.findIndex(e => e?.id === 'slime_armor'), ring = s.bag.findIndex(e => e?.id === 'slime_ring');
    toggleEquip(s, armor);
    expect(equipBonus(s).def).toBe(4);
    // 반지를 끼면: 반지 HP·MP + 세트 방어력 5
    expect(compareGear(s, s.bag[ring]!)).toEqual([{ k: 'def', v: 5 }, { k: 'hp', v: 15 }, { k: 'mp', v: 10 }]);
    toggleEquip(s, ring);
    expect(equipBonus(s).def).toBe(9);
    toggleEquip(s, armor);
    expect(equipBonus(s).def).toBe(0);
  });
  it('같은 반지 2개는 1개로 셈 (세트 안 켜짐)', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'slime_ring'); addItem(s, 'slime_ring');
    s.bag.forEach((e, i) => { if (e?.id === 'slime_ring') toggleEquip(s, i); });
    expect(equipBonus(s).def).toBe(0);
  });
  it('골렘 세트: 공격력 5 · 보스 피해 10%', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'golem_weapon'); addItem(s, 'golem_gloves');
    s.bag.forEach((e, i) => { if (e) toggleEquip(s, i); });
    expect(equipBonus(s).atk).toBe(12 + 3 + 5);
    expect(deriveStats(s).boss).toBeCloseTo(0.1);
  });
});

describe('대장장이 제작', () => {
  it('맡기면 재료·형판·골드를 가져가고 30초마다 하나씩, 받으면 가방에. 게임을 꺼도(시간만 지나면) 완성', async () => {
    const { craftOrder, craftCollect, craftStatus } = await import('../shared/rules/craft');
    const { CRAFT, recipeDef } = await import('../shared/data/craft');
    const { countItem } = await import('../shared/rules/inventory');
    const s = newSave('t', 'warrior', 'M');
    s.gold = 1000;
    addItem(s, 'scrap_rusty', 25); addItem(s, 'mold_rusty', 3);
    const r = recipeDef('ingot_rusty')!, T = CRAFT.time * 1000;
    expect(craftOrder(s, 'ingot_rusty', 0).ok).toBe(true);
    expect(craftOrder(s, 'ingot_rusty', 0).ok).toBe(true);
    expect(craftOrder(s, 'ingot_rusty', 0).ok).toBe(false); // 고철 5개 남음
    expect(countItem(s, 'scrap_rusty')).toBe(5);
    expect(countItem(s, 'mold_rusty')).toBe(1);
    expect(s.gold).toBe(1000 - r.gold * 2);
    expect(craftStatus(s, T - 1)).toEqual({ done: 0, left: 1 });
    expect(craftCollect(s, T - 1).ok).toBe(false);
    expect(craftStatus(s, T * 5).done).toBe(2);
    expect(craftCollect(s, T * 5).ok).toBe(true);
    expect(countItem(s, 'ingot_rusty')).toBe(2);
    expect(s.craft.queue).toEqual([]);
  });
  it('대기열은 최대 개수까지, 형판은 대장장이에게 삼', async () => {
    const { CRAFT } = await import('../shared/data/craft');
    const s = newSave('t', 'warrior', 'M');
    s.gold = 1e6;
    expect(applyAction(s, { type: 'buyMold', item: 'mold_iron', n: 12 }, 0).ok).toBe(true);
    addItem(s, 'scrap_good', 100);
    for (let i = 0; i < CRAFT.queueMax; i++) expect(applyAction(s, { type: 'craftOrder', recipe: 'ingot_iron' }, 0).ok).toBe(true);
    expect(applyAction(s, { type: 'craftOrder', recipe: 'ingot_iron' }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'buyMold', item: 'hp', n: 1 }, 0).ok).toBe(false);
  });
});

describe('장비 칸에 끌어다 놓기', () => {
  it('부위가 맞으면 장착, 안 맞으면 아무 일 없음', () => {
    const { s, uid, idx } = withGear('slime_armor');
    expect(applyAction(s, { type: 'equipTo', index: idx, slot: 'hat' }, 0)).toEqual({ ok: false });
    expect(s.equip.hat).toBeUndefined();
    expect(applyAction(s, { type: 'equipTo', index: idx, slot: 'top' }, 0).ok).toBe(true);
    expect(s.equip.top).toBe(uid);
  });
  it('반지는 반지1·반지2 아무 칸이나, 옮기면 두 칸이 바뀜', () => {
    const a = withGear('slime_ring');
    const s = a.s;
    addItem(s, 'slime_ring');
    const idx2 = s.bag.findIndex((e, i) => e?.id === 'slime_ring' && i !== a.idx);
    const uid2 = s.bag[idx2]!.uid;
    equipTo(s, a.idx, 'ring2');
    equipTo(s, idx2, 'ring1');
    expect([s.equip.ring1, s.equip.ring2]).toEqual([uid2, a.uid]);
    equipTo(s, a.idx, 'ring1');
    expect([s.equip.ring1, s.equip.ring2]).toEqual([a.uid, uid2]);
  });
});

describe('행운의 반지 · 주화 상점 · 드롭률', () => {
  it('드롭률은 보너스끼리 더한 뒤 곱함 (1% × (1 + 0.5 + 1.0) = 2.5%), 100% 를 안 넘음', () => {
    expect(dropChance(0.01, 50 + 100)).toBeCloseTo(0.025);
    expect(dropChance(0.7, 100)).toBe(1);
  });
  it('미션 주화 5개로 행운의 반지, 끼면 드롭률 +10 · 방어력 +5', () => {
    const s = newSave('t', 'warrior', 'M');
    expect(applyAction(s, { type: 'coinBuy', item: 'luck_ring' }, 0).ok).toBe(false);
    addItem(s, 'mission_coin', 5);
    expect(applyAction(s, { type: 'coinBuy', item: 'luck_ring' }, 0).ok).toBe(true);
    expect(s.bag.some(e => e?.id === 'mission_coin')).toBe(false);
    toggleEquip(s, s.bag.findIndex(e => e?.id === 'luck_ring'));
    const b = equipBonus(s);
    expect([b.drop, b.def]).toEqual([10, 5]);
  });
});

describe('직업별 장비 · 처음 무기 · 주먹질', () => {
  it('캐릭터를 만들면 직업에 맞는 평범한 무기를 끼고 시작', () => {
    for (const [cls, id] of [['warrior', 'plain_sword'], ['mage', 'plain_staff'], ['archer', 'plain_bow']] as const) {
      const s = newSave('t', cls, 'M');
      expect(equippedEntry(s, 'weapon')?.id).toBe(id);
      expect(hasWeapon(s)).toBe(true);
      expect(keySkill(s, 'Z')).toBe('basic');
    }
  });
  it('다른 직업 무기는 못 낌 (우클릭·끌어다 놓기 둘 다)', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'plain_staff');
    const i = s.bag.findIndex(e => e?.id === 'plain_staff');
    expect(toggleEquip(s, i)).toBe(CANT_WEAR);
    expect(equipTo(s, i, 'weapon')).toBe(CANT_WEAR);
    expect(equippedEntry(s, 'weapon')?.id).toBe('plain_sword');
  });
  it('무기를 벗으면 Z 가 주먹질, 다시 끼면 원래대로. 주먹질 공격력은 근력', () => {
    const s = newSave('t', 'mage', 'M');
    const i = s.bag.findIndex(e => e?.id === 'plain_staff');
    toggleEquip(s, i);
    expect(keySkill(s, 'Z')).toBe('punch');
    s.stats.str = 15; s.stats.int = 5;
    const st = deriveStats(s);
    expect(st.punchAtk).toBeGreaterThan(st.atk);
    toggleEquip(s, i);
    expect(keySkill(s, 'Z')).toBe('basic');
  });
  it('Z 는 다른 스킬로 못 바꿈', () => {
    const s = newSave('t', 'warrior', 'M');
    expect(applyAction(s, { type: 'unbindKey', key: 'Z' }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'swapKeys', from: 'Z', to: 'A' }, 0).ok).toBe(false);
    expect(s.skillKeys.Z).toBe('ilseom');
  });
  it('예전 캐릭터(무기 없음)는 불러올 때 한 번 받음', () => {
    const s = newSave('t', 'archer', 'M');
    s.bag = s.bag.map(e => (e?.id === 'plain_bow' ? null : e));
    s.equip = {};
    delete s.flags.start_weapon;
    const n = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(equippedEntry(n, 'weapon')?.id).toBe('plain_bow');
    const again = normalizeSave(JSON.parse(JSON.stringify(n)));
    expect(again.bag.filter(e => e?.id === 'plain_bow').length).toBe(1);
  });
});
