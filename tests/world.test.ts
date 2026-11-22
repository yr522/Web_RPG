// 게임 판(World)을 화면 없이 돌려 보는 테스트: 드롭·줍기·방어력·던전 클리어
import { describe, expect, it } from 'vitest';
import { World, TICK } from '../shared/sim/World';
import { MONSTERS } from '../shared/data/monsters';
import { DEFENSE } from '../shared/data/classes';
import { addItem, countItem, takeBagEntry, toggleEquip } from '../shared/rules/inventory';
import { GROUND_Y } from '../shared/data/maps';
import { ITEMS } from '../shared/data/items';
import { GATHER } from '../shared/data/gather';
import { keySkill } from '../shared/rules/progress';
import { repair } from '../shared/rules/gear';
import { newSave } from '../shared/sim/save';
import type { Enemy, PlayerState } from '../shared/sim/entities';
import { emptyCommand } from '../shared/sim/types';

// 테스트에서만 안쪽 함수를 부름
type Inside = { kill(e: Enemy, p: PlayerState): void; dropItem(x: number, y: number, item: string): void; hurtPlayer(p: PlayerState, d: number, dir: number, pierce?: boolean): void };
const inside = (w: World) => w as unknown as Inside;

const run = (w: World, sec: number) => { for (let i = 0; i < sec / TICK; i++) w.step(new Map()); };

function fieldWithPlayer(seed = 1) {
  const w = new World('field', seed);
  const s = newSave('t', 'warrior', 'M');
  const p = w.addPlayer('p', s, 600);
  return { w, s, p };
}

/** 떨어진 물건을 전부 플레이어 발밑으로 옮겨서 줍게 함 */
function pickAll(w: World, p: PlayerState) {
  for (let i = 0; i < 120 && w.coins.length; i++) {
    for (const c of w.coins) { c.x = p.x; c.y = p.y; c.vx = c.vy = 0; }
    w.step(new Map());
  }
}

describe('슬라임 드롭', () => {
  it('슬라임 표에 갑옷·반지가 있음', () => {
    for (const m of ['slime', 'slime_elem'] as const) {
      const items = (MONSTERS[m].drops ?? []).map(d => d.item);
      expect(items).toContain('slime_armor');
      expect(items).toContain('slime_ring');
    }
  });
  it('여러 번 잡으면 실제로 장비가 떨어지고, 주우면 가방에 들어가 옵션을 굴림', () => {
    const { w, s, p } = fieldWithPlayer(7);
    const slime = w.enemies.find(e => e.mob === 'slime')!;
    for (let i = 0; i < 400; i++) {
      slime.dead = false;
      inside(w).kill(slime, p);
      pickAll(w, p);
    }
    const gear = s.bag.filter(e => e && (e.id === 'slime_armor' || e.id === 'slime_ring'));
    expect(gear.length).toBeGreaterThan(5);
    // 하나하나 다른 번호
    expect(new Set(gear.map(e => e!.uid)).size).toBe(gear.length);
    // 커먼: 옵션은 0~1개, 1단계
    for (const e of gear) {
      expect((e!.opts ?? []).length).toBeLessThanOrEqual(1);
      for (const o of e!.opts ?? []) expect(o.tier).toBe(1);
    }
    // 대략 절반에 옵션 (50%)
    const withOpt = gear.filter(e => e!.opts?.length).length;
    expect(withOpt).toBeGreaterThan(0);
    expect(withOpt).toBeLessThan(gear.length);
  });
  it('가방이 가득 차면 장비가 바닥에 남음', () => {
    const { w, s, p } = fieldWithPlayer();
    for (let i = 0; s.bag.includes(null); i++) addItem(s, 'test_hat');
    inside(w).dropItem(p.x, p.y, 'slime_ring');
    for (const c of w.coins) { c.x = p.x; c.y = p.y; }
    w.step(new Map());
    expect(w.coins.some(c => c.item === 'slime_ring')).toBe(true);
  });
});

