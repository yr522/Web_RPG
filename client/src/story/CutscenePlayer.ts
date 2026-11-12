// 컷신 재생기: cutscenes.ts 의 단계를 차례로 실행한다.
// 플레이어는 진짜 입력 대신 이 재생기가 만든 명령(걷기·앉기·점프·공격)으로 움직인다 → 게임 규칙 그대로 움직임.
// NPC·연출용 몬스터는 화면에서만 움직인다 (컷신이 끝나면 NPC 는 제자리로, 연출용 몬스터는 사라짐).
// fight 단계: 연출용 몬스터를 그 자리에서 진짜 몬스터로 바꾼다 → 컷신이 끝나면 싸움 시작.
import { CUTSCENES, CUTSCENE, type CutStep, type CutX, type Motion, type Who } from '@shared/data/cutscenes';
import { emptyCommand, type Command } from '@shared/sim/types';
import type { Element } from '@shared/data/elements';
import type { Session } from '../session/LocalSession';
import type { Input } from '../input/Input';

/** 컷신이 화면(GameScene)에 시키는 일. who = 'npc:id' 또는 'mob:이름' */
export interface Stage {
  /** 카메라: x = 화면 가운데에 올 맵 좌표 (null = 플레이어 따라가기), zoom 배, time 초 동안 */
  camTo(x: number | null, zoom: number, time: number): void;
  /** 위치 (없으면 null) */
  actorX(who: string): number | null;
  actorWalk(who: string, to: number, speed: number): void;
  /** 걷거나 점프하는 중 */
  actorMoving(who: string): boolean;
  actorPose(who: string, motion: Motion | null): void;
  actorFace(who: string, dir: 1 | -1): void;
  actorElem(who: string): Element | null;
  mobSpawn(id: string, elem: Element | null, x: number, face: 1 | -1): void;
  mobRemove(id: string): void;
  /** 컷신이 끝나면: NPC 제자리, 연출용 몬스터 없앰 */
  resetActors(): void;
  say(who: string, text: string, life: number): void;
  /** 화면 UI 보이기/숨기기 */
  setUi(v: boolean): void;
}

/** 걷다가 이 거리(px) 안이면 도착 */
const ARRIVE = 6;
/** 플레이어가 막혀서 못 가는 등, 한 단계가 이 시간(초)을 넘으면 그냥 다음으로 */
const STEP_LIMIT = 8;

export class CutscenePlayer {
  running = false;
  /** 지금 플레이어를 직접 움직이는 중 */
  private driving = false;
  private held = { move: 0 as -1 | 0 | 1, down: false };
  private once: { jump?: boolean; attack?: boolean } = {};
  private waits: { check: () => boolean; resolve: () => void }[] = [];
  private t = 0;

  constructor(
    private stage: Stage,
    private session: Session,
    private input: Input,
    private talk: (npc: string) => Promise<void>,
  ) {}

  /** 매 프레임 */
  update(dt: number) {
    this.t += dt;
    this.waits = this.waits.filter(w => { if (w.check()) { w.resolve(); return false; } return true; });
  }

  /** 틱마다: 컷신이 플레이어를 움직이는 중이면 그 명령, 조작만 막힌 상태면 가만히, 아니면 null(진짜 입력) */
  command(): Command | null {
    if (!this.running || (!this.driving && !this.input.locked)) return null;
    const c = emptyCommand();
    c.move = this.held.move;
    c.down = this.held.down;
    if (this.once.jump) { c.jumpPressed = true; }
    if (this.once.attack) { c.skillPressed = ['Z']; c.skillHeld = ['Z']; }
    this.once = {};
    return c;
  }

  async play(id: string) {
    const steps = CUTSCENES[id];
    if (!steps || this.running) return;
    this.running = true;
    try {
      for (let i = 0; i < steps.length; i++) {
        const step = steps[i];
        // 이야기 효과 (플래그 등): 세션이 데이터에서 직접 찾아 적용
        if ('do' in step) { this.session.act({ type: 'cutDo', cut: id, step: i }); continue; }
        const done = this.run(step);
        if (step.wait !== false) await done;
        if (typeof step.wait === 'number') await this.sleep(step.wait);
      }
    } finally {
      this.driving = false;
      this.held = { move: 0, down: false };
      this.input.locked = false;
      this.stage.setUi(true);
      this.stage.camTo(null, 1, 0.5);
      this.stage.resetActors();
      this.session.releaseHeld();
      this.running = false;
    }
  }

