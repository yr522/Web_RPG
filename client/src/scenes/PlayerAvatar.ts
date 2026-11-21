// 플레이어 외형: 파츠(몸·머리·앞팔 …)를 같은 96×96 칸에 겹쳐 그린다.
// 파츠마다 그림 파일 한 장, 모션은 줄로 나뉨 (2026-11-21 유저 정리, *_true.png). 모든 파츠가 같은 칸 배치
// → 모션(줄) + 프레임 번호(칸) 하나로 전부 맞춰서 바꾼다.
import Phaser from 'phaser';
import type { PlayerState } from '@shared/sim/entities';
import type { ClassId } from '@shared/data/classes';
import { DRAW_START_TIME } from '@shared/sim/skills/archer';
import bodyUrl from '../../../assets/img/sprites/bones/player_bone_walk_body_true.png';
import headUrl from '../../../assets/img/sprites/bones/player_bone_walk_head_true.png';
import armUrl from '../../../assets/img/sprites/bones/player_bone_walk_front_arm_true.png';
import swordsmanFace from '../../../assets/img/sprites/players/faces/001_swordsman/swordsman_face.png';
import swordsmanHair from '../../../assets/img/sprites/players/hairs/001_swordsman/swordsman_hair.png';

/** 파츠 한 칸 크기 (에셋 규격: 96×96) */
export const CELL = 96;
/** 발 기준점: 칸 안에서 발바닥이 닿는 위치 (Pixelorama 의 dot 레이어 = 49, 95 픽셀 → 그 픽셀의 아래쪽 끝) */
export const FOOT_X = 49;
export const FOOT_Y = 96;
/** 화면 배율 (예전 임시 스프라이트와 비슷한 크기) */
export const AVATAR_SCALE = 1.25;
/** 발에서 머리 꼭대기까지 높이 (화면 px, 뼈대 그림 기준: 머리 맨 위 = 칸의 49번째 줄) → 말풍선 위치 */
export const AVATAR_HEAD = (FOOT_Y - 49) * AVATAR_SCALE;

/** 레이어 순서 (아래 → 위). 에셋 문서의 파츠 표와 같다. 아직 그림이 없는 파츠는 생기면 순서대로 끼워 넣는다. */
export const PARTS = ['body', 'head', 'front_arm'] as const;
type Part = (typeof PARTS)[number];

/** 파츠별 그림 (뼈대, 임시). 한 장 = 가로 SHEET_COLS 칸 × 모션 줄 */
export const PART_FILES: Record<Part, string> = { body: bodyUrl, head: headUrl, front_arm: armUrl };
/** 한 줄의 칸 수 (가장 긴 모션 = 기본 6칸) */
export const SHEET_COLS = 6;

/**
 * 모션 = 그림의 몇 번째 줄 (0부터). 지금은 모든 직업이 같은 뼈대(bone) 그림을 임시로 쓴다.
 * - walk (1줄): 0 기본 · 1·2 걷기 · 3 공중 · 4 앉기 · 5 쓰러짐
 * - sword (2줄): 0 휘두르기 전 · 1 휘두름
 * - staff (3줄): 0 마법 쏘기 전 · 1 쏨 (검과 같은 방식으로 씀)
 * - bow (4줄): 0 활 당기기 시작 · 1 당기는 중 · 2 화살 발사됨
 */
export const SHEETS = { walk: 0, sword: 1, staff: 2, bow: 3 } as const;
export type SheetName = keyof typeof SHEETS;

/**
 * 직업별 얼굴·머리 (2026-11-21, 검사만 그림 있음). 기본 모션(walk 시트)과 같은 프레임 순서.
 * 공격 모션 그림은 아직 없어서 공격하는 동안은 숨김 (뼈대만). 레이어: 머리(뼈대) 위 → 얼굴 → 앞머리 → 앞팔 아래
 */
const LOOKS: Partial<Record<ClassId, { face: string; hair: string }>> = {
  warrior: { face: swordsmanFace, hair: swordsmanHair },
};
const lookKey = (cls: ClassId, part: 'face' | 'hair') => `pl_look_${cls}_${part}`;

/** 직업별 공격 그림 */
export const ATTACK_SHEET: Record<ClassId, SheetName> = { warrior: 'sword', mage: 'staff', archer: 'bow' };

const texKey = (part: Part) => `pl_${part}`;
/** 모션 + 그 모션 안의 프레임 → 그림 전체에서의 칸 번호 */
export const cellIndex = (sheet: SheetName, frame: number) => SHEETS[sheet] * SHEET_COLS + frame;