describe('방어력', () => {
  it('방어력만큼 받는 피해가 줄고, 관통 피해는 그대로', () => {
    const { w, s, p } = fieldWithPlayer();
    addItem(s, 'test_top');
    toggleEquip(s, s.bag.findIndex(e => e?.id === 'test_top'));
    w.refreshStats(p, true);
    expect(p.stats.def).toBe(5);
    p.invT = 0;
    const hp0 = p.hp;
    inside(w).hurtPlayer(p, 100, 1);
    expect(hp0 - p.hp).toBe(Math.round(100 * (1 - 5 / (5 + DEFENSE.k))));
    const hp1 = p.hp;
    inside(w).hurtPlayer(p, 100, 1, true);
    expect(hp1 - p.hp).toBe(100);
  });
  it('방어력이 아무리 높아도 최대 75%까지만 줄고 최소 1', () => {
    const { w, s, p } = fieldWithPlayer();
    addItem(s, 'slime_armor');
    const e = s.bag.find(x => x?.id === 'slime_armor')!;
    e.opts = [{ id: 'def', tier: 5 }];
    e.enh = 15;
    toggleEquip(s, s.bag.indexOf(e));
    s.level = 99; // HP 넉넉히
    w.refreshStats(p, true);
    const hp0 = p.hp;
    inside(w).hurtPlayer(p, 1000, 1);
    expect(hp0 - p.hp).toBeGreaterThanOrEqual(250);
    const hp1 = p.hp;
    inside(w).hurtPlayer(p, 1, 1);
    expect(hp1 - p.hp).toBe(1);
  });
});

describe('던전', () => {
  it('마지막 방을 다 잡으면 클리어 보상', () => {
    const w = new World('dungeon3', 3);
    const s = newSave('t', 'warrior', 'M');
    const p = w.addPlayer('p', s, 300);
    expect(w.cleared).toBe(false);
    const gold0 = s.gold;
    for (let guard = 0; guard < 20 && !w.cleared; guard++) {
      for (const e of w.enemies) if (!e.dead) inside(w).kill(e, p);
      run(w, 1.5);
    }
    expect(w.cleared).toBe(true);
    pickAll(w, p);
    expect(s.gold - gold0).toBeGreaterThanOrEqual(w.map.clearReward!.gold);
  });
});

describe('훈련장 허수아비', () => {
  it('학교에서 훈련장으로 오가는 포탈', async () => {
    const { MAPS } = await import('../shared/data/maps');
    expect(MAPS.school.portals.some(p => p.to === 'training')).toBe(true);
    expect(MAPS.training.portals.some(p => p.to === 'school')).toBe(true);
  });
  it('안 움직이고, 안 죽고, 부딪혀도 피해 없음, 맞으면 초당 피해가 뜸', async () => {
    const { DUMMY } = await import('../shared/data/monsters');
    const w = new World('training', 1);
    const s = newSave('t', 'warrior', 'M');
    const d = w.enemies.find(e => e.mob === 'dummy')!;
    const p = w.addPlayer('p', s, d.x);
    const x0 = d.x, hp0 = p.hp;
    run(w, 1);
    expect(p.hp).toBe(hp0);
    expect(d.meter).toBeUndefined();
    // 2초 동안 매 틱 10씩 = 초당 600
    for (let i = 0; i < 2 / TICK; i++) { d.hp -= 10; w.step(new Map()); }
    expect(d.x).toBe(x0);
    expect(d.dead).toBe(false);
    expect(d.meter!.on).toBe(true);
    expect(d.meter!.dps).toBeGreaterThan(560);
    expect(d.meter!.dps).toBeLessThan(640);
    // 안 때리면 쉬는 시간만큼 내려가다가 idle 초 뒤 측정 끝, 값은 남음
    run(w, DUMMY.idle + 0.5);
    expect(d.meter!.on).toBe(false);
    expect(d.meter!.dps).toBeGreaterThan(560);
  });
  it('진짜 공격으로 때려도 재짐 (검사 일섬)', () => {
    const w = new World('training', 1);
    const s = newSave('t', 'warrior', 'M');
    s.learned.ilseom = 'fire';
    const d = w.enemies.find(e => e.mob === 'dummy')!;
    w.addPlayer('p', s, d.x - 40);
    for (let i = 0; i < 3 / TICK; i++) w.step(new Map([['p', { ...emptyCommand(), skillHeld: ['Z'] }]]));
    expect(d.meter!.dps).toBeGreaterThan(0);
    expect(d.x).toBe(d.spawnX);
  });
});

