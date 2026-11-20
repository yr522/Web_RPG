// 그림 이펙트 (스프라이트 시트). 가로 한 줄 프레임, 오른쪽 보는 그림 (왼쪽은 뒤집음).
// shared 의 { kind: 'anim', anim: 이름 } 이펙트가 여기 이름으로 재생된다.
import Phaser from 'phaser';
import smearH1 from '../../../assets/img/vfx/Smear VFX 01/Smear 01 Horizontal 1.png';
import swordSlash from '../../../assets/img/vfx/slash_temp/pixel_art_sword_slash_sprites.png';
import galeDash from '../../../assets/img/vfx/pixelfx/gale_dash.png';
import galeDashCore from '../../../assets/img/vfx/pixelfx/gale_dash_core.png';
import flowSlash from '../../../assets/img/vfx/pixelfx/flow_slash.png';
import flowSlashCore from '../../../assets/img/vfx/pixelfx/flow_slash_core.png';
import vortexImg from '../../../assets/img/vfx/pixelfx/vortex.png';
import vortexCore from '../../../assets/img/vfx/pixelfx/vortex_core.png';
import vortexBurst from '../../../assets/img/vfx/pixelfx/vortex_burst.png';
import vortexBurstCore from '../../../assets/img/vfx/pixelfx/vortex_burst_core.png';
import arrowImg from '../../../assets/img/vfx/pixelfx/arrow.png';
import arrowCore from '../../../assets/img/vfx/pixelfx/arrow_core.png';
import arrowBig from '../../../assets/img/vfx/pixelfx/arrow_big.png';
import arrowBigCore from '../../../assets/img/vfx/pixelfx/arrow_big_core.png';
import vortexBg from '../../../assets/img/vfx/bow/vortex.png';
import harpoonImg from '../../../assets/img/vfx/bow/harpoon.png';
import arrowStill from '../../../assets/img/vfx/pixelfx/arrow_still.png';
import arrowStillCore from '../../../assets/img/vfx/pixelfx/arrow_still_core.png';
import groundPop from '../../../assets/img/vfx/pixelfx/ground_pop.png';
import groundPopCore from '../../../assets/img/vfx/pixelfx/ground_pop_core.png';
import ilseomSlash from '../../../assets/img/vfx/pixelfx/ilseom_slash.png';
import ilseomSlashCore from '../../../assets/img/vfx/pixelfx/ilseom_slash_core.png';
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
  /** 하얀 부분은 원소 색을 안 입히고 흰색 그대로 (밝기 기준 0~1, 이보다 밝은 곳). 불러올 때 흰 부분만 뽑아 위층으로 겹침 */
  keepWhite?: number;
  /** 같이 재생할 위층 이펙트 이름 (원소 색을 안 입힘, 흰 심 등) */
  core?: string;
  /** 기준점 (칸 안 px). 화살은 촉 끝 */
  origin?: [number, number];
  /** 화살: 그림 속 화살 길이 (px). 게임 화살 길이(len)에 맞춰 크기를 조절할 때 씀 */
  len?: number;
  /** 계속 반복 (버프 오버레이) */
  loop?: boolean;
  /** 구간별 재생 (이름 → 칸 순서, 반복 여부). 재생 키는 vfxKey(이름) + ':' + 구간 */
  parts?: Record<string, { frames: number[]; loop?: boolean }>;
}

