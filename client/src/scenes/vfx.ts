// 그림 이펙트 (스프라이트 시트). 가로 한 줄 프레임, 오른쪽 보는 그림 (왼쪽은 뒤집음).
// shared 의 { kind: 'anim', anim: 이름 } 이펙트가 여기 이름으로 재생된다.
import Phaser from 'phaser';
import smearH1 from '../../../assets/img/vfx/Smear VFX 01/Smear 01 Horizontal 1.png';
import swordSlash from '../../../assets/img/vfx/slash_temp/pixel_art_sword_slash_sprites.png';
import galeDash from '../../../assets/img/vfx/pixelfx/gale_dash.png';
import galeDashCore from '../../../assets/img/vfx/pixelfx/gale_dash_core.png';
import flowSlash from '../../../assets/img/vfx/pixelfx/flow_slash.png';
import flowSlashCore from '../../../assets/img/vfx/pixelfx/flow_slash_core.png';
import cheonbungVfx from '../../../assets/img/vfx/sword/cheon_boong_vfx.png';
import buff_blessed_loop from '../../../assets/img/vfx/buff_overlay/blessed_loop.png';
import buff_buff_applied from '../../../assets/img/vfx/buff_overlay/buff_applied.png';
import buff_haste_loop from '../../../assets/img/vfx/buff_overlay/haste_loop.png';
import buff_heal from '../../../assets/img/vfx/buff_overlay/heal.png';
import buff_invisible_shimmer_loop from '../../../assets/img/vfx/buff_overlay/invisible_shimmer_loop.png';
import buff_level_up from '../../../assets/img/vfx/buff_overlay/level_up.png';
import buff_mana_regen_loop from '../../../assets/img/vfx/buff_overlay/mana_regen_loop.png';
import buff_protect_shield_loop from '../../../assets/img/vfx/buff_overlay/protect_shield_loop.png';
import buff_rage_loop from '../../../assets/img/vfx/buff_overlay/rage_loop.png';
import buff_regen_loop from '../../../assets/img/vfx/buff_overlay/regen_loop.png';
import buff_revive from '../../../assets/img/vfx/buff_overlay/revive.png';

export interface VfxDef {
  url: string;
  /** 한 칸 크기 (px). 세로가 다르면 frameH */
  frame: number;
  frameH?: number;
  frames: number;
  /** 초당 프레임 */
  fps: number;
  /** 화면 배율 */
  scale: number;
  /** 칸 재생 순서 (같은 칸을 여러 번 넣으면 그만큼 오래 보임). 없으면 0 부터 차례로 */
  seq?: number[];
  /** 도트 그림이 아님: 확대할 때 부드럽게 (기본은 도트라 각지게) */
  smooth?: boolean;
  /** 그리는 층 (기본 5.5 = 캐릭터 위·잔상 아래). 잔상 위로 올리려면 6.5 */
  depth?: number;
  /** 같이 재생할 위층 이펙트 이름 (원소 색을 안 입힘, 흰 심 등) */
  core?: string;
  /** 계속 반복 (버프 오버레이) */
  loop?: boolean;
}