  private until(check: () => boolean, limit = STEP_LIMIT) {
    const end = this.t + limit;
    return new Promise<void>(resolve => this.waits.push({ check: () => check() || this.t >= end, resolve }));
  }

  private sleep(sec: number) {
    const end = this.t + sec;
    return this.until(() => this.t >= end, sec + 1);
  }

  private me() { return this.session.me(); }
  private meX() { const p = this.me(); return p.x + p.w / 2; }

  private xOf(x: CutX): number | null {
    if (typeof x === 'number') return x;
    if (x === 'player') return this.meX();
    return this.stage.actorX(x);
  }

  private async run(step: CutStep): Promise<void> {
    if ('lock' in step) { this.input.locked = step.lock; return; }
    if ('ui' in step) { this.stage.setUi(step.ui); return; }
    if ('talk' in step) { await this.talk(step.talk); return; }
    if ('mob' in step) {
      const x = this.xOf(step.mob.x);
      if (x !== null) this.stage.mobSpawn(step.mob.id, step.mob.elem ?? null, x, step.mob.face ?? -1);
      return;
    }
    if ('remove' in step) { if (step.remove.startsWith('mob:')) this.stage.mobRemove(step.remove.slice(4)); return; }
    if ('fight' in step) {
      const who = step.fight.who, x = this.stage.actorX(who);
      if (x === null || !who.startsWith('mob:')) return;
      this.session.spawnStory(x, this.stage.actorElem(who), step.fight.tag);
      this.stage.mobRemove(who.slice(4));
      return;
    }
    if ('say' in step) { this.stage.say(step.say.who, step.say.text, step.say.life ?? CUTSCENE.sayLife); return; }
    if ('cam' in step) {
      const c = step.cam;
      const time = c === 'follow' ? step.time ?? CUTSCENE.camTime : c.time ?? CUTSCENE.camTime;
      if (c === 'follow') this.stage.camTo(null, 1, time);
      else this.stage.camTo(c.x === undefined ? null : this.xOf(c.x), c.zoom ?? 1, time);
      await this.sleep(time);
      return;
    }
    if ('face' in step) {
      const { who, dir } = step.face;
      if (who === 'player') {
        // 앉은 채로 방향키 = 제자리에서 방향만 돌리기
        this.driving = true;
        this.held = { move: dir, down: true };
        await this.sleep(0.05);
        this.held = { move: 0, down: false };
        this.driving = false;
      } else this.stage.actorFace(who, dir);
      return;
    }
    if ('walk' in step) {
      const { who, to, speed } = step.walk;
      const target = this.xOf(to);
      if (target === null) return;
      if (who === 'player') {
        this.driving = true;
        this.held = { move: target > this.meX() ? 1 : -1, down: false };
        const dir = this.held.move;
        await this.until(() => (target - this.meX()) * dir <= ARRIVE);
        this.held = { move: 0, down: false };
        this.driving = false;
      } else {
        // 다른 캐릭터에게 걸어갈 때는 바로 옆에서 멈춤
        const from = this.stage.actorX(who);
        if (from === null) return;
        const stop = typeof to === 'string' ? target + (from > target ? 40 : -40) : target;
        this.stage.actorWalk(who, stop, speed ?? CUTSCENE.walkSpeed);
        await this.until(() => !this.stage.actorMoving(who));
      }
      return;
    }
    if ('pose' in step) {
      const { who, motion, time } = step.pose;
      if (who !== 'player') {
        this.stage.actorPose(who, motion);
        if (motion === 'jump') await this.until(() => !this.stage.actorMoving(who), 2);
        if (motion !== 'jump' || time) await this.sleep(time ?? 0.6);
        this.stage.actorPose(who, null);
        return;
      }
      await this.playerPose(motion, time);
    }
  }

  private async playerPose(motion: Motion, time?: number) {
    this.driving = true;
    const me = () => this.me();
    if (motion === 'crouch') {
      this.held = { move: 0, down: true };
      await this.sleep(time ?? 0.6);
      this.held = { move: 0, down: false };
    } else if (motion === 'jump') {
      this.once.jump = true;
      await this.until(() => !me().onGround, 1);
      await this.until(() => me().onGround, 3);
      if (time) await this.sleep(time);
    } else if (motion === 'attack') {
      this.once.attack = true;
      await this.until(() => !!me().action, 1);
      await this.until(() => !me().action && me().lockT <= 0, 3);
      if (time) await this.sleep(time);
    } else await this.sleep(time ?? 0);
    this.driving = false;
  }
}

export type { Who };
