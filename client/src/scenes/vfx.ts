// 그림 이펙트 (스프라이트 시트). 가로 한 줄 프레임, 오른쪽 보는 그림 (왼쪽은 뒤집음).
// shared 의 { kind: 'anim', anim: 이름 } 이펙트가 여기 이름으로 재생된다.
import Phaser from 'phaser';
import smearH1 from '../../../assets/img/vfx/Smear VFX 01/Smear 01 Horizontal 1.png';

export interface VfxDef {
  url: string;
  /** 한 칸 크기 (px) */
  frame: number;
  frames: number;
  /** 초당 프레임 */
  fps: number;
  /** 화면 배율 */
  scale: number;
}

export const VFX: Record<string, VfxDef> = {
  /** 임시: 가로 베기 (검사 기본 공격) */
  smear_h1: { url: smearH1, frame: 48, frames: 5, fps: 25, scale: 2 },
};

export const vfxKey = (name: string) => `vfx:${name}`;

export function preloadVfx(scene: Phaser.Scene) {
  for (const [name, d] of Object.entries(VFX)) scene.load.spritesheet(vfxKey(name), d.url, { frameWidth: d.frame, frameHeight: d.frame });
}

export function createVfxAnims(scene: Phaser.Scene) {
  for (const [name, d] of Object.entries(VFX)) {
    scene.textures.get(vfxKey(name)).setFilter(Phaser.Textures.FilterMode.NEAREST);
    if (!scene.anims.exists(vfxKey(name))) {
      scene.anims.create({ key: vfxKey(name), frames: scene.anims.generateFrameNumbers(vfxKey(name), { start: 0, end: d.frames - 1 }), frameRate: d.fps });
    }
  }
}