describe('이동기 (텔레포트 · 후방 도약)', () => {
  const learnAll = (s: ReturnType<typeof newSave>, id: string) => { s.learned[id] = null; s.skillKeys = { Q: id }; };
  it('마법사 텔레포트: 앞으로 순간이동, 사라진 동안 무적, 쿨타임', async () => {
    const { TELEPORT, SKILLS } = await import('../shared/data/classes');
    const w = new World('training', 1);
    const s = newSave('t', 'mage', 'M');
    learnAll(s, 'teleport');
    const p = w.addPlayer('p', s, 300);
    run(w, 0.5);
    p.face = 1;
    const x0 = p.x;
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    expect(p.action?.inv).toBe(true);
    run(w, 0.5);
    expect(p.x - x0).toBeCloseTo(TELEPORT.dist, -1);
    expect(p.cd.teleport).toBeGreaterThan(0);
    expect(p.cd.teleport).toBeLessThanOrEqual(SKILLS.teleport.cd);
  });
  it('궁수 후방 도약: 뒤로 날아가며 정해진 세 자리(서 있던 자리 앞뒤)에 한 발씩, 먼 곳은 안 맞음', async () => {
    const { DOYAK } = await import('../shared/data/classes');
    const { MONSTERS } = await import('../shared/data/monsters');
    const w = new World('training', 1);
    const s = newSave('t', 'archer', 'M');
    learnAll(s, 'doyak');
    const p = w.addPlayer('p', s, 300);
    run(w, 0.5);
    p.face = 1;
    // 허수아비 4개: 화살 박히는 세 자리 + 멀리 하나 (먼 것은 안 맞아야 함)
    const inside = w as unknown as { spawnEnemy(m: string, x: number, e: null): Enemy };
    w.enemies.length = 0;
    const cx0 = p.x + p.w / 2;
    const ds = [...DOYAK.spots, 400].map(dx => inside.spawnEnemy('dummy', cx0 + dx - MONSTERS.dummy.w / 2, null));
    run(w, 0.1);
    const x0 = p.x;
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    let hits: number[] = [0, 0, 0, 0];
    for (let i = 0; i < 1.5 / TICK; i++) { w.step(new Map()); ds.forEach((d, j) => { if (d.meter) hits[j] = d.meter.dmg; }); }
    expect(x0 - p.x).toBeGreaterThan(DOYAK.back * 0.8);
    expect(hits.slice(0, 3).every(h => h > 0)).toBe(true);
    expect(hits[3]).toBe(0);
    expect(MONSTERS.dummy).toBeDefined();
  });
});

