// 게임 화면. Session 의 상태를 읽어서 그리기만 한다 (게임 규칙은 shared/ 에).
import Phaser from 'phaser';
import { GROUND_Y } from '@shared/data/maps';
import { CLASSES } from '@shared/data/classes';
import type { Session } from '../session/LocalSession';
import type { Input } from '../input/Input';
import type { Hud } from '../hud/Hud';
import { palette } from './palette';
import { professorHasNews } from '@shared/rules/progress';
import { ELEMENTS, type Element } from '@shared/data/elements';
import type { Fx } from '@shared/sim/types';

const hex = (c: string) => parseInt(c.slice(1, 7), 16);
import { ICON_URLS } from '../ui/icons';
import { itemDef } from '@shared/data/items';
import { AVATAR_HEAD, AVATAR_SCALE, PlayerAvatar, makeStaticAvatar, poseStaticAvatar, preloadAvatar } from './PlayerAvatar';
import { CutscenePlayer, type Stage } from '../story/CutscenePlayer';
import type { Motion } from '@shared/data/cutscenes';
import { QUESTS } from '@shared/data/quests';
import { companionNpc, npcPlace, questTarget } from '@shared/rules/quests';
import { mapNpcs, mapPortals, offersQuest } from '@shared/rules/story';
import { nextPortal } from '@shared/rules/route';
import { SpeechBubble } from './SpeechBubble';
import { NPC_BUBBLE_RANGE, TALK_NPCS } from '@shared/data/npcs';
import slimeUrl from '../../../assets/img/sprites/새 폴더/01_slime/slime.png';
import { BOSS_ORB, COIN, COIN_ANIM, COIN_KINDS, MONSTERS, coinKind, type MonsterId } from '@shared/data/monsters';
import coinBronze from '../../../assets/img/icon/coin/bronze_coin.png';
import coinIron from '../../../assets/img/icon/coin/iron_coin.png';
import coinSilver from '../../../assets/img/icon/coin/silver_coin.png';
import coinGold from '../../../assets/img/icon/coin/gold_coin.png';

/** 골드 동전 그림 (16×16 칸, 가로로 프레임) */
const COIN_URLS = { bronze: coinBronze, iron: coinIron, silver: coinSilver, gold: coinGold };

/** 화면 높이 (월드 좌표). 땅(470)이 화면 76% 높이에 오도록 해서 아래쪽 HUD에 캐릭터가 가리지 않게 한다. 폭은 화면 비율에 따라 720~1280 */
/** 맵 밖으로 더 그리는 땅 폭 (화면이 맵보다 넓을 때용) */
const EDGE = 400;
export const VIEW_H = 620;
const FONT = 'Pretendard, system-ui, sans-serif';
const ROBE: Record<string, number> = { warrior: 0x8a3a3a, mage: 0x4a3a8a, archer: 0x2f6a4a };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 977) % 2600, y: (i * 389) % 300, s: (i % 3) + 1 }));

export interface SceneDeps {
  session: Session; input: Input; hud: Hud; isTouch: boolean; openNpc: (id: string) => void;
  /** 예 / 아니오 묻기 */
  confirm: (text: string, yes: () => void) => void;
  /** 보스 입장 포탈: 난이도 고르기 */
  chooseBoss: (boss: string, text?: string) => void;
  /** 대화 NPC 대화창 (닫힐 때까지 기다림) — 컷신의 talk 단계 */
  talk: (npc: string) => Promise<void>;
}

/**
 * 컷신에서 움직이는 그림: 대화 NPC('npc:id', 뼈대 그림) 와 연출용 몬스터('mob:이름', 슬라임 그림).
 * 화면에서만 움직이고 게임 규칙과는 상관없다.
 */
interface Actor {
  kind: 'npc' | 'mob';
  root: Phaser.GameObjects.Container | Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  elem: Element | null;
  home: number; x: number; face: 1 | -1; to: number | null; speed: number; pose: Motion | null; t: number;
  /** 점프 중 경과 시간 (null = 땅) */
  jumpT: number | null;
}
/** 컷신 점프: 높이(px), 시간(초) / 연출용 몬스터 머리 높이 (말풍선 위치) */
const ACTOR_JUMP = { h: 50, time: 0.5 };
const MOB_HEAD = 46;
/** 길 안내 화살표: 플레이어 머리 위, 가야 할 쪽 */
const GUIDE = { hideWithin: 50, color: 0xffd84a };

/** 따라다니는 NPC: 플레이어 뒤 간격, 걷기·뛰기 속도, 이만큼 벌어지면 뜀 */
const COMPANION = { gap: 60, walk: 200, run: 420, runFrom: 220 };

/** 맵 배경 그림 (assets/img/bg/*.png) */
const BG_FILES = import.meta.glob('../../../assets/img/bg/*.png', { eager: true, import: 'default' }) as Record<string, string>;

/** 몬스터 그림: 원소 슬라임은 회색 슬라임(원소 색을 입힘), 나머지는 몬스터 id 그대로 */
function mobTexture(mob: MonsterId, elem: unknown) {
  if (mob === 'slime' || mob === 'slime_elem') return elem ? 'slime_gray' : 'slime';
  return mob;
}

export class GameScene extends Phaser.Scene implements Stage {
  private deps!: SceneDeps;
  private actors = new Map<string, Actor>();
  private cut!: CutscenePlayer;
  private guideG!: Phaser.GameObjects.Graphics;
  /** 카메라 확대 배율 (컷신), 컷신 카메라 이동 */
  private camZoom = 1;
  private camMove: { fromX: number; toX: number | null; fromZ: number; toZ: number; t: number; dur: number } | null = null;
  /** 컷신 카메라가 잡고 있는 화면 가운데 (null = 플레이어 따라가기) */
  private camHold: number | null = null;
  private uiOn = true;
  private bg!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private mapLayer!: Phaser.GameObjects.Container;
  private player!: PlayerAvatar;
  private nameTag!: Phaser.GameObjects.Text;
  private bubble!: Phaser.GameObjects.Text;
  private floats: { t: Phaser.GameObjects.Text; age: number; life: number }[] = [];
  private profMark: Phaser.GameObjects.Text | null = null;
  /** 머리 위 말풍선: 'player' 또는 'npc:<id>' */
  private bubbles = new Map<string, SpeechBubble>();
  /** 다가오면 말풍선을 띄우는 NPC: 범위 안에 들어와 있는지 (나갔다 다시 와야 또 뜸) */
  private npcNear = new Map<string, boolean>();
  private camX = 0;
  private hitstop = 0;
  private shake = 0;
  private flash = new Map<string, number>();
  private fxList: { f: Fx; t: number }[] = [];
  private combat!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  /** 캐릭터 뒤에 그리는 것 (마법진) */
  private underG!: Phaser.GameObjects.Graphics;
  /** 투사체·소용돌이·충전 바·조준 */
  private projG!: Phaser.GameObjects.Graphics;
  private enemyLabels = new Map<string, Phaser.GameObjects.Text>();
  private enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** 떨어진 골드 동전 그림 (id → 그림) */
  private coinSprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** 땅에 떨어진 물건 그림 (id → 아이콘) */
  private dropSprites = new Map<string, { item: string; obj: Phaser.GameObjects.Image | Phaser.GameObjects.Text }>();
  private fade = 1;
  /** 세로로 긴 맵의 카메라 위쪽 y (맵에 들어오면 다시 맞춤) */
  private camYNow: number | null = null;
  private mapSig = '';
  private companion: { id: string; root: Phaser.GameObjects.Container; label: Phaser.GameObjects.Text; x: number; walkT: number | null } | null = null;
  private viewW = 960;
  private zoom = 1;

  constructor() { super('game'); }

  init(deps: SceneDeps) { this.deps = deps; }

  preload() {
    preloadAvatar(this);
    // 슬라임: 32×32 칸 3개 (1 기본 · 2 이동 · 3 점프 준비)
    this.load.spritesheet('slime', slimeUrl, { frameWidth: 32, frameHeight: 32 });
    for (const [path, url] of Object.entries(ICON_URLS)) this.load.image(`ico:${path}`, url);
    for (const k of COIN_KINDS) this.load.spritesheet(`coin:${k.img}`, COIN_URLS[k.img], { frameWidth: 16, frameHeight: 16 });
    for (const [path, url] of Object.entries(BG_FILES)) this.load.image(`bg:${path.split('/').pop()!.replace(/\.png$/, '')}`, url);
  }

