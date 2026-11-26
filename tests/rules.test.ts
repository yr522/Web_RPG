// 가방·퀘스트·성장 규칙
import { describe, expect, it } from 'vitest';
import { BAG_SIZE } from '../shared/data/items';
import { expNeed, MAX_LEVEL } from '../shared/data/classes';
import { expGapMult } from '../shared/data/monsters';
import { addItem, canAdd, countItem, equippedSlot, moveItem, removeItem, sortBag, toggleEquip } from '../shared/rules/inventory';
import { acceptQuest, questState, questsOnKill, reportQuest, togglePin } from '../shared/rules/quests';
import { applyAction, gainExp } from '../shared/rules/progress';
import { createSave, deriveStats, newSave, normalizeSave } from '../shared/sim/save';

const fresh = () => newSave('t', 'warrior', 'M');

describe('가방', () => {
  it('소비 물건은 한 칸에 쌓이고 장비는 따로', () => {
    const s = fresh();
    addItem(s, 'hp', 5);
    expect(s.bag.filter(e => e?.id === 'hp')).toHaveLength(1);
    addItem(s, 'test_hat', 2);
    expect(s.bag.filter(e => e?.id === 'test_hat')).toHaveLength(2);
  });
  it('가득 차면 안 들어감 (쌓이는 건 들어감)', () => {
    const s = fresh();
    while (s.bag.includes(null)) addItem(s, 'test_hat');
    expect(canAdd(s, 'test_hat')).toBe(false);
    expect(addItem(s, 'test_hat')).toBe(false);
    expect(addItem(s, 'hp', 3)).toBe(true);
    expect(s.bag).toHaveLength(BAG_SIZE);
  });
  it('낀 장비를 빼면 장비창에서도 빠짐', () => {
    const s = fresh();
    addItem(s, 'test_hat');
    const i = s.bag.findIndex(e => e?.id === 'test_hat');
    toggleEquip(s, i);
    expect(s.equip.hat).toBeDefined();
    removeItem(s, 'test_hat');
    expect(s.equip.hat).toBeUndefined();
  });
  it('반지는 두 칸에 차례로', () => {
    const s = fresh();
    addItem(s, 'test_ring', 3);
    const idx = s.bag.flatMap((e, i) => (e?.id === 'test_ring' ? [i] : []));
    toggleEquip(s, idx[0]); toggleEquip(s, idx[1]);
    expect(equippedSlot(s, s.bag[idx[0]]!.uid)).toBe('ring1');
    expect(equippedSlot(s, s.bag[idx[1]]!.uid)).toBe('ring2');
    toggleEquip(s, idx[2]);
    expect(equippedSlot(s, s.bag[idx[2]]!.uid)).toBe('ring1');
    expect(equippedSlot(s, s.bag[idx[0]]!.uid)).toBeNull();
  });
  it('옮기기·정렬해도 물건 수와 장착은 그대로', () => {
    const s = fresh();
    addItem(s, 'slime_gel', 4); addItem(s, 'test_top'); addItem(s, 'reset');
    const top = s.bag.findIndex(e => e?.id === 'test_top');
    toggleEquip(s, top);
    const uid = s.equip.top;
    expect(moveItem(s, top, 40)).toBeNull();
    sortBag(s);
    expect(s.bag[0]?.id).toBe('test_top');
    expect(s.bag[0]?.uid).toBe(uid);
    expect(countItem(s, 'slime_gel')).toBe(4);
    expect(s.equip.top).toBe(uid);
  });
});

describe('성장', () => {
  it('경험치가 넘치면 여러 레벨을 한 번에, 남는 건 이어짐', () => {
    const s = fresh();
    const need = expNeed(1) + expNeed(2) + 5;
    const r = gainExp(s, need);
    expect(s.level).toBe(3);
    expect(s.exp).toBe(5);
    expect(s.statPts).toBe(6);
    expect(r.fullHeal).toBe(true);
  });
  it('최대 레벨(14)에서 멈추고, 그 뒤 경험치는 안 쌓임', () => {
    const s = fresh();
    gainExp(s, 1e7);
    expect(s.level).toBe(MAX_LEVEL);
    expect(s.exp).toBe(0);
    gainExp(s, 500);
    expect(s.level).toBe(MAX_LEVEL);
    expect(s.exp).toBe(0);
  });
  it('15 이상인 예전 캐릭터는 레벨·경험치 그대로, 더 안 오름', () => {
    const s = fresh();
    s.level = 22; s.exp = 300;
    gainExp(s, 5000);
    expect(s.level).toBe(22);
    expect(s.exp).toBe(300);
    expect(applyAction(s, { type: 'debug', what: 'level' } as never, 0).ok).toBe(false);
  });
  it('몬스터보다 레벨이 많이 높으면 경험치가 줄어듦', () => {
    expect(expGapMult(5, 5)).toBe(1);
    expect(expGapMult(8, 5)).toBe(1);
    expect(expGapMult(10, 5)).toBeCloseTo(0.7);
    expect(expGapMult(14, 1)).toBeCloseTo(0.1);
    expect(expGapMult(14, undefined)).toBe(1);
  });
  it('새 캐릭터는 학교 홀에서 시작', () => {
    expect(fresh().map).toBe('school_hall');
  });
  it('캐릭터 생성: 포인트를 넘게 나눠도 잘림', () => {
    const s = createSave('  ', 'mage', 'F', { str: 99, dex: 99, int: 99 });
    const total = s.stats.str + s.stats.dex + s.stats.int + s.statPts;
    const base = newSave('x', 'mage', 'F');
    expect(total - (base.stats.str + base.stats.dex + base.stats.int)).toBeLessThanOrEqual(10);
    expect(s.name.length).toBeGreaterThan(0);
  });
  it('능력치 찍기', () => {
    const s = fresh();
    s.statPts = 1;
    const hp0 = deriveStats(s).maxHp;
    expect(applyAction(s, { type: 'stat', stat: 'str' }, 0).ok).toBe(true);
    expect(deriveStats(s).maxHp).toBeGreaterThan(hp0);
    expect(applyAction(s, { type: 'stat', stat: 'str' }, 0).ok).toBe(false);
  });
  it('상점: 골드 빠지고 물건 들어옴, 모자라면 안 됨', () => {
    const s = fresh();
    s.gold = 60;
    expect(applyAction(s, { type: 'buy', item: 'hp', n: 1 }, 0).ok).toBe(true);
    expect(s.gold).toBe(30);
    expect(applyAction(s, { type: 'buy', item: 'hp', n: 10 }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'buy', item: 'hp', n: 3 }, 0).ok).toBe(false);
  });
});

