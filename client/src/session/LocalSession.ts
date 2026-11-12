// 세션 교체 구조: 지금은 LocalSession(브라우저에서 시뮬레이션), 나중에 RemoteSession(서버 연결).
// 화면은 Session 인터페이스만 보고, 시뮬레이션이 어디서 돌아가는지 모른다.
import { World, TICK, type PlayerState } from '@shared/sim/World';
import type { Command, EntityId, GameEvent } from '@shared/sim/types';
import type { SaveData } from '@shared/sim/save';
import type { Store } from '@shared/store/Store';
import type { MapId } from '@shared/data/maps';
import type { Element } from '@shared/data/elements';
import { applyAction, type ActionResult, type MenuAction } from '@shared/rules/progress';
import { autoReport, isAuto, newlyReady, nightLocked, questReadyText } from '@shared/rules/quests';
import { MAPS } from '@shared/data/maps';
import { checkCond } from '@shared/rules/story';
import { nightOf } from '@shared/sim/clock';
import { BOSSES } from '@shared/data/bosses';
import { questDef } from '@shared/data/quests';

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
  /** 보스 메뉴: 열린 보스의 방으로 이동 */
  warpBoss(id: string): boolean;
  /** 물어보는 포탈에서 "예" */
  takePortal(to: MapId, toX: number, toY?: number): void;
  /** 인벤토리에서 포션 사용 (1·2번 키와 같음) */
  usePotion(kind: 'hp' | 'mp'): void;
  /** 컷신: 이야기용 진짜 몬스터 만들기 (x = 가운데), 붙잡아 둔 몬스터 풀기 */
  spawnStory(x: number, elem: Element | null, tag?: string): void;
  releaseHeld(): void;
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

  private enter(map: MapId, x: number, keep?: { hp: number; mp: number }, y?: number) {
    this.world = new World(map);
    const p = this.world.addPlayer(this.playerId, this.save, x, keep?.hp, keep?.mp, y);
    this.prev = { x: p.x, y: p.y };
    this.save.map = map;
    void this.store.save(this.save);
    this.checkBecomes();
  }

  /** 지금 맵이 조건에 따라 다른 맵으로 바뀌어야 하면 같은 자리로 옮김 (몬스터 없는 숲 → 있는 숲) */
  private checkBecomes() {
    const b = MAPS[this.world.mapId].becomes;
    if (!b || !checkCond(this.save, b.when)) return;
    const me = this.me();
    this.pending.push(...this.world.takeEvents());
    this.enter(b.to, me.x, { hp: me.hp, mp: me.mp }, me.y + me.h);
    this.pending.push({ type: 'mapEnter', playerId: this.playerId, map: b.to });
  }

  nowMs() {
    const t = Date.now() + this.save.timeOffset;
    // 밤 고정 퀘스트 중에는 그날 밤 한가운데에 멈춤
    return nightLocked(this.save) ? nightOf(t) : t;
  }

  act(action: MenuAction): ActionResult {
    let r: ActionResult = { ok: false };
    // 레벨·스킬·장비 목표처럼 행동으로 끝나는 퀘스트 알림
    const ready = newlyReady(this.save, () => { r = applyAction(this.save, action, this.nowMs()); });
    for (const q of ready) {
      if (isAuto(this.save, q)) continue;
      if (!r.banner) r.banner = questReadyText(q);
      else this.pending.push({ type: 'banner', playerId: this.playerId, text: questReadyText(q), color: '#9ef0a0' });
    }
    // 자동 보고 퀘스트 (다음 퀘스트를 받자마자 끝나는 경우 포함)
    for (const a of autoReport(this.save)) {
      if (a.banner) this.pending.push({ type: 'banner', playerId: this.playerId, text: a.banner, color: '#9ef0a0' });
    }
    if (r.ok) {
      this.world.refreshStats(this.me(), r.fullHeal);
      if (action.type === 'useReset') this.world.resetCombat(this.me());
      void this.store.save(this.save);
    }
    return r;
  }

  takePortal(to: MapId, toX: number, toY?: number) {
    const { hp, mp } = this.me();
    this.enter(to, toX, { hp, mp }, toY);
    this.pending.push({ type: 'mapEnter', playerId: this.playerId, map: to });
  }

  usePotion(kind: 'hp' | 'mp') { this.world.usePotion(this.me(), kind); }
  spawnStory(x: number, elem: Element | null, tag?: string) { this.world.spawnStory(x, elem, tag); }
  releaseHeld() { this.world.releaseHeld(); }

  /** 학교로 돌아가기 */
  returnHome(): boolean {
    if (this.world.mapId === 'school') return false;
    const { hp, mp } = this.me();
    this.enter('school', 600, { hp, mp });
    this.pending.push({ type: 'mapEnter', playerId: this.playerId, map: 'school' });
    return true;
  }

  warpBoss(id: string): boolean {
    const b = BOSSES.find(o => o.id === id);
    if (!b || !checkCond(this.save, b.unlock)) return false;
    this.takePortal(b.map, b.x);
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
        // 완료 조건을 채우는 순간 장면 전용 맵으로 옮기고 컷신 (골렘 처치 → 결정체를 빼앗기는 장면)
        if (ev.type === 'questReady' && ev.playerId === this.playerId) {
          const sc = questDef(ev.quest)?.readyScene;
          if (sc) {
            const solo = questDef(ev.quest)?.solo?.cls === this.save.cls;
            const { hp, mp } = this.me();
            this.enter(sc.map, sc.x, { hp, mp });
            out.push({ type: 'mapEnter', playerId: this.playerId, map: sc.map });
            out.push({ type: 'cutscene', id: solo && sc.soloCutscene ? sc.soloCutscene : sc.cutscene });
            break;
          }
        }
        if (ev.type === 'portal' && ev.playerId === this.playerId) {
          // 물어보는 포탈은 화면이 "예"를 누르면 takePortal
          if (ev.confirm) continue;
          const { hp, mp } = this.me();
          this.enter(ev.to, ev.toX, { hp, mp }, ev.toY);
          out.push({ type: 'mapEnter', playerId: this.playerId, map: ev.to });
          break;
        }
        if (ev.type === 'died' && ev.playerId === this.playerId) {
          // 맵에 정해진 곳(보스 방 → 공방 지하 등)이 있으면 거기서, 아니면 학교에서 깨어남
          const r = this.world.map.respawn;
          this.enter(r?.map ?? 'school', r?.x ?? 600, undefined, r?.y);
          out.push({ type: 'mapEnter', playerId: this.playerId, map: this.world.mapId });
          out.push({ type: 'banner', playerId: this.playerId, text: r ? '쓰러졌다…' : '쓰러졌다… 학교에서 깨어났다', color: '#ff8080' });
          break;
        }
      }
    }
    this.checkBecomes();
    out.push(...this.pending.splice(0));
    this.alpha = this.acc / TICK;
    this.saveTimer += realDt;
    if (this.saveTimer > 5) { this.saveTimer = 0; void this.store.save(this.save); }
    return out;
  }
}
