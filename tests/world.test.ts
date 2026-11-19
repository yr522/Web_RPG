// 게임 판(World)을 화면 없이 돌려 보는 테스트: 드롭·줍기·방어력·던전 클리어
import { describe, expect, it } from 'vitest';
import { World, TICK } from '../shared/sim/World';
import { MONSTERS } from '../shared/data/monsters';
import { DEFENSE } from '../shared/data/classes';
import { addItem, toggleEquip } from '../shared/rules/inventory';
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
