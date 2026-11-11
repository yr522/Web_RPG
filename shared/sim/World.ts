// 맵 하나 = 방 하나. 화면(Phaser)·DOM을 모르는 순수 시뮬레이션.
// 지금은 브라우저(LocalSession)가 돌리고, 나중에는 서버가 같은 코드를 돌린다.
import { GROUND_Y, MAPS, type MapDef, type MapId } from '../data/maps';
import { CLASSES, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, MAGE_RECOIL, type SlotKey } from '../data/classes';
import { ELEMENTS, REACTIONS, STRONG_AGAINST, reactionKey, type Element } from '../data/elements';
import { POTION, itemDef } from '../data/items';
import { BAG_FULL, addItem, countItem, removeItem } from '../rules/inventory';
import { questDef, type QuestDef } from '../data/quests';
import { autoReport, newlyReady, questReadyText, questState, questsOnKill, questsOnVisit, readyQuestIds } from '../rules/quests';
import { mapNpcs, mapPortals } from '../rules/story';
import { MONSTERS, MONSTER_AI, SLIME_AI, CHARGER_AI, FLYER_AI, GOLEM_AI, BOSS_ORB, COIN, ITEM_DROP, type MonsterId } from '../data/monsters';
import { stepBody, overlaps, JUMP_VELOCITY, type Solid } from './physics';
import { emptyCommand, type Command, type EntityId, type Fx, type GameEvent } from './types';
import { deriveStats, type DerivedStats, type SaveData } from './save';
import { gainExp, learned, skillLevel } from '../rules/progress';
import type { Attack, Coin, Enemy, Hitbox, PlayerState, Projectile, Rect, Vortex } from './entities';
import type { HitboxSpec, ProjSpec, SkillWorld } from './skills/types';
import { CLASS_SKILLS } from './skills';
import { CHARGE_SKILLS, startGrapple } from './skills/archer';
import { mulberry32, type Rng } from './rng';

export type { PlayerState, Enemy, Coin, Projectile, Vortex } from './entities';
export const TICK = 1 / 60;

const cx = (o: { x: number; w: number }) => o.x + o.w / 2;
const cy = (o: { y: number; h: number }) => o.y + o.h / 2;

/** 원소 상성 배율 (기획서 3장) */
export function elemMult(atk: Element | null, target: Enemy) {
  if (!atk || !target.elem) return 1;
  if (atk === target.elem) return target.elemental ? 0.25 : 1;
  if (STRONG_AGAINST[atk] === target.elem) return target.elemental ? 2 : 1.1;
  if (STRONG_AGAINST[target.elem] === atk) return target.elemental ? 0.5 : 0.9;
  return 1;
}

export class World implements SkillWorld {
  readonly map: MapDef;
  readonly solids: Solid[];
  readonly players = new Map<EntityId, PlayerState>();
  readonly enemies: Enemy[] = [];
  coins: Coin[] = [];
  hitboxes: Hitbox[] = [];
  projectiles: Projectile[] = [];
  vortices: Vortex[] = [];
  private timers: { t: number; fn: () => void; owner: PlayerState }[] = [];
  time = 0;
  readonly rng: Rng;
  private events: GameEvent[] = [];
  /** 보스 방 천장 보안장치: 조준 중이면 dir (고정된 방향), aimT = 발사까지 */
  orb: { x: number; y: number; t: number; aimT: number; dir: { x: number; y: number } | null } | null = null;
  /** 보안장치가 쏜 탄 */
  orbShots: { id: string; x: number; y: number; vx: number; vy: number }[] = [];
  private nextId = 1;