describe('검사 회류참 (4식)', () => {
  it('뒤로 물러나며 앞쪽 몬스터를 끌어오고, 조금 뒤에 걸친 몬스터도 맞음, 보스는 안 끌려옴', async () => {
    const { HOERYU } = await import('../shared/data/classes');
    const w = new World('training', 1);
    const s = newSave('t', 'warrior', 'M');
    s.learned.hoeryu = 'water'; s.skillKeys = { Q: 'hoeryu' };
    const p = w.addPlayer('p', s, 500);
    run(w, 0.5);
    p.face = 1;
    const inside = w as unknown as { spawnEnemy(m: string, x: number, e: null): Enemy };
    w.enemies.length = 0;
    const far = inside.spawnEnemy('guard_a', p.x + p.w + 110, null);
    const behind = inside.spawnEnemy('guard_a', p.x - 30, null);
    const out = inside.spawnEnemy('guard_a', p.x + p.w + HOERYU.front + 120, null);
    const boss = inside.spawnEnemy('guard_boss', p.x + p.w + 70, null);
    for (const e of [far, behind, out, boss]) { e.maxHp = e.hp = 1e6; }
    const bossX = boss.x, x0 = p.x;
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    run(w, HOERYU.time + 0.05);
    expect(x0 - p.x).toBeGreaterThan(HOERYU.back * 0.8);
    expect(far.hp).toBeLessThan(1e6);
    expect(behind.hp).toBeLessThan(1e6);
    expect(out.hp).toBe(1e6);
    expect(boss.hp).toBeLessThan(1e6);
    // 끌려옴: 내 앞 가까이
    expect(Math.abs(far.x - (p.x + p.w))).toBeLessThan(120);
    expect(Math.abs(boss.x - bossX)).toBeLessThan(40);
  });
  it('일섬 → 월참 → 질풍참 → 회류참으로 이어야 천붕이 열림', () => {
    const w = new World('training', 1);
    const s = newSave('t', 'warrior', 'M');
    s.level = 10;
    for (const id of ['ilseom', 'wolcham', 'jilpung', 'hoeryu', 'cheonbung']) s.learned[id] = 'fire';
    s.skillKeys = { Z: 'ilseom', A: 'wolcham', S: 'jilpung', Q: 'hoeryu', D: 'cheonbung' };
    const d = w.enemies.find(e => e.mob === 'dummy')!;
    const p = w.addPlayer('p', s, d.x - 60);
    run(w, 0.3);
    p.face = 1;
    const press = (k: 'Z' | 'A' | 'S' | 'Q' | 'D') => w.step(new Map([['p', { ...emptyCommand(), skillPressed: [k] }]]));
    const until = (cond: () => boolean) => { for (let i = 0; i < 120 && !cond(); i++) w.step(new Map()); };
    press('Z'); until(() => !p.action && p.lockT <= 0);
    p.face = 1; press('A'); until(() => !p.action && p.lockT <= 0);
    expect(p.combo).toBe(2);
    // 질풍참은 허수아비를 지나쳐 가므로 다시 허수아비 앞에서
    p.face = 1; press('S'); until(() => !p.action);
    expect(p.combo).toBe(3);
    expect(p.cbWindow).toBe(0);
    p.x = d.x - 120; p.face = 1; press('Q'); until(() => !p.action);
    expect(p.cbWindow).toBeGreaterThan(0);
    press('D');
    expect(p.action?.name).toBe('cheonbung');
  });
});

describe('포션 5단계', () => {
  it('1번 키는 가진 것 중 가장 작은 것부터, 가방에서 고르면 그 포션', async () => {
    const { POTIONS, POTION } = await import('../shared/data/items');
    const { countItem } = await import('../shared/rules/inventory');
    const { w, s, p } = fieldWithPlayer();
    s.bag = s.bag.map(() => null);
    addItem(s, 'hp_m', 1); addItem(s, 'hp_xl', 1);
    p.hp = 1;
    w.usePotion(p, 'hp');
    expect(countItem(s, 'hp_m')).toBe(0);
    expect(p.hp).toBe(Math.min(p.stats.maxHp, 1 + POTIONS.hp_m.amount));
    p.potionCd = 0; p.hp = 1;
    w.usePotion(p, 'hp_xl');
    expect(countItem(s, 'hp_xl')).toBe(0);
    expect(p.hp).toBe(Math.min(p.stats.maxHp, 1 + POTIONS.hp_xl.amount));
    expect(POTION.cooldown).toBeGreaterThan(0);
  });
});

