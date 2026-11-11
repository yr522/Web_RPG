// 플레이어 외형: 파츠(몸·머리·앞팔 …)를 같은 96×96 칸에 겹쳐 그린다.
// 모션마다 그림 파일(시트)이 따로 있고, 한 시트 안에서는 모든 파츠가 같은 프레임 순서를 쓴다
// → 시트 + 프레임 번호 하나로 전부 맞춰서 바꾼다.
import Phaser from 'phaser';
import type { PlayerState } from '@shared/sim/entities';
import type { ClassId } from '@shared/data/classes';
import { DRAW_START_TIME } from '@shared/sim/skills/archer';
import walkBody from '../../../assets/img/sprites/bones/player_bone_walk_body.png';
import walkHead from '../../../assets/img/sprites/bones/player_bone_walk_head.png';
import walkArm from '../../../assets/img/sprites/bones/player_bone_walk_front_arm.png';
import swordBody from '../../../assets/img/sprites/bones/attack_sword/player_bone_attack_sword_body.png';
import swordHead from '../../../assets/img/sprites/bones/attack_sword/player_bone_attack_sword_head.png';
import swordArm from '../../../assets/img/sprites/bones/attack_sword/player_bone_attack_sword_frontarm.png';
import bowBody from '../../../assets/img/sprites/bones/attack_bow/player_bone_attack_bow_body.png';
import bowHead from '../../../assets/img/sprites/bones/attack_bow/player_bone_attack_bow_head.png';
import bowArm from '../../../assets/img/sprites/bones/attack_bow/player_bone_attack_bow_frontarm.png';
import staffBody from '../../../assets/img/sprites/bones/attack_staff/player_bone_attack_staff_body.png';
import staffHead from '../../../assets/img/sprites/bones/attack_staff/player_bone_attack_staff_head.png';
import staffArm from '../../../assets/img/sprites/bones/attack_staff/player_bone_attack_staff_frontarm.png';

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

/**
 * 모션 시트. 지금은 모든 직업이 같은 뼈대(bone) 그림을 임시로 쓴다.
 * - walk: 0 기본 · 1·2 걷기 · 3 공중 · 4 앉기
 * - sword: 0 휘두르기 전 · 1 휘두름
 * - staff: 0 마법 쏘기 전 · 1 쏨 (검과 같은 방식으로 씀)
 * - bow: 0 활 당기기 시작 · 1 당기는 중 · 2 화살 발사됨
 */
export const SHEETS = {
  walk: { body: walkBody, head: walkHead, front_arm: walkArm },
  sword: { body: swordBody, head: swordHead, front_arm: swordArm },
  bow: { body: bowBody, head: bowHead, front_arm: bowArm },
  staff: { body: staffBody, head: staffHead, front_arm: staffArm },
} as const satisfies Record<string, Record<Part, string>>;
export type SheetName = keyof typeof SHEETS;

/** 직업별 공격 그림 */
export const ATTACK_SHEET: Record<ClassId, SheetName> = { warrior: 'sword', mage: 'staff', archer: 'bow' };

const texKey = (sheet: SheetName, part: Part) => `pl_${sheet}_${part}`;

/** 걷기 등 반복 모션: 프레임 번호와 한 프레임 시간(초) */
const LOOPS = {
  idle: { frames: [0], frameTime: 1 },
  // 걷기는 2프레임뿐이라 천천히 번갈아 보여 준다
  walk: { frames: [1, 2], frameTime: 0.22 },
  /** 공중 (올라갈 때·떨어질 때 같은 그림) */
  jump: { frames: [3], frameTime: 1 },
  /** 땅에서 ↓ */
  crouch: { frames: [4], frameTime: 1 },
} as const;
type LoopName = keyof typeof LOOPS;

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
    if (a.name === 'recover') return { sheet, frame: 2 };
    return null;
  }
  if (a.name === 'dash') return { sheet, frame: 1 };
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
  for (const sheet of Object.keys(SHEETS) as SheetName[]) {
    for (const part of PARTS) scene.load.spritesheet(texKey(sheet, part), SHEETS[sheet][part], { frameWidth: CELL, frameHeight: CELL });
  }
}

/** 움직이지 않는 캐릭터 그림 (대화 NPC 임시 모습: 뼈대 기본 자세). (x, y) = 발 기준점 */
export function makeStaticAvatar(scene: Phaser.Scene, x: number, y: number, face: 1 | -1) {
  const parts = PARTS.map(part => {
    scene.textures.get(texKey('walk', part)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    return scene.add.sprite(0, 0, texKey('walk', part), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL);
  });
  return scene.add.container(x, y, parts).setScale(AVATAR_SCALE * face, AVATAR_SCALE);
}

export class PlayerAvatar {
  readonly root: Phaser.GameObjects.Container;
  private parts: Phaser.GameObjects.Sprite[];
  private loop: LoopName = 'idle';
  private t = 0;
  /** 마지막으로 보여 준 공격 그림 (공격 직후 쉬는 시간 동안 유지) */
  private attacked = false;

  constructor(scene: Phaser.Scene) {
    for (const sheet of Object.keys(SHEETS) as SheetName[]) {
      for (const part of PARTS) scene.textures.get(texKey(sheet, part)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    }
    this.parts = PARTS.map(part => scene.add.sprite(0, 0, texKey('walk', part), 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL));
    // 컨테이너의 (0,0) = 발 기준점. 좌우 반전은 컨테이너 배율을 뒤집어서 기준점 그대로 뒤집는다.
    this.root = scene.add.container(0, 0, this.parts).setScale(AVATAR_SCALE);
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
      const next: LoopName = !me.onGround ? 'jump' : me.crouch ? 'crouch' : walking ? 'walk' : 'idle';
      if (next !== this.loop) { this.loop = next; this.t = 0; }
      this.t += dt;
      const l = LOOPS[this.loop];
      pose = { sheet: 'walk', frame: l.frames[Math.floor(this.t / l.frameTime) % l.frames.length] };
    } else {
      this.loop = 'idle'; this.t = 0;
    }
    PARTS.forEach((part, i) => {
      const key = texKey(pose.sheet, part), sp = this.parts[i];
      if (sp.texture.key !== key) sp.setTexture(key, pose.frame);
      else sp.setFrame(pose.frame);
    });
    // 그림은 오른쪽을 보고 있다 → 왼쪽을 볼 때 뒤집기
    this.root.setPosition(x, y).setScale(AVATAR_SCALE * (me.face < 0 ? -1 : 1), AVATAR_SCALE);
  }

  setVisible(v: boolean) { this.root.setVisible(v); }
}