  constructor(readonly mapId: MapId, seed = Date.now()) {
    this.rng = mulberry32(seed);
    this.map = MAPS[mapId];
    this.solids = [
      { x: 0, y: GROUND_Y, w: this.map.width, h: 200, ground: true },
      ...this.map.platforms.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h ?? 14 })),
    ];
    for (const sp of this.map.spawns) this.spawnEnemy(sp.mob, sp.x, sp.elem ?? null, sp.y).once = sp.once;
    if (this.map.orb) this.orb = { x: this.map.orb.x, y: this.map.orb.y, t: 0, aimT: 0, dir: null };
  }

  // ===================== 입장 · 퇴장 =====================
  addPlayer(id: EntityId, data: SaveData, x: number, hp?: number, mp?: number, y = GROUND_Y): PlayerState {
    const stats = deriveStats(data);
    const p: PlayerState = {
      id, name: data.name, data, stats, x, y: y - 46, w: 28, h: 46, vx: 0, vy: 0, face: 1,
      onGround: false, drop: 0, plat: null, hp: hp ?? stats.maxHp, mp: mp ?? stats.maxMp,
      cmd: emptyCommand(), potionCd: 0, push: 0, warnCd: 0, action: null, cd: {}, lockT: 0, buffer: null,
      lastHit: null, combo: 0, cbWindow: 0, invT: 0, hurt: 0, stunT: 0, crouch: false, buffT: 0, chainArrow: null, ropeTo: null,
    };
    this.players.set(id, p);
    // 가기 퀘스트: 이 맵에 들어오면 완료
    for (const q of questsOnVisit(data, this.mapId)) this.questReady(p, q);
    return p;
  }

  /** 퀘스트를 다 했을 때 큰 글씨 알림 (누구에게 보고하는지) */
  private questReady(p: PlayerState, q: QuestDef) {
    // 자동 보고 퀘스트는 바로 보고 (다음 퀘스트도 바로 받음)
    if (q.auto) {
      for (const r of autoReport(p.data)) {
        if (r.banner) this.events.push({ type: 'banner', playerId: p.id, text: r.banner, color: '#9ef0a0' });
        if (r.statsChanged) this.refreshStats(p, r.fullHeal);
      }
      return;
    }
    this.events.push({ type: 'banner', playerId: p.id, text: questReadyText(q), color: '#9ef0a0' });
  }

  removePlayer(id: EntityId) { this.players.delete(id); }

  /** 틱 밖에서 생긴 이벤트(입장 때 퀘스트 완료 등)를 꺼냄 */
  takeEvents() { const out = this.events; this.events = []; return out; }

  /** 레벨·능력치가 바뀌면 다시 계산 */
  refreshStats(p: PlayerState, fullHeal = false) {
    p.stats = deriveStats(p.data);
    if (fullHeal) { p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; }
    p.hp = Math.min(p.hp, p.stats.maxHp);
    p.mp = Math.min(p.mp, p.stats.maxMp);
  }

  /** 스킬트리 초기화 등으로 배운 스킬이 바뀌면 진행 중인 전투 상태를 푼다 */
  resetCombat(p: PlayerState) {
    p.cd = {}; p.action = null; p.buffer = null; p.lockT = 0; p.combo = 0; p.cbWindow = 0; p.lastHit = null;
    p.buffT = 0; p.chainArrow = null; p.ropeTo = null;
    this.hitboxes = this.hitboxes.filter(h => h.owner !== p);
    this.projectiles = this.projectiles.filter(o => o.owner !== p);
    this.timers = this.timers.filter(o => o.owner !== p);
  }

  /**
   * 이야기용 몬스터: 컷신이 그 자리에 진짜 몬스터를 만든다. 한 번만 나오고, held 면 컷신이 끝날 때까지 가만히.
   * x = 가운데. 만든 몬스터 id 를 돌려준다.
   */
  spawnStory(x: number, elem: Element | null, tag?: string, held = true) {
    const mob: MonsterId = elem ? 'slime_elem' : 'slime';
    const e = this.spawnEnemy(mob, x - MONSTERS[mob].w / 2, elem);
    e.tag = tag; e.held = held; e.once = true;
    return e.id;
  }

  /** 붙잡아 둔 몬스터 풀기 (컷신 끝) */
  releaseHeld() { for (const e of this.enemies) e.held = false; }

  private spawnEnemy(mob: MonsterId, x: number, elem: Element | null, y?: number) {
    const def = MONSTERS[mob];
    const sy = y ?? GROUND_Y - def.h;
    const e: Enemy = {
      id: `e${this.nextId++}`, mob, x, y: sy, w: def.w, h: def.h, vx: 0, vy: 0, onGround: false, drop: 0, plat: null,
      elem, elemental: !!def.elemental, maxHp: def.hp, hp: def.hp,
      dir: this.rng() < 0.5 ? -1 : 1, turnT: 1 + this.rng() * 2, hopT: this.rng() * 2, stun: 0, record: null,
      dead: false, deadT: 0, spawnX: x, spawnY: sy, speed: this.range(def.speed), leap: 'none', leapT: 0,
      leapCd: this.patternCd(mob), pulled: false,
    };
    this.enemies.push(e);
    return e;
  }

  // ===================== 틱 =====================
  /** 고정 틱 한 번 진행. 명령은 플레이어별. */
  step(commands: Map<EntityId, Command>): GameEvent[] {
    const dt = TICK;
    this.time += dt;
    for (const p of this.players.values()) this.stepPlayer(p, commands.get(p.id) ?? emptyCommand(), dt);
    this.stepEnemies(dt);
    this.stepHitboxes(dt);
    this.stepProjectiles(dt);
    this.stepVortices(dt);
    this.stepOrb(dt);
    this.stepTimers(dt);
    this.stepCoins(dt);
    const out = this.events;
    this.events = [];
    return out;
  }

  private stepPlayer(p: PlayerState, cmd: Command, dt: number) {
    // 이동기(질풍참 돌진·사슬 화살 끌려가기 등 무적 행동)가 이번 틱에 끝나도 이번 틱까지는 무적
    const invAtStart = !!(p.action && p.action.inv);
    // 기절: 조작 불가
    if (p.stunT > 0) { p.stunT = Math.max(0, p.stunT - dt); cmd = emptyCommand(); }
    p.cmd = cmd;
    p.drop = Math.max(0, p.drop - dt);
    p.potionCd = Math.max(0, p.potionCd - dt);
    p.warnCd = Math.max(0, p.warnCd - dt);
    p.invT = Math.max(0, p.invT - dt);
    p.hurt = Math.max(0, p.hurt - dt);
    p.cbWindow = Math.max(0, p.cbWindow - dt);
    p.lockT = Math.max(0, p.lockT - dt);
    // 마력 해방: 쿨타임 2배속, 끝나면 그때부터 해방 쿨타임
    if (p.buffT > 0) {
      p.buffT -= dt;
      if (p.buffT <= 0) { p.buffT = 0; p.cd.haebang = SKILLS.haebang.cd; this.float(cx(p), p.y - 26, '해방 종료', '#aaaaaa', 14); }
    }
    const rate = p.buffT > 0 ? 2 : 1;
    for (const s in p.cd) p.cd[s] = Math.max(0, p.cd[s] - dt * (s === 'haebang' ? 1 : rate));
    if (!p.action || p.action.name !== 'grapple') p.ropeTo = null;
    const cs = CLASS_SKILLS[p.data.cls];
    p.mp = Math.min(p.stats.maxMp, p.mp + p.stats.regen * dt);
    if (this.map.safe) p.hp = Math.min(p.stats.maxHp, p.hp + 6 * dt);

    for (const k of cmd.potionPressed) this.usePotion(p, k);

    // ↑ : NPC 대화 / 포탈
    if (cmd.upPressed && !p.action && p.hurt <= 0) {
      const npc = this.npcNear(p);
      if (npc) { this.events.push({ type: 'interact', playerId: p.id, npc: npc.id }); return; }
      const portal = this.portalNear(p);
      if (portal && p.onGround) { this.events.push({ type: 'portal', playerId: p.id, to: portal.to, toX: portal.toX, toY: portal.toY, confirm: portal.confirm }); return; }
    }

    // 스킬 입력. 공격이 완전히 끝나기 전 입력은 무효, 끝나기 0.2초 전 입력만 끝나자마자 실행(버퍼)
    for (const key of cmd.skillPressed) {
      const i = SLOT_KEYS.indexOf(key);
      if (i >= 4) continue;
      const name = this.activeSkill(p, i), a = p.action;
      if (!name) { this.warn(p, `Lv ${UNLOCK_LEVELS[i]}에 배울 수 있어`); continue; }
      // 사슬 화살이 날아가는 중 한 번 더 누르면 끌려감
      if (name === 'sasl' && p.chainArrow && !p.chainArrow.dead && !(a && a.name === 'aim')) { startGrapple(this, p); continue; }
      // 조준·충전·돌진·끌려가는 중에는 다른 스킬 완전 무효
      if (a && (a.name === 'aim' || a.name === 'charge' || a.name === 'dash' || a.name === 'grapple')) continue;
      const remain = (a ? a.dur - a.t : 0) + p.lockT;
      if (!a && p.lockT <= 0) this.tryStart(p, name);
      // 궁수 충전: 쏜 직후에 눌러도 바로 당기기 시작 (발사는 쉬는 시간이 지난 뒤)
      else if (p.data.cls === 'archer' && CHARGE_SKILLS.includes(name) && (!a || a.name === 'recover') && p.hurt <= 0) this.tryStart(p, name);
      else if (remain <= 0.2) p.buffer = { name, t: this.time };
    }

    // 안전장치: 행동이 비정상적으로 길어지면 풀기
    if (p.action && p.action.t > (p.action.name === 'charge' ? 6 : 2.5)) { p.action = null; p.vx = p.vy = 0; }
    if (!Number.isFinite(p.lockT) || p.lockT > 3) p.lockT = 0;
    const a = p.action;
    if (a) {
      a.t += dt;
      if (a.events) for (const ev of a.events) if (!ev.done && a.t >= ev.at) { ev.done = true; ev.fn(); }
      a.update?.(dt);
      if (p.action === a && a.t >= a.dur) { p.action = null; a.end?.(); }
    }
    if (!p.action && p.lockT <= 0 && p.buffer) {
      const b = p.buffer; p.buffer = null;
      if (this.time - b.t < 0.35) this.tryStart(p, b.name);
    }
    // Z 를 누르고 있으면 기본기(기본 공격·일섬·마력탄) 연타
    const z = this.activeSkill(p, 0);
    if (!p.action && p.lockT <= 0 && z && cs.auto.includes(z) && cmd.skillHeld.includes('Z') && p.hurt <= 0) this.tryStart(p, z, true);

    // 이동
    const walkMul = p.action ? cs.walk[p.action.name] : undefined;
    if (p.action && walkMul !== undefined && p.hurt <= 0) {
      // 검사·궁수: 공격 중에도 이동 (바라보는 방향은 공격 방향 유지)
      if (cmd.move) p.vx = cmd.move * p.stats.speed * walkMul;
      else if (p.onGround && p.action.name !== 'ilseom' && p.action.name !== 'wolcham') p.vx = 0;
      if (cmd.jumpPressed && p.onGround && !p.action.noGravity) p.vy = JUMP_VELOCITY;
    }
    // 앉기: 땅에서 ↓ 를 누르고 있으면 멈춰서 방향만 돌린다 (↓+점프는 발판 내려가기 그대로)
    p.crouch = !p.action && p.hurt <= 0 && p.onGround && cmd.down;
    if (!p.action) {
      if (p.hurt > 0) p.vx *= 1 - 5 * dt;
      else {
        p.vx = p.crouch ? 0 : cmd.move * p.stats.speed;
        if (cmd.move) p.face = cmd.move;
        if (cmd.jumpPressed && p.onGround) {
          const onPlatform = p.plat && !p.plat.ground && p.y + p.h < GROUND_Y - 2;
          if (cmd.down && onPlatform) p.drop = 0.25;
          else p.vy = JUMP_VELOCITY;
        }
      }
    }
    // 반동으로 밀려나는 중: 이번 틱만 그만큼 옆으로 움직이고 원래 속도로 되돌린다
    const keepVx = p.vx;
    if (p.push) {
      const step = Math.sign(p.push) * Math.min(Math.abs(p.push), (MAGE_RECOIL.dist / MAGE_RECOIL.time) * dt);
      p.push -= step;
      if (Math.abs(p.push) < 0.01) p.push = 0;
      p.vx = step / dt;
    }
    const pushed = p.vx !== keepVx;
    stepBody(p, dt, this.solids, this.map.width, !(p.action && p.action.noGravity));
    if (pushed) p.vx = keepVx;

    if (!Number.isFinite(p.x) || !Number.isFinite(p.y) || !Number.isFinite(p.vx) || !Number.isFinite(p.vy)) {
      p.action = null; p.x = 300; p.y = GROUND_Y - p.h; p.vx = p.vy = 0;
    }

    // 몬스터와 부딪히면 피해
    if (p.invT <= 0 && !invAtStart && !(p.action && p.action.inv)) {
      for (const e of this.enemies) {
        if (e.dead || e.held || !overlaps(p, e)) continue;
        // 골렘 돌진에 맞으면 기절
        const charging = e.pat === 'charge' && e.leap === 'leap';
        const dmg = charging ? GOLEM_AI.chargeDmg : MONSTERS[e.mob].touch;
        p.hp -= dmg;
        this.float(cx(p), p.y - 10, `-${dmg}`, '#ff6b6b', 18);
        if (charging) { p.stunT = GOLEM_AI.stunTime; this.float(cx(p), p.y - 34, '기절!', '#ffd84a', 18, 1.2); }
        if (p.action && p.action.superArmor) p.invT = 0.6;
        else {
          p.invT = 1.0; p.hurt = 0.3; p.action = null;
          const dir = Math.sign(cx(p) - cx(e)) || 1;
          p.vx = dir * 280; p.vy = -320;
        }
        break;
      }
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.resetCombat(p);
      this.events.push({ type: 'died', playerId: p.id });
    }
  }

  // ===================== 스킬 =====================
  /** 슬롯(0~3)에 지금 쓸 수 있는 스킬. 첫 스킬을 배우기 전 Z 는 기본 공격 */
  activeSkill(p: PlayerState, i: number): string | null {
    const id = CLASSES[p.data.cls].skills[i];
    if (learned(p.data, id)) return id;
    return i === 0 ? 'basic' : null;
  }

  private slotOf(p: PlayerState, skill: string) {
    return Math.max(0, CLASSES[p.data.cls].skills.indexOf(skill));
  }

  private tryStart(p: PlayerState, name: string, silent = false) {
    const sk = SKILLS[name], cs = CLASS_SKILLS[p.data.cls];
    const can = cs.can[name]?.(this, p);
    if (can !== undefined && can !== true) { if (!silent) this.warn(p, can); return false; }
    if ((p.cd[name] ?? 0) > 0) { if (!silent) this.warn(p, '쿨타임'); return false; }
    if (p.mp < sk.mp) { if (!silent) this.warn(p, 'MP 부족'); return false; }
    const start = cs.start[name];
    if (!start) { if (!silent) this.warn(p, '아직 못 쓰는 스킬이야'); return false; }
    p.mp -= sk.mp;
    // 마력 해방의 쿨타임은 버프가 끝난 뒤부터
    if (sk.cd && name !== 'haebang') p.cd[name] = sk.cd;
    const order = this.slotOf(p, name);
    // 연계 보너스는 검사 전용
    const chain = p.data.cls === 'warrior' && !!(p.lastHit && this.time - p.lastHit.t < 0.9 && order > p.lastHit.order);
    // 검사 초식 순서: 일섬 → 월참 → 질풍참이 이어져야(연계) 천붕이 열린다
    if (name === 'ilseom') p.combo = 1;
    else if (name === 'wolcham') p.combo = chain && p.combo === 1 ? 2 : 0;
    else if (name === 'jilpung') p.combo = chain && p.combo === 2 ? 3 : 0;
    else p.combo = 0;
    start(this, p, chain);
    return true;
  }

  // SkillWorld 구현 (스킬 코드가 쓰는 것들)
  private skillMult(p: PlayerState, skill: string) {
    return skill === 'basic' ? 1 : 1 + 0.1 * (skillLevel(p.data, skill) - 1);
  }
  addHB(p: PlayerState, h: HitboxSpec) {
    this.hitboxes.push({
      dx: 0, dy: 0, w: 0, h: 0, ...h,
      owner: p, face: h.face ?? p.face, order: h.order ?? 0, chain: h.chain ?? false, t: 0, hit: new Set(), sm: this.skillMult(p, h.skill),
    });
  }
  addProj(p: PlayerState, s: ProjSpec): Projectile {
    const o: Projectile = {
      id: `j${this.nextId++}`, kind: s.kind, x: s.x, y: s.y, ang: Math.atan2(s.vy, s.vx), speed: Math.hypot(s.vx, s.vy),
      range: s.range, traveled: 0, size: s.size, len: s.len, pierce: s.pierce, hit: new Set(), dead: false,
      owner: p, face: Math.sign(s.vx) || p.face, coef: s.coef, elem: s.elem, order: s.order ?? 0, chain: s.chain ?? false, kb: s.kb,
      sm: this.skillMult(p, s.skill),
    };
    this.projectiles.push(o);
    return o;
  }
  addVortex(_p: PlayerState, v: Vortex) { this.vortices.push(v); }
  later(p: PlayerState, t: number, fn: () => void) { this.timers.push({ t, fn, owner: p }); }
  nearestFront(p: PlayerState, range: number) {
    let best: Enemy | null = null, bd = Infinity;
    for (const e of this.enemies) {
      if (e.dead) continue;
      const dx = cx(e) - cx(p), dy = cy(e) - cy(p);
      if (dx * p.face < -10 || Math.abs(dx) > range || Math.abs(dy) > 220) continue;
      const d = Math.hypot(dx, dy);
      if (d < bd) { bd = d; best = e; }
    }
    return best;
  }
  fx(f: Fx) { this.events.push({ type: 'fx', fx: f }); }
  float(x: number, y: number, text: string, color: string, size?: number, life?: number) {
    this.events.push({ type: 'float', x, y, text, color, size, life });
  }
  chainText(p: PlayerState, skill: string, chain: boolean) {
    if (chain) this.float(cx(p), p.y - 30, `연계! 제${this.slotOf(p, skill) + 1}초 ${SKILLS[skill].name}`, '#ffffff', 16, 0.8);
  }
  elemOf(p: PlayerState, skill: string) { return p.data.learned[skill] ?? null; }
  learned(p: PlayerState, skill: string) { return learned(p.data, skill); }
  held(p: PlayerState, skill: string) { return p.cmd.skillHeld.includes(SLOT_KEYS[this.slotOf(p, skill)] as SlotKey); }

  warn(p: PlayerState, text: string) {
    if (p.warnCd > 0) return;
    p.warnCd = 0.6;
    this.float(cx(p), p.y - 26, text, '#dddddd', 14);
  }

  // ===================== 공격 판정 =====================
  hitboxRect(h: Hitbox): Rect {
    if (h.abs) return h.abs;
    const p = h.owner;
    if (h.center) return { x: cx(p) - h.w / 2, y: cy(p) - h.h / 2, w: h.w, h: h.h };
    const x = h.face > 0 ? cx(p) + h.dx : cx(p) - h.dx - h.w;
    return { x, y: cy(p) + h.dy, w: h.w, h: h.h };
  }

  private stepHitboxes(dt: number) {
    for (const h of this.hitboxes) {
      h.t += dt;
      const r = this.hitboxRect(h);
      for (const e of this.enemies) {
        if (e.dead || h.hit.has(e.id) || !overlaps(r, e)) continue;
        h.hit.add(e.id);
        this.hitEnemy(e, h);
      }
    }
    this.hitboxes = this.hitboxes.filter(h => h.t < h.life);
  }

  private stepProjectiles(dt: number) {
    for (const o of this.projectiles) {
      if (o.dead) continue;
      const step = o.speed * dt;
      o.x += Math.cos(o.ang) * step; o.y += Math.sin(o.ang) * step; o.traveled += step;
      const r = { x: o.x - o.size / 2, y: o.y - o.size / 2, w: o.size, h: o.size };
      for (const e of this.enemies) {
        if (e.dead || o.hit.has(e.id) || !overlaps(r, e)) continue;
        o.hit.add(e.id);
        this.hitEnemy(e, o);
        if (!o.pierce) {
          o.dead = true;
          this.fx({ kind: 'ring', x: o.x, y: o.y, color: o.elem ? ELEMENTS[o.elem].color : '#dddddd', r0: 4, r1: 26, life: 0.2 });
          break;
        }
      }
      if (o.traveled >= o.range) o.dead = true;
    }
    for (const p of this.players.values()) if (p.chainArrow?.dead) p.chainArrow = null;
    this.projectiles = this.projectiles.filter(o => !o.dead);
  }

  /** 소용돌이: 범위 안 몬스터를 가운데로 끌어당김 */
  private stepVortices(dt: number) {
    for (const v of this.vortices) {
      v.t += dt;
      for (const e of this.enemies) {
        if (e.dead || MONSTERS[e.mob].boss) continue;
        const dx = v.x - cx(e), dy = v.y - cy(e);
        if (Math.hypot(dx, dy) > v.r) continue;
        const f = Math.min(1, dt * 7);
        e.x += dx * f; e.y += dy * f; e.vx = 0; e.vy = 0; e.stun = 0.3; e.pulled = true; e.leap = 'none';
      }
    }
    this.vortices = this.vortices.filter(v => v.t < v.life);
  }

  private stepTimers(dt: number) {
    const due: (() => void)[] = [];
    for (const o of this.timers) { o.t -= dt; if (o.t <= 0) due.push(o.fn); }
    this.timers = this.timers.filter(o => o.t > 0);
    for (const fn of due) fn();
  }

  private hitEnemy(e: Enemy, h: Attack) {
    const p = h.owner;
    // 기절(취약) 중인 보스는 피해 배수
    const weak = e.groggy && e.groggy > 0 ? GOLEM_AI.groggyMult : 1;
    const base = p.stats.atk * h.coef * h.sm * (h.chain ? 1.2 : 1) * (0.92 + this.rng() * 0.16) * weak;
    const m = elemMult(h.elem, e);
    const d = Math.max(1, Math.round(base * m));
    e.hp -= d;
    const col = h.elem ? ELEMENTS[h.elem].color : '#c8c8e0';
    this.float(cx(e), e.y - 8, `${d}${m !== 1 ? ` ×${m}` : ''}`, col, m >= 2 ? 24 : m < 1 ? 15 : h.coef >= 2.5 ? 23 : 19);
    let reaction = false;
    // 원소 반응: 마지막으로 맞은 원소 + 이번 원소
    if (h.elem && e.record && e.record !== h.elem) {
      const r = REACTIONS[reactionKey(e.record, h.elem)];
      if (r) {
        reaction = true;
        const rm = elemMult(r.element, e);
        const rd = Math.max(1, Math.round(base * 0.5 * rm));
        e.hp -= rd;
        const rc = ELEMENTS[r.element].color;
        this.float(cx(e), e.y - 34, `${r.name}! ${rd}${rm !== 1 ? ` ×${rm}` : ''}`, rc, 26, 1.2);
        this.events.push({ type: 'banner', playerId: p.id, text: `${ELEMENTS[r.element].icon} ${r.name}!`, color: rc });
        this.fx({ kind: 'ring', x: cx(e), y: cy(e), color: rc, r0: 10, r1: 70, life: 0.35 });
      }
    }
    if (h.elem) e.record = h.elem;
    // 보스는 밀리지 않고 경직 없음
    if (!MONSTERS[e.mob].boss) {
      if (h.kbAng !== undefined) { e.vx = Math.cos(h.kbAng) * h.face * h.kb; e.vy = Math.min(-150, Math.sin(h.kbAng) * h.kb); }
      else { e.vx = h.face * h.kb; e.vy = h.launch ?? -140; }
      e.stun = h.launch && h.launch < -300 ? 0.7 : 0.3;
      e.leap = 'none';
    }
    p.lastHit = { order: h.order, t: this.time };
    this.events.push({ type: 'hit', enemyId: e.id, heavy: !h.light, reaction });
    if (e.hp <= 0 && !e.dead) {
      e.dead = true; e.deadT = 0;
      this.fx({ kind: 'ring', x: cx(e), y: cy(e), color: '#ffffff', r0: 5, r1: 40, life: 0.3 });
      this.onKill(p, e);
    }
  }

  private onKill(p: PlayerState, e: Enemy) {
    const s = p.data;
    // 처치 목표 + 레벨업(레벨 목표)으로 새로 끝난 퀘스트
    const before = readyQuestIds(s);
    s.kills++;
    this.events.push({ type: 'kill', playerId: p.id, enemyId: e.id, tag: e.tag });
    const def = MONSTERS[e.mob];
    const r = gainExp(s, def.exp);
    this.float(cx(e), e.y - 46, r.msg!, '#9ef0a0', 14, 1.0);
    if (r.banner) {
      this.events.push({ type: 'banner', playerId: p.id, text: r.banner, color: '#ffe066' });
      this.fx({ kind: 'ring', x: cx(p), y: cy(p), color: '#ffe066', r0: 10, r1: 120, life: 0.6 });
    }
    if (r.statsChanged) this.refreshStats(p, r.fullHeal);
    const [g0, g1] = def.gold;
    this.dropGold(cx(e), cy(e), g0 + Math.floor(this.rng() * (g1 - g0 + 1)));
    for (const d of def.drops ?? []) {
      if (d.quest && questState(s, d.quest) !== 'active') continue;
      // 최대 개수: 가방 + 바닥에 떨어져 있는 것
      if (d.max !== undefined && countItem(s, d.item) + this.coins.filter(c => c.item === d.item).length >= d.max) continue;
      if (this.rng() < d.chance) this.dropItem(cx(e), cy(e), d.item);
    }
    questsOnKill(s, e.mob, e.tag);
    for (const id of readyQuestIds(s)) if (!before.includes(id)) this.questReady(p, questDef(id)!);
  }

  // ===================== 몬스터 =====================
  private stepEnemies(dt: number) {
    const players = [...this.players.values()];
    for (const e of this.enemies) {
      if (e.dead) {
        e.deadT += dt;
        if (e.once) continue;
        // 5초 뒤, 근처에 플레이어가 없으면 다시 나타남
        if (e.deadT > 5 && players.every(p => Math.abs(cx(p) - e.spawnX) > 320)) {
          e.dead = false; e.hp = e.maxHp; e.x = e.spawnX; e.y = e.spawnY - 40; e.vx = e.vy = 0; e.record = null; e.stun = 0; e.leap = 'none'; e.leapCd = this.patternCd(e.mob);
        }
        continue;
      }
      // 소용돌이에 끌려가는 중: 스스로 움직이지 않음 (stepVortices 가 다음 틱에 다시 끌어당김)
      if (e.pulled) { e.pulled = false; continue; }
      // 컷신 중 붙잡힘: 제자리에 서 있기 (떨어지는 것만)
      if (e.held) { e.vx = 0; e.leap = 'none'; stepBody(e, dt, this.solids, this.map.width); continue; }
      const target = this.nearestPlayer(e);
      e.leapCd -= dt;
      if (e.stun > 0) {
        e.stun -= dt;
        e.leap = 'none';
        if (e.onGround) e.vx *= 1 - 6 * dt;
        if (MONSTERS[e.mob].ai === 'flyer') { e.vx *= 1 - 6 * dt; e.vy *= 1 - 6 * dt; }
      } else {
        const ai = MONSTERS[e.mob].ai;
        if (ai === 'slime') this.slimeAi(e, target, dt);
        else if (ai === 'flyer') this.flyerAi(e, target, dt);
        else if (ai === 'golem') this.golemAi(e, target, dt);
        else this.groundAi(e, target, dt);
      }
      if (MONSTERS[e.mob].ai === 'flyer') {
        // 날아다님: 중력·발판 없이 맵 안에서만
        e.x = Math.max(0, Math.min(this.map.width - e.w, e.x + e.vx * dt));
        e.y = Math.max(this.map.top ?? 0, Math.min(GROUND_Y - e.h, e.y + e.vy * dt));
      } else stepBody(e, dt, this.solids, this.map.width);
      // 맵 끝에 닿으면 돌아섬 (골렘 돌진 중은 제외: 돌진이 벽에서 끝나야 함)
      if (!(e.pat === 'charge' && e.leap === 'leap')) {
        if (e.x <= 0) e.dir = 1;
        if (e.x >= this.map.width - e.w) e.dir = -1;
      }
    }
  }

  /** 다음 특수 패턴(슬라임 큰 점프, 돌진)까지 시간 */
  private patternCd(mob: MonsterId) {
    const ai = MONSTERS[mob].ai;
    return ai === 'slime' ? this.range(SLIME_AI.leapEvery) : ai === 'charger' ? this.range(CHARGER_AI.every) : 0;
  }

  /** 쫓을 대상이 보이면 그쪽으로, 아니면 돌아다니기. 쫓는 중인지 돌려준다 */
  private walk(e: Enemy, target: PlayerState | null, dt: number) {
    const dx = target ? cx(target) - cx(e) : 9999, dy = target ? cy(target) - cy(e) : 9999;
    const chasing = Math.abs(dx) < MONSTER_AI.sight && Math.abs(dy) < 110;
    if (chasing) {
      // 거의 겹쳐 있으면 방향을 바꾸지 않고 멈춘다 (매 틱 좌우로 떨리는 것 방지)
      const near = Math.abs(dx) <= MONSTER_AI.chaseDeadZone;
      if (!near) e.dir = dx > 0 ? 1 : -1;
      e.vx = near ? 0 : e.dir * e.speed * MONSTERS[e.mob].chase;
    } else {
      e.turnT -= dt;
      if (e.turnT < 0) { e.dir = e.dir > 0 ? -1 : 1; e.turnT = 1.5 + this.rng() * 2.5; }
      e.vx = e.dir * e.speed;
    }
    return { chasing, dx };
  }

  /** 슬라임: 폴짝 + 웅크렸다 크게 점프 */
  private slimeAi(e: Enemy, target: PlayerState | null, dt: number) {
    if (e.leap === 'crouch') {
      // 웅크림(예고): 멈춰서 잠깐 기다렸다가 뛰어듦
      e.vx = 0;
      e.leapT -= dt;
      if (e.leapT <= 0) {
        e.leap = 'leap';
        e.vy = SLIME_AI.leapVy * (0.9 + this.rng() * 0.2);
        e.vx = e.dir * SLIME_AI.leapVx;
        e.onGround = false;
      }
      return;
    }
    if (e.leap === 'leap') {
      // 공중: 방향 유지, 땅에 닿으면 끝
      if (e.onGround) { e.leap = 'none'; e.leapCd = this.range(SLIME_AI.leapEvery); e.hopT = this.range(SLIME_AI.hopEvery); }
      return;
    }
    const { chasing } = this.walk(e, target, dt);
    if (e.onGround && chasing && e.leapCd <= 0) {
      // 쫓아오다가 가끔 웅크렸다 크게 점프
      if (this.rng() < SLIME_AI.leapChance) { e.leap = 'crouch'; e.leapT = SLIME_AI.crouchTime; e.vx = 0; }
      else e.leapCd = this.range(SLIME_AI.leapEvery) * 0.5;
    } else {
      e.hopT -= dt;
      if (e.onGround && e.hopT < 0) { e.vy = -this.range(SLIME_AI.hopPower); e.hopT = this.range(SLIME_AI.hopEvery); }
    }
  }

  /** 걷는 몬스터 (기계 등): 점프 없음. 돌진형은 가끔 멈춰 떨다가(crouch) 앞으로 돌진(leap) */
  private groundAi(e: Enemy, target: PlayerState | null, dt: number) {
    if (e.leap === 'crouch') {
      e.vx = 0;
      e.leapT -= dt;
      if (e.leapT <= 0) { e.leap = 'leap'; e.leapT = CHARGER_AI.dashTime; }
      return;
    }
    if (e.leap === 'leap') {
      e.vx = e.dir * CHARGER_AI.dashSpeed;
      e.leapT -= dt;
      if (e.leapT <= 0) { e.leap = 'none'; e.leapCd = this.range(CHARGER_AI.every); }
      return;
    }
    const { chasing, dx } = this.walk(e, target, dt);
    if (MONSTERS[e.mob].ai === 'charger' && chasing && e.onGround && e.leapCd <= 0 && Math.abs(dx) < CHARGER_AI.range) {
      e.dir = dx > 0 ? 1 : -1;
      e.leap = 'crouch'; e.leapT = CHARGER_AI.windup; e.vx = 0;
    }
  }

  /** 날아다니는 몬스터: 보이면 플레이어 쪽으로 곧장, 아니면 좌우로 둥실둥실 */
  private flyerAi(e: Enemy, target: PlayerState | null, dt: number) {
    e.hoverY ??= e.spawnY;
    const dx = target ? cx(target) - cx(e) : 9999, dy = target ? cy(target) - cy(e) : 9999;
    const dist = Math.hypot(dx, dy), sp = e.speed * MONSTERS[e.mob].chase;
    if (dist < FLYER_AI.sight) {
      if (dist > 4) { e.vx = (dx / dist) * sp; e.vy = (dy / dist) * sp; }
      if (Math.abs(dx) > 4) e.dir = dx > 0 ? 1 : -1;
      e.hoverY = e.y;
    } else {
      e.turnT -= dt;
      if (e.turnT < 0) { e.dir = e.dir > 0 ? -1 : 1; e.turnT = 1.5 + this.rng() * 2.5; }
      e.vx = e.dir * e.speed;
      const want = e.hoverY + Math.sin(this.time * FLYER_AI.bobSpeed + e.spawnX) * FLYER_AI.bob;
      e.vy = (want - e.y) * 2;
    }
  }

  /** 마법 골렘: 플레이어 쪽으로 천천히 → 가까우면 내려치기, 멀면 가끔 맵 끝까지 돌진. 기절 중엔 멈춤 */
  private golemAi(e: Enemy, target: PlayerState | null, dt: number) {
    if (e.groggy && e.groggy > 0) {
      e.groggy -= dt; e.vx = 0; e.leap = 'none'; e.pat = undefined;
      if (e.groggy <= 0) { e.groggy = 0; e.orbHits = 0; e.leapCd = this.range(GOLEM_AI.every); }
      return;
    }
    const dx = target ? cx(target) - cx(e) : 0;
    if (e.leap === 'crouch') {
      // 예고: 멈춰서 떨림
      e.vx = 0;
      e.leapT -= dt;
      if (e.leapT > 0) return;
      e.leap = 'leap';
      if (e.pat === 'slam') { this.golemSlam(e); e.leapT = GOLEM_AI.slamRecover; }
      return;
    }
    if (e.leap === 'leap') {
      if (e.pat === 'slam') {
        e.vx = 0;
        e.leapT -= dt;
        if (e.leapT <= 0) { e.leap = 'none'; e.pat = undefined; e.leapCd = this.range(GOLEM_AI.every); }
      } else {
        // 돌진: 정한 방향으로 벽에 닿을 때까지 (플레이어 위치와 상관없음)
        const d = e.chargeDir ?? e.dir;
        e.dir = d;
        e.vx = d * GOLEM_AI.chargeSpeed;
        const atWall = d > 0 ? e.x >= this.map.width - e.w - 1 : e.x <= 1;
        if (atWall) { e.vx = 0; e.leap = 'none'; e.pat = undefined; e.leapCd = this.range(GOLEM_AI.every); this.events.push({ type: 'shake', amount: 8 }); }
      }
      return;
    }
    // 걷기: 항상 플레이어 쪽으로 천천히
    if (target && Math.abs(dx) > MONSTER_AI.chaseDeadZone) e.dir = dx > 0 ? 1 : -1;
    e.vx = target && Math.abs(dx) > 40 ? e.dir * e.speed : 0;
    if (!target || e.leapCd > 0 || !e.onGround) return;
    if (Math.abs(dx) < GOLEM_AI.slamRange + e.w / 2) { e.pat = 'slam'; e.leap = 'crouch'; e.leapT = GOLEM_AI.slamWindup; e.vx = 0; }
    else if (this.rng() < GOLEM_AI.chargeChance) { e.pat = 'charge'; e.chargeDir = e.dir; e.leap = 'crouch'; e.leapT = GOLEM_AI.chargeWindup; e.vx = 0; }
    else e.leapCd = this.range(GOLEM_AI.every) * 0.5;
  }

  /** 골렘 전방 내려치기: 앞쪽 범위 안 플레이어에게 피해 */
  private golemSlam(e: Enemy) {
    const area = { x: e.dir > 0 ? cx(e) : cx(e) - GOLEM_AI.slamW, y: e.y + e.h - GOLEM_AI.slamH, w: GOLEM_AI.slamW, h: GOLEM_AI.slamH };
    this.fx({ kind: 'ring', x: area.x + area.w / 2, y: e.y + e.h - 10, color: '#c8a070', r0: 20, r1: GOLEM_AI.slamW * 0.6, life: 0.35 });
    this.events.push({ type: 'shake', amount: 10 });
    for (const p of this.players.values()) {
      if (!overlaps(p, area) || p.invT > 0 || (p.action && p.action.inv)) continue;
      this.hurtPlayer(p, GOLEM_AI.slamDmg, Math.sign(cx(p) - cx(e)) || e.dir);
    }
  }

  /** 몬스터 공격(접촉 말고)에 맞음 */
  private hurtPlayer(p: PlayerState, dmg: number, dir: number) {
    p.hp -= dmg;
    this.float(cx(p), p.y - 10, `-${dmg}`, '#ff6b6b', 18);
    if (p.action && p.action.superArmor) { p.invT = 0.6; return; }
    p.invT = 1.0; p.hurt = 0.3; p.action = null;
    p.vx = dir * 300; p.vy = -340;
  }

  /** 보안장치 오브: 주기적으로 조준(방향 고정) → 발사. 탄은 플레이어·골렘 모두 맞음. 골렘이 3번 맞으면 기절 */
  private stepOrb(dt: number) {
    const o = this.orb;
    if (o) {
      const boss = this.enemies.find(e => MONSTERS[e.mob].ai === 'golem' && !e.dead && !e.held);
      if (!boss) { o.dir = null; o.t = 0; }
      else if (o.dir) {
        o.aimT -= dt;
        if (o.aimT <= 0) {
          this.orbShots.push({ id: `o${this.nextId++}`, x: o.x, y: o.y, vx: o.dir.x * BOSS_ORB.speed, vy: o.dir.y * BOSS_ORB.speed });
          o.dir = null; o.t = 0;
        }
      } else {
        o.t += dt;
        const target = [...this.players.values()][0];
        if (o.t >= BOSS_ORB.every && target) {
          const dx = cx(target) - o.x, dy = cy(target) - o.y, d = Math.hypot(dx, dy) || 1;
          o.dir = { x: dx / d, y: dy / d }; o.aimT = BOSS_ORB.aimTime;
        }
      }
    }
    const r = BOSS_ORB.r;
    for (const s of this.orbShots) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      const box = { x: s.x - r, y: s.y - r, w: r * 2, h: r * 2 };
      let hit = s.y > GROUND_Y || s.x < -r || s.x > this.map.width + r;
      for (const e of this.enemies) {
        if (hit || e.dead || MONSTERS[e.mob].ai !== 'golem' || !overlaps(box, e)) continue;
        hit = true;
        if (e.groggy && e.groggy > 0) continue;
        e.orbHits = (e.orbHits ?? 0) + 1;
        this.fx({ kind: 'ring', x: s.x, y: s.y, color: '#6ec8ff', r0: 8, r1: 50, life: 0.3 });
        this.float(cx(e), e.y - 20, `${e.orbHits} / ${GOLEM_AI.groggyHits}`, '#6ec8ff', 20, 1.0);
        if (e.orbHits >= GOLEM_AI.groggyHits) {
          e.groggy = GOLEM_AI.groggyTime; e.leap = 'none'; e.pat = undefined; e.vx = 0;
          this.float(cx(e), e.y - 44, '기절!', '#ffd84a', 24, 1.4);
          this.events.push({ type: 'shake', amount: 8 });
        }
      }
      for (const p of this.players.values()) {
        if (hit || !overlaps(box, p) || p.invT > 0 || (p.action && p.action.inv)) continue;
        hit = true;
        this.hurtPlayer(p, BOSS_ORB.dmg, Math.sign(s.vx) || 1);
      }
      if (hit) s.vx = NaN;
    }
    this.orbShots = this.orbShots.filter(s => !Number.isNaN(s.vx));
  }

  private range([a, b]: readonly [number, number]) { return a + this.rng() * (b - a); }

  // ===================== 골드 =====================
  /** 큰 금액은 동전 2개로 나눠 튀어나옴 */
  private dropGold(x: number, y: number, amt: number) {
    const n = amt >= 12 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const a = i === n - 1 ? amt - Math.floor(amt / n) * (n - 1) : Math.floor(amt / n);
      this.coins.push({
        id: `c${this.nextId++}`, x: x - COIN.size / 2, y: y - COIN.size / 2, w: COIN.size, h: COIN.size,
        vx: (this.rng() - 0.5) * 160, vy: -380 - this.rng() * 120, onGround: false, drop: 0, plat: null, amt: a, t: 0,
      });
    }
  }

  private dropItem(x: number, y: number, item: string) {
    const sz = ITEM_DROP.size;
    this.coins.push({
      id: `c${this.nextId++}`, x: x - sz / 2, y: y - sz / 2, w: sz, h: sz,
      vx: (this.rng() - 0.5) * 120, vy: -420 - this.rng() * 80, onGround: false, drop: 0, plat: null, amt: 1, item, t: 0,
    });
  }

  private stepCoins(dt: number) {
    const players = [...this.players.values()];
    this.coins = this.coins.filter(c => {
      c.t += dt;
      stepBody(c, dt, this.solids, this.map.width);
      if (c.onGround) c.vx *= 1 - 8 * dt;
      // 캐릭터 몸이 닿아야 획득 (자동 줍기 없음)
      const p = players.find(pl => overlaps(pl, c));
      if (p) {
        if (c.item) {
          // 가방이 가득 차면 줍지 않고 바닥에 남는다
          let added = false;
          const ready = newlyReady(p.data, () => { added = addItem(p.data, c.item!, c.amt); });
          if (!added) { this.warn(p, BAG_FULL); return c.t < COIN.life; }
          for (const q of ready) this.questReady(p, q);
          this.float(cx(c), c.y - 6, `+${itemDef(c.item)?.name ?? c.item}`, '#ffffff', 15, 0.8);
        } else {
          p.data.gold += c.amt;
          this.float(cx(c), c.y - 6, `+${c.amt} G`, '#ffd84a', 15, 0.8);
        }
        return false;
      }
      return c.t < COIN.life;
    });
  }

  private nearestPlayer(e: Enemy) {
    let best: PlayerState | null = null, bd = Infinity;
    for (const p of this.players.values()) {
      const d = Math.abs(cx(p) - cx(e)) + Math.abs(cy(p) - cy(e));
      if (d < bd) { bd = d; best = p; }
    }
    return best;
  }

  // ===================== 그 밖 =====================
  npcNear(p: PlayerState) {
    return mapNpcs(p.data, this.mapId).find(n => Math.abs(n.x - cx(p)) < 60) ?? null;
  }

  /** 근처 포탈 (화면에서 "↑ 이동" 말풍선용) */
  portalNear(p: PlayerState) {
    return mapPortals(p.data, this.mapId).find(o => Math.abs(o.x - cx(p)) < 40 && Math.abs((o.y ?? GROUND_Y) - (p.y + p.h)) < 30) ?? null;
  }

  usePotion(p: PlayerState, kind: 'hp' | 'mp') {
    if (p.potionCd > 0) return;
    if (countItem(p.data, kind) <= 0) return this.warn(p, `${kind === 'hp' ? 'HP' : 'MP'} 포션이 없어`);
    if (kind === 'hp' && p.hp >= p.stats.maxHp) return this.warn(p, 'HP가 가득 찼어');
    if (kind === 'mp' && p.mp >= p.stats.maxMp) return this.warn(p, 'MP가 가득 찼어');
    removeItem(p.data, kind);
    p.potionCd = POTION.cooldown;
    if (kind === 'hp') { p.hp = Math.min(p.stats.maxHp, p.hp + POTION.hp); this.float(cx(p), p.y - 10, `+${POTION.hp} HP`, '#ff8a8a', 16); }
    else { p.mp = Math.min(p.stats.maxMp, p.mp + POTION.mp); this.float(cx(p), p.y - 10, `+${POTION.mp} MP`, '#8ab0ff', 16); }
  }
}

export type { DerivedStats };