describe('궁수 소용돌이 화살', () => {
  it('소용돌이 안 잔 피해 4번 + 큰 화살, 반지름 밖은 안 맞음', async () => {
    const { SOYONG_PULL_R, SOYONG_TICK } = await import('../shared/data/classes');
    const w = new World('training', 1);
    const s = newSave('t', 'archer', 'M');
    s.learned.soyong = 'earth'; s.skillKeys = { Q: 'soyong' };
    const p = w.addPlayer('p', s, 300);
    run(w, 0.5);
    p.face = 1;
    const inside = w as unknown as { spawnEnemy(m: string, x: number, e: null): Enemy };
    w.enemies.length = 0;
    const inn = inside.spawnEnemy('dummy', p.x + p.w / 2 + 270, null);
    const out = inside.spawnEnemy('dummy', p.x + p.w / 2 + 270 + SOYONG_PULL_R + 60, null);
    run(w, 0.1);
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    // 큰 화살(0.24 + 0.4 초) 전까지는 잔 피해만
    run(w, 0.24 + SOYONG_TICK.first + SOYONG_TICK.gap * (SOYONG_TICK.n - 1) + 0.05);
    const small = inn.meter?.dmg ?? 0;
    expect(small).toBeGreaterThan(0);
    run(w, 1);
    expect(inn.meter?.dmg ?? 0).toBeGreaterThan(small * 3);
    expect(out.meter?.dmg ?? 0).toBe(0);
  });
});

describe('후방 도약 화살이 박히는 자리', () => {
  it('발판 위에서 쓰면 발판에, 발판 밖은 바닥까지', async () => {
    const { GROUND_Y, MAPS } = await import('../shared/data/maps');
    const w = new World('field', 1);
    const pl = MAPS.field.platforms[0];
    expect(w.surfaceBelow(pl.x + 20, pl.y - 50)).toBe(pl.y);
    expect(w.surfaceBelow(pl.x - 30, pl.y - 50)).toBe(GROUND_Y);
    // 발판보다 아래에서 쏘면 발판은 무시
    expect(w.surfaceBelow(pl.x + 20, pl.y + 5)).toBe(GROUND_Y);
  });
});

describe('마법사 원소 기둥 토네이도', () => {
  it('키를 한 번 더 누르면 바라보는 방향으로 움직이고, 맵 끝에 닿으면 반대로 감', async () => {
    const { GIDUNG } = await import('../shared/data/classes');
    const w = new World('training', 1);
    const s = newSave('t', 'mage', 'M');
    s.learned.gidung = 'fire'; s.skillKeys = { Q: 'gidung' };
    const p = w.addPlayer('p', s, 300);
    run(w, 0.5);
    p.face = 1; p.mp = 999;
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    run(w, GIDUNG.cast + 0.1);
    expect(w.tornadoes.length).toBe(1);
    const t = w.tornadoes[0], x0 = t.x;
    run(w, 0.3);
    expect(t.x).toBe(x0); // 누르기 전엔 제자리
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Q'] }]]));
    run(w, 0.3);
    expect(t.x).toBeGreaterThan(x0);
    // 맵 오른쪽 끝 근처로 옮기면 부딪혀서 왼쪽으로
    t.x = w.bounds.r - GIDUNG.w / 2 - 2;
    run(w, 0.1);
    expect(t.dir).toBe(-1);
    expect(t.x + GIDUNG.w / 2).toBeLessThanOrEqual(w.bounds.r);
  });
});