/** 걷기 등 반복 모션: 프레임 번호와 한 프레임 시간(초) */
const LOOPS = {
  idle: { frames: [0], frameTime: 1 },
  // 걷기는 2프레임뿐이라 천천히 번갈아 보여 준다
  walk: { frames: [1, 2], frameTime: 0.22 },
  /** 공중 (올라갈 때·떨어질 때 같은 그림) */
  jump: { frames: [3], frameTime: 1 },
  /** 땅에서 ↓ */
  crouch: { frames: [4], frameTime: 1 },
  /** 쓰러짐 (체력 0) */
  down: { frames: [5], frameTime: 1 },
} as const;
type LoopName = keyof typeof LOOPS;
/** 따라다니는 NPC 가 뛸 때 걷기 프레임 시간 배율 */
const RUN_FRAME = 0.55;

/** 마법사가 쏘기 전(지팡이 1번 그림) 부들거림: 이 간격(초)마다 좌우로 이만큼(월드 px) 흔들림 */
const SHAKE = { every: 0.035, amp: 1 };

/** 검 휘두름·마법 쏨: 판정이 나온 뒤 이 시간 동안 휘두른(쏜) 그림 */
const SWING_SHOW = 0.07;

interface Pose { sheet: SheetName; frame: number }

/** 공격 중 그림. 공격 중이 아니면 null */
function attackPose(me: PlayerState): Pose | null {
  const a = me.action, sheet = ATTACK_SHEET[me.data.cls];
  if (!a) return null;
  if (sheet === 'bow') {
    // 당기기 시작 → 당기는 중 → (놓으면) 발사됨. 다시 누르면 바로 처음부터.
    if (a.name === 'charge' || a.name === 'aim' || a.name === 'draw') return { sheet, frame: a.t < DRAW_START_TIME ? 0 : 1 };
    // 쏜 직후 · 후방 도약으로 날아가며 쏘는 중
    if (a.name === 'recover' || a.name === 'leap') return { sheet, frame: 2 };
    return null;
  }
  if (a.name === 'dash') return { sheet, frame: 1 };
  // 흘려베기 받아내기: 휘두르기 전 자세로 버팀
  if (a.name === 'guard') return { sheet, frame: 0 };
  if (a.events?.length) {
    // 판정이 나오는 순간 휘두른 그림, 다음 판정 전에는 다시 휘두르기 전 그림
    let last = -1;
    for (const ev of a.events) if (ev.done) last = Math.max(last, ev.at);
    if (last < 0) return { sheet, frame: 0 };
    const allDone = a.events.every(ev => ev.done);
    return { sheet, frame: allDone || a.t - last < SWING_SHOW ? 1 : 0 };
  }
  // 캐스팅(원소 기둥 등): 끝날 때까지 휘두르기 전 그림
  if (a.name === 'cast') return { sheet, frame: 0 };
  return null;
}

/** 공격이 끝난 뒤 잠깐 쉬는 동안 유지할 그림 (휘두름 / 화살 발사됨) */
const followThrough = (sheet: SheetName): Pose => ({ sheet, frame: sheet === 'bow' ? 2 : 1 });

export function preloadAvatar(scene: Phaser.Scene) {
  for (const part of PARTS) scene.load.spritesheet(texKey(part), PART_FILES[part], { frameWidth: CELL, frameHeight: CELL });
  for (const [cls, l] of Object.entries(LOOKS) as [ClassId, { face: string; hair: string }][]) {
    scene.load.spritesheet(lookKey(cls, 'face'), l.face, { frameWidth: CELL, frameHeight: CELL });
    scene.load.spritesheet(lookKey(cls, 'hair'), l.hair, { frameWidth: CELL, frameHeight: CELL });
  }
}