describe('퀘스트', () => {
  it('교수님 일일 퀘스트: 아무 몬스터 50 → 보고하면 미션 주화 5개 → 그날은 끝 → 다음 날 다시 받기', () => {
    const s = fresh();
    s.dailyDay = '2026-11-21';
    expect(acceptQuest(s, 'd_hunt').ok).toBe(true);
    expect(questState(s, 'd_hunt')).toBe('active');
    for (let i = 0; i < 49; i++) questsOnKill(s, i % 2 ? 'slime' : 'guard_a');
    expect(questState(s, 'd_hunt')).toBe('active');
    expect(questsOnKill(s, 'honey_slime').map(q => q.id)).toContain('d_hunt');
    expect(questState(s, 'd_hunt')).toBe('ready');
    const exp0 = s.exp + s.level * 1e6;
    expect(reportQuest(s, 'd_hunt').ok).toBe(true);
    expect(s.exp + s.level * 1e6).toBeGreaterThan(exp0);
    expect(countItem(s, 'mission_coin')).toBe(5);
    expect(questState(s, 'd_hunt')).toBe('done');
    expect(acceptQuest(s, 'd_hunt').ok).toBe(false);
    s.dailyDay = '2026-11-22';
    expect(questState(s, 'd_hunt')).toBe('none');
    expect(acceptQuest(s, 'd_hunt').ok).toBe(true);
  });
  it('모으기 퀘스트는 보고할 때 물건을 가져가고 보상 물건을 줌', () => {
    const s = fresh();
    acceptQuest(s, 'test_gel');
    addItem(s, 'slime_gel', 5);
    expect(questState(s, 'test_gel')).toBe('ready');
    const hp0 = countItem(s, 'hp');
    expect(reportQuest(s, 'test_gel').ok).toBe(true);
    expect(countItem(s, 'slime_gel')).toBe(2);
    expect(countItem(s, 'hp')).toBe(hp0 + 2);
    expect(questState(s, 'test_gel')).toBe('done');
  });
  it('덜 했으면 보고 못 함, 이미 받았으면 또 못 받음', () => {
    const s = fresh();
    acceptQuest(s, 'd_hunt');
    expect(acceptQuest(s, 'd_hunt').ok).toBe(false);
    expect(reportQuest(s, 'd_hunt').ok).toBe(false);
  });
  it('핀은 하는 중인 퀘스트만, 보고하면 빠짐', () => {
    const s = fresh();
    expect(togglePin(s, 'd_hunt').ok).toBe(false);
    acceptQuest(s, 'test_gel');
    expect(togglePin(s, 'test_gel').ok).toBe(true);
    addItem(s, 'slime_gel', 3);
    reportQuest(s, 'test_gel');
    expect(s.questPins).not.toContain('test_gel');
  });
});

describe('저장', () => {
  it('새 캐릭터 저장 → 불러오기가 같음', () => {
    const s = fresh();
    expect(normalizeSave(JSON.parse(JSON.stringify(s)))).toEqual(s);
  });
  it('없는 물건·퀘스트는 정리됨', () => {
    const s = fresh() as ReturnType<typeof fresh>;
    s.bag[10] = { id: 'no_such_item', n: 1 };
    s.quests.no_such_quest = { active: true, counts: [0] };
    s.questPins.push('no_such_quest');
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.bag[10]).toBeNull();
    expect(back.quests.no_such_quest).toBeUndefined();
    expect(back.questPins).toEqual([]);
  });
  it('예전 1번 형태(퀘스트 count 하나)도 불러옴', () => {
    const s = fresh() as unknown as Record<string, unknown>;
    s.version = 1;
    s.quests = { d_hunt: { active: true, count: 3 } };
    const back = normalizeSave(s as never);
    expect(back.quests.d_hunt.counts).toEqual([3]);
  });
});

