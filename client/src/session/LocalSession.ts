// 세션 교체 구조: 지금은 LocalSession(브라우저에서 시뮬레이션), 나중에 RemoteSession(서버 연결).
// 화면은 Session 인터페이스만 보고, 시뮬레이션이 어디서 돌아가는지 모른다.
import { World, TICK, type PlayerState } from '@shared/sim/World';
import type { Command, EntityId, GameEvent } from '@shared/sim/types';
import type { SaveData } from '@shared/sim/save';
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
  returnHome(): boolean;
}

export class LocalSession implements Session {
  readonly playerId = 'p1';
  world!: World;
  alpha = 0;
  private acc = 0;
  private prev = { x: 0, y: 0 };
  private saveTimer = 0;
  private pending: GameEvent[] = [];

  constructor(readonly save: SaveData, private store: Store) {
    this.enter(save.map, 600);
  }

  me() { return this.world.players.get(this.playerId)!; }
  prevPos() { return this.prev; }

  private enter(map: MapId, x: number, keep?: { hp: number; mp: number }) {
    this.world = new World(map);
    const p = this.world.addPlayer(this.playerId, this.save, x, keep?.hp, keep?.mp);
    this.prev = { x: p.x, y: p.y };
    this.save.map = map;
    void this.store.save(this.save);
  }

  nowMs() { return Date.now() + this.save.timeOffset; }

  act(action: MenuAction): ActionResult {
    const r = applyAction(this.save, action, this.nowMs());
    if (r.ok) {
      this.world.refreshStats(this.me(), r.fullHeal);
      if (action.type === 'useReset') this.world.resetCombat(this.me());
      void this.store.save(this.save);
    }
    return r;
  }

  /** 학교로 돌아가기 */
  returnHome(): boolean {
    if (this.world.mapId === 'school') return false;
    const { hp, mp } = this.me();
    this.enter('school', 600, { hp, mp });
    this.pending.push({ type: 'mapEnter', playerId: this.playerId, map: 'school' });
    return true;
  }

  update(realDt: number, readCommand: () => Command): GameEvent[] {
    const out: GameEvent[] = this.pending;
    this.pending = [];
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
        if (ev.type === 'died' && ev.playerId === this.playerId) {
          this.enter('school', 600);
          out.push({ type: 'mapEnter', playerId: this.playerId, map: 'school' });
          out.push({ type: 'banner', playerId: this.playerId, text: '쓰러졌다… 학교에서 깨어났다', color: '#ff8080' });
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
