// 스킬 딜량 자동 측정: 게임 판(World)을 화면 없이 돌려서 허수아비를 때려 본다.
// 실행: npm run dps  → document/스킬딜량_측정.md 를 새로 씀
// 수치(스킬·직업 표)를 고친 뒤 다시 돌리면 표가 갱신된다.
import { writeFileSync } from 'node:fs';
import { World, TICK } from '../shared/sim/World';
import { CLASSES, SKILLS, SLOT_KEYS, classActiveIds, type ClassId, type SlotKey } from '../shared/data/classes';
import { newSave, type SaveData } from '../shared/sim/save';
import { emptyCommand, type Command } from '../shared/sim/types';
import type { Enemy, PlayerState } from '../shared/sim/entities';
import { GROUND_Y } from '../shared/data/maps';

const LEVEL = 10;
const SECONDS = 30;
/** 허수아비 거리 후보 (스킬마다 가장 잘 맞는 거리로) */
const DISTS = [50, 140, 300];

type Inside = { tryStart(p: PlayerState, name: string, silent?: boolean): boolean; spawnEnemy(mob: string, x: number, elem: null, y?: number): Enemy };

function makeSave(cls: ClassId, skillLv: number): SaveData {
  const s = newSave('측정', cls, 'M');
  s.level = LEVEL;
  // 능력치 포인트는 전부 주 능력치에
  s.stats[CLASSES[cls].main] += (LEVEL - 1) * 3;
  s.skillKeys = {};
  classActiveIds(cls).forEach((id, i) => {
    s.learned[id] = SKILLS[id].elements[0] ?? null;
    s.skillLevels[id] = skillLv;
    s.skillKeys[SLOT_KEYS[i]] = id;
  });
  return s;
}

interface Result { dmg: number; casts: number; mpUsed: number; by?: Record<string, number> }

/**
 * press: 이번 틱에 누를 키, held: 누르고 있을 키 (틱 번호 → 명령). infMp: MP 무한
 */
function run(cls: ClassId, skillLv: number, plan: (tick: number, p: PlayerState) => Command, infMp: boolean, dist: number): Result {
  const w = new World('golem_room', 12345);
  // 맵의 몬스터는 치우고 허수아비 하나
  for (const e of w.enemies) { e.dead = true; e.once = true; }
  w.orb = null;
  const s = makeSave(cls, skillLv);
  const p = w.addPlayer('p', s, 300);
  p.face = 1;
  const inside = w as unknown as Inside;
  const dummy = inside.spawnEnemy('guard_c', 300 + dist, null);
  dummy.maxHp = dummy.hp = 1e9;
  const home = { x: dummy.x, y: GROUND_Y - dummy.h };
  let casts = 0, mpUsed = 0;
  const by: Record<string, number> = {};
  const orig = inside.tryStart.bind(w);
  inside.tryStart = (pl, name, silent) => {
    const mp0 = pl.mp;
    const ok = orig(pl, name, silent);
    if (ok) { casts++; mpUsed += mp0 - pl.mp; by[name] = (by[name] ?? 0) + 1; }
    return ok;
  };
  const ticks = Math.round(SECONDS / TICK);
  for (let t = 0; t < ticks; t++) {
    // 허수아비: 제자리, 공격 안 함. 플레이어는 맞지 않음
    dummy.x = home.x; dummy.y = home.y; dummy.vx = dummy.vy = 0; dummy.stun = 1; dummy.leap = 'none'; dummy.hp = 1e9;
    p.invT = 10; p.hp = p.stats.maxHp;
    if (infMp) p.mp = p.stats.maxMp;
    // 돌진 등으로 멀어지면 할 일이 없을 때 제자리로
    if (!p.action) { p.x = 300; p.face = 1; }
    w.step(new Map([['p', plan(t, p)]]));
  }
  // 1e9 에서 깎인 만큼이 마지막 틱 것만 남으므로 따로 셈: hit 이벤트 대신 누적
  return { dmg: dmgTotal(w), casts, mpUsed, by };
}

// 매 틱 hp 를 1e9 로 되돌리므로, 깎인 양을 World.step 직후 모아야 함 → step 을 감쌈
const totals = new WeakMap<World, number>();
const origStep = World.prototype.step;
World.prototype.step = function (cmds) {
  const d = this.enemies.find(e => e.hp > 1e8);
  const before = d?.hp ?? 0;
  const out = origStep.call(this, cmds);
  if (d) totals.set(this, (totals.get(this) ?? 0) + Math.max(0, before - d.hp));
  return out;
};
const dmgTotal = (w: World) => totals.get(w) ?? 0;

/** 한 스킬만: 누르고 hold 초 누르고 있다 떼기를 반복 */
const solo = (key: SlotKey, hold: number) => (t: number): Command => {
  const cyc = Math.max(1, Math.round((hold + 0.05) / TICK)), k = t % cyc;
  const c = emptyCommand();
  if (k === 0) c.skillPressed = [key];
  if (k < cyc - 1) c.skillHeld = [key];
  return c;
};

/** 누르고 있는 시간 후보 (충전 스킬용) */
const HOLDS = [0, 0.3, 0.8, 1.6];

function bestSolo(cls: ClassId, key: SlotKey, lv: number) {
  let best: Result & { hold: number; dist: number } = { dmg: -1, casts: 0, mpUsed: 0, hold: 0, dist: 0 };
  for (const d of DISTS) for (const h of HOLDS) {
    const r = run(cls, lv, solo(key, h), true, d);
    if (r.dmg > best.dmg) best = { ...r, hold: h, dist: d };
  }
  return best;
}