export const VFX: Record<string, VfxDef> = {
  /** 임시: 가로 베기 (검사 기본 공격) */
  smear_h1: { url: smearH1, frame: 48, frames: 5, fps: 25, scale: 2 },
  /** 임시: 위에서 앞으로 내려 베기, 거의 회색이라 원소 색을 입힘 (검사 일섬) */
  sword_slash: { url: swordSlash, frame: 64, frameH: 47, frames: 5, fps: 40, scale: 1.5 },
  /** 검사 일섬: 눈높이에서 본 납작한 초승달, 납작 크레용 붓으로 그은 두꺼운 베기 (pixelfx). 바깥은 무채색이라 원소 색, 흰 심은 위층. 칸 128×52, 기준점 (44, 33) = 몸 중심 */
  ilseom_slash: { url: ilseomSlash, frame: 128, frameH: 52, frames: 8, fps: 30, scale: 1.5, origin: [44, 33], core: 'ilseom_slash_core' },
  ilseom_slash_core: { url: ilseomSlashCore, frame: 128, frameH: 52, frames: 8, fps: 30, scale: 1.5, origin: [44, 33] },
  /** 검사 질풍참: 돌진 앞 뾰족한 바람 쐐기 (pixelfx 로 그림). 바깥은 밝은 무채색이라 원소 색이 입혀지고, 가운데 흰 심은 위층(gale_dash_core)으로 색 없이 겹침. 칸 100×32, 몸 중심은 칸의 x 27 */
  gale_dash: { url: galeDash, frame: 100, frameH: 32, frames: 6, fps: 20, scale: 3, core: 'gale_dash_core' },
  gale_dash_core: { url: galeDashCore, frame: 100, frameH: 32, frames: 6, fps: 20, scale: 3 },
  /** 검사 회류참: 뒤로 미끄러지며 시작점에서 몸을 따라 파도처럼 그어지는 검기 하나 (도착 직전 사라짐) + 발밑 먼지 (pixelfx). 땅에 고정, 칸 176×56, 시작점 몸 중심·발은 칸의 (154, 50) */
  flow_slash: { url: flowSlash, frame: 176, frameH: 56, frames: 14, fps: 30, scale: 2, core: 'flow_slash_core', depth: 6.5 },
  flow_slash_core: { url: flowSlashCore, frame: 176, frameH: 56, frames: 14, fps: 30, scale: 2, depth: 6.5 },
  /** 궁수 소용돌이 (pixelfx, 반복): 범위 안은 나선 팔로 중심에 빨려 들고, 범위 밖은 알갱이가 천천히 퍼짐. 칸 360×360 (4칸씩 여러 줄), 가운데가 중심, 배율 2 = 반지름 300 */
  soyong_vortex: { url: vortexImg, frame: 360, frames: 12, fps: 20, scale: 2, loop: true, core: 'soyong_vortex_core' },
  soyong_vortex_core: { url: vortexCore, frame: 360, frames: 12, fps: 20, scale: 2, loop: true },
  /** 소용돌이 터짐 (한 번): 화살이 중심에 닿으면 줄어들며 사라지고 충격파 + 파편 */
  soyong_burst: { url: vortexBurst, frame: 360, frames: 17, fps: 30, scale: 2, core: 'soyong_burst_core' },
  soyong_burst_core: { url: vortexBurstCore, frame: 360, frames: 17, fps: 30, scale: 2 },
  /** 궁수 화살 (pixelfx, 날아가는 동안 반복). 무채색이라 원소 색을 입히고 흰 심은 위층. 칸 80×28, 촉 끝 (72, 14). 그림 속 길이 24 → 게임 화살 길이에 맞춰 크기 조절 */
  arrow: { url: arrowImg, frame: 80, frameH: 28, frames: 12, fps: 30, scale: 1, loop: true, origin: [72, 14], len: 24, core: 'arrow_core' },
  arrow_core: { url: arrowCore, frame: 80, frameH: 28, frames: 12, fps: 30, scale: 1, loop: true },
  /** 큰 화살: 더 굵고, 촉에서 나온 알갱이가 몸통을 따라 흐르다 깃에서 퍼짐. 그림 속 길이 36 */
  arrow_big: { url: arrowBig, frame: 80, frameH: 28, frames: 12, fps: 30, scale: 1, loop: true, origin: [72, 14], len: 36, core: 'arrow_big_core' },
  arrow_big_core: { url: arrowBigCore, frame: 80, frameH: 28, frames: 12, fps: 30, scale: 1, loop: true },
  /** 사슬 화살 끝 작살 (유저 그림, 무채색이라 원소 색을 입힘). 19×12 한 칸, 오른쪽을 봄, 촉 끝 (18, 6) */
  /** 궁수 소용돌이 뒷배경 (유저 그림, 무채색이라 원소 색을 입히고 흰 부분은 흰색 그대로). 칸 256×256 11칸: 0~3 커짐, 4~8 돎(반복), 9~10 줄어듦. 가운데가 중심 */
  soyong_bg: { url: vortexBg, frame: 256, frames: 11, fps: 14, scale: 2.3, smooth: true, keepWhite: 0.72, depth: 5.4,
    parts: { in: { frames: [0, 1, 2, 3] }, loop: { frames: [4, 5, 6, 7, 8], loop: true }, out: { frames: [9, 10] } } },
  harpoon: { url: harpoonImg, frame: 19, frameH: 12, frames: 1, fps: 1, scale: 1.5, origin: [18, 6] },
  /** 박혀서 멈춘 큰 화살 (후방 도약). 바람 줄·알갱이 없음, 1칸 */
  arrow_still: { url: arrowStill, frame: 80, frameH: 28, frames: 1, fps: 1, scale: 1, origin: [72, 14], len: 36, core: 'arrow_still_core' },
  arrow_still_core: { url: arrowStillCore, frame: 80, frameH: 28, frames: 1, fps: 1, scale: 1 },
  /** 화살이 땅에 박힐 때 (pixelfx, 한 번, 작게): 땅이 뾰족하게 솟았다 가라앉음 + 납작한 충격파 + 흙 조각. 칸 72×44, 기준점 (36, 34) = 박힌 자리 땅 줄 */
  ground_pop: { url: groundPop, frame: 72, frameH: 44, frames: 14, fps: 30, scale: 1.5, origin: [36, 34], depth: 5.6, core: 'ground_pop_core' },
  ground_pop_core: { url: groundPopCore, frame: 72, frameH: 44, frames: 14, fps: 30, scale: 1.5, origin: [36, 34], depth: 5.6 },
  /** 검사 오의 천붕: 연속 베기 (유저 그림, 무채색이라 원소 색을 입힘). 칸 256×256 6칸: 0 = 모으기, 1~5 = 다섯 번 베기. 초당 18칸으로 모으기 1번(0.06초) + 베기 칸마다 2번(0.11초) = 판정 5번 박자 */
  cheonbung: { url: cheonbungVfx, frame: 256, frames: 6, fps: 18, scale: 1.5, smooth: true, seq: [0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5], keepWhite: 0.72 },
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
  for (const [name, d] of Object.entries(VFX)) if (d.url) scene.load.spritesheet(vfxKey(name), d.url, { frameWidth: d.frame, frameHeight: d.frameH ?? d.frame });
}