  create() {
    this.makeGraySlime();
    this.makeTempMobs();
    this.makeTempMobs2();
    this.zoom = this.scale.height / VIEW_H;
    this.bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.mapLayer = this.add.container(0, 0).setDepth(1);
    this.fx = this.add.graphics().setDepth(2);
    this.combat = this.add.graphics().setDepth(4);
    this.fxG = this.add.graphics().setDepth(6);
    this.underG = this.add.graphics().setDepth(4.8);
    this.projG = this.add.graphics().setDepth(6.5);
    this.player = new PlayerAvatar(this).setDepth(5);
    this.guideG = this.add.graphics().setDepth(7.2);
    this.cut = new CutscenePlayer(this, this.deps.session, this.deps.input, this.deps.talk);
    this.nameTag = this.text('', 11, '#fff').setOrigin(0.5, 0).setDepth(6);
    this.bubble = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '13px', color: '#222', backgroundColor: 'rgba(255,255,255,0.92)', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(7).setVisible(false).setResolution(this.zoom);
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(10);

    this.scale.on('resize', () => this.applyView());
    this.applyView();
    this.buildMap();
    this.deps.hud.showBanner(this.deps.session.world.map.name);
  }

  private text(s: string, size: number, color: string) {
    return this.add.text(0, 0, s, { fontFamily: FONT, fontSize: `${size}px`, fontStyle: 'bold', color, stroke: '#000', strokeThickness: 3 })
      .setResolution(this.zoom);
  }

  /** 렌더 배율에 맞춰 카메라 확대. 월드 좌표는 항상 높이 540 기준. */
  private applyView() {
    const cam = this.cameras.main;
    this.zoom = this.scale.height / VIEW_H;
    cam.setOrigin(0, 0);
    cam.setZoom(this.zoom);
    cam.setRoundPixels(true);
    this.viewW = this.scale.width / this.zoom;
    // 글자는 화면 배율만큼 크게 그려야 선명하다
    const fix = (list: Phaser.GameObjects.GameObject[]) => {
      for (const o of list) {
        if (o instanceof Phaser.GameObjects.Text) o.setResolution(this.zoom);
        else if (o instanceof Phaser.GameObjects.Container) fix(o.list);
      }
    };
    fix(this.children.list);
  }