/** 움직이지 않는 캐릭터 그림 (대화 NPC 임시 모습: 뼈대 기본 자세). (x, y) = 발 기준점 */
export function makeStaticAvatar(scene: Phaser.Scene, x: number, y: number, face: 1 | -1) {
  const parts = PARTS.map(part => {
    scene.textures.get(texKey(part)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return scene.add.sprite(0, 0, texKey(part), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL);
  });
  return scene.add.container(x, y, parts).setScale(AVATAR_SCALE * face, AVATAR_SCALE);
}

/** 움직이지 않는 캐릭터 그림에 걷기 모션: t = 걷기 시작부터 지난 시간(초), null = 서 있기. fast = 뛰기(프레임 빠르게) */
export function poseStaticAvatar(root: Phaser.GameObjects.Container, t: number | null, fast = false) {
  const l = t === null ? LOOPS.idle : LOOPS.walk;
  const ft = fast ? l.frameTime * RUN_FRAME : l.frameTime;
  const frame = l.frames[Math.floor((t ?? 0) / ft) % l.frames.length];
  for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setFrame(frame);
}

export class PlayerAvatar {
  readonly root: Phaser.GameObjects.Container;
  private parts: Phaser.GameObjects.Sprite[];
  /** 얼굴·앞머리 (직업 그림이 있을 때만 보임) */
  private face: Phaser.GameObjects.Sprite;
  private hair: Phaser.GameObjects.Sprite;
  private loop: LoopName = 'idle';
  private t = 0;
  /** 마지막으로 보여 준 공격 그림 (공격 직후 쉬는 시간 동안 유지) */
  private attacked = false;
  private shakeT = 0;
  private shakeX = 0;

  constructor(scene: Phaser.Scene) {
    for (const part of PARTS) scene.textures.get(texKey(part)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    for (const cls of Object.keys(LOOKS) as ClassId[]) {
      for (const p of ['face', 'hair'] as const) scene.textures.get(lookKey(cls, p)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.parts = PARTS.map(part => scene.add.sprite(0, 0, texKey(part), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL));
    const blank = (Object.keys(LOOKS) as ClassId[])[0];
    this.face = scene.add.sprite(0, 0, lookKey(blank, 'face'), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL).setVisible(false);
    this.hair = scene.add.sprite(0, 0, lookKey(blank, 'hair'), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL).setVisible(false);
    // 컨테이너의 (0,0) = 발 기준점. 좌우 반전은 컨테이너 배율을 뒤집어서 기준점 그대로 뒤집는다.
    // 순서: 몸 · 머리(뼈대) · 얼굴 · 앞머리 · 앞팔
    const [body, head, arm] = this.parts;
    this.root = scene.add.container(0, 0, [body, head, this.face, this.hair, arm]).setScale(AVATAR_SCALE);
  }

  setDepth(d: number) { this.root.setDepth(d); return this; }

  /** 매 프레임 호출: 상태에 맞는 모션을 고르고 프레임을 넘긴다 */
  update(dt: number, me: PlayerState, x: number, y: number) {
    let pose = attackPose(me);
    if (pose) this.attacked = true;
    else if (this.attacked && !me.action && me.lockT > 0 && me.hurt <= 0) pose = followThrough(ATTACK_SHEET[me.data.cls]);
    else this.attacked = false;

    if (!pose) {
      const walking = me.onGround && !me.action && Math.abs(me.vx) > 20;
      const next: LoopName = me.downT > 0 ? 'down' : !me.onGround ? 'jump' : me.crouch ? 'crouch' : walking ? 'walk' : 'idle';
      if (next !== this.loop) { this.loop = next; this.t = 0; }
      this.t += dt;
      const l = LOOPS[this.loop];
      pose = { sheet: 'walk', frame: l.frames[Math.floor(this.t / l.frameTime) % l.frames.length] };
    } else {
      this.loop = 'idle'; this.t = 0;
    }
    const cell = cellIndex(pose.sheet, pose.frame);
    for (const sp of this.parts) sp.setFrame(cell);
    // 얼굴·앞머리: 기본 모션일 때만 (공격 그림은 아직 없음 → 뼈대만)
    const look = pose.sheet === 'walk' && LOOKS[me.data.cls] ? me.data.cls : null;
    for (const p of ['face', 'hair'] as const) {
      const sp = this[p];
      sp.setVisible(!!look);
      if (!look) continue;
      const key = lookKey(look, p);
      if (sp.texture.key !== key) sp.setTexture(key, pose.frame);
      else sp.setFrame(pose.frame);
    }
    // 마법 쏘기 전(지팡이 1번 그림, 동작 중)에는 부들부들 떨림
    if (pose.sheet === 'staff' && pose.frame === 0 && me.action) {
      this.shakeT += dt;
      if (this.shakeT >= SHAKE.every) { this.shakeT = 0; this.shakeX = this.shakeX > 0 ? -SHAKE.amp : SHAKE.amp; }
    } else { this.shakeT = 0; this.shakeX = 0; }
    // 그림은 오른쪽을 보고 있다 → 왼쪽을 볼 때 뒤집기
    this.root.setPosition(x + this.shakeX, y).setScale(AVATAR_SCALE * (me.face < 0 ? -1 : 1), AVATAR_SCALE);
  }

  setVisible(v: boolean) { this.root.setVisible(v); }

  /** 잔상: 지금 모습을 그대로 본뜬 그림이 한 색으로 칠해져 제자리에 남았다가 서서히 사라짐 */
  ghost(color: number, life: number, alpha = 0.55) {
    if (!this.root.visible) return;
    const scene = this.root.scene;
    const shown = (this.root.list as Phaser.GameObjects.Sprite[]).filter(sp => sp.visible);
    const parts = shown.map(sp => scene.add.sprite(0, 0, sp.texture.key, sp.frame.name).setOrigin(sp.originX, sp.originY).setTintFill(color));
    const c = scene.add.container(this.root.x, this.root.y, parts).setScale(this.root.scaleX, this.root.scaleY).setDepth(this.root.depth - 0.1).setAlpha(alpha);
    scene.tweens.add({ targets: c, alpha: 0, duration: life * 1000, onComplete: () => c.destroy() });
  }
}