describe('영주님의 생일잔치', () => {
  it('꿀 슬라임: 가까우면 제자리에서 휘둘러 피해 + 둔화 (걷는 속도 느려짐)', async () => {
    const { SNAIL_AI, SLOW_DEBUFF } = await import('../shared/data/monsters');
    const w = new World('honey_field', 1);
    const s = newSave('t', 'warrior', 'M');
    const p = w.addPlayer('p', s, 100);
    const inside = w as unknown as { spawnEnemy(m: string, x: number, e: null): Enemy };
    w.enemies.length = 0;
    run(w, 0.5);
    const e = inside.spawnEnemy('honey_slime', p.x + p.w + 20, null);
    e.leapCd = 0;
    const hp0 = p.hp;
    p.invT = 0;
    // 몸통이 안 닿게 몬스터를 붙잡아 두지 않고, 휘두를 때까지 기다림
    for (let i = 0; i < (SNAIL_AI.windup + 0.2) / TICK; i++) { p.invT = Math.min(p.invT, 0); w.step(new Map()); if (p.slowT > 0) break; }
    expect(p.slowT).toBeGreaterThan(0);
    expect(p.hp).toBeLessThan(hp0);
    expect(p.slowT).toBeLessThanOrEqual(SLOW_DEBUFF.time);
  });
  it('고철은 녹슨 것 또는 쓸만한 것 하나만 (같이 안 떨어짐), 꿀 슬라임은 꿀', async () => {
    const { MONSTERS } = await import('../shared/data/monsters');
    expect(MONSTERS.guard_a.drops!.filter(d => d.group === 'scrap').map(d => [d.item, d.chance])).toEqual([['scrap_rusty', 0.3], ['scrap_good', 0.05]]);
    expect(MONSTERS.guard_b.drops!.some(d => d.item === 'scrap_good')).toBe(true);
    expect(MONSTERS.honey_slime.drops).toEqual([{ item: 'honey', chance: 0.7 }]);
    const w = new World('guard_a', 3);
    const s = newSave('t', 'warrior', 'M');
    const p = w.addPlayer('p', s, 300);
    let both = 0, any = 0;
    for (let i = 0; i < 300; i++) {
      const e = w.enemies.find(x => !x.dead)!;
      const n0 = w.coins.filter(c => c.item).length;
      inside(w).kill(e, p);
      const got = w.coins.slice(n0).filter(c => c.item === 'scrap_rusty' || c.item === 'scrap_good').length;
      if (got > 1) both++;
      if (got) any++;
      w.coins.length = 0; e.dead = false; e.hp = e.maxHp;
    }
    expect(both).toBe(0);
    expect(any).toBeGreaterThan(60);
  });
  it('마법공학의 유산을 다 끝내야 마샤·대 장장이가 퀘스트를 줌', async () => {
    const { npcMark } = await import('../shared/rules/story');
    const s = newSave('t', 'mage', 'M');
    s.level = 5;
    expect(npcMark(s, 'masha')).toBeNull();
    expect(npcMark(s, 'smith')).toBeNull();
    s.quests.mg13 = { active: false, counts: [], done: 1 } as never;
    expect(npcMark(s, 'masha')).toBe('!');
    expect(npcMark(s, 'smith')).toBe('!');
  });
});

describe('인벤토리에서 바닥에 버리기', () => {
  it('캐릭터 발밑에 떨어지고, 2초 동안 못 줍고, 그 뒤에 닿으면 강화 그대로 주움', () => {
    const { w, s, p } = fieldWithPlayer();
    w.enemies.length = 0;
    addItem(s, 'slime_armor');
    const idx = s.bag.findIndex(e => e?.id === 'slime_armor');
    s.bag[idx]!.enh = 7;
    w.dropEntry(p, takeBagEntry(s, idx)!);
    expect(w.coins).toHaveLength(1);
    expect(Math.abs(w.coins[0].x + w.coins[0].w / 2 - (p.x + p.w / 2))).toBeLessThan(1);
    run(w, 1.9);
    expect(s.bag.some(x => x?.id === 'slime_armor')).toBe(false);
    run(w, 0.3);
    pickAll(w, p);
    expect(s.bag.find(x => x?.id === 'slime_armor')?.enh).toBe(7);
  });
  it('쌓인 물건은 개수만큼 나눠서 버림', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'honey', 5);
    const idx = s.bag.findIndex(e => e?.id === 'honey');
    expect(takeBagEntry(s, idx, 2)).toEqual({ id: 'honey', n: 2 });
    expect(s.bag[idx]?.n).toBe(3);
    expect(takeBagEntry(s, idx, 0)).toBeNull();
  });
  it('끼고 있는 장비는 못 버림', () => {
    const s = newSave('t', 'warrior', 'M');
    addItem(s, 'slime_armor');
    const idx = s.bag.findIndex(e => e?.id === 'slime_armor');
    toggleEquip(s, idx);
    expect(takeBagEntry(s, idx)).toBeNull();
  });
});

