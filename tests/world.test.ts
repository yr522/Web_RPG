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
