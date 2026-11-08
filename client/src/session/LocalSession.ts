// 세션 교체 구조: 지금은 LocalSession(브라우저에서 시뮬레이션), 나중에 RemoteSession(서버 연결).
// 화면은 Session 인터페이스만 보고, 시뮬레이션이 어디서 돌아가는지 모른다.
import { World, TICK, type PlayerState } from '@shared/sim/World';
import type { Command, EntityId, GameEvent } from '@shared/sim/types';
import { deriveStats, type SaveData } from '@shared/sim/save';
import type { Store } from '@shared/store/Store';
import type { MapId } from '@shared/data/maps';
import { applyAction, type ActionResult, type MenuAction } from '@shared/rules/progress';

export interface Session {
  readonly playerId: EntityId;
  readonly save: SaveData;
  readonly world: World;
  /** 0~1, 마지막 틱과 다음 틱 사이 어디쯤인지 (그리기 보간용) */
  readonly alpha: number;
  me(): PlayerState;
  /** 직전 틱의 내 위치 (보간용) */
  prevPos(): { x: number; y: number };
  update(realDt: number, readCommand: () => Command): GameEvent[];
  /** 메뉴 행동 (상점, 퀘스트, 수업 등) */
  act(action: MenuAction): ActionResult;
  /** 게임 안 시계 (테스트용 시간 당기기 포함) */
  nowMs(): number;
}

export class LocalSession implements Session {
  readonly playerId = 'p1';
  world!: World;
  alpha = 0;
  private acc = 0;
  private prev = { x: 0, y: 0 };
  private saveTimer = 0;

  constructor(readonly save: SaveData, private store: Store) {
    this.enter(save.map, 600);
  }

  me() { return this.world.players.get(this.playerId)!; }
  prevPos() { return this.prev; }

  private enter(map: MapId, x: number, keep?: { hp: number; mp: number }) {
    const stats = deriveStats(this.save);
    this.world = new World(map);
    const p = this.world.addPlayer(this.playerId, this.save.name, x, stats, this.save.inventory, keep?.hp, keep?.mp);
    this.prev = { x: p.x, y: p.y };
    this.save.map = map;
    void this.store.save(this.save);
  }

  nowMs() { return Date.now() + this.save.timeOffset; }

  act(action: MenuAction): ActionResult {
    const r = applyAction(this.save, action, this.nowMs());
    if (r.ok) {
      this.refreshStats(r.fullHeal);
      void this.store.save(this.save);
    }
    return r;
  }

  /** 레벨·능력치가 바뀌면 최대 HP 등 다시 계산 */
  refreshStats(fullHeal = false) {
    const p = this.me();
    p.stats = deriveStats(this.save);
    if (fullHeal) { p.hp = p.stats.maxHp; p.mp = p.stats.maxMp; }
    p.hp = Math.min(p.hp, p.stats.maxHp);
    p.mp = Math.min(p.mp, p.stats.maxMp);
  }

  update(realDt: number, readCommand: () => Command): GameEvent[] {
    const out: GameEvent[] = [];
    this.acc += Math.min(realDt, 0.25);
    while (this.acc >= TICK) {
      this.acc -= TICK;
      const p = this.me();
      this.prev = { x: p.x, y: p.y };
      const events = this.world.step(new Map([[this.playerId, readCommand()]]));
      for (const ev of events) {
        out.push(ev);
        if (ev.type === 'portal' && ev.playerId === this.playerId) {
          const { hp, mp } = this.me();
          this.enter(ev.to, ev.toX, { hp, mp });
          out.push({ type: 'mapEnter', playerId: this.playerId, map: ev.to });
          break;
        }
      }
    }
    this.alpha = this.acc / TICK;
    this.saveTimer += realDt;
    if (this.saveTimer > 5) { this.saveTimer = 0; void this.store.save(this.save); }
    return out;
  }
}