describe('채집 (2026-11-22)', () => {
  /** 채집 공간에서 도구를 끼고 node 종류 채집물 앞에 섬 */
  function gatherSetup(tool: 'sickle' | 'pickaxe', node: 'blue_herb' | 'tin') {
    const w = new World('gather_test', 1);
    const s = newSave('t', 'mage', 'M');
    addItem(s, tool);
    toggleEquip(s, s.bag.findIndex(e => e?.id === tool));
    const g = w.gathers.find(o => o.node === node && o.y === GROUND_Y) ?? w.gathers.find(o => o.node === node)!;
    const p = w.addPlayer('p', s, g.x - 14, undefined, undefined, g.y);
    run(w, 0.3);
    return { w, s, p, g };
  }
  const pressZ = (w: World) => w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Z'] }]]));

  it('도구를 끼면 Z 가 채집, 맞는 채집물 앞에서 1개 얻고 내구도 −1, 채집물은 잠깐 사라짐', () => {
    const { w, s, g } = gatherSetup('sickle', 'blue_herb');
    expect(keySkill(s, 'Z')).toBe('gather');
    pressZ(w); run(w, 1);
    expect(countItem(s, 'blue_herb')).toBe(1);
    expect(s.bag.find(e => e?.id === 'sickle')?.dur).toBe(ITEMS.sickle.dur! - 1);
    expect(g.t).toBeGreaterThan(0);
    pressZ(w); run(w, 1);
    expect(countItem(s, 'blue_herb')).toBe(1);
    run(w, GATHER.respawn);
    expect(g.t).toBe(0);
  });
  it('도구 종류가 안 맞으면 못 캠', () => {
    const { w, s } = gatherSetup('sickle', 'tin');
    pressZ(w); run(w, 1);
    expect(countItem(s, 'tin')).toBe(0);
  });
  it('내구도 0 이면 파괴되고 장비 칸에서 빠짐 → Z 는 주먹질, 대장장이 수리로 내구도 가득', () => {
    const { w, s, g } = gatherSetup('pickaxe', 'tin');
    const e = s.bag.find(x => x?.id === 'pickaxe')!;
    e.dur = 1;
    pressZ(w); run(w, 1);
    expect(countItem(s, 'tin')).toBe(1);
    expect(e.broken).toBe(true);
    expect(s.equip.weapon).toBeUndefined();
    expect(keySkill(s, 'Z')).toBe('punch');
    expect(g.t).toBeGreaterThan(0);
    s.gold = GATHER.repair;
    expect(repair(s, e.uid!).ok).toBe(true);
    expect(e.dur).toBe(ITEMS.pickaxe.dur);
    expect(s.gold).toBe(0);
  });
  it('맞는 무기가 없으면 Z 말고 다른 스킬은 못 씀', () => {
    const w = new World('field', 1);
    const s = newSave('t', 'warrior', 'M');
    s.learned.wolcham = 'fire'; s.learned.ilseom = 'fire';
    const p = w.addPlayer('p', s, 600);
    run(w, 0.3);
    toggleEquip(s, s.bag.findIndex(e => e?.id === 'plain_sword'));
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['A'] }]]));
    expect(p.action).toBeNull();
    w.step(new Map([['p', { ...emptyCommand(), skillPressed: ['Z'] }]]));
    expect(p.action?.name).toBe('punch');
  });
});

describe('NPC 상호작용 높이 (2026-11-22)', () => {
  it('NPC 와 x 가 같아도 다른 층(3층 포탈 자리)에서는 말이 안 걸림', () => {
    const w = new World('school', 1);
    const s = newSave('t', 'warrior', 'M');
    const smith = w.map.npcs.find(n => n.id === 'smith')!;
    const p = w.addPlayer('p', s, smith.x - 14, undefined, undefined, 250);
    run(w, 0.3);
    expect(w.npcNear(p)).toBeNull();
    p.y = GROUND_Y - p.h; p.vy = 0;
    expect(w.npcNear(p)?.id).toBe('smith');
  });
});