describe('매점 팔기', () => {
  it('산 값의 50%, 점액 1G, 슬라임 장비 100G, 퀘스트 물건은 못 팖', async () => {
    const { sellPrice, ITEMS } = await import('../shared/data/items');
    expect(sellPrice('hp')).toBe(Math.floor(ITEMS.hp.price! * 0.5));
    expect(sellPrice('slime_gel')).toBe(1);
    expect(sellPrice('slime_armor')).toBe(100);
    expect(sellPrice('slime_ring')).toBe(100);
    expect(sellPrice('workshop_key')).toBe(0);
  });
  it('여러 개 중 일부·전부 팔기, 골드 들어옴', () => {
    const s = fresh();
    addItem(s, 'slime_gel', 5);
    const i = s.bag.findIndex(e => e?.id === 'slime_gel');
    expect(applyAction(s, { type: 'sell', index: i, n: 2 }, 0).ok).toBe(true);
    expect(countItem(s, 'slime_gel')).toBe(3);
    expect(s.gold).toBe(2);
    applyAction(s, { type: 'sell', index: i, n: 99 }, 0);
    expect(countItem(s, 'slime_gel')).toBe(0);
    expect(s.bag[i]).toBeNull();
    expect(s.gold).toBe(5);
  });
  it('끼고 있는 장비·퀘스트 물건·빈 칸은 못 팖', () => {
    const s = fresh();
    addItem(s, 'slime_armor'); addItem(s, 'workshop_key');
    const a = s.bag.findIndex(e => e?.id === 'slime_armor'), k = s.bag.findIndex(e => e?.id === 'workshop_key');
    toggleEquip(s, a);
    expect(applyAction(s, { type: 'sell', index: a, n: 1 }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'sell', index: k, n: 1 }, 0).ok).toBe(false);
    expect(applyAction(s, { type: 'sell', index: 59, n: 1 }, 0).ok).toBe(false);
    expect(s.gold).toBe(0);
    toggleEquip(s, a);
    expect(applyAction(s, { type: 'sell', index: a, n: 1 }, 0).ok).toBe(true);
    expect(s.gold).toBe(100);
  });
});

describe('창고 · 업적 · 칭호', () => {
  it('개인 창고: 맡기면 가방에서 빠지고 쌓이는 건 합쳐짐, 꺼내면 돌아옴. 끼고 있는 장비는 못 맡김', async () => {
    const { depositItem, withdrawItem } = await import('../shared/rules/inventory');
    const s = fresh();
    addItem(s, 'slime_gel', 4);
    const g = s.bag.findIndex(e => e?.id === 'slime_gel');
    expect(applyAction(s, { type: 'deposit', index: g }, 0).ok).toBe(true);
    expect(countItem(s, 'slime_gel')).toBe(0);
    addItem(s, 'slime_gel', 2);
    applyAction(s, { type: 'deposit', index: s.bag.findIndex(e => e?.id === 'slime_gel') }, 0);
    expect(s.storage.filter(e => e?.id === 'slime_gel')).toEqual([{ id: 'slime_gel', n: 6 }]);
    expect(applyAction(s, { type: 'withdraw', index: s.storage.findIndex(e => e?.id === 'slime_gel') }, 0).ok).toBe(true);
    expect(countItem(s, 'slime_gel')).toBe(6);
    addItem(s, 'test_hat');
    const h = s.bag.findIndex(e => e?.id === 'test_hat');
    toggleEquip(s, h);
    expect(applyAction(s, { type: 'deposit', index: h }, 0).ok).toBe(false);
    // 공용 창고: 다른 캐릭터가 꺼내면 새 번호
    toggleEquip(s, h);
    const shared: (import('../shared/rules/inventory').BagEntry | null)[] = Array(40).fill(null);
    expect(depositItem(s, shared, h).ok).toBe(true);
    const other = newSave('o', 'mage', 'F');
    other.nextUid = 50;
    expect(withdrawItem(other, shared, 0).ok).toBe(true);
    expect(other.bag.find(e => e?.id === 'test_hat')?.uid).toBe(50);
  });
  it('업적: 조건을 채우면 달성, 달성한 것만 칭호로', async () => {
    const { checkAchievements } = await import('../shared/rules/achievements');
    const s = fresh();
    expect(applyAction(s, { type: 'title', id: 'first_hunt' }, 0).ok).toBe(false);
    s.kills = 1; s.mobKills.slime = 1;
    expect(checkAchievements(s).map(a => a.id)).toContain('first_hunt');
    expect(checkAchievements(s)).toEqual([]);
    expect(applyAction(s, { type: 'title', id: 'first_hunt' }, 0).ok).toBe(true);
    expect(s.title).toBe('first_hunt');
    applyAction(s, { type: 'title', id: null }, 0);
    expect(s.title).toBeNull();
  });
});