/** 돌려 쓰기: 뒤 키부터(강한 스킬부터) 쿨타임이 끝난 것을 누름, 기본기는 누르고 있음. MP 는 실제처럼 */
function rotation(cls: ClassId, lv: number, infMp: boolean): Result {
  // 이동기(텔레포트·후방 도약)는 돌려 쓰기에서 뺌
  const keys = classActiveIds(cls).map((_, i) => SLOT_KEYS[i]).filter((_, i) => classActiveIds(cls)[i] !== CLASSES[cls].move);
  const ready = (p: PlayerState, k: SlotKey) => (p.cd[p.data.skillKeys[k]!] ?? 0) <= 0 && p.mp >= SKILLS[p.data.skillKeys[k]!].mp;
  let best: Result = { dmg: -1, casts: 0, mpUsed: 0 };
  for (const d of DISTS) {
    const r = run(cls, lv, (t, p) => {
      const c = emptyCommand();
      // 마법사: 기본기 누르고 있기(연타). 궁수: 0.3초씩 당겨 쏘기
      if (cls === 'mage') c.skillHeld = [keys[0]];
      if (cls === 'archer' && t % 24 < 18) c.skillHeld = [keys[0]];
      if (t % 6 === 0) {
        if (cls === 'warrior') {
          // 검사: 일섬 → 월참 → 질풍참 → 천붕 연계, 이어지지 않으면 일섬부터. 힌트 스킬은 연계 사이에
          // 질풍참 뒤 천붕 열림(cbWindow) → 천붕
          const next = p.cbWindow > 0 ? keys[3] : keys[Math.min(2, p.combo)];
          const hint = keys.slice(4).find(k => ready(p, k));
          c.skillPressed = [p.combo === 0 && p.cbWindow <= 0 && hint ? hint : ready(p, next) ? next : keys[0]];
        } else {
          const r = keys.slice(1).reverse().find(k => ready(p, k));
          c.skillPressed = [r ?? keys[0]];
        }
      }
      return c;
    }, infMp, d);
    if (r.dmg > best.dmg) best = r;
  }
  return best;
}

const f = (n: number) => (Math.round(n * 10) / 10).toLocaleString('ko-KR');

const lines: string[] = [];
lines.push('# 스킬 딜량 측정 (자동)', '');
lines.push(`> \`npm run dps\` 로 만든 표. 손으로 고치지 말고 수치를 바꾼 뒤 다시 돌린다.`);
lines.push(`> 조건: 캐릭터 Lv ${LEVEL}, 능력치 포인트 전부 주 능력치, 장비·패시브 없음, 허수아비 1마리(원소 없음, 거리는 ${DISTS.join('·')}px 중 그 스킬이 가장 잘 맞는 곳), ${SECONDS}초.`);
lines.push('> 한 마리만 때리므로 여러 마리를 맞히는 스킬은 실제보다 낮게 나온다. 치명타는 확률대로 섞여 있음.', '');
lines.push('- **단독 초당 피해**: 그 스킬만 쿨타임마다 계속 씀 (MP 무한). 쿨타임이 긴 스킬은 낮게 나온다');
lines.push('- **1회 피해**: 한 번 썼을 때 피해 (단독 측정 총 피해 ÷ 쓴 횟수)');
lines.push('- **MP 1당 피해**: 1회 피해 ÷ MP', '');

for (const cls of ['warrior', 'mage', 'archer'] as ClassId[]) {
  const c = CLASSES[cls];
  lines.push(`## ${c.name}`, '');
  lines.push('| 스킬 | 쿨타임 | MP | 단독 초당 피해 (Lv1) | 1회 피해 (Lv1) | MP 1당 피해 | 1회 피해 (Lv5) | 측정 (거리·누름) |');
  lines.push('|---|---|---|---|---|---|---|---|');
  classActiveIds(cls).forEach((id, i) => {
    const sk = SKILLS[id], key = SLOT_KEYS[i];
    const r1 = bestSolo(cls, key, 1), r5 = bestSolo(cls, key, 5);
    const per1 = r1.casts ? r1.dmg / r1.casts : 0, per5 = r5.casts ? r5.dmg / r5.casts : 0;
    const note = r1.dmg <= 0 ? ' (혼자서는 못 씀)' : '';
    lines.push(`| ${sk.name}${note} | ${sk.cd || '-'} | ${sk.mp || '-'} | ${f(r1.dmg / SECONDS)} | ${f(per1)} | ${sk.mp ? f(per1 / sk.mp) : '-'} | ${f(per5)} | ${r1.dist}px · ${r1.hold ? `${r1.hold}초` : '톡'} |`);
  });
  const rot = rotation(cls, 1, false), rotInf = rotation(cls, 1, true);
  lines.push('');
  lines.push(`- 돌려 쓰기 초당 피해 (Lv1 스킬, MP 실제): **${f(rot.dmg / SECONDS)}** · MP 무한이면 ${f(rotInf.dmg / SECONDS)}`);
  lines.push(`- 돌려 쓰기 ${SECONDS}초 동안 쓴 횟수: ${Object.entries(rot.by ?? {}).map(([k, n]) => `${SKILLS[k]?.name ?? k} ${n}`).join(' · ')}`);
  lines.push('');
}

writeFileSync(new URL('../document/스킬딜량_측정.md', import.meta.url), lines.join('\n'));
console.log(lines.join('\n'));