export const VFX: Record<string, VfxDef> = {
  /** 임시: 가로 베기 (검사 기본 공격) */
  smear_h1: { url: smearH1, frame: 48, frames: 5, fps: 25, scale: 2 },
  /** 임시: 위에서 앞으로 내려 베기, 거의 회색이라 원소 색을 입힘 (검사 일섬) */
  sword_slash: { url: swordSlash, frame: 64, frameH: 47, frames: 5, fps: 40, scale: 1.5 },
  /** 검사 질풍참: 돌진 앞 뾰족한 바람 쐐기 (pixelfx 로 그림). 바깥은 밝은 무채색이라 원소 색이 입혀지고, 가운데 흰 심은 위층(gale_dash_core)으로 색 없이 겹침. 칸 100×32, 몸 중심은 칸의 x 27 */
  gale_dash: { url: galeDash, frame: 100, frameH: 32, frames: 6, fps: 20, scale: 3, core: 'gale_dash_core' },
  gale_dash_core: { url: galeDashCore, frame: 100, frameH: 32, frames: 6, fps: 20, scale: 3 },
  /** 검사 회류참: 뒤로 미끄러지며 시작점에서 몸을 따라 파도처럼 그어지는 검기 하나 (도착 직전 사라짐) + 발밑 먼지 (pixelfx). 땅에 고정, 칸 176×56, 시작점 몸 중심·발은 칸의 (154, 50) */
  flow_slash: { url: flowSlash, frame: 176, frameH: 56, frames: 14, fps: 30, scale: 2, core: 'flow_slash_core', depth: 6.5 },
  flow_slash_core: { url: flowSlashCore, frame: 176, frameH: 56, frames: 14, fps: 30, scale: 2, depth: 6.5 },
  /** 검사 오의 천붕: 연속 베기 (유저 그림, 무채색이라 원소 색을 입힘). 칸 256×256 6칸: 0 = 모으기, 1~5 = 다섯 번 베기. 초당 18칸으로 모으기 1번(0.06초) + 베기 칸마다 2번(0.11초) = 판정 5번 박자 */
  cheonbung: { url: cheonbungVfx, frame: 256, frames: 6, fps: 18, scale: 1.5, smooth: true, seq: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5] },
  // 버프 오버레이 (무료 에셋, 캐릭터·몬스터 위에 얹음). 여러 줄 시트: 왼→오, 위→아래 순서. 배율은 얹는 쪽에서 몸 크기에 맞춤
  buff_blessed_loop: { url: buff_blessed_loop, frame: 32, frameH: 48, frames: 8, fps: 10, scale: 1, loop: true },
  buff_buff_applied: { url: buff_buff_applied, frame: 32, frameH: 48, frames: 8, fps: 10, scale: 1 },
  buff_haste_loop: { url: buff_haste_loop, frame: 32, frameH: 48, frames: 6, fps: 10, scale: 1, loop: true },
  buff_heal: { url: buff_heal, frame: 32, frameH: 48, frames: 10, fps: 10, scale: 1 },
  buff_invisible_shimmer_loop: { url: buff_invisible_shimmer_loop, frame: 32, frameH: 48, frames: 8, fps: 10, scale: 1, loop: true },
  buff_level_up: { url: buff_level_up, frame: 48, frameH: 64, frames: 14, fps: 10, scale: 1 },
  buff_mana_regen_loop: { url: buff_mana_regen_loop, frame: 32, frameH: 48, frames: 8, fps: 10, scale: 1, loop: true },
  buff_protect_shield_loop: { url: buff_protect_shield_loop, frame: 32, frameH: 48, frames: 8, fps: 10, scale: 1, loop: true },
  buff_rage_loop: { url: buff_rage_loop, frame: 32, frameH: 48, frames: 6, fps: 10, scale: 1, loop: true },
  buff_regen_loop: { url: buff_regen_loop, frame: 32, frameH: 48, frames: 12, fps: 10, scale: 1, loop: true },
  buff_revive: { url: buff_revive, frame: 32, frameH: 64, frames: 14, fps: 10, scale: 1 },
};

export const vfxKey = (name: string) => `vfx:${name}`;

export function preloadVfx(scene: Phaser.Scene) {
  for (const [name, d] of Object.entries(VFX)) scene.load.spritesheet(vfxKey(name), d.url, { frameWidth: d.frame, frameHeight: d.frameH ?? d.frame });
}

export function createVfxAnims(scene: Phaser.Scene) {
  for (const [name, d] of Object.entries(VFX)) {
    scene.textures.get(vfxKey(name)).setFilter(d.smooth ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    if (!scene.anims.exists(vfxKey(name))) {
      scene.anims.create({ key: vfxKey(name), frames: d.seq ? scene.anims.generateFrameNumbers(vfxKey(name), { frames: d.seq }) : scene.anims.generateFrameNumbers(vfxKey(name), { start: 0, end: d.frames - 1 }), frameRate: d.fps, repeat: d.loop ? -1 : 0 });
    }
  }
}