  /** 맵이 바뀔 때마다 맵의 고정된 부분을 새로 만든다 */
  private buildMap(soft = false) {
    this.mapLayer.removeAll(true);
    for (const b of this.bubbles.values()) b.destroy();
    this.bubbles.clear();
    this.npcNear.clear();
    for (const t of this.enemyLabels.values()) t.destroy();
    this.enemyLabels.clear();
    for (const sp of this.enemySprites.values()) sp.destroy();
    this.enemySprites.clear();
    this.flash.clear();
    this.fxList = [];
    const { world, save } = this.deps.session, map = world.map;
    const g = this.add.graphics();
    this.mapLayer.add(g);

    if (map.building) this.drawSchool(g);

    for (const p of world.solids) {
      if (p.ground) {
        // 화면이 맵보다 넓을 때(아주 넓은 화면) 양옆이 비지 않게 땅을 맵 밖까지 그린다
        g.fillStyle(0x2b2a3f).fillRect(-EDGE, p.y, map.width + EDGE * 2, p.h);
        g.fillStyle(map.building ? 0x7a6a8a : 0x4a7a4a).fillRect(-EDGE, p.y, map.width + EDGE * 2, 6);
      }
    }
    // 발판은 배경 그림 위에 그림
    const plat = this.add.graphics();
    for (const p of world.solids) {
      if (p.ground) continue;
      plat.fillStyle(0x6b5640).fillRect(p.x, p.y, p.w, p.h);
      plat.fillStyle(0x8fae6a).fillRect(p.x, p.y, p.w, 4);
    }
    // 배경 그림: 그림 속 땅 줄이 땅 높이에 오게
    if (map.bg && this.textures.exists(`bg:${map.bg.img}`)) {
      // 화면이 그림보다 넓을 때 양옆이 하늘색으로 비지 않게 어둡게 채움
      // 세로로 긴 맵은 그림 맨 위가 맵 맨 위에 오게
      const top = map.top ?? 0;
      g.fillStyle(0x0c1420).fillRect(-EDGE, top - EDGE, EDGE, GROUND_Y - top + EDGE).fillRect(map.width, top - EDGE, EDGE, GROUND_Y - top + EDGE);
      this.mapLayer.add(this.add.image(0, top, `bg:${map.bg.img}`).setOrigin(0, 0).setScale((GROUND_Y - top) / map.bg.groundY));
    }
    this.mapLayer.add(plat);
    for (const s of map.signs) {
      g.fillStyle(0x5a4630).fillRect(s.x - 3, GROUND_Y - 50, 6, 50);
      g.fillStyle(0x7a6040).fillRect(s.x - 75, GROUND_Y - 74, 150, 28);
      this.mapLayer.add(this.text(s.text, 14, '#fff3d0').setStroke('#000', 0).setOrigin(0.5).setPosition(s.x, GROUND_Y - 60));
    }
    this.mapSig = this.visibleSig();
    for (const pt of mapPortals(save, world.mapId)) {
      this.mapLayer.add(this.text(pt.label, 12, '#e8dcff').setOrigin(0.5, 1).setPosition(pt.x, (pt.y ?? GROUND_Y) - 98));
    }
    this.profMark = null;
    for (const a of this.actors.values()) if (a.kind === 'mob') { a.root.destroy(); a.label.destroy(); }
    this.actors.clear();
    for (const n of mapNpcs(save, world.mapId)) {
      const x = n.x, y = GROUND_Y;
      // 터치·클릭으로 대화
      const zone = this.add.zone(x, y - 55, n.id === 'shop' ? 132 : 80, 125).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.deps.input.blocked) return;
        const me = this.deps.session.me();
        if (Math.abs(me.x + me.w / 2 - x) < 280) this.deps.openNpc(n.id);
        else this.deps.hud.toast('더 가까이 가자');
      });
      this.mapLayer.add(zone);
      if (n.id === 'prof') {
        this.profMark = this.text('!', 26, '#ffd84a').setOrigin(0.5, 1).setPosition(x, y - 106);
        this.mapLayer.add(this.profMark);
      }
      // 교수님은 이야기 대사가 있어도 그림은 교수님 그대로
      const talk = n.id === 'prof' ? undefined : TALK_NPCS[n.id];
      if (talk?.prop === 'bed') {
        // 침대 (임시 그림)
        g.fillStyle(0x5a3f22).fillRect(x - 50, y - 30, 100, 30).fillRect(x - 54, y - 52, 10, 52);
        g.fillStyle(0xe8e2d4).fillRect(x - 44, y - 38, 92, 12);
        g.fillStyle(0x6a7ac0).fillRect(x - 20, y - 40, 68, 14);
        g.fillStyle(0xffffff).fillRect(x - 42, y - 46, 22, 9);
        this.mapLayer.add(this.text(talk.name, 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6));
        continue;
      }
      if (talk) {
        // 대화 NPC: 임시로 뼈대 그림, 플레이어 쪽(왼쪽)을 봄
        const root = makeStaticAvatar(this, x, y, -1), label = this.text(talk.name, 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6);
        if (talk.tint !== undefined) for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setTint(talk.tint);
        this.mapLayer.add(root);
        this.mapLayer.add(label);
        this.actors.set(`npc:${n.id}`, { kind: 'npc', root, label, elem: null, home: x, x, face: -1, to: null, speed: 0, pose: null, t: 0, jumpT: null });
        continue;
      }
      if (n.id === 'shop') {
        g.fillStyle(0x6b4a2a).fillRect(x - 60, y - 46, 120, 46);
        g.fillStyle(0x8a6438).fillRect(x - 64, y - 50, 128, 8);
        g.fillStyle(0x5a3f22).fillRect(x - 58, y - 110, 6, 64).fillRect(x + 52, y - 110, 6, 64);
        for (let i = 0; i < 6; i++) {
          g.fillStyle(i % 2 ? 0xf4efe0 : 0xd9534f);
          g.fillRect(x - 66 + i * 22, y - 112, 22, 12);
          g.fillCircle(x - 55 + i * 22, y - 100, 11);
        }
        g.fillStyle(0xf1dcc0).fillCircle(x, y - 62, 11);
        g.fillStyle(0x7a4a8a).slice(x, y - 66, 12, Math.PI, 0).fillPath();
        g.fillStyle(0x111111).fillRect(x - 5, y - 64, 3, 3).fillRect(x + 3, y - 64, 3, 3);
        g.fillStyle(0xe0484f).fillRect(x - 40, y - 62, 8, 12);
        g.fillStyle(0x4a7cf0).fillRect(x + 30, y - 62, 8, 12);
        this.mapLayer.add(this.text('매점 모리', 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6));
      } else {
        const robe = ROBE[save.cls];
        g.fillStyle(robe).fillTriangle(x - 20, y, x + 20, y, x + 13, y - 50).fillTriangle(x - 20, y, x + 13, y - 50, x - 13, y - 50);
        g.fillStyle(0xf1dcc0).fillCircle(x, y - 60, 12);
        g.fillStyle(0xdddddd).fillTriangle(x - 9, y - 56, x + 9, y - 56, x, y - 36);
        g.fillStyle(robe).fillTriangle(x - 18, y - 68, x + 18, y - 68, x + 3, y - 102);
        g.fillStyle(0x111111).fillRect(x - 5, y - 63, 3, 3).fillRect(x + 3, y - 63, 3, 3);
        this.mapLayer.add(this.text(CLASSES[save.cls].professor, 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6));
      }
    }

    this.nameTag.setText(save.name);
    if (soft) return;
    const me = this.deps.session.me();
    this.camX = this.cameraTarget(me.x + me.w / 2, me.face);
    this.camYNow = null;
    this.fade = 1;
    this.placeCompanion();
  }

  /** 지금 보이는 NPC·포탈 목록 (퀘스트 진행으로 바뀌면 맵을 다시 그림) */
  private visibleSig() {
    const { save, world } = this.deps.session;
    return mapNpcs(save, world.mapId).map(n => n.id + n.x).join() + '|' + mapPortals(save, world.mapId).map(p => p.to + p.x).join();
  }

  /** 따라다니는 NPC (연출, 무적): 맵에 들어오면 플레이어 옆에 나타남 */
  private placeCompanion() {
    this.companion?.root.destroy();
    this.companion?.label.destroy();
    this.companion = null;
    const id = companionNpc(this.deps.session.save);
    if (!id) return;
    const me = this.deps.session.me(), x = me.x + me.w / 2 - me.face * COMPANION.gap;
    const root = makeStaticAvatar(this, x, GROUND_Y, me.face).setDepth(4.9);
    const label = this.text(TALK_NPCS[id]?.name ?? id, 12, '#fff').setOrigin(0.5, 0).setDepth(4.9);
    this.companion = { id, root, label, x, walkT: null };
  }

  /** 따라다니는 NPC: 멀어지면 후다닥 따라옴 */
  private updateCompanion(dt: number, meX: number) {
    const want = companionNpc(this.deps.session.save);
    if ((want ?? null) !== (this.companion?.id ?? null)) this.placeCompanion();
    const c = this.companion;
    if (!c) return;
    const me = this.deps.session.me();
    const target = meX - me.face * COMPANION.gap, d = target - c.x;
    if (Math.abs(d) > COMPANION.gap * 0.5) {
      const speed = Math.abs(d) > COMPANION.runFrom ? COMPANION.run : COMPANION.walk;
      c.x += Math.sign(d) * Math.min(Math.abs(d), speed * dt);
      c.root.setScale(AVATAR_SCALE * (Math.sign(d) || 1), AVATAR_SCALE);
      c.walkT = (c.walkT ?? 0) + dt;
      poseStaticAvatar(c.root, c.walkT, speed === COMPANION.run);
    } else if (c.walkT !== null) { c.walkT = null; poseStaticAvatar(c.root, null); }
    c.root.setPosition(c.x, GROUND_Y);
    c.label.setPosition(c.x, GROUND_Y + 6);
  }

  private drawSchool(g: Phaser.GameObjects.Graphics) {
    const x0 = 470;
    g.fillStyle(0x5b4f86).fillRect(x0, 210, 780, 260);
    g.fillStyle(0x4a3f72).fillRect(x0 - 40, 150, 110, 320).fillRect(x0 + 710, 150, 110, 320);
    g.fillStyle(0x3a2f60)
      .fillTriangle(x0 - 55, 150, x0 + 15, 70, x0 + 85, 150)
      .fillTriangle(x0 + 695, 150, x0 + 765, 70, x0 + 835, 150)
      .fillTriangle(x0 + 290, 210, x0 + 390, 120, x0 + 490, 210);
    g.fillStyle(0xe8d9a0).fillCircle(x0 + 390, 175, 18);
    g.fillStyle(0x3a2f60).fillRect(x0 + 389, 162, 2, 14).fillRect(x0 + 389, 174, 10, 2);
    g.fillStyle(0x2c2550);
    for (let r = 0; r < 2; r++) for (let c = 0; c < 8; c++) if (c !== 3 && c !== 4) g.fillRect(x0 + 50 + c * 86, 250 + r * 90, 30, 46);
    g.fillStyle(0x2a1f45).fillRoundedRect(x0 + 345, 360, 90, 110, { tl: 40, tr: 40, bl: 0, br: 0 });
    this.mapLayer.add(this.text('마 법 학 교', 18, '#fff3d0').setStroke('#000', 0).setOrigin(0.5).setPosition(x0 + 390, 228).setFontFamily('Esamanru, ' + FONT));
  }

  private cameraTarget(cx: number, face: number) {
    const w = this.deps.session.world.map.width;
    // 맵이 화면보다 좁으면 가운데에 고정
    if (w <= this.viewW) return (w - this.viewW) / 2;
    return Math.max(0, Math.min(w - this.viewW, cx - this.viewW / 2 + face * 60));
  }

  private lastFrame = performance.now();

  update() {
    const { session, input, hud } = this.deps;
    // Phaser 의 delta 는 튀는 값을 깎아서 느린 기기에서 게임이 느려진다 → 실제 경과 시간을 직접 잰다
    const nowMs = performance.now();
    const dt = Math.min(0.25, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    // 타격감: 맞는 순간 아주 잠깐 멈칫(hitstop)
    this.cut.update(dt);
    const events = this.hitstop > 0 ? [] : session.update(dt, () => this.cut.command() ?? input.readCommand());
    this.hitstop = Math.max(0, this.hitstop - dt);
    for (const ev of events) {
      if (ev.type === 'mapEnter') { this.buildMap(); hud.showBanner(session.world.map.name); }
      if (ev.type === 'notice') hud.toast(ev.text);
      if (ev.type === 'interact') this.deps.openNpc(ev.npc);
      if (ev.type === 'portal' && ev.boss) this.deps.chooseBoss(ev.boss, ev.confirm);
      else if (ev.type === 'portal' && ev.confirm) {
        const { to, toX, toY } = ev;
        this.deps.confirm(ev.confirm, () => session.takePortal(to, toX, toY));
      }
      if (ev.type === 'float') this.addFloat(ev.x, ev.y, ev.text, ev.color, ev.size, ev.life);
      if (ev.type === 'banner') hud.showBanner(ev.text, ev.color);
      if (ev.type === 'fx') this.fxList.push({ f: ev.fx, t: 0 });
      if (ev.type === 'hit') {
        this.flash.set(ev.enemyId, 0.1);
        this.hitstop = Math.max(this.hitstop, ev.reaction ? 0.08 : ev.heavy ? 0.045 : 0.02);
        if (ev.reaction) this.shake = Math.max(this.shake, 7);
      }
      if (ev.type === 'died') this.shake = 0;
      if (ev.type === 'shake') this.shake = Math.max(this.shake, ev.amount);
      if (ev.type === 'cutscene') this.playCutscene(ev.id);
      if (ev.type === 'say') this.say(ev.who === session.playerId ? 'player' : ev.who, ev.text, ev.life);
    }

    const me = session.me(), prev = session.prevPos(), a = session.alpha;
    const px = prev.x + (me.x - prev.x) * a, py = prev.y + (me.y - prev.y) * a;
    const camY = this.updateCamera(dt, px + me.w / 2, me.face, py + me.h);
    this.shake = Math.max(0, this.shake - 30 * dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    const z = this.zoom * this.camZoom;
    if (this.cameras.main.zoom !== z) this.cameras.main.setZoom(z);
    this.cameras.main.setScroll(Math.round((this.camX + sx) * z) / z, Math.round((camY + sy) * z) / z);
    this.updateActors(dt);

    const pal = palette(session.nowMs());
    this.drawBackground(pal);
    this.drawPortals();
    this.drawEnemies(dt);
    this.drawFx(dt);
    this.drawCombat(px, py);

    // 내 캐릭터: 휘두를 때 살짝 앞으로, 맞은 뒤 무적 동안 깜빡임
    const act = me.action?.name;
    const lunge = act === 'ilseom' || act === 'wolcham' || act === 'basic' ? 3 * me.face : 0;
    this.player.update(dt, me, px + me.w / 2 + lunge, py + me.h);
    this.player.setVisible(me.downT > 0 || !(me.invT > 0 && Math.floor(this.time.now / 50) % 2 === 0));
    this.nameTag.setPosition(px + me.w / 2, py + me.h + 6);

    // 퀘스트 진행으로 NPC 자리·포탈이 바뀌면 다시 그림
    if (this.visibleSig() !== this.mapSig) this.buildMap(true);
    this.updateCompanion(dt, px + me.w / 2);
    this.updateSpeech(dt, px + me.w / 2, py + me.h);
    this.drawGuide(px + me.w / 2, py + me.h);
    const portal = session.world.portalNear(me);
    const npc = mapNpcs(session.save, session.world.mapId).find(n => Math.abs(n.x - (me.x + me.w / 2)) < 60);
    if (portal) this.showBubble(portal.x, (portal.y ?? GROUND_Y) - 118, '↑ 이동');
    // 대화 NPC 는 머리 위 말풍선이 떠 있는 동안 안내 말풍선을 겹쳐 띄우지 않음
    else if (npc && this.bubbles.get(`npc:${npc.id}`)?.visible) this.bubble.setVisible(false);
    else if (npc) this.showBubble(npc.x, GROUND_Y - 126, `↑ / ${this.deps.isTouch ? '터치' : '클릭'}: ${npc.id === 'shop' ? '상점' : '대화'}`);
    else this.bubble.setVisible(false);
    if (this.bubble.visible && (input.blocked || this.cut.running)) this.bubble.setVisible(false);

    if (this.profMark) {
      const news = professorHasNews(session.save, session.nowMs());
      this.profMark.setVisible(news).setY(GROUND_Y - 106 + Math.sin(this.time.now / 200) * 3);
    }
    this.updateFloats(dt);

    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.overlay.clear();
    if (pal.phase === 2) this.overlay.fillStyle(0x0a0a32, 0.18).fillRect(0, 0, this.viewW, VIEW_H);
    if (this.fade > 0) this.overlay.fillStyle(0x000000, this.fade).fillRect(0, 0, this.viewW, VIEW_H);

    hud.update(session);
  }

  // ===================== 컷신 =====================
  playCutscene(id: string) { void this.cut.play(id); }

  /** 카메라: 평소엔 플레이어를 따라가고, 컷신이 잡으면 그 자리·배율로 부드럽게. 화면 위쪽 y 를 돌려준다 */
  private updateCamera(dt: number, meX: number, face: number, meFeet = GROUND_Y) {
    const followLeft = this.cameraTarget(meX, face);
    if (this.camMove) {
      const m = this.camMove;
      m.t = Math.min(m.dur, m.t + dt);
      const k = m.dur > 0 ? m.t / m.dur : 1, e = k * k * (3 - 2 * k);
      const toX = m.toX ?? followLeft + this.viewW / 2;
      const center = m.fromX + (toX - m.fromX) * e;
      this.camZoom = m.fromZ + (m.toZ - m.fromZ) * e;
      this.camX = this.clampCam(center);
      if (m.t >= m.dur) { this.camHold = m.toX; this.camMove = null; }
    } else if (this.camHold !== null) {
      this.camX = this.clampCam(this.camHold);
    } else {
      this.camX += (followLeft - this.camX) * Math.min(1, dt * 6);
    }
    // 확대하면 보이는 높이가 줄어듦: 땅이 화면 아래쪽에 오도록
    const vh = VIEW_H / this.camZoom;
    const top = this.deps.session.world.map.top;
    if (top === undefined) return Math.max(0, Math.min(VIEW_H - vh, GROUND_Y - vh * 0.7));
    // 세로로 긴 맵: 플레이어 발이 화면 아래쪽 70% 쯤에 오게 따라감. 높이 올라갈수록 발을 화면 아래쪽(맨 위 발판에서 75%)에 둬서 천장이 더 보이게
    const highest = Math.min(GROUND_Y, ...this.deps.session.world.map.platforms.map(p => p.y));
    const up = highest < GROUND_Y ? Math.max(0, Math.min(1, (GROUND_Y - meFeet) / (GROUND_Y - highest))) : 0;
    const want = Math.max(top, Math.min(VIEW_H - vh, meFeet - vh * (0.7 + 0.05 * up)));
    if (this.camYNow === null) this.camYNow = want;
    this.camYNow += (want - this.camYNow) * Math.min(1, dt * 6);
    return this.camYNow;
  }

  /** 화면 가운데 x → 화면 왼쪽 x (맵 밖으로 안 나가게) */
  private clampCam(center: number) {
    const vw = this.viewW / this.camZoom, w = this.deps.session.world.map.width;
    if (w <= vw) return (w - vw) / 2;
    return Math.max(0, Math.min(w - vw, center - vw / 2));
  }

  camTo(x: number | null, zoom: number, time: number) {
    const vw = this.viewW / this.camZoom;
    this.camMove = { fromX: this.camX + vw / 2, toX: x, fromZ: this.camZoom, toZ: zoom, t: 0, dur: time };
    this.camHold = null;
  }

  actorX(who: string) { return this.actors.get(who)?.x ?? null; }
  actorWalk(who: string, to: number, speed: number) {
    const a = this.actors.get(who);
    if (!a) return;
    a.to = to; a.speed = speed; a.face = to > a.x ? 1 : -1;
  }
  actorMoving(who: string) { const a = this.actors.get(who); return !!a && (a.to !== null || a.jumpT !== null); }
  actorPose(who: string, motion: Motion | null) {
    const a = this.actors.get(who);
    if (!a) return;
    a.pose = motion;
    if (motion === 'jump') a.jumpT = 0;
  }
  actorFace(who: string, dir: 1 | -1) { const a = this.actors.get(who); if (a) a.face = dir; }
  actorElem(who: string) { return this.actors.get(who)?.elem ?? null; }

  mobSpawn(id: string, elem: Element | null, x: number, face: 1 | -1) {
    this.mobRemove(id);
    const root = this.add.sprite(x, GROUND_Y + 1, elem ? 'slime_gray' : 'slime', 0).setOrigin(0.5, 1).setScale(1.45).setDepth(4);
    if (elem) root.setTint(hex(ELEMENTS[elem].color));
    const label = this.text(elem ? `${ELEMENTS[elem].name} 슬라임` : '슬라임', 11, '#ffffff').setStroke('#000', 2).setOrigin(0.5, 0).setDepth(4);
    this.actors.set(`mob:${id}`, { kind: 'mob', root, label, elem, home: x, x, face, to: null, speed: 0, pose: null, t: 0, jumpT: null });
  }
  mobRemove(id: string) {
    const a = this.actors.get(`mob:${id}`);
    if (!a) return;
    a.root.destroy(); a.label.destroy();
    this.actors.delete(`mob:${id}`);
    this.bubbles.get(`mob:${id}`)?.hide();
  }

  /** 컷신 끝: NPC 는 제자리로, 연출용 몬스터는 없앰 */
  resetActors() {
    for (const [who, a] of this.actors) {
      if (a.kind === 'mob') this.mobRemove(who.slice(4));
      else { a.x = a.home; a.to = null; a.pose = null; a.face = -1; a.jumpT = null; }
    }
  }
  setUi(v: boolean) {
    this.uiOn = v;
    document.body.classList.toggle('ui-off', !v);
  }

  /**
   * 컷신 그림 움직이기.
   * NPC 뼈대 그림: 0 서기 · 1·2 걷기 · 3 공중 · 4 앉기 / 슬라임: 0 기본 · 1 이동(0과 번갈아) · 2 웅크림
   */
  private updateActors(dt: number) {
    for (const a of this.actors.values()) {
      const mob = a.kind === 'mob';
      let frame = 0;
      if (a.to !== null) {
        const d = a.to - a.x, step = a.speed * dt;
        if (Math.abs(d) <= step) { a.x = a.to; a.to = null; } else a.x += Math.sign(d) * step;
        a.t += dt;
        if (a.to !== null) frame = mob ? Math.floor(a.t * 6) % 2 : 1 + (Math.floor(a.t / 0.22) % 2);
      } else if (a.pose === 'crouch') frame = mob ? 2 : 4;
      let y = GROUND_Y;
      if (a.jumpT !== null) {
        a.jumpT += dt;
        const k = Math.min(1, a.jumpT / ACTOR_JUMP.time);
        y -= Math.sin(Math.PI * k) * ACTOR_JUMP.h;
        if (!mob) frame = 3;
        if (k >= 1) { a.jumpT = null; if (a.pose === 'jump') a.pose = null; }
      }
      if (mob) {
        (a.root as Phaser.GameObjects.Sprite).setFrame(frame).setPosition(a.x, y + 1).setFlipX(a.face > 0);
      } else {
        const root = a.root as Phaser.GameObjects.Container;
        root.setPosition(a.x, y).setScale(AVATAR_SCALE * a.face, AVATAR_SCALE);
        for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setFrame(frame);
      }
      a.label.setPosition(a.x, GROUND_Y + 6);
    }
  }

  /** 길 안내: 하는 중인 퀘스트의 목적지(다른 맵이면 그쪽 포탈) 방향으로 머리 위 화살표 */
  private drawGuide(meX: number, meFeet: number) {
    const g = this.guideG;
    g.clear();
    if (this.cut.running || !this.uiOn || this.deps.session.me().downT > 0) return;
    const { session } = this.deps, save = session.save, here = session.world.mapId;
    let tx: number | null = null;
    for (const q of QUESTS) {
      if (!save.quests[q.id]?.active) continue;
      const t = questTarget(save, q);
      if (!t) continue;
      if (t.map !== here) tx = nextPortal(save, here, t.map)?.x ?? null;
      else tx = t.x ?? null;
      if (tx !== null) break;
    }
    // 하는 퀘스트가 없으면: 다음 퀘스트를 줄 이야기 NPC 쪽으로
    if (tx === null && !QUESTS.some(q => save.quests[q.id]?.active && !q.repeat)) {
      for (const id of Object.keys(TALK_NPCS)) {
        if (!TALK_NPCS[id].guide || !offersQuest(save, id, session.nowMs())) continue;
        const t = npcPlace(id, save);
        if (!t) continue;
        tx = t.map !== here ? nextPortal(save, here, t.map)?.x ?? null : t.x;
        if (tx !== null) break;
      }
    }
    if (tx === null || Math.abs(tx - meX) < GUIDE.hideWithin) return;
    const dir = tx > meX ? 1 : -1, bob = Math.sin(this.time.now / 150) * 3 * dir;
    const x = meX + dir * 26 + bob, y = meFeet - AVATAR_HEAD - 2;
    g.fillStyle(GUIDE.color).lineStyle(2, 0x3a2a00).beginPath()
      .moveTo(x + dir * 9, y).lineTo(x - dir * 5, y - 8).lineTo(x - dir * 5, y + 8).closePath().fillPath().strokePath();
  }

  /** 머리 위 말풍선 띄우기. who = 'player' 또는 'npc:<NPC id>' */
  say(who: string, text: string, life = 3) {
    let b = this.bubbles.get(who);
    if (!b) { b = new SpeechBubble(this, this.zoom); this.bubbles.set(who, b); }
    b.show(text, life);
  }

  /** 말풍선 위치 갱신 + 대화 NPC 에 다가가면 말풍선 */
  private updateSpeech(dt: number, meX: number, meFeet: number) {
    const { save: sv, world: wd } = this.deps.session;
    for (const n of mapNpcs(sv, wd.mapId)) {
      const talk = TALK_NPCS[n.id];
      if (!talk?.bubble) continue;
      const near = Math.abs((this.actorX(`npc:${n.id}`) ?? n.x) - meX) < NPC_BUBBLE_RANGE;
      if (near && !this.npcNear.get(n.id)) this.say(`npc:${n.id}`, talk.bubble.text, talk.bubble.life);
      this.npcNear.set(n.id, near);
    }
    for (const [who, b] of this.bubbles) {
      if (who === 'player') { b.update(dt, meX, meFeet - AVATAR_HEAD - 4); continue; }
      const a = this.actors.get(who);
      if (a) {
        const lift = a.jumpT !== null ? Math.sin(Math.PI * Math.min(1, a.jumpT / ACTOR_JUMP.time)) * ACTOR_JUMP.h : 0;
        b.update(dt, a.x, GROUND_Y - lift - (a.kind === 'mob' ? MOB_HEAD : AVATAR_HEAD) - 4);
        continue;
      }
      const n = mapNpcs(sv, wd.mapId).find(o => `npc:${o.id}` === who);
      if (n) b.update(dt, n.x, GROUND_Y - AVATAR_HEAD - 4);
      else b.hide();
    }
  }

  private addFloat(x: number, y: number, text: string, color: string, size = 18, life = 0.9) {
    const t = this.text(text, size, color).setOrigin(0.5, 1).setPosition(x + (Math.random() - 0.5) * 14, y).setDepth(9);
    this.floats.push({ t, age: 0, life });
  }

  /** 몬스터 (3단계에서 스프라이트로 교체) */
  private drawEnemies(dt: number) {
    const g = this.combat, world = this.deps.session.world;
    g.clear();
    const alive = new Set<string>();
    for (const e of world.enemies) {
      const fl = Math.max(0, (this.flash.get(e.id) ?? 0) - dt);
      this.flash.set(e.id, fl);
      let label = this.enemyLabels.get(e.id);
      if (e.dead && e.deadT > 0.35) { label?.setVisible(false); continue; }
      alive.add(e.id);
      const alpha = e.dead ? 1 - e.deadT / 0.35 : 1;
      let sp = this.enemySprites.get(e.id);
      if (!sp) {
        // 원소 슬라임은 회색 슬라임에 원소 색을 입힌다
        sp = this.add.sprite(0, 0, mobTexture(e.mob, e.elem), 0).setOrigin(0.5, 1).setDepth(4);
        // 슬라임은 1.45배, 임시 그림 몬스터는 몸 높이에 맞춤
        sp.setScale(e.mob === 'slime' || e.mob === 'slime_elem' ? 1.45 : MONSTERS[e.mob].h / sp.frame.height);
        if (e.elem) sp.setTint(hex(ELEMENTS[e.elem].color));
        this.enemySprites.set(e.id, sp);
      }
      // 프레임 (유저 지정): 0 = 기본, 1 = 이동(0과 번갈아), 2 = 점프 준비 자세
      let frame = 0;
      if (e.leap === 'crouch') frame = 2;
      else if (e.onGround && e.stun <= 0 && Math.abs(e.vx) > 1) frame = Math.floor(this.time.now / 1000 * 6 + e.spawnX) % 2;
      // 웅크릴 때 부들부들 떨림 (점프 예고)
      const shiver = e.leap === 'crouch' ? Math.sin(this.time.now / 25) * 1.5 : 0;
      sp.setFrame(frame).setVisible(true).setAlpha(alpha)
        .setPosition(e.x + e.w / 2 + shiver, e.y + e.h + 1)
        .setFlipX(e.dir > 0);
      if (fl > 0) sp.setTintFill(0xffffff);
      else if (e.elem) sp.setTint(hex(ELEMENTS[e.elem].color));
      else if (e.groggy && e.groggy > 0) sp.setTint(0x8090b0);
      else sp.clearTint();
      if (!label) {
        label = this.text(e.elem ? `${ELEMENTS[e.elem].name} 슬라임` : MONSTERS[e.mob].name, 11, '#ffffff').setStroke('#000', 2).setOrigin(0.5, 0).setDepth(4);
        this.enemyLabels.set(e.id, label);
      }
      label.setVisible(true).setAlpha(alpha * 0.85).setPosition(e.x + e.w / 2, e.y + e.h + 3);
      if (e.hp < e.maxHp && !e.dead) {
        g.fillStyle(0x000000, 0.6).fillRect(e.x, e.y - 10, e.w, 5);
        g.fillStyle(0xff5050).fillRect(e.x, e.y - 10, e.w * Math.max(0, e.hp / e.maxHp), 5);
      }
      // 마지막으로 맞은 원소 (원소 반응 힌트)
      if (e.record && !e.dead) {
        g.fillStyle(hex(ELEMENTS[e.record].color)).fillCircle(e.x + e.w / 2, e.y - 20, 6);
        g.lineStyle(1.5, 0xffffff).strokeCircle(e.x + e.w / 2, e.y - 20, 6);
      }
    }
    // 보스 방 보안장치 (푸른 오브): 조준 중이면 고정된 방향으로 조준선, 탄
    if (world.orb) {
      const o = world.orb;
      if (o.dir) {
        const a = 0.35 + 0.35 * Math.abs(Math.sin(this.time.now / 60));
        g.lineStyle(3, 0x6ec8ff, a).lineBetween(o.x, o.y, o.x + o.dir.x * 1600, o.y + o.dir.y * 1600);
      }
      g.fillStyle(0x2a3a5a).fillRect(o.x - 26, o.y - 40, 52, 14);
      g.fillStyle(0x6ec8ff, o.dir ? 1 : 0.75).fillCircle(o.x, o.y, 16);
      g.lineStyle(2, 0xe0f6ff).strokeCircle(o.x, o.y, 16);
    }
    for (const s of world.orbShots) {
      g.fillStyle(0x6ec8ff).fillCircle(s.x, s.y, BOSS_ORB.r);
      g.fillStyle(0xe0f6ff).fillCircle(s.x, s.y, BOSS_ORB.r * 0.5);
    }
    for (const [id, t] of this.enemyLabels) if (!alive.has(id)) t.setVisible(false);
    for (const [id, sp] of this.enemySprites) if (!alive.has(id)) sp.setVisible(false);

    // 골드: 금액에 따라 동전·철전·은전·금전 그림이 계속 돎, 사라지기 5초 전부터 깜빡임
    const drops = new Set<string>(), coins = new Set<string>();
    const frame = Math.floor(this.time.now / 1000 * COIN_ANIM.fps) % COIN_ANIM.frames;
    for (const c of world.coins) {
      const blink = c.t > COIN.life - COIN.blinkLast && Math.floor(c.t * 8) % 2 === 1;
      if (c.item) { drops.add(c.id); this.drawDrop(c.id, c.item, c.x + c.w / 2, c.y + c.h, c.t, blink); continue; }
      coins.add(c.id);
      const key = `coin:${coinKind(c.amt)}`;
      let sp = this.coinSprites.get(c.id);
      if (!sp) {
        sp = this.add.sprite(0, 0, key, 0).setOrigin(0.5, 1).setDepth(4.5).setScale(COIN_ANIM.scale);
        this.coinSprites.set(c.id, sp);
      } else if (sp.texture.key !== key) sp.setTexture(key, 0);
      sp.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      sp.setPosition(c.x + c.w / 2, c.y + c.h).setFrame(frame).setVisible(!blink);
    }

    for (const [id, sp] of this.coinSprites) if (!coins.has(id)) { sp.destroy(); this.coinSprites.delete(id); }
    for (const [id, d] of this.dropSprites) if (!drops.has(id)) { d.obj.destroy(); this.dropSprites.delete(id); }

    const me = this.deps.session.me();
    // 천붕 준비: 몸 주위 원
    if (me.cbWindow > 0 && me.data.learned.cheonbung !== undefined) {
      const el = me.data.learned.cheonbung;
      g.fillStyle(el ? hex(ELEMENTS[el].color) : 0xffffff, 0.3).fillCircle(me.x + me.w / 2, me.y + me.h / 2, 34);
    }
  }

  /** 떨어진 물건: 아이콘 그림(없으면 이모지)이 바닥 위에서 살짝 위아래로 흔들림. (x, y) = 아래 가운데 */
  private drawDrop(id: string, item: string, x: number, y: number, t: number, blink: boolean) {
    let d = this.dropSprites.get(id);
    if (!d || d.item !== item) {
      d?.obj.destroy();
      const img = itemDef(item)?.img, key = `ico:${img}`;
      const obj = img && this.textures.exists(key)
        ? this.add.image(0, 0, key).setOrigin(0.5, 1)
        : this.add.text(0, 0, itemDef(item)?.icon ?? '?', { fontSize: '22px' }).setOrigin(0.5, 1).setResolution(this.zoom);
      if (obj instanceof Phaser.GameObjects.Image) obj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
      d = { item, obj: obj.setDepth(4.6) };
      this.dropSprites.set(id, d);
    }
    d.obj.setPosition(x, y - 2 - 3 * (1 + Math.sin(t * 4))).setVisible(!blink);
  }

  /** 투사체·소용돌이 + 내 캐릭터 주변 표시 (마법진, 충전 바, 조준, 사슬) */
  private drawCombat(px: number, py: number) {
    const g = this.projG, u = this.underG, world = this.deps.session.world, me = this.deps.session.me();
    const t = this.time.now / 1000;
    g.clear(); u.clear();
    const elCol = (e: import('@shared/data/elements').Element | null | undefined) => (e ? hex(ELEMENTS[e].color) : 0xdddddd);

    for (const v of world.vortices) {
      const p = v.t / v.life, al = Math.min(1, (1 - p) * 2), c = hex(v.color);
      g.fillStyle(0x140a28, 0.55 * al).fillCircle(v.x, v.y, 30 + 10 * Math.sin(v.t * 20));
      for (let i = 0; i < 3; i++) {
        const a0 = v.t * 9 + i * 2.1;
        g.lineStyle(3, c, al).beginPath().arc(v.x, v.y, 45 + i * 22, a0, a0 + 1.8).strokePath();
      }
      g.lineStyle(3, c, 0.15 * al).strokeCircle(v.x, v.y, v.r);
    }

    for (const o of world.projectiles) {
      const c = elCol(o.elem);
      if (o.kind === 'orb') {
        g.fillStyle(c, 0.33).fillCircle(o.x, o.y, 13);
        g.fillStyle(c).fillCircle(o.x, o.y, 8);
        g.fillStyle(0xffffff).fillCircle(o.x, o.y, 3);
        continue;
      }
      // 화살: 진행 방향으로 회전한 막대 + 화살촉
      const L = o.len ?? 26, th = o.kind === 'big' ? 10 : 4;
      const cos = Math.cos(o.ang), sin = Math.sin(o.ang);
      const pt = (lx: number, ly: number) => ({ x: o.x + lx * cos - ly * sin, y: o.y + lx * sin + ly * cos });
      const quad = (x0: number, y0: number, x1: number, y1: number, col: number, al: number) => {
        g.fillStyle(col, al).fillPoints([pt(x0, y0), pt(x1, y0), pt(x1, y1), pt(x0, y1)], true);
      };
      if (o.kind === 'big') quad(-L, -th * 1.6, L * 0.4, th * 1.6, c, 0.27);
      quad(-L, -th / 2, 0, th / 2, c, 1);
      g.fillStyle(c).fillPoints([pt(4, 0), pt(-6, -th - 3), pt(-6, th + 3)], true);
    }

    const x = px, y = py, a = me.action;
    // 사슬 화살: 날아가는 화살 / 끌려가는 지점까지 밧줄
    const to = me.ropeTo ?? (me.chainArrow && !me.chainArrow.dead ? me.chainArrow : null);
    if (to) g.lineStyle(2, 0xe8dcb0).lineBetween(x + me.w / 2, y + me.h / 2, to.x, to.y);
    // 마력 해방 중: 몸 주위 원
    if (me.buffT > 0) g.lineStyle(2, 0xc8b8ff, 0.5 + 0.3 * Math.sin(t * 10)).strokeCircle(x + me.w / 2, y + me.h / 2, 32);
    if (!a) return;

    if (a.cast) {
      // 캐스팅: 발밑에서 도는 마법진 + 캐스팅 바
      const col = elCol(a.skill ? me.data.learned[a.skill] : null), mx = x + me.w / 2, my = y + me.h;
      const ring = (ang: number) => ({ x: mx + Math.cos(ang) * 40, y: my + Math.sin(ang) * 40 * 0.3 });
      u.lineStyle(3, col).strokeEllipse(mx, my, 80, 24);
      const rot = t * 3, star = [];
      for (let i = 0; i < 6; i++) star.push(ring(rot + (i * Math.PI * 2 / 6) * 2));
      u.strokePoints(star, true);
      const f = Math.min(1, a.t / (a.castEnd ?? a.dur));
      if (f < 1) {
        g.fillStyle(0x000000, 0.67).fillRect(x - 8, y - 14, me.w + 16, 5);
        g.fillStyle(col).fillRect(x - 8, y - 14, (me.w + 16) * f, 5);
      }
    }
    if (a.name === 'charge') {
      // 충전 바 (가득 차면 깜빡임)
      const col = elCol(a.elem), gv = a.g ?? 0;
      g.fillStyle(0x000000, 0.67).fillRect(x - 10, y - 14, me.w + 20, 6);
      g.fillStyle(gv >= 1 && Math.floor(t * 12) % 2 ? 0xffffff : col).fillRect(x - 10, y - 14, (me.w + 20) * gv, 6);
    }
    if (a.name === 'aim') {
      // 조준: 부채꼴 + 점선
      const col = elCol(a.elem), ox = x + me.w / 2, oy = y + me.h / 2, R = 300, m = a.maxAng ?? 1;
      const base = me.face > 0 ? 0 : Math.PI;
      g.fillStyle(col, 0.13).slice(ox, oy, R, base - m, base + m).fillPath();
      const ang = me.face > 0 ? a.ang ?? 0 : Math.PI - (a.ang ?? 0);
      g.lineStyle(4, col, 0.9);
      for (let d = 0; d < R; d += 16) {
        const e = Math.min(R, d + 10);
        g.lineBetween(ox + Math.cos(ang) * d, oy + Math.sin(ang) * d, ox + Math.cos(ang) * e, oy + Math.sin(ang) * e);
      }
    }
  }

  /** 그림이 아직 없는 몬스터의 임시 그림 (왼쪽을 봄, 프레임 0 기본 · 1 이동 · 2 패턴 예고) */
  private makeTempMobs() {
    const make = (key: string, fw: number, fh: number, draw: (r: (x: number, y: number, w: number, h: number, c: string) => void, f: number) => void) => {
      const c = document.createElement('canvas');
      c.width = fw * 3; c.height = fh;
      const ctx = c.getContext('2d')!;
      for (let f = 0; f < 3; f++) draw((x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(f * fw + x, y, w, h); }, f);
      const tex = this.textures.addCanvas(key, c)!;
      for (let f = 0; f < 3; f++) tex.add(f, 0, f * fw, 0, fw, fh);
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    // 경비기계A: 홀쭉한 몸 + 외눈 + 두 다리
    make('guard_a', 32, 36, (r, f) => {
      r(15, 0, 2, 5, '#9aa3ad'); r(14, 0, 4, 2, '#e0484a');
      r(7, 5, 18, 14, '#1d2128'); r(8, 6, 16, 12, '#6f7c8a'); r(8, 6, 16, 3, '#8d9aa8');
      r(9, 10, 8, 4, '#1d2128'); r(10, 11, 4, 2, f === 2 ? '#ffd0d0' : '#ff4a4a');
      r(9, 19, 14, 9, '#1d2128'); r(10, 20, 12, 7, '#56616e');
      const k = f === 1 ? 2 : 0;
      r(10 - k, 28, 4, 8, '#1d2128'); r(18 + k, 28, 4, 8, '#1d2128');
      r(11 - k, 28, 2, 7, '#8d9aa8'); r(19 + k, 28, 2, 7, '#8d9aa8');
    });
    // 경비기계B: 넓적한 몸 + 쌍눈 + 앞으로 내민 충각, 바퀴
    make('guard_b', 40, 40, (r, f) => {
      r(6, 6, 30, 22, '#1d1a14'); r(7, 7, 28, 20, '#a07a3a'); r(7, 7, 28, 4, '#c49a52');
      r(10, 12, 12, 5, '#1d1a14');
      const eye = f === 2 ? '#fff2a0' : '#ffb020';
      r(11, 13, 4, 3, eye); r(17, 13, 4, 3, eye);
      r(0, 18, 8, 5, '#1d1a14'); r(1, 19, 7, 3, '#c9ccd2');
      r(6, 28, 30, 6, '#1d1a14');
      const off = f === 1 ? 1 : 0;
      for (let i = 0; i < 3; i++) { r(8 + i * 10, 32, 8, 8, '#1d1a14'); r(10 + i * 10 - off, 34, 4, 4, '#6b6f78'); }
    });
  }

  /** 공방 지하·골렘 임시 그림 (왼쪽을 봄) */
  private makeTempMobs2() {
    const make = (key: string, fw: number, fh: number, draw: (r: (x: number, y: number, w: number, h: number, c: string) => void, f: number) => void) => {
      const c = document.createElement('canvas');
      c.width = fw * 3; c.height = fh;
      const ctx = c.getContext('2d')!;
      for (let f = 0; f < 3; f++) draw((x, y, w, h, col) => { ctx.fillStyle = col; ctx.fillRect(f * fw + x, y, w, h); }, f);
      const tex = this.textures.addCanvas(key, c)!;
      for (let f = 0; f < 3; f++) tex.add(f, 0, f * fw, 0, fw, fh);
      tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    };
    // 경비기계C: 뚜벅이, 두꺼운 몸 + 큰 다리
    make('guard_c', 36, 42, (r, f) => {
      r(6, 2, 24, 20, '#15181d'); r(7, 3, 22, 18, '#4f6a5c'); r(7, 3, 22, 4, '#6f8f7c');
      r(8, 9, 10, 5, '#15181d'); r(9, 10, 8, 3, f === 2 ? '#d0ffd8' : '#5dff8a');
      r(9, 22, 18, 8, '#15181d'); r(10, 23, 16, 6, '#3b5046');
      const k = f === 1 ? 2 : 0;
      r(8 - k, 30, 8, 12, '#15181d'); r(20 + k, 30, 8, 12, '#15181d');
      r(9 - k, 31, 6, 10, '#6f8f7c'); r(21 + k, 31, 6, 10, '#6f8f7c');
    });
    // 경비기계D: 작은 비행 기계, 프로펠러
    make('guard_d', 24, 18, (r, f) => {
      const p = f === 1 ? 2 : 0;
      r(2 + p, 0, 20 - p * 2, 2, '#9aa3ad'); r(11, 2, 2, 3, '#15181d');
      r(4, 5, 16, 10, '#15181d'); r(5, 6, 14, 8, '#7a6aa8'); r(5, 6, 14, 2, '#9a8ac8');
      r(6, 9, 5, 3, f === 2 ? '#ffd0ff' : '#ff6ad8');
      r(8, 15, 2, 3, '#15181d'); r(14, 15, 2, 3, '#15181d');
    });
    // 마법 골렘: 큰 돌 몸 + 가운데 마력 결정
    make('golem', 58, 88, (r, f) => {
      r(10, 0, 34, 24, '#1b1a20'); r(11, 1, 32, 22, '#6b6470'); r(11, 1, 32, 5, '#857d8a');
      r(13, 10, 9, 5, '#1b1a20'); r(14, 11, 7, 3, f === 2 ? '#e0f6ff' : '#6ec8ff');
      r(2, 24, 54, 38, '#1b1a20'); r(3, 25, 52, 36, '#5c5662'); r(3, 25, 52, 6, '#766f7c');
      r(22, 34, 14, 16, '#1b1a20'); r(24, 36, 10, 12, f === 2 ? '#c8f0ff' : '#4aa8ff');
      const arm = f === 2 ? -8 : 0;
      r(0, 28 + arm, 10, 30, '#1b1a20'); r(1, 29 + arm, 8, 28, '#6b6470');
      r(48, 28, 10, 30, '#1b1a20'); r(49, 29, 8, 28, '#6b6470');
      const k = f === 1 ? 3 : 0;
      r(8 - k, 62, 16, 26, '#1b1a20'); r(34 + k, 62, 16, 26, '#1b1a20');
      r(9 - k, 63, 14, 24, '#5c5662'); r(35 + k, 63, 14, 24, '#5c5662');
    });
  }

  /** 원소 슬라임용: 초록 슬라임을 밝은 회색으로 바꾼 텍스처 (색을 입히면 원소 색이 됨) */
  private makeGraySlime() {
    const src = this.textures.get('slime').getSourceImage() as HTMLImageElement;
    const c = document.createElement('canvas');
    c.width = src.width; c.height = src.height;
    const ctx = c.getContext('2d')!;
    ctx.drawImage(src, 0, 0);
    const img = ctx.getImageData(0, 0, c.width, c.height), d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      const l = 0.3 * d[i] + 0.59 * d[i + 1] + 0.11 * d[i + 2];
      const v = Math.min(255, l * 1.9);
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    ctx.putImageData(img, 0, 0);
    const tex = this.textures.addCanvas('slime_gray', c)!;
    for (let f = 0; f < 3; f++) tex.add(f, 0, f * 32, 0, 32, 32);
    tex.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.textures.get('slime').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /** 검기·원 퍼짐·잔상 */
  private drawFx(dt: number) {
    const g = this.fxG;
    g.clear();
    for (const o of this.fxList) {
      o.t += dt;
      const f = o.f, p = Math.min(1, o.t / f.life), al = 1 - p;
      if (f.kind === 'arc') {
        const lo = Math.min(f.a0, f.a1), hi = Math.max(f.a0, f.a1);
        // 왼쪽을 볼 때는 좌우 반전
        const s0 = f.face > 0 ? lo : Math.PI - hi, s1 = f.face > 0 ? hi : Math.PI - lo;
        g.lineStyle(f.w * (1 - p * 0.5), hex(f.color), al).beginPath().arc(f.x, f.y, f.r, s0, s1).strokePath();
        g.lineStyle(2, 0xffffff, al).beginPath().arc(f.x, f.y, f.r - 3, s0, s1).strokePath();
      } else if (f.kind === 'line') {
        g.lineStyle(f.w, hex(f.color), al).lineBetween(f.x1, f.y1, f.x2, f.y2);
      } else if (f.kind === 'ring') {
        g.lineStyle(5, hex(f.color), al).strokeCircle(f.x, f.y, f.r0 + (f.r1 - f.r0) * p);
      } else if (f.kind === 'ghost') {
        g.fillStyle(hex(f.color), 0.45 * al).fillRect(f.x, f.y + 8, f.w, f.h - 8);
      } else if (f.kind === 'pillar') {
        // 원소 기둥: 아래에서 솟아오름
        const hh = f.h * Math.min(1, o.t / 0.1), pa = p < 0.6 ? 0.9 : (1 - p) / 0.4 * 0.9;
        g.fillStyle(hex(f.color), pa).fillRect(f.x - f.w / 2, f.by - hh, f.w, hh);
        g.fillStyle(0xffffff, pa * 0.53).fillRect(f.x - f.w / 6, f.by - hh, f.w / 3, hh);
      } else if (f.kind === 'flame') {
        // 원소 파도 한 칸: 뾰족한 불길 4개
        const grow = Math.min(1, o.t / 0.08);
        g.fillStyle(hex(f.color), al);
        for (let i = 0; i < 4; i++) {
          const bx = f.x + i * f.w / 4, hh = f.h * grow * (0.6 + 0.4 * Math.abs(Math.sin(i * 1.7 + o.t * 20)));
          g.fillTriangle(bx, f.y, bx + f.w / 8, f.y - hh, bx + f.w / 4, f.y);
        }
      } else if (f.kind === 'zone') {
        g.fillStyle(hex(f.color), 0.18 * al).fillRect(f.x, 0, f.w, GROUND_Y);
      }
    }
    this.fxList = this.fxList.filter(o => o.t < o.f.life);
  }

  private updateFloats(dt: number) {
    for (const f of this.floats) {
      f.age += dt;
      f.t.y -= 40 * dt;
      f.t.setAlpha(f.age > f.life * 0.6 ? 1 - (f.age - f.life * 0.6) / (f.life * 0.4) : 1);
    }
    this.floats = this.floats.filter(f => { if (f.age < f.life) return true; f.t.destroy(); return false; });
  }

  private showBubble(x: number, y: number, s: string) {
    if (this.bubble.text !== s) this.bubble.setText(s);
    this.bubble.setPosition(x, y).setVisible(true);
  }

  private drawBackground(pal: ReturnType<typeof palette>) {
    const g = this.bg, W = this.viewW, H = VIEW_H, camX = this.camX;
    g.clear();
    // 배경 색만 쓰는 맵 (공방 지하 등)
    const solid = this.deps.session.world.map.bgColor;
    if (solid !== undefined) { g.fillStyle(solid).fillRect(0, 0, W, H); return; }
    g.fillGradientStyle(pal.top, pal.top, pal.mid, pal.mid, 1).fillRect(0, 0, W, H * 0.6);
    g.fillGradientStyle(pal.mid, pal.mid, pal.bot, pal.bot, 1).fillRect(0, H * 0.6, W, H * 0.4);
    if (pal.stars > 0.02) {
      g.fillStyle(0xffffff, pal.stars);
      for (const s of STARS) {
        const x = (((s.x - camX * 0.05) % 2600) + 2600) % 2600;
        if (x < W) g.fillRect(x, s.y, s.s, s.s);
      }
    }
    g.fillStyle(pal.orb).fillCircle(W - 140, pal.orbY, pal.phase === 2 ? 30 : 38);
    const px = camX * 0.25;
    for (let i = -1; i < 8; i++) {
      const bx = i * 520 - (px % 520);
      if (bx > W + 40) break;
      g.fillStyle(pal.castle)
        .fillRect(bx + 40, 250, 200, 220).fillRect(bx + 80, 170, 50, 300).fillRect(bx + 180, 200, 40, 270)
        .fillTriangle(bx + 70, 170, bx + 105, 110, bx + 140, 170)
        .fillTriangle(bx + 172, 200, bx + 200, 150, bx + 228, 200);
      if (pal.win > 0.02) {
        g.fillStyle(0xffdc78, pal.win);
        for (let wy = 0; wy < 4; wy++) for (let wx = 0; wx < 4; wx++) if ((wx + wy + i) % 3) g.fillRect(bx + 60 + wx * 40, 280 + wy * 38, 8, 12);
      }
    }
    const hx = camX * 0.5;
    g.fillStyle(pal.hill).beginPath().moveTo(0, H);
    for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, 400 + Math.sin((x + hx) / 140) * 25);
    g.lineTo(W + 20, H).closePath().fillPath();
  }

  private drawPortals() {
    const g = this.fx, t = this.time.now / 1000;
    g.clear();
    for (const p of mapPortals(this.deps.session.save, this.deps.session.world.mapId)) {
      const py = (p.y ?? GROUND_Y) - 48;
      g.fillStyle(0xa078ff, 0.25).fillEllipse(p.x, py, 48, 88);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(4, 0xbea0ff, 0.8 - i * 0.2);
        g.strokeEllipse(p.x, py, (26 - i * 6 + Math.sin(t * 4 + i) * 2) * 2, (46 - i * 8) * 2);
      }
    }
  }
}
