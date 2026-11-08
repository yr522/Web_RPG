// 맵 하나 = 방 하나. 화면(Phaser)·DOM을 모르는 순수 시뮬레이션.
// 지금은 브라우저(LocalSession)가 돌리고, 나중에는 서버가 같은 코드를 돌린다.
import { GROUND_Y, MAPS, type MapDef, type MapId } from '../data/maps';
import { stepBody, JUMP_VELOCITY, type Body, type Solid } from './physics';
import type { Command, EntityId, GameEvent } from './types';
import type { DerivedStats } from './save';
import { POTION } from '../data/items';

export const TICK = 1 / 60;

export interface PlayerState extends Body {
  id: EntityId;
  name: string;
  face: 1 | -1;
  hp: number;
  mp: number;
  stats: DerivedStats;
  /** 포션 개수 (로컬에서는 저장 데이터와 같은 객체) */
  inv: { hp: number; mp: number };
  potionCd: number;
  /** 같은 경고가 연달아 뜨지 않게 */
  warnCd: number;
}

export class World {
  readonly map: MapDef;
  readonly solids: Solid[];
  readonly players = new Map<EntityId, PlayerState>();
  time = 0;
  private events: GameEvent[] = [];

  constructor(readonly mapId: MapId) {
    this.map = MAPS[mapId];
    this.solids = [
      { x: 0, y: GROUND_Y, w: this.map.width, h: 200, ground: true },
      ...this.map.platforms.map(p => ({ x: p.x, y: p.y, w: p.w, h: p.h ?? 14 })),
    ];
  }

  addPlayer(id: EntityId, name: string, x: number, stats: DerivedStats, inv: { hp: number; mp: number }, hp = stats.maxHp, mp = stats.maxMp): PlayerState {
    const p: PlayerState = {
      id, name, x, y: GROUND_Y - 46, w: 28, h: 46, vx: 0, vy: 0, face: 1,
      onGround: false, drop: 0, plat: null, hp, mp, stats, inv, potionCd: 0, warnCd: 0,
    };
    this.players.set(id, p);
    return p;
  }

  removePlayer(id: EntityId) { this.players.delete(id); }

  /** 고정 틱 한 번 진행. 명령은 플레이어별. */
  step(commands: Map<EntityId, Command>): GameEvent[] {
    const dt = TICK;
    this.time += dt;
    for (const p of this.players.values()) {
      const cmd = commands.get(p.id);
      if (cmd) this.stepPlayer(p, cmd, dt);
      else stepBody(p, dt, this.solids, this.map.width);
    }
    const out = this.events;
    this.events = [];
    return out;
  }

  private stepPlayer(p: PlayerState, cmd: Command, dt: number) {
    p.drop = Math.max(0, p.drop - dt);
    p.potionCd = Math.max(0, p.potionCd - dt);
    p.warnCd = Math.max(0, p.warnCd - dt);
    for (const k of cmd.potionPressed) this.usePotion(p, k);
    p.mp = Math.min(p.stats.maxMp, p.mp + p.stats.regen * dt);
    if (this.map.safe) p.hp = Math.min(p.stats.maxHp, p.hp + 6 * dt);

    if (cmd.upPressed) {
      const npc = this.npcNear(p);
      if (npc) {
        this.events.push({ type: 'interact', playerId: p.id, npc: npc.id });
        return;
      }
      const portal = this.map.portals.find(o => Math.abs(o.x - (p.x + p.w / 2)) < 40);
      if (portal && p.onGround) {
        this.events.push({ type: 'portal', playerId: p.id, to: portal.to, toX: portal.toX });
        return;
      }
    }

    p.vx = cmd.move * p.stats.speed;
    if (cmd.move) p.face = cmd.move;
    if (cmd.jumpPressed && p.onGround) {
      const onPlatform = p.plat && !p.plat.ground && p.y + p.h < GROUND_Y - 2;
      if (cmd.down && onPlatform) p.drop = 0.25;
      else p.vy = JUMP_VELOCITY;
    }
    stepBody(p, dt, this.solids, this.map.width);

    // 안전장치: 위치가 깨지면 복구
    if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) {
      p.x = 300; p.y = GROUND_Y - p.h; p.vx = p.vy = 0;
    }
  }

  npcNear(p: PlayerState) {
    return this.map.npcs.find(n => Math.abs(n.x - (p.x + p.w / 2)) < 60) ?? null;
  }

  float(x: number, y: number, text: string, color: string, size?: number) {
    this.events.push({ type: 'float', x, y, text, color, size });
  }

  warn(p: PlayerState, text: string) {
    if (p.warnCd > 0) return;
    p.warnCd = 0.6;
    this.float(p.x + p.w / 2, p.y - 26, text, '#dddddd', 14);
  }

  private usePotion(p: PlayerState, kind: 'hp' | 'mp') {
    if (p.potionCd > 0) return;
    if (p.inv[kind] <= 0) return this.warn(p, `${kind === 'hp' ? 'HP' : 'MP'} 포션이 없어`);
    if (kind === 'hp' && p.hp >= p.stats.maxHp) return this.warn(p, 'HP가 가득 찼어');
    if (kind === 'mp' && p.mp >= p.stats.maxMp) return this.warn(p, 'MP가 가득 찼어');
    p.inv[kind]--;
    p.potionCd = POTION.cooldown;
    if (kind === 'hp') { p.hp = Math.min(p.stats.maxHp, p.hp + POTION.hp); this.float(p.x + p.w / 2, p.y - 10, `+${POTION.hp} HP`, '#ff8a8a', 16); }
    else { p.mp = Math.min(p.stats.maxMp, p.mp + POTION.mp); this.float(p.x + p.w / 2, p.y - 10, `+${POTION.mp} MP`, '#8ab0ff', 16); }
  }

  /** 근처 포탈 (화면에서 "↑ 이동" 말풍선용) */
  portalNear(p: PlayerState) {
    return this.map.portals.find(o => Math.abs(o.x - (p.x + p.w / 2)) < 40) ?? null;
  }
}
