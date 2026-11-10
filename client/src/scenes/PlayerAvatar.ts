// 플레이어 외형: 파츠(몸·머리·앞팔 …)를 같은 96×96 칸에 겹쳐 그린다.
// 모든 파츠는 같은 프레임 순서를 쓴다 → 프레임 번호 하나로 전부 맞춰서 바꾼다.
import Phaser from 'phaser';
import type { PlayerState } from '@shared/sim/entities';
import boneBodyUrl from '../../../assets/img/sprites/bones/player_bone_walk_body.png';
import boneHeadUrl from '../../../assets/img/sprites/bones/player_bone_walk_head.png';
import boneArmUrl from '../../../assets/img/sprites/bones/player_bone_walk_front_arm.png';

/** 파츠 한 칸 크기 (에셋 규격: 96×96) */
const CELL = 96;
/** 발 기준점: 칸 안에서 발바닥이 닿는 위치 (Pixelorama 의 dot 레이어 = 49, 95 픽셀 → 그 픽셀의 아래쪽 끝) */
const FOOT_X = 49;
const FOOT_Y = 96;
/** 화면 배율 (예전 임시 스프라이트와 비슷한 크기) */
export const AVATAR_SCALE = 1.25;

/**
 * 레이어 순서 (아래 → 위). 에셋 문서의 파츠 표와 같다.
 * 아직 그림이 없는 파츠는 목록에 없어도 된다 — 생기면 여기 순서대로 끼워 넣는다.
 */
const LAYERS = [
  { key: 'bone_body', url: boneBodyUrl },
  { key: 'bone_head', url: boneHeadUrl },
  { key: 'bone_front_arm', url: boneArmUrl },
] as const;

/** 모션: 프레임 번호와 한 프레임 시간(초) */
const ANIMS = {
  idle: { frames: [0], frameTime: 1 },
  // 걷기는 2프레임뿐이라 천천히 번갈아 보여 준다
  walk: { frames: [1, 2], frameTime: 0.22 },
  /** 공중 (올라갈 때·떨어질 때 같은 그림) */
  jump: { frames: [3], frameTime: 1 },
  /** 땅에서 ↓ */
  crouch: { frames: [4], frameTime: 1 },
} as const;
type AnimName = keyof typeof ANIMS;

export function preloadAvatar(scene: Phaser.Scene) {
  for (const l of LAYERS) scene.load.spritesheet(l.key, l.url, { frameWidth: CELL, frameHeight: CELL });
}

export class PlayerAvatar {
  readonly root: Phaser.GameObjects.Container;
  private parts: Phaser.GameObjects.Sprite[];
  private anim: AnimName = 'idle';
  private t = 0;

  constructor(scene: Phaser.Scene) {
    this.parts = LAYERS.map(l => {
      scene.textures.get(l.key).setFilter(Phaser.Textures.FilterMode.NEAREST);
      return scene.add.sprite(0, 0, l.key, 0).setOrigin(FOOT_X / CELL, FOOT_Y / CELL);
    });
    // 컨테이너의 (0,0) = 발 기준점. 좌우 반전은 컨테이너 배율을 뒤집어서 기준점 그대로 뒤집는다.
    this.root = scene.add.container(0, 0, this.parts).setScale(AVATAR_SCALE);
  }

  setDepth(d: number) { this.root.setDepth(d); return this; }

  /** 매 프레임 호출: 상태에 맞는 모션을 고르고 프레임을 넘긴다 */
  update(dt: number, me: PlayerState, x: number, y: number) {
    const walking = me.onGround && !me.action && Math.abs(me.vx) > 20;
    const next: AnimName = !me.onGround ? 'jump' : me.crouch ? 'crouch' : walking ? 'walk' : 'idle';
    if (next !== this.anim) { this.anim = next; this.t = 0; }
    this.t += dt;
    const a = ANIMS[this.anim];
    const frame = a.frames[Math.floor(this.t / a.frameTime) % a.frames.length];
    for (const p of this.parts) p.setFrame(frame);
    // 그림은 오른쪽을 보고 있다 → 왼쪽을 볼 때 뒤집기
    this.root.setPosition(x, y).setScale(AVATAR_SCALE * (me.face < 0 ? -1 : 1), AVATAR_SCALE);
  }

  setVisible(v: boolean) { this.root.setVisible(v); }
}