/** keepWhite: 그림에서 밝은 부분만 흰색으로 뽑은 시트를 만들어 위층(core)으로 붙임 */
function buildWhiteLayers(scene: Phaser.Scene) {
  for (const [name, d] of Object.entries(VFX)) {
    if (d.keepWhite === undefined) continue;
    const wName = `${name}_white`, key = vfxKey(wName);
    if (!scene.textures.exists(key)) {
      const img = scene.textures.get(vfxKey(name)).getSourceImage() as HTMLImageElement;
      const cv = document.createElement('canvas');
      cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, cv.width, cv.height), px = data.data;
      const lo = d.keepWhite, hi = Math.min(1, lo + 0.15);
      for (let i = 0; i < px.length; i += 4) {
        const l = (px[i] + px[i + 1] + px[i + 2]) / 765;
        const k = Math.max(0, Math.min(1, (l - lo) / (hi - lo)));
        const e = k * k * (3 - 2 * k);
        px[i] = px[i + 1] = px[i + 2] = 255;
        px[i + 3] = Math.round(px[i + 3] * e);
      }
      ctx.putImageData(data, 0, 0);
      scene.textures.addSpriteSheet(key, cv as unknown as HTMLImageElement, { frameWidth: d.frame, frameHeight: d.frameH ?? d.frame });
    }
    VFX[wName] = { ...d, url: '', keepWhite: undefined, core: undefined };
    d.core = wName;
  }
}

export function createVfxAnims(scene: Phaser.Scene) {
  buildWhiteLayers(scene);
  for (const [name, d] of Object.entries(VFX)) {
    scene.textures.get(vfxKey(name)).setFilter(d.smooth ? Phaser.Textures.FilterMode.LINEAR : Phaser.Textures.FilterMode.NEAREST);
    if (!scene.anims.exists(vfxKey(name))) {
      scene.anims.create({ key: vfxKey(name), frames: d.seq ? scene.anims.generateFrameNumbers(vfxKey(name), { frames: d.seq }) : scene.anims.generateFrameNumbers(vfxKey(name), { start: 0, end: d.frames - 1 }), frameRate: d.fps, repeat: d.loop ? -1 : 0 });
    }
    for (const [part, q] of Object.entries(d.parts ?? {})) {
      const key = vfxKey(name) + ':' + part;
      if (!scene.anims.exists(key)) scene.anims.create({ key, frames: scene.anims.generateFrameNumbers(vfxKey(name), { frames: q.frames }), frameRate: d.fps, repeat: q.loop ? -1 : 0 });
    }
  }
}
