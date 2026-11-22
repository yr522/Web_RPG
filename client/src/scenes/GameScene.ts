// 게임 화면. Session 의 상태를 읽어서 그리기만 한다 (게임 규칙은 shared/ 에).
import Phaser from 'phaser';
import { GROUND_Y, MAP_BGM } from '@shared/data/maps';
import { CLASSES, DOYAK, GIDUNG, HINT, SOYONG_VISUAL_R } from '@shared/data/classes';
import type { Session } from '../session/LocalSession';
import type { Input } from '../input/Input';
import type { Hud } from '../hud/Hud';
import { palette, type Palette } from './palette';
import { professorMark } from '@shared/rules/progress';
import { playBgm } from '../audio/bgm';
import { achievementDef } from '@shared/data/achievements';
import { ELEMENTS, type Element } from '@shared/data/elements';
import type { Fx } from '@shared/sim/types';
import type { Enemy } from '@shared/sim/entities';

const hex = (c: string) => parseInt(c.slice(1, 7), 16);
/** 바닥에 떨어진 물건 그림의 화면 크기 (원본이 16·32·64 여도 이 크기로 맞춤) */
const DROP_ICON_PX = 32;
/** 폭죽 터지는 색 (임시 그림) */
const FIREWORK_COLORS = [0xff5a5a, 0xffd23a, 0x5ad2ff, 0xa8ff5a, 0xff7ae0, 0xffa040];
/** 버린 지 얼마 안 돼 못 줍는 물건 틴트 (살짝 붉게) */
const DROP_LOCK_TINT = 0xff9a9a;

import { ICON_URLS } from '../ui/icons';
import { FIREWORK, itemDef } from '@shared/data/items';
import { GATHER_NODES } from '@shared/data/gather';
import { VFX, createVfxAnims, preloadVfx, vfxKey } from './vfx';
import { AVATAR_HEAD, AVATAR_SCALE, PlayerAvatar, makeStaticAvatar, poseStaticAvatar, preloadAvatar } from './PlayerAvatar';
import { CutscenePlayer, type Stage } from '../story/CutscenePlayer';
import type { Motion } from '@shared/data/cutscenes';
import { QUESTS } from '@shared/data/quests';
import { companionNpc, npcPlace, questTarget } from '@shared/rules/quests';
import { mapNpcs, mapPickups, mapPortals, npcMark, offersQuest, selfMark, type QuestMark } from '@shared/rules/story';
import { nextPortal } from '@shared/rules/route';
import { SpeechBubble } from './SpeechBubble';
import { NPC_BUBBLE_RANGE, TALK_NPCS } from '@shared/data/npcs';
import slimeUrl from '../../../assets/img/sprites/enemies/01_slime/slime.png';
import honeySlimeUrl from '../../../assets/img/sprites/enemies/03_honeySlime/Honey_slime.png';
import { BOSS_ORB, ELITE, GOLEM_AI, GOLEM_NORMAL, COIN, COIN_ANIM, COIN_KINDS, MONSTERS, coinKind, type MonsterId } from '@shared/data/monsters';
import { GOLEM_ART_H, GOLEM_DEATH_BOOM, GOLEM_DEATH_CRACK, GOLEM_DEATH_TIME, GOLEM_PARTS, golemPose, type GolemState } from './golemRig';
import coinBronze from '../../../assets/img/icon/coin/bronze_coin.png';
import coinIron from '../../../assets/img/icon/coin/iron_coin.png';
import coinSilver from '../../../assets/img/icon/coin/silver_coin.png';
import coinGold from '../../../assets/img/icon/coin/gold_coin.png';
import qmarkNew from '../../../assets/UI/speech_bubbles/exclamation_mark.png';
import qmarkDone from '../../../assets/UI/speech_bubbles/question_mark.png';
import qmarkTail from '../../../assets/UI/speech_bubbles/mark_tail.png';

/** 퀘스트 말풍선 (16×16 아이콘 + 16×20 꼬리, 같은 자리에 겹침) 화면 배율, NPC 머리 위 높이 */
const QMARK_SCALE = 2;
const QMARK_NPC_TOP = 108;

/** 마법 골렘 파츠 그림 (192×192 레이어별) */
const GOLEM_FILES = import.meta.glob('../../../assets/img/sprites/enemies/02_boss_Golem/golem_*.png', { eager: true, import: 'default' }) as Record<string, string>;
/** true 면 예전 임시 골렘 그림(네모 블록)을 씀 */
const GOLEM_OLD_LOOK = false;

/** 골드 동전 그림 (16×16 칸, 가로로 프레임) */
const COIN_URLS = { bronze: coinBronze, iron: coinIron, silver: coinSilver, gold: coinGold };

/** 화면 높이 (월드 좌표). 땅(470)이 화면 76% 높이에 오도록 해서 아래쪽 HUD에 캐릭터가 가리지 않게 한다. 폭은 화면 비율에 따라 720~1280 */
/** 맵 밖으로 더 그리는 땅 폭 (화면이 맵보다 넓을 때용) */
const EDGE = 400;
import { VIEW_H, VIEW_MAX_W } from '../ui/stage';
export { VIEW_H };
/** 세로로 긴 맵에서 카메라가 안 따라가는 범위: 발이 화면 위에서 이 비율 사이에 있으면 그대로 (벗어나면 따라감) */
const CAM_BAND = { top: 0.42, bottom: 0.8 };
const FONT = 'Pretendard, system-ui, sans-serif';
const ROBE: Record<string, number> = { warrior: 0x8a3a3a, mage: 0x4a3a8a, archer: 0x2f6a4a };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 977) % 2600, y: (i * 389) % 300, s: (i % 3) + 1 }));

export interface SceneDeps {
  loading?: import('../ui/Loading').Loading;
  session: Session; input: Input; hud: Hud; isTouch: boolean; openNpc: (id: string) => void;
  /** 예 / 아니오 묻기 */
  confirm: (text: string, yes: () => void) => void;
  /** 갈 곳 고르기 포탈 */
  choosePortal: (opts: { label: string; go: () => void }[]) => void;
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
  /** 그림 크기 배율 (대화 NPC 의 scale, 없으면 1) */
  scale?: number;
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

/** 슬라임 그림 배율: 몸 높이 1 당 (높이 30 일 때 1.45배). 몸이 커지면 그림도 같이 커짐 */
const SLIME_DRAW = 1.45 / 30;

/** 몬스터 그림: 원소 슬라임은 회색 슬라임(원소 색을 입힘), 나머지는 몬스터 id 그대로 */
function mobTexture(mob: MonsterId, elem: unknown) {
  if (mob === 'slime' || mob === 'slime_elem') return elem ? 'slime_gray' : 'slime';
  return MONSTERS[mob].look ?? mob;
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
  /** 시간대별 배경 그림 [아침, 낮, 밤], 그 위 건물 그림 (시간대에 따라 바꿈) */
  private timeBgs: Phaser.GameObjects.Image[] = [];
  private timeProps: Phaser.GameObjects.Image[] = [];
  private fx!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private mapLayer!: Phaser.GameObjects.Container;
  /** 배경 그림 없는 맵의 맵 밖 검정 */
  private edgeMask: Phaser.GameObjects.Graphics | null = null;
  private player!: PlayerAvatar;
  private nameTag!: Phaser.GameObjects.Text;
  /** 칭호 (이름 위, 달고 있을 때만) */
  private titleTag!: Phaser.GameObjects.Text;
  private bubble!: Phaser.GameObjects.Text;
  private floats: { t: Phaser.GameObjects.Text; age: number; life: number }[] = [];
  /** 내 머리 위 [?]·[✔] 말풍선 (혼자 하는 퀘스트, 누르면 혼잣말 대화) */
  private selfMark!: Phaser.GameObjects.Container;
  /** NPC id → 머리 위 퀘스트 말풍선 */
  private npcMarks = new Map<string, Phaser.GameObjects.Container>();
  /** 머리 위 말풍선: 'player' 또는 'npc:<id>' */
  private bubbles = new Map<string, SpeechBubble>();
  /** 다가오면 말풍선을 띄우는 NPC: 범위 안에 들어와 있는지 (나갔다 다시 와야 또 뜸) */
  private npcNear = new Map<string, boolean>();
  private camX = 0;
  private hitstop = 0;
  private shake = 0;
  private flash = new Map<string, number>();
  private fxList: { f: Fx; t: number }[] = [];
  /** 재생 중인 그림 이펙트 */
  private vfxSprites: { sp: Phaser.GameObjects.Sprite; follow: () => void }[] = [];
  /** 흘려베기 받아내는 중인 플레이어의 방패 그림 (색 층 + 흰 심) */
  private guardShields = new Map<string, Phaser.GameObjects.Sprite[]>();
  /** 마력 해방 중인 플레이어 뒤 마법진 */
  private haebangCircles = new Map<string, Phaser.GameObjects.Image>();
  /** 날아가는 화살 그림 (화살 id → 색 입힌 몸 + 흰 심) */
  private arrowSprites = new Map<string, Phaser.GameObjects.Sprite[]>();
  /** 사슬 화살로 끌려가는 동안 박혀 있는 작살 */
  private ropeHarpoon: Phaser.GameObjects.Sprite | null = null;
  /** 소용돌이 그림 (소용돌이 → 색 입힌 층 + 흰 심) */
  private vortexSprites = new Map<object, Phaser.GameObjects.Sprite[]>();
  /** 원소 기둥 토네이도 그림 (색 층 + 흰 심) */
  private tornadoSprites = new Map<object, Phaser.GameObjects.Sprite[]>();
  /** 정예몹 특성 오버레이 (몬스터 id + 특성 → 계속 도는 그림) */
  private eliteFx = new Map<string, Phaser.GameObjects.Sprite>();
  private combat!: Phaser.GameObjects.Graphics;
  private fxG!: Phaser.GameObjects.Graphics;
  /** 캐릭터 뒤에 그리는 것 (마법진) */
  private underG!: Phaser.GameObjects.Graphics;
  /** 투사체·소용돌이·충전 바·조준 */
  private projG!: Phaser.GameObjects.Graphics;
  private enemyLabels = new Map<string, Phaser.GameObjects.Text>();
  /** 허수아비 머리 위 초당 피해 */
  private dpsLabels = new Map<string, Phaser.GameObjects.Text>();
  private enemySprites = new Map<string, Phaser.GameObjects.Sprite>();
  /** 파츠로 움직이는 골렘 */
  private golemRigs = new Map<string, { c: Phaser.GameObjects.Container; parts: Phaser.GameObjects.Image[]; boomed: boolean }>();
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
    this.load.on('progress', (p: number) => this.deps.loading?.set(p));
    this.load.image('qmark:!', qmarkNew); this.load.image('qmark:?', qmarkDone); this.load.image('qmark:tail', qmarkTail);
    preloadAvatar(this);
    preloadVfx(this);
    // 슬라임: 32×32 칸 3개 (1 기본 · 2 이동 · 3 점프 준비)
    this.load.spritesheet('slime', slimeUrl, { frameWidth: 32, frameHeight: 32 });
    // 꿀 슬라임: 32×32 칸 5개 (1·2 이동 · 3·4 공격 · 5 죽음), 오른쪽을 봄
    this.load.spritesheet('honey_slime', honeySlimeUrl, { frameWidth: 32, frameHeight: 32 });
    for (const [path, url] of Object.entries(ICON_URLS)) this.load.image(`ico:${path}`, url);
    for (const k of COIN_KINDS) this.load.spritesheet(`coin:${k.img}`, COIN_URLS[k.img], { frameWidth: 16, frameHeight: 16 });
    for (const [path, url] of Object.entries(GOLEM_FILES)) this.load.image(path.split('/').pop()!.replace(/\.png$/, ''), url);
    for (const [path, url] of Object.entries(BG_FILES)) this.load.image(`bg:${path.split('/').pop()!.replace(/\.png$/, '')}`, url);
  }

  create() {
    createVfxAnims(this);
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
    this.titleTag = this.text('', 10, '#ffe066').setOrigin(0.5, 0).setDepth(6).setVisible(false);
    this.bubble = this.add.text(0, 0, '', {
      fontFamily: FONT, fontSize: '13px', color: '#222', backgroundColor: 'rgba(255,255,255,0.92)', padding: { x: 8, y: 4 },
    }).setOrigin(0.5, 1).setDepth(7).setVisible(false).setResolution(this.zoom);
    this.overlay = this.add.graphics().setScrollFactor(0).setDepth(10);
    this.selfMark = this.makeQuestMark().setDepth(7.5).setVisible(false);
    this.selfMark.getAt<Phaser.GameObjects.Image>(0).setInteractive({ useHandCursor: true });
    this.selfMark.getAt<Phaser.GameObjects.Image>(0).on('pointerdown', () => { if (!this.deps.input.blocked && !this.cut.running) void this.deps.talk('self'); });

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
    for (const t of this.dpsLabels.values()) t.destroy();
    this.dpsLabels.clear();
    for (const sp of this.enemySprites.values()) sp.destroy();
    this.enemySprites.clear();
    for (const r of this.golemRigs.values()) r.c.destroy();
    this.golemRigs.clear();
    for (const sp of this.eliteFx.values()) sp.destroy();
    this.eliteFx.clear();
    this.flash.clear();
    this.fxList = [];
    for (const o of this.vfxSprites) o.sp.destroy();
    this.vfxSprites = [];
    for (const l of this.guardShields.values()) l.forEach(sp => sp.destroy());
    this.guardShields.clear();
    for (const im of this.haebangCircles.values()) im.destroy();
    this.haebangCircles.clear();
    for (const l of this.arrowSprites.values()) l.forEach(sp => sp.destroy());
    this.arrowSprites.clear();
    this.ropeHarpoon?.destroy(); this.ropeHarpoon = null;
    for (const l of this.vortexSprites.values()) l.forEach(sp => sp.destroy());
    this.vortexSprites.clear();
    for (const l of this.tornadoSprites.values()) l.forEach(sp => sp.destroy());
    this.tornadoSprites.clear();
    const { world, save } = this.deps.session, map = world.map;
    // 배경 음악 (같은 곡이면 이어서)
    playBgm(MAP_BGM[world.mapId]);
    // 배경 그림이 없는 맵, 시간대 배경이 있어도 화면보다 짧은 맵: 맵 밖(양옆)은 검정
    if (!map.bg && (!map.bgTime || map.width < VIEW_MAX_W)) {
      const top = (map.top ?? 0) - 3000;
      const mask = this.add.graphics().fillStyle(0x000000).fillRect(-4000, top, 4000, 8000).fillRect(map.width, top, 4000, 8000);
      mask.setDepth(8);
      this.edgeMask?.destroy();
      this.edgeMask = mask;
    } else { this.edgeMask?.destroy(); this.edgeMask = null; }
    this.timeBgs = []; this.timeProps = [];
    // 시간대별 배경 그림 (맨 뒤, NPC·간판보다 먼저): 맵 폭에 맞춰 늘리고, 그림 속 땅 줄이 땅 높이에 오게. 그 위에 건물 등
    if (map.bgTime && map.bgTime.imgs.every(i => this.textures.exists(`bg:${i}`))) {
      for (const img of map.bgTime.imgs) {
        const im = this.add.image(0, 0, `bg:${img}`).setOrigin(0, 0);
        // 그림 맨 아래 = 화면 맨 아래, 바닥 타일 윗면 = 땅 높이. 맵 가운데에
        const sc = (VIEW_H - GROUND_Y) / (im.height - map.bgTime.groundY);
        im.setScale(sc).setPosition((map.width - im.width * sc) / 2, GROUND_Y - map.bgTime.groundY * sc).setVisible(false);
        this.mapLayer.add(im);
        this.timeBgs.push(im);
      }
      for (const pr of map.props ?? []) {
        if (!this.textures.exists(`bg:${pr.img}`)) continue;
        const im = this.add.image(pr.x, GROUND_Y, `bg:${pr.img}`);
        im.setOrigin(0.5, pr.groundY / im.height).setScale(pr.scale);
        this.mapLayer.add(im);
        this.timeProps.push(im);
      }
    }
    // 배경 그림 (맨 뒤, NPC·간판보다 먼저): 그림 속 땅 줄이 땅 높이에 오게
    if (map.bg && this.textures.exists(`bg:${map.bg.img}`)) {
      // 화면이 그림보다 넓을 때 양옆이 하늘색으로 비지 않게 어둡게 채움
      // 세로로 긴 맵은 그림 맨 위가 맵 맨 위에 오게
      const top = map.top ?? 0;
      const eg = this.add.graphics();
      this.mapLayer.add(eg);
      eg.fillStyle(0x0c1420).fillRect(-EDGE, top - EDGE, EDGE, GROUND_Y - top + EDGE).fillRect(map.width, top - EDGE, EDGE, GROUND_Y - top + EDGE);
      // 땅도 그림 뒤에 (그림이 땅 아래까지 그려져 있으면 그림이 보이고, 그림이 끝난 아래는 땅 색)
      for (const p of world.solids) if (p.ground) eg.fillStyle(0x2b2a3f).fillRect(-EDGE, p.y, map.width + EDGE * 2, p.h);
      this.mapLayer.add(this.add.image(0, top, `bg:${map.bg.img}`).setOrigin(0, 0).setScale((GROUND_Y - top) / map.bg.groundY));
    }
    const g = this.add.graphics();
    this.mapLayer.add(g);

    for (const p of world.solids) {
      // 배경 그림 맵은 땅이 그림에 있음 (그림 밖은 위에서 그림 뒤에 칠함)
      if (p.ground && (map.bgTime || map.bg)) continue;
      if (p.ground) {
        // 화면이 맵보다 넓을 때(아주 넓은 화면) 양옆이 비지 않게 땅을 맵 밖까지 그린다
        g.fillStyle(0x2b2a3f).fillRect(-EDGE, p.y, map.width + EDGE * 2, p.h);
        g.fillStyle(0x4a7a4a).fillRect(-EDGE, p.y, map.width + EDGE * 2, 6);
      }
    }
    // 발판은 배경 그림 위에 그림
    const plat = this.add.graphics();
    for (const p of world.solids) {
      if (p.ground) continue;
      plat.fillStyle(0x6b5640).fillRect(p.x, p.y, p.w, p.h);
      plat.fillStyle(0x8fae6a).fillRect(p.x, p.y, p.w, 4);
    }
    this.mapLayer.add(plat);
    for (const s of map.signs) {
      g.fillStyle(0x5a4630).fillRect(s.x - 3, GROUND_Y - 50, 6, 50);
      g.fillStyle(0x7a6040).fillRect(s.x - 75, GROUND_Y - 74, 150, 28);
      this.mapLayer.add(this.text(s.text, 14, '#fff3d0').setStroke('#000', 0).setOrigin(0.5).setPosition(s.x, GROUND_Y - 60));
    }
    this.mapSig = this.visibleSig();
    for (const pt of mapPortals(save, world.mapId, world.cleared)) {
      this.mapLayer.add(this.text(pt.label, 12, '#e8dcff').setOrigin(0.5, 1).setPosition(pt.x, (pt.y ?? GROUND_Y) - 98));
    }
    this.npcMarks.clear();
    for (const a of this.actors.values()) if (a.kind === 'mob') { a.root.destroy(); a.label.destroy(); }
    this.actors.clear();
    for (const n of mapNpcs(save, world.mapId)) {
      const x = n.x, y = GROUND_Y;
      // 터치·클릭으로 대화
      const zone = this.add.zone(x, y - 55, n.id === 'shop' ? 132 : n.id === 'bed' ? 190 : 80, n.id === 'bed' ? 110 : 125).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => {
        if (this.deps.input.blocked) return;
        const me = this.deps.session.me();
        if (Math.abs(me.x + me.w / 2 - x) < 280) this.deps.openNpc(n.id);
        else this.deps.hud.toast('더 가까이 가자');
      });
      this.mapLayer.add(zone);
      if (n.id === 'prof') {
      }
      if (n.id === 'prof' || (TALK_NPCS[n.id] && TALK_NPCS[n.id].prop !== 'bed')) {
        const qm = this.makeQuestMark().setPosition(x, GROUND_Y - QMARK_NPC_TOP).setVisible(false);
        this.mapLayer.add(qm);
        this.npcMarks.set(n.id, qm);
      }
      // 교수님은 이야기 대사가 있어도 그림은 교수님 그대로
      const talk = n.id === 'prof' || n.id === 'smith' || n.id === 'shop' ? undefined : TALK_NPCS[n.id];
      if (talk?.prop === 'bed') {
        // 침대: 그림은 배경에 있음. 눈에 안 보이는 NPC (클릭·↑ 자리만)
        continue;
      }
      if (talk) {
        // 대화 NPC: 임시로 뼈대 그림, 플레이어 쪽(왼쪽)을 봄
        const root = makeStaticAvatar(this, x, y, -1), label = this.text(talk.name, 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6);
        if (talk.tint !== undefined) for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setTint(talk.tint);
        if (talk.scale) root.setScale(AVATAR_SCALE * -1 * talk.scale, AVATAR_SCALE * talk.scale);
        this.mapLayer.add(root);
        this.mapLayer.add(label);
        this.actors.set(`npc:${n.id}`, { kind: 'npc', root, label, elem: null, home: x, x, face: -1, to: null, speed: 0, pose: null, t: 0, jumpT: null, scale: talk.scale });
        continue;
      }
      if (n.id === 'storage') {
        // 창고지기 (임시): 상자 + 뼈대 그림
        g.fillStyle(0x6b4a2a).fillRect(x - 78, y - 34, 40, 34).fillRect(x + 40, y - 26, 30, 26);
        g.fillStyle(0x8a6438).fillRect(x - 80, y - 38, 44, 6);
        const root = makeStaticAvatar(this, x, y, -1), label = this.text('창고지기', 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6);
        for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setTint(0xa0b0c8);
        this.mapLayer.add(root);
        this.mapLayer.add(label);
        this.actors.set(`npc:${n.id}`, { kind: 'npc', root, label, elem: null, home: x, x, face: -1, to: null, speed: 0, pose: null, t: 0, jumpT: null });
        continue;
      }
      if (n.id === 'smith') {
        // 대장장이 (임시): 모루 + 뼈대 그림
        g.fillStyle(0x3d3d44).fillRect(x - 70, y - 26, 44, 10).fillRect(x - 60, y - 16, 24, 16);
        g.fillStyle(0x55555e).fillRect(x - 78, y - 30, 20, 6);
        const root = makeStaticAvatar(this, x, y, -1), label = this.text('대 장장이', 12, '#fff').setOrigin(0.5, 0).setPosition(x, y + 6);
        for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setTint(0xc89a7a);
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
    return mapNpcs(save, world.mapId).map(n => n.id + n.x).join() + '|' + mapPortals(save, world.mapId, world.cleared).map(p => p.to + p.x).join();
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
    const tint = TALK_NPCS[id]?.tint;
    if (tint !== undefined) for (const sp of root.list as Phaser.GameObjects.Sprite[]) sp.setTint(tint);
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

  /**
   * 시간대별 배경 그림 섞기 + 건물·땅 색. 아래쪽 그림은 다 보이게 두고 위쪽 그림의 투명도로 섞는다
   * (둘 다 반투명이면 뒤의 하늘이 비쳐서)
   */
  private applyTimeOfDay(pal: Palette) {
    if (this.timeBgs.length === 3) {
      const cur = pal.phase, next = pal.next, f = pal.f;
      this.timeBgs.forEach((im, i) => {
        let a = 0;
        if (next > cur) a = i === cur ? 1 : i === next ? f : 0;
        else a = i === next ? 1 : i === cur ? 1 - f : 0;
        if (i === cur && f === 0) a = 1;
        im.setVisible(a > 0).setAlpha(a);
      });
    }
    for (const im of this.timeProps) im.setTint(pal.imgTint);
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
    if (this.deps.loading) { this.deps.loading.done(); this.deps.loading = undefined; } // 첫 화면이 그려졌으니 로딩 화면을 지움
    // Phaser 의 delta 는 튀는 값을 깎아서 느린 기기에서 게임이 느려진다 → 실제 경과 시간을 직접 잰다
    const nowMs = performance.now();
    const dt = Math.min(0.25, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    hud.minimap.draw(session.world, session.save, session.nowMs(), dt);
    // 타격감: 맞는 순간 아주 잠깐 멈칫(hitstop)
    this.cut.update(dt);
    const events = this.hitstop > 0 ? [] : session.update(dt, () => this.cut.command() ?? input.readCommand());
    this.hitstop = Math.max(0, this.hitstop - dt);
    for (const ev of events) {
      if (ev.type === 'mapEnter') { this.buildMap(); hud.showBanner(session.world.map.name); }
      if (ev.type === 'notice') hud.toast(ev.text);
      if (ev.type === 'interact') this.deps.openNpc(ev.npc);
      if (ev.type === 'portal' && ev.choose) this.deps.choosePortal(ev.choose.map(c => ({ label: c.label, go: () => session.takePortal(c.to, c.toX) })));
      else if (ev.type === 'portal' && ev.boss) this.deps.chooseBoss(ev.boss, ev.confirm);
      else if (ev.type === 'portal' && ev.confirm) {
        const { to, toX, toY } = ev;
        this.deps.confirm(ev.confirm, () => session.takePortal(to, toX, toY));
      }
      if (ev.type === 'float') this.addFloat(ev.x, ev.y, ev.text, ev.color, ev.size, ev.life);
      if (ev.type === 'banner') hud.showBanner(ev.text, ev.color);
      if (ev.type === 'fx') {
        if (ev.fx.kind === 'anim') this.playVfx(ev.fx);
        // 내 캐릭터 잔상: 지금 모습을 본뜬 그림
        else if (ev.fx.kind === 'droparrow') this.dropArrow(ev.fx);
        else if (ev.fx.kind === 'ghost' && ev.fx.owner && ev.fx.owner === this.deps.session.me().id) this.player.ghost(hex(ev.fx.color), ev.fx.life);
        else this.fxList.push({ f: ev.fx, t: 0 });
      }
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
    this.applyTimeOfDay(pal);
    this.drawPortals();
    this.drawEnemies(dt);
    this.drawFx(dt);
    this.drawCombat(px, py);

    // 내 캐릭터: 휘두를 때 살짝 앞으로, 맞은 뒤 무적 동안 깜빡임
    const act = me.action?.name;
    const lunge = act === 'ilseom' || act === 'wolcham' || act === 'basic' || act === 'punch' ? 3 * me.face : 0;
    this.player.update(dt, me, px + me.w / 2 + lunge, py + me.h);
    // 텔레포트로 사라진 동안은 안 보임
    this.player.setVisible(me.action?.name !== 'blink' && (me.downT > 0 || !(me.invT > 0 && Math.floor(this.time.now / 50) % 2 === 0)));
    // 칭호: 이름 위에 「칭호」, 이름은 한 줄 아래로
    const title = achievementDef(this.deps.session.save.title);
    if (title) {
      const t = `「${title.name}」`;
      if (this.titleTag.text !== t) this.titleTag.setText(t);
      this.titleTag.setColor(title.color ?? '#ffe066').setPosition(px + me.w / 2, py + me.h + 6).setVisible(true);
      this.nameTag.setPosition(px + me.w / 2, py + me.h + 20);
    } else {
      this.titleTag.setVisible(false);
      this.nameTag.setPosition(px + me.w / 2, py + me.h + 6);
    }

    // 퀘스트 진행으로 NPC 자리·포탈이 바뀌면 다시 그림
    if (this.visibleSig() !== this.mapSig) this.buildMap(true);
    this.updateCompanion(dt, px + me.w / 2);
    this.updateSpeech(dt, px + me.w / 2, py + me.h);
    this.drawGuide(px + me.w / 2, py + me.h);
    this.drawPickups();
    this.drawFireworks();
    const portal = session.world.portalNear(me);
    const npc = mapNpcs(session.save, session.world.mapId).find(n => Math.abs(n.x - (me.x + me.w / 2)) < 60);
    const pick = session.world.pickupNear(me);
    if (pick && !npc) this.showBubble(pick.x, (pick.y ?? GROUND_Y) - 70, '↑');
    else if (portal) this.showBubble(portal.x, (portal.y ?? GROUND_Y) - 118, '↑ 이동');
    // 대화 NPC 는 머리 위 말풍선이 떠 있는 동안 안내 말풍선을 겹쳐 띄우지 않음
    else if (npc && this.bubbles.get(`npc:${npc.id}`)?.visible) this.bubble.setVisible(false);
    else if (npc) this.showBubble(npc.x, GROUND_Y - 126, `↑ / ${this.deps.isTouch ? '터치' : '클릭'}: ${npc.id === 'shop' ? '상점' : npc.id === 'smith' ? '대장간' : '대화'}`);
    else this.bubble.setVisible(false);
    if (this.bubble.visible && (input.blocked || this.cut.running)) this.bubble.setVisible(false);

    // 혼자 하는 퀘스트: 내 머리 위 [?] (받기) · [✔] (보고)
    const mark = selfMark(session.save, session.nowMs());
    if (mark && !input.blocked && !this.cut.running) {
      this.setQuestMark(this.selfMark, mark);
      this.selfMark.setPosition(me.x + me.w / 2, me.y - 16 + Math.sin(this.time.now / 200) * 3).setVisible(true);
    } else this.selfMark.setVisible(false);
    // NPC 머리 위: ! 받을 퀘스트 · ? 보고할 퀘스트
    const bob = Math.sin(this.time.now / 200) * 3;
    for (const [id, c] of this.npcMarks) {
      const m: QuestMark = id === 'prof' ? professorMark(session.save, session.nowMs()) : npcMark(session.save, id, session.nowMs());
      if (m && !this.cut.running) { this.setQuestMark(c, m); c.setVisible(true).setY(GROUND_Y - QMARK_NPC_TOP + bob); } else c.setVisible(false);
    }
    this.updateFloats(dt);

    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.overlay.clear();
    if (pal.phase === 2 && !session.world.map.indoor) this.overlay.fillStyle(0x0a0a32, 0.18).fillRect(0, 0, this.viewW, VIEW_H);
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
    // 세로로 긴 맵: 맵에 들어오면 발이 화면 아래쪽 70% 쯤에 오게.
    // 그 뒤로는 발이 화면 위아래 CAM_BAND 안에 있는 동안 카메라를 안 움직이고, 벗어날 때만 따라감 (점프마다 흔들리지 않게)
    // 맨 아래 땅에 서 있으면 다시 그 자리로
    let want = meFeet - vh * 0.7;
    const onFloor = this.deps.session.me().onGround && meFeet >= GROUND_Y - 1;
    if (this.camYNow !== null && !onFloor) {
      want = this.camYNow;
      if (meFeet - want < vh * CAM_BAND.top) want = meFeet - vh * CAM_BAND.top;
      if (meFeet - want > vh * CAM_BAND.bottom) want = meFeet - vh * CAM_BAND.bottom;
    }
    want = Math.max(top, Math.min(VIEW_H - vh, want));
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
    const root = this.add.sprite(x, GROUND_Y + 1, elem ? 'slime_gray' : 'slime', 0).setOrigin(0.5, 1).setScale(SLIME_DRAW * MONSTERS[elem ? 'slime_elem' : 'slime'].h).setDepth(4);
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
        root.setPosition(a.x, y).setScale(AVATAR_SCALE * a.face * (a.scale ?? 1), AVATAR_SCALE * (a.scale ?? 1));
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
    if (tx === null && !QUESTS.some(q => save.quests[q.id]?.active && !q.repeat && !q.daily)) {
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
    const alive = new Set<string>(), liveFx = new Set<string>();
    for (const e of world.enemies) {
      const fl = Math.max(0, (this.flash.get(e.id) ?? 0) - dt);
      this.flash.set(e.id, fl);
      let label = this.enemyLabels.get(e.id);
      const rigged = MONSTERS[e.mob].ai === 'golem' && !GOLEM_OLD_LOOK;
      if (rigged && e.dead && e.deadT <= GOLEM_DEATH_TIME) { alive.add(e.id); this.drawGolem(e, fl); }
      // 죽음 그림이 있는 몬스터(꿀 슬라임)는 조금 더 오래 보여 줌
      const fadeT = e.mob === 'honey_slime' ? 0.7 : 0.35;
      if (e.dead && e.deadT > fadeT) { label?.setVisible(false); continue; }
      alive.add(e.id);
      const alpha = !e.dead ? 1 : e.mob === 'honey_slime' ? Math.min(1, 2 - 2 * e.deadT / fadeT) : 1 - e.deadT / fadeT;
      if (rigged && !e.dead) this.drawGolem(e, fl);
      let sp = this.enemySprites.get(e.id);
      if (!sp) {
        // 원소 슬라임은 회색 슬라임에 원소 색을 입힌다
        sp = this.add.sprite(0, 0, mobTexture(e.mob, e.elem), 0).setOrigin(0.5, 1).setDepth(4);

        if (e.elem) sp.setTint(hex(ELEMENTS[e.elem].color));
        this.enemySprites.set(e.id, sp);
      }
      // 프레임 (유저 지정): 0 = 기본, 1 = 이동(0과 번갈아), 2 = 점프 준비 자세
      // 꿀 슬라임: 0·1 이동, 2 휘두르기 준비, 3 휘두름, 4 죽음
      const honey = e.mob === 'honey_slime';
      let frame = 0;
      if (honey && e.dead) frame = 4;
      else if (honey && e.leap === 'leap') frame = 3;
      else if (e.leap === 'crouch') frame = 2;
      else if (e.onGround && e.stun <= 0 && Math.abs(e.vx) > 1) frame = Math.floor(this.time.now / 1000 * (honey ? 4 : 6) + e.spawnX) % 2;
      // 웅크릴 때 부들부들 떨림 (점프 예고)
      const shiver = e.leap === 'crouch' ? Math.sin(this.time.now / 25) * 1.5 : 0;
      // 슬라임은 1.45배, 임시 그림 몬스터는 몸 높이에 맞춤 (정예는 몸이 커진 만큼)
      const slime = e.mob === 'slime' || e.mob === 'slime_elem' || honey;
      sp.setScale(slime ? SLIME_DRAW * e.h : e.h / sp.frame.height);
      sp.setFrame(frame).setVisible(!rigged).setAlpha(alpha)
        .setPosition(e.x + e.w / 2 + (honey ? 0 : shiver), e.y + e.h + 1)
        .setFlipX(honey ? e.dir < 0 : e.dir > 0);
      if (fl > 0) sp.setTintFill(0xffffff);
      else if (e.elem) sp.setTint(hex(ELEMENTS[e.elem].color));
      else if (e.groggy && e.groggy > 0) sp.setTint(0x8090b0);
      else sp.clearTint();
      // 정예: 이름 앞에 [정예 특성] + 금색, 발밑에 금색 빛
      const base = e.elem ? `${ELEMENTS[e.elem].name} 슬라임` : MONSTERS[e.mob].name;
      const name = e.elite ? `정예 ${e.elite.map(a => ELITE.affixes[a].name).join('·')} ${base}` : base;
      if (!label) {
        label = this.text(name, 11, '#ffffff').setStroke('#000', 2).setOrigin(0.5, 0).setDepth(4);
        this.enemyLabels.set(e.id, label);
      }
      if (label.text !== name) label.setText(name);
      label.setColor(e.elite ? ELITE.color : '#ffffff');
      // 특성 오버레이: 몸 위에 계속 도는 그림 (몸 높이에 맞춤, 특성이 여러 개면 겹쳐서)
      for (const a of e.elite ?? []) {
        const key = `${e.id}:${a}`, name = ELITE.affixes[a].overlay, d = VFX[name];
        if (!d) continue;
        let fx = this.eliteFx.get(key);
        if (!fx) { fx = this.add.sprite(0, 0, vfxKey(name), 0).setOrigin(0.5, 1).setDepth(4.2).play(vfxKey(name)); this.eliteFx.set(key, fx); }
        const sc = (e.h * 1.35) / (d.frameH ?? d.frame);
        fx.setScale(sc).setPosition(e.x + e.w / 2, e.y + e.h + 2).setAlpha(alpha).setVisible(!e.dead || e.deadT < 0.35);
        liveFx.add(key);
      }
      if (e.elite && !e.dead) {
        const pulse = 0.35 + 0.2 * Math.sin(this.time.now / 160);
        g.fillStyle(hex(ELITE.color), pulse).fillEllipse(e.x + e.w / 2, e.y + e.h, e.w + 22, 14);
        g.lineStyle(2, hex(ELITE.color), 0.5 + pulse).strokeEllipse(e.x + e.w / 2, e.y + e.h, e.w + 22, 14);
        if (e.raged) g.fillStyle(0xff3020, 0.15 + 0.1 * Math.sin(this.time.now / 60)).fillEllipse(e.x + e.w / 2, e.y + e.h / 2, e.w + 26, e.h + 20);
      }
      label.setVisible(true).setAlpha(alpha * 0.85).setPosition(e.x + e.w / 2, e.y + e.h + 3);
      // 허수아비: HP 바 대신 머리 위에 초당 피해 (측정 중이면 노랑, 끝나면 흰색으로 남음)
      if (e.meter) {
        let t = this.dpsLabels.get(e.id);
        if (!t) { t = this.text('', 22, '#ffe066').setOrigin(0.5, 1).setDepth(10); this.dpsLabels.set(e.id, t); }
        const s = `DPS ${Math.round(e.meter.dps).toLocaleString('ko-KR')}`;
        if (t.text !== s) t.setText(s);
        t.setColor(e.meter.on ? '#ffe066' : '#ffffff').setPosition(e.x + e.w / 2, e.y - 64).setVisible(true);
      }
      if (e.hp < e.maxHp && !e.dead && MONSTERS[e.mob].ai !== 'dummy') {
        g.fillStyle(0x000000, 0.6).fillRect(e.x, e.y - 10, e.w, 5);
        g.fillStyle(0xff5050).fillRect(e.x, e.y - 10, e.w * Math.max(0, e.hp / e.maxHp), 5);
      }
      // 마지막으로 맞은 원소 (원소 반응 힌트)
      if (e.record && !e.dead) {
        g.fillStyle(hex(ELEMENTS[e.record].color)).fillCircle(e.x + e.w / 2, e.y - 20, 6);
        g.lineStyle(1.5, 0xffffff).strokeCircle(e.x + e.w / 2, e.y - 20, 6);
      }
      // 마력 씨앗: 원소 색 마름모 (반짝임)
      if (e.seed && !e.dead) {
        const sx = e.x + e.w / 2 + 16, sy = e.y - 20, r = 5 + Math.sin(this.time.now / 120);
        g.fillStyle(e.seed.elem ? hex(ELEMENTS[e.seed.elem].color) : 0xc8b8ff).fillTriangle(sx, sy - r - 2, sx - r, sy, sx + r, sy).fillTriangle(sx - r, sy, sx + r, sy, sx, sy + r + 2);
        g.lineStyle(1.2, 0xffffff).strokeTriangle(sx, sy - r - 2, sx - r, sy, sx + r, sy).strokeTriangle(sx - r, sy, sx + r, sy, sx, sy + r + 2);
      }
      // 출혈: 붉은 방울
      if (e.bleed && !e.dead) {
        const bx = e.x + e.w / 2 - 16, by = e.y - 22;
        g.fillStyle(0xd04050).fillCircle(bx, by + 2, 4).fillTriangle(bx - 4, by + 1, bx + 4, by + 1, bx, by - 6);
      }
      // 묶임: 발밑 고리
      if (e.root && e.root > 0 && !e.dead) {
        g.lineStyle(3, hex(ELEMENTS.earth.color), 0.9).strokeEllipse(e.x + e.w / 2, e.y + e.h - 3, e.w + 14, 12);
      }
    }
    // 보스 방 보안장치 (푸른 오브): 조준 중이면 고정된 방향으로 조준선, 탄
    // 보스 패턴 예고: 반투명 상자 (끝날수록 진해짐, 테두리 깜빡임)
    for (const w of world.warns) {
      const p = Math.min(1, w.t / w.life), c = hex(w.color);
      g.fillStyle(c, 0.12 + 0.22 * p).fillRect(w.x, w.y, w.w, w.h);
      g.lineStyle(2, c, 0.5 + 0.5 * Math.abs(Math.sin(this.time.now / (p > 0.7 ? 40 : 90)))).strokeRect(w.x, w.y, w.w, w.h);
    }
    // 천장 잔해: 떨어지기 직전에 위에서 내려옴
    for (const r of world.rubble) {
      const fall = 0.25, left = GOLEM_NORMAL.rubbleWarn - r.t;
      if (left > fall) continue;
      const top = world.map.top ?? 0, y = top + (GROUND_Y - top) * (1 - left / fall), s2 = GOLEM_NORMAL.rubbleW * 0.6;
      g.fillStyle(0x4a4450).fillRect(r.x - s2 / 2, y - s2, s2, s2);
      g.fillStyle(0x6b6470).fillRect(r.x - s2 / 2 + 3, y - s2 + 3, s2 - 6, s2 / 3);
    }
    if (world.orb) {
      const o = world.orb;
      if (o.dir && !o.locked) {
        // 따라가는 중: 흐린 조준선
        g.lineStyle(2, 0x6ec8ff, 0.35).lineBetween(o.x, o.y, o.x + o.dir.x * 1600, o.y + o.dir.y * 1600);
      } else if (o.dir) {
        // 방향 고정: 굵고 빠르게 깜빡임
        const a = 0.45 + 0.45 * Math.abs(Math.sin(this.time.now / 40));
        g.lineStyle(4, 0x6ec8ff, a).lineBetween(o.x, o.y, o.x + o.dir.x * 1600, o.y + o.dir.y * 1600);
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
    for (const [id, t] of this.dpsLabels) if (!alive.has(id)) t.setVisible(false);
    for (const [id, sp] of this.enemySprites) if (!alive.has(id)) sp.setVisible(false);
    for (const [id, r] of this.golemRigs) if (!alive.has(id) || !world.enemies.some(e => e.id === id)) r.c.setVisible(false);
    for (const [k, sp] of this.eliteFx) if (!liveFx.has(k)) { sp.destroy(); this.eliteFx.delete(k); }

    // 골드: 금액에 따라 동전·철전·은전·금전 그림이 계속 돎, 사라지기 5초 전부터 깜빡임
    const drops = new Set<string>(), coins = new Set<string>();
    const frame = Math.floor(this.time.now / 1000 * COIN_ANIM.fps) % COIN_ANIM.frames;
    for (const c of world.coins) {
      const blink = c.t > COIN.life - COIN.blinkLast && Math.floor(c.t * 8) % 2 === 1;
      if (c.item) { drops.add(c.id); this.drawDrop(c.id, c.item, c.x + c.w / 2, c.y + c.h, c.t, blink, c.lock !== undefined); continue; }
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

  /** 퀘스트 말풍선: 아래 가운데가 꼬리 끝. [아이콘, 꼬리] 순서 (꼬리가 앞) */
  private makeQuestMark() {
    const tail = this.add.image(0, 0, 'qmark:tail').setOrigin(0.5, 1).setScale(QMARK_SCALE);
    const icon = this.add.image(0, -4 * QMARK_SCALE, 'qmark:!').setOrigin(0.5, 1).setScale(QMARK_SCALE);
    for (const im of [tail, icon]) im.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    return this.add.container(0, 0, [icon, tail]).setDepth(7.5);
  }
  private setQuestMark(c: Phaser.GameObjects.Container, mark: '!' | '?') {
    const key = `qmark:${mark}`, icon = c.getAt<Phaser.GameObjects.Image>(0);
    if (icon.texture.key !== key) icon.setTexture(key);
  }

  /** 떨어진 물건: 아이콘 그림(없으면 이모지)이 바닥 위에서 살짝 위아래로 흔들림. (x, y) = 아래 가운데 */
  private drawDrop(id: string, item: string, x: number, y: number, t: number, blink: boolean, locked = false) {
    let d = this.dropSprites.get(id);
    if (!d || d.item !== item) {
      d?.obj.destroy();
      const img = itemDef(item)?.img, key = `ico:${img}`;
      const obj = img && this.textures.exists(key)
        ? this.add.image(0, 0, key).setOrigin(0.5, 1)
        : this.add.text(0, 0, itemDef(item)?.icon ?? '?', { fontSize: '22px' }).setOrigin(0.5, 1).setResolution(this.zoom);
      if (obj instanceof Phaser.GameObjects.Image) {
        obj.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
        obj.setScale(DROP_ICON_PX / Math.max(obj.width, obj.height)); // 16·32·64 어느 크기든 같은 크기로
      }
      d = { item, obj: obj.setDepth(4.6) };
      this.dropSprites.set(id, d);
    }
    d.obj.setPosition(x, y - 2 - 3 * (1 + Math.sin(t * 4))).setVisible(!blink);
    // 버린 지 얼마 안 돼 못 줍는 물건: 살짝 붉게
    if (locked) d.obj.setTint(DROP_LOCK_TINT); else d.obj.clearTint();
  }

  /** 투사체·소용돌이 + 내 캐릭터 주변 표시 (마법진, 충전 바, 조준, 사슬) */
  private drawCombat(px: number, py: number) {
    const g = this.projG, u = this.underG, world = this.deps.session.world, me = this.deps.session.me();
    const t = this.time.now / 1000;
    g.clear(); u.clear();
    const elCol = (e: import('@shared/data/elements').Element | null | undefined) => (e ? hex(ELEMENTS[e].color) : 0xdddddd);

    // 소용돌이 그림 (색 입힌 층 + 흰 심). 소용돌이가 끝나면 지움 (터짐은 따로 재생)
    for (const v of world.vortices) {
      if (!this.vortexSprites.has(v)) {
        const d = VFX.soyong_vortex;
        this.vortexSprites.set(v, ['soyong_vortex', d.core!].map((n, i) => {
          const sp = this.add.sprite(v.x, v.y, vfxKey(n), 0).setDepth(5.5).setScale(d.scale * SOYONG_VISUAL_R / 300);
          if (i === 0) sp.setTint(hex(v.color));
          return sp.play(vfxKey(n));
        }));
        // 뒷배경 (유저 그림): 커지고 → 도는 동안 반복
        const b = VFX.soyong_bg;
        const back = ['soyong_bg', b.core!].map((n, i) => {
          const sp = this.add.sprite(v.x, v.y, vfxKey(n), 0).setDepth(i === 0 ? 5.4 : 5.45).setScale(b.scale * SOYONG_VISUAL_R / 300).setData('bg', true);
          if (i === 0) sp.setTint(hex(v.color));
          sp.play(vfxKey(n) + ':in').chain(vfxKey(n) + ':loop');
          return sp;
        });
        this.vortexSprites.get(v)!.push(...back);
      }
    }
    // 소용돌이가 끝나면: 앞 그림은 바로 지우고, 뒷배경은 줄어드는 칸을 재생하고 지움
    for (const [v, l] of this.vortexSprites) if (!world.vortices.includes(v as never)) {
      for (const sp of l) {
        if (!sp.getData('bg')) { sp.destroy(); continue; }
        sp.chain(); // 이어 붙인 반복 칸 취소
        sp.play(sp.anims.currentAnim!.key.replace(/:(in|loop)$/, ':out'));
        sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
      }
      this.vortexSprites.delete(v);
    }

    // 원소 기둥 토네이도: 생김 → 돎(반복)을 붙여 두고 토네이도를 따라 움직임. 끝나면 사라지는 칸 재생 후 지움
    for (const o of world.tornadoes) {
      let l = this.tornadoSprites.get(o);
      if (!l) {
        const d = VFX.gidung_tornado;
        l = ['gidung_tornado', d.core!].map((n, i) => {
          const sp = this.add.sprite(o.x, o.by, vfxKey(n), 0).setDepth(5.5).setScale(d.scale * GIDUNG.scale).setOrigin(d.origin![0] / d.frame, d.origin![1] / (d.frameH ?? d.frame));
          if (i === 0) sp.setTint(hex(o.color));
          sp.play(vfxKey(n) + ':in').chain(vfxKey(n) + ':loop');
          return sp;
        });
        this.tornadoSprites.set(o, l);
      }
      l.forEach(sp => sp.setPosition(o.x, o.by));
    }
    for (const [o, l] of this.tornadoSprites) if (!world.tornadoes.includes(o as never)) {
      for (const sp of l) {
        sp.chain();
        sp.play(sp.anims.currentAnim!.key.replace(/:(in|loop)$/, ':out'));
        sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sp.destroy());
      }
      this.tornadoSprites.delete(o);
    }

    // 궁수 덫: 바닥 위 톱니 모양 (작동 전엔 흐리게)
    for (const tr of world.traps) {
      const c = elCol(tr.elem), on = tr.t >= HINT.deot.arm, al = on ? 1 : 0.45, hw = tr.w / 2;
      u.fillStyle(0x1a1a22, 0.8 * al).fillRect(tr.x - hw, tr.y - 5, tr.w, 5);
      u.fillStyle(c, al);
      for (let i = 0; i < 4; i++) { const x0 = tr.x - hw + i * (tr.w / 4); u.fillTriangle(x0, tr.y - 5, x0 + tr.w / 8, tr.y - 13, x0 + tr.w / 4, tr.y - 5); }
    }

    // 흘려베기 받아내기 자세: 몸 앞 방패 그림 (guard_shield, 받아내는 동안 반복)
    this.syncGuardShields();
    this.syncHaebangCircles();

    const seenArrows = new Set<string>();
    for (const o of world.projectiles) {
      const c = elCol(o.elem);
      // 화살 그림 (기본 화살·사슬 화살 = arrow, 큰 화살 = arrow_big)
      if (o.kind === 'arrow' || o.kind === 'chain' || o.kind === 'big') {
        this.drawArrow(o, o.elem ? hex(ELEMENTS[o.elem].color) : null);
        seenArrows.add(o.id);
        continue;
      }
      // 마력탄·마법사 기본 공격: 파직거리는 마력 덩어리 그림 (mana_orb)
      if (o.kind === 'orb' && (o.skill === 'madan' || o.skill === 'basic')) {
        this.drawManaOrb(o, o.elem ? hex(ELEMENTS[o.elem].color) : null);
        seenArrows.add(o.id);
        continue;
      }
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
    for (const [id, l] of this.arrowSprites) if (!seenArrows.has(id)) { l.forEach(sp => sp.destroy()); this.arrowSprites.delete(id); }

    const x = px, y = py, a = me.action;
    // 사슬 화살: 날아가는 화살 / 끌려가는 지점까지 밧줄
    const to = me.ropeTo ?? (me.chainArrow && !me.chainArrow.dead ? me.chainArrow : null);
    if (to) g.lineStyle(2, 0xe8dcb0).lineBetween(x + me.w / 2, y + me.h / 2, to.x, to.y);
    // 끌려가는 동안: 작살이 그 자리에 박혀 있음
    if (me.ropeTo) {
      const h = VFX.harpoon, el = me.data.learned.sasl;
      if (!this.ropeHarpoon) {
        this.ropeHarpoon = this.add.sprite(0, 0, vfxKey('harpoon'), 0).setDepth(6.6).setOrigin(h.origin![0] / h.frame, h.origin![1] / h.frameH!).setScale(h.scale);
        if (el) this.ropeHarpoon.setTint(hex(ELEMENTS[el].color));
      }
      const ang = Math.atan2(me.ropeTo.y - (y + me.h / 2), me.ropeTo.x - (x + me.w / 2));
      if (this.ropeHarpoon.getData('ang') === undefined) this.ropeHarpoon.setData('ang', ang).setRotation(ang).setFlipY(Math.cos(ang) < 0);
      this.ropeHarpoon.setPosition(me.ropeTo.x, me.ropeTo.y);
    } else if (this.ropeHarpoon) { this.ropeHarpoon.destroy(); this.ropeHarpoon = null; }
    // 마력 해방 중: 몸 뒤 마법진은 syncHaebangCircles
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

  /** 마법 골렘: 파츠 그림을 상태에 맞춰 움직임 (golemRig.ts) */
  private drawGolem(e: Enemy, flash: number) {
    let rig = this.golemRigs.get(e.id);
    if (!rig) {
      const parts = GOLEM_PARTS.map(p => {
        const key = `golem_${p}`;
        this.textures.get(key).setFilter(Phaser.Textures.FilterMode.NEAREST);
        return this.add.image(0, 0, key);
      });
      rig = { c: this.add.container(0, 0, parts).setDepth(4), parts, boomed: false };
      this.golemRigs.set(e.id, rig);
    }
    const st: GolemState = { mode: 'idle', p: 0, t: this.time.now / 1000 + e.spawnX * 0.01 };
    const left = (total: number) => Math.max(0, Math.min(1, 1 - e.leapT / total));
    if (e.dead) { st.mode = 'dead'; st.p = e.deadT; }
    else if (e.groggy && e.groggy > 0) st.mode = 'groggy';
    else if (e.pat === 'slam') { st.mode = e.leap === 'crouch' ? 'slamWind' : 'slamHit'; st.p = left(e.leap === 'crouch' ? GOLEM_AI.slamWindup : GOLEM_AI.slamRecover); }
    else if (e.pat === 'quake') { st.mode = e.leap === 'crouch' ? 'quakeWind' : 'quakeHit'; st.p = left(e.leap === 'crouch' ? GOLEM_NORMAL.quakeWindup : GOLEM_NORMAL.quakeRecover); }
    else if (e.pat === 'charge') { st.mode = e.leap === 'crouch' ? 'chargeWind' : 'charge'; st.p = e.leap === 'crouch' ? left(GOLEM_AI.chargeWindup) : 0; }
    else if (e.onGround && Math.abs(e.vx) > 1) st.mode = 'walk';
    if (!e.dead) rig.boomed = false;
    const mx = e.x + e.w / 2, my = e.y + e.h * 0.55;
    // 죽음: 부들부들 떨 때 화면도 조금 흔들림 → 폭발 (화면 크게 흔들림, 빛, 고리)
    if (e.dead && e.deadT > GOLEM_DEATH_CRACK && e.deadT < GOLEM_DEATH_BOOM) this.shake = Math.max(this.shake, 3);
    if (e.dead && e.deadT >= GOLEM_DEATH_BOOM && !rig.boomed) {
      rig.boomed = true;
      this.shake = Math.max(this.shake, 22);
      this.fxList.push({ f: { kind: 'ring', x: mx, y: my, color: '#ffffff', r0: 20, r1: 260, life: 0.45 }, t: 0 });
      this.fxList.push({ f: { kind: 'ring', x: mx, y: my, color: '#6ec8ff', r0: 40, r1: 420, life: 0.7 }, t: 0 });
    }
    if (e.dead && e.deadT >= GOLEM_DEATH_BOOM && e.deadT < GOLEM_DEATH_BOOM + 0.35) {
      const k = 1 - (e.deadT - GOLEM_DEATH_BOOM) / 0.35;
      this.combat.fillStyle(0xe0f6ff, 0.8 * k).fillCircle(mx, my, 60 + 120 * (1 - k));
      this.combat.fillStyle(0xffffff, k).fillCircle(mx, my, 40 + 40 * (1 - k));
    }
    // 돌진 예고: 돌진할 쪽 앞에 <<< (먼 쪽일수록 진하고 주황, 가까울수록 흐리고 노랑), 깜빡임
    if (!e.dead && e.pat === 'charge' && e.leap === 'crouch') {
      const d = e.chargeDir ?? e.dir, blink = 0.35 + 0.65 * Math.abs(Math.sin(this.time.now / 160));
      const front = d > 0 ? e.x + e.w + 30 : e.x - 30, cy = e.y + e.h * 0.6, hh = 30, ww = 22;
      const cols = [0xffd23a, 0xffaa2a, 0xff7a1a], alphas = [0.3, 0.6, 1];
      for (let i = 0; i < 3; i++) {
        const x = front + d * i * 36, tip = x + d * ww;
        this.combat.lineStyle(9, cols[i], alphas[i] * blink);
        this.combat.beginPath().moveTo(x, cy - hh).lineTo(tip, cy).lineTo(x, cy + hh).strokePath();
      }
    }
    const sc = e.h / GOLEM_ART_H;
    rig.c.setVisible(true).setPosition(e.x + e.w / 2, e.y + e.h + 1).setScale(sc * (e.dir > 0 ? -1 : 1), sc);
    golemPose(st).forEach((d, i) => {
      const im = rig!.parts[i];
      im.setOrigin(d.ox, d.oy).setPosition(d.x, d.y).setRotation(d.rot).setAlpha(d.alpha);
      if (flash > 0 && !e.dead) im.setTintFill(0xffffff);
      else if (st.mode === 'groggy') im.setTint(0x8090b0);
      else im.clearTint();
    });
  }

  /** 한 번만 줍는 물건 (그림이 없어서 흰 상자, 둥실둥실) */
  private pickG: Phaser.GameObjects.Graphics | null = null;
  private drawPickups() {
    if (!this.pickG || !this.pickG.active) this.pickG = this.add.graphics().setDepth(4.5);
    const g = this.pickG.clear(), s = this.deps.session;
    for (const o of mapPickups(s.save, s.world.mapId)) {
      const y = (o.y ?? GROUND_Y) - 6 - 3 * (1 + Math.sin(this.time.now / 250 + o.x));
      g.fillStyle(0xffffff, 0.95).fillRect(o.x - 10, y - 24, 20, 24);
      g.lineStyle(2, 0x3a3a3a, 1).strokeRect(o.x - 10, y - 24, 20, 24);
    }
    // 채집물 (임시 그림): 풀 = 푸른 덤불, 광석 = 회색 바위. 캔 뒤 다시 생기기 전엔 안 보임
    for (const o of s.world.gathers) {
      if (o.t > 0) continue;
      const n = GATHER_NODES[o.node];
      if (!n) continue;
      if (n.tool === 'herb') {
        g.fillStyle(0x2f6a3a).fillRect(o.x - 3, o.y - 18, 6, 18);
        g.fillStyle(n.color).fillCircle(o.x - 9, o.y - 20, 7).fillCircle(o.x + 9, o.y - 20, 7).fillCircle(o.x, o.y - 28, 7);
      } else {
        g.fillStyle(0x55595f).fillRect(o.x - 20, o.y - 22, 40, 22);
        g.fillStyle(n.color).fillRect(o.x - 15, o.y - 30, 30, 10).fillRect(o.x - 8, o.y - 16, 10, 8);
      }
    }
  }

  /**
   * 폭죽 (임시 그림): 설치 → 통이 부들부들 떨며 불똥 튐 → 발사(꼬리 불꽃) → 늘 같은 높이에서 터짐 (빛 알갱이가 퍼졌다가 떨어지며 사라짐)
   */
  private fwG: Phaser.GameObjects.Graphics | null = null;
  private drawFireworks() {
    if (!this.fwG || !this.fwG.active) this.fwG = this.add.graphics().setDepth(6);
    const g = this.fwG.clear(), F = FIREWORK, now = this.time.now / 1000;
    for (const f of this.deps.session.world.fireworks) {
      const seed = [...f.id].reduce((a, c) => a * 31 + c.charCodeAt(0), 7);
      const rnd = (i: number) => { const v = Math.sin(seed * 12.9898 + i * 78.233) * 43758.5453; return v - Math.floor(v); };
      const cols = FIREWORK_COLORS, c1 = cols[seed % cols.length], c2 = cols[(seed >> 3) % cols.length];
      if (f.t < F.fuse) {
        // 통: 갈수록 더 세게 떨림
        const k = f.t / F.fuse, sx = Math.sin(now * 60) * (0.6 + 2.2 * k), x = f.x + sx;
        g.fillStyle(0x2a1a10).fillRect(x - 6, f.y - 22, 12, 22);
        g.fillStyle(0xd84a3a).fillRect(x - 5, f.y - 21, 10, 20);
        g.fillStyle(0xf0e0c0).fillRect(x - 5, f.y - 14, 10, 3);
        g.fillStyle(0x3a2a1a).fillRect(x - 1, f.y - 27, 2, 5);
        // 불똥: 심지 끝에서 튀어 오름
        for (let i = 0; i < 10; i++) {
          const ph = (now * 2.4 + rnd(i)) % 1, a = (rnd(i + 20) - 0.5) * 2.4;
          const px = x + Math.sin(a) * 26 * ph, py = f.y - 27 - Math.cos(a) * 22 * ph + 30 * ph * ph;
          g.fillStyle(ph < 0.5 ? 0xffe27a : 0xff8a2a, 1 - ph).fillRect(px - 1, py - 1, 2.5, 2.5);
        }
      } else if (f.t < F.fuse + F.rise) {
        // 발사: 위로 갈수록 느려짐, 꼬리 불꽃
        const k = (f.t - F.fuse) / F.rise, e = 1 - (1 - k) * (1 - k), y = f.y - 20 + (f.burstY - f.y + 20) * e;
        g.fillStyle(0xfff2b0).fillCircle(f.x, y, 3);
        for (let i = 1; i <= 8; i++) g.fillStyle(0xffb040, 0.7 - i * 0.08).fillCircle(f.x + Math.sin(now * 40 + i) * 1.5, y + i * 7, 2.6 - i * 0.22);
      } else {
        // 터짐: 두 겹 고리로 퍼지며 빛줄기를 남기고, 끝으로 갈수록 떨어지며 사라짐
        const k = (f.t - F.fuse - F.rise) / F.burst, e = 1 - Math.pow(1 - Math.min(1, k * 1.5), 3), fall = 50 * k * k, a = Math.max(0, 1 - k * k);
        if (k < 0.15) g.fillStyle(0xffffff, 0.9 * (1 - k / 0.15)).fillCircle(f.x, f.burstY, 40);
        for (let ring = 0; ring < 2; ring++) {
          const n = ring ? 20 : 32, r = (ring ? 85 : 150) * e, col = ring ? c2 : c1;
          for (let i = 0; i < n; i++) {
            const ang = (i / n) * Math.PI * 2 + rnd(ring * 50 + i) * 0.25;
            const cx2 = Math.cos(ang), sy2 = Math.sin(ang);
            const px = f.x + cx2 * r, py = f.burstY + sy2 * r + fall;
            const tw = 0.7 + 0.3 * Math.sin(now * 30 + i);
            // 빛줄기 (안쪽에서 바깥으로)
            g.lineStyle(2.5, col, a * 0.55).lineBetween(f.x + cx2 * r * 0.55, f.burstY + sy2 * r * 0.55 + fall * 0.6, px, py);
            g.fillStyle(col, a * tw).fillCircle(px, py, 4.5 * (1 - k * 0.4));
            g.fillStyle(0xffffff, a * tw * 0.9).fillCircle(px, py, 2);
          }
        }
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
    // 들짐승 (영지 가도): 황소 머리·뿔 + 하이에나 몸(앞이 높고 뒤가 처진 등, 점무늬, 갈기). 2 = 돌진 예고 (머리 숙임, 붉은 눈)
    make('beast', 46, 30, (r, f) => {
      const ol = '#2a1c12', fur = '#9a7444', dark = '#6a4a28', spot = '#4a3218', horn = '#efe6cc';
      const hd = f === 2 ? 3 : 0;
      // 꼬리 (오른쪽 끝)
      r(41, 8, 4, 2, ol); r(43, 10, 2, 5, ol); r(42, 14, 3, 3, spot);
      // 몸: 앞(왼쪽)이 높고 뒤로 갈수록 낮아짐
      r(12, 5, 18, 15, ol); r(28, 8, 14, 12, ol);
      r(13, 6, 17, 13, fur); r(28, 9, 13, 10, fur);
      r(13, 6, 17, 3, dark);
      // 갈기
      r(14, 3, 10, 4, ol); r(15, 4, 8, 3, spot);
      // 점무늬
      r(18, 11, 3, 2, spot); r(24, 9, 2, 2, spot); r(31, 12, 3, 2, spot); r(36, 10, 2, 2, spot); r(27, 15, 2, 2, spot);
      // 머리 (황소): 넓은 얼굴 + 뿔 + 코
      r(2, 6 + hd, 13, 11, ol); r(3, 7 + hd, 11, 9, fur); r(3, 12 + hd, 5, 4, dark);
      r(1, 13 + hd, 3, 3, ol); r(2, 14 + hd, 1, 1, '#d08a7a');
      r(5, 9 + hd, 2, 2, f === 2 ? '#ff3a2a' : '#1a1008');
      r(1, 3 + hd, 4, 2, ol); r(0, 1 + hd, 2, 3, ol); r(1, 4 + hd, 3, 1, horn); r(0, 2 + hd, 1, 2, horn);
      r(10, 3 + hd, 4, 2, ol); r(12, 1 + hd, 2, 3, ol); r(10, 4 + hd, 3, 1, horn); r(12, 2 + hd, 1, 2, horn);
      // 다리 (앞다리 길고 뒷다리 짧음)
      const k = f === 1 ? 2 : 0;
      r(14 - k, 19, 4, 11, ol); r(15 - k, 19, 2, 10, dark);
      r(22 + k, 19, 4, 11, ol); r(23 + k, 19, 2, 10, dark);
      r(30 - k, 19, 4, 11, ol); r(31 - k, 19, 2, 10, dark);
      r(37 + k, 19, 4, 11, ol); r(38 + k, 19, 2, 10, dark);
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
    // 허수아비 (훈련장): 짚 머리 + 모자, 가로 막대 팔, 나무 기둥. 안 움직임 (세 프레임 같음)
    make('dummy', 17, 32, r => {
      r(4, 0, 9, 2, '#3a2a1a'); r(2, 2, 13, 2, '#3a2a1a'); r(5, 1, 7, 1, '#6a4a2a');
      r(4, 4, 9, 7, '#2a1e10'); r(5, 4, 7, 6, '#e0c070'); r(6, 6, 1, 1, '#2a1e10'); r(10, 6, 1, 1, '#2a1e10'); r(7, 8, 3, 1, '#a07838');
      r(0, 12, 17, 3, '#2a1e10'); r(1, 13, 15, 1, '#8a6038');
      r(4, 11, 9, 9, '#2a1e10'); r(5, 12, 7, 7, '#b04838'); r(5, 15, 7, 1, '#e0c070');
      r(0, 15, 2, 2, '#e0c070'); r(15, 15, 2, 2, '#e0c070');
      r(7, 20, 3, 12, '#2a1e10'); r(8, 20, 1, 12, '#8a6038');
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
    this.textures.get('honey_slime').setFilter(Phaser.Textures.FilterMode.NEAREST);
  }

  /**
   * 마력 해방: 캐릭터 뒤에 마법진. 처음엔 반투명·조금 아래·작게 → 0.6초 동안 진해지며 살짝 위로 올라옴.
   * 해방 중에는 몸을 따라다니며 천천히 돌고 은은하게 숨 쉼, 끝나면 0.4초 동안 투명해지며 사라짐
   */
  private syncHaebangCircles() {
    const world = this.deps.session.world, d = VFX.magic_circle, now = this.time.now / 1000;
    for (const [id, im] of this.haebangCircles) {
      const p = world.players.get(id);
      if (p && p.buffT > 0) continue;
      this.haebangCircles.delete(id);
      this.tweens.killTweensOf(im);
      this.tweens.add({ targets: im, alpha: 0, duration: 400, onComplete: () => im.destroy() });
    }
    for (const p of world.players.values()) {
      if (p.buffT <= 0) continue;
      let im = this.haebangCircles.get(p.id);
      if (!im) {
        im = this.add.image(0, 0, vfxKey('magic_circle'), 0).setDepth(d.depth!).setTint(0xc8b8ff).setAlpha(0.2).setScale(d.scale * 0.85)
          .setData('rise', 18).setData('born', now);
        this.tweens.add({ targets: im, alpha: 0.95, duration: 600, ease: 'Quad.easeIn' });
        this.tweens.add({ targets: im, scale: d.scale, duration: 600, ease: 'Cubic.easeOut' });
        this.tweens.addCounter({ from: 18, to: 0, duration: 700, ease: 'Cubic.easeOut', onUpdate: tw => im!.setData('rise', tw.getValue()) });
        this.haebangCircles.set(p.id, im);
      }
      const age = now - (im.getData('born') as number);
      // 머리 위 (마법진 가운데가 머리 끝보다 60px 위), 천천히 돎 + 위아래로 살짝 떠다님
      im.setPosition(p.x + p.w / 2 - p.face * 4, p.y - 60 + (im.getData('rise') as number) + Math.sin(age * 2) * 2).setRotation(age * 0.35);
    }
  }

  /** 받아내는 중인 플레이어마다 방패 그림을 붙여 두고, 끝나면 뗌 */
  private syncGuardShields() {
    const world = this.deps.session.world;
    for (const [id, sps] of this.guardShields) {
      const p = world.players.get(id);
      if (p?.action?.guard) continue;
      for (const sp of sps) sp.destroy();
      this.guardShields.delete(id);
    }
    for (const p of world.players.values()) {
      if (!p.action?.guard) continue;
      let sps = this.guardShields.get(p.id);
      if (!sps) {
        const el = p.data.learned.heullyeo, tint = hex(el ? ELEMENTS[el].color : '#dddddd');
        sps = ['guard_shield', 'guard_shield_core'].map((name, i) => {
          const d = VFX[name];
          const sp = this.add.sprite(0, 0, vfxKey(name), 0).setDepth(d.depth ?? 5.5).setOrigin(d.origin![0] / d.frame, d.origin![1] / (d.frameH ?? d.frame));
          if (i === 0) sp.setTint(tint);
          sp.play(vfxKey(name));
          return sp;
        });
        this.guardShields.set(p.id, sps);
      }
      const s = VFX.guard_shield.scale;
      for (const sp of sps) sp.setPosition(p.x + p.w / 2, p.y + p.h / 2).setScale(s * (p.face < 0 ? -1 : 1), s);
    }
  }

  /** 그림 이펙트 재생 (끝나면 사라짐). owner 가 있으면 그 플레이어를 따라감 */
  private playVfx(f: Extract<Fx, { kind: 'anim' }>) {
    const d = VFX[f.anim];
    if (!d) return;
    const sc = d.scale * (f.scale ?? 1);
    const sp = this.add.sprite(f.x, f.y, vfxKey(f.anim), 0).setDepth(d.depth ?? 5.5).setScale(sc * (f.face < 0 ? -1 : 1), sc);
    // 위아래 뒤집으면 기준점도 같이 뒤집음 (그림 속 같은 점이 기준점에 오게)
    if (d.origin) { const fh = d.frameH ?? d.frame; sp.setOrigin(d.origin[0] / d.frame, (f.flipY ? fh - d.origin[1] : d.origin[1]) / fh); }
    if (f.color) sp.setTint(hex(f.color));
    if (f.flipY) sp.setFlipY(true);
    const follow = () => {
      const p = f.owner ? this.deps.session.world.players.get(f.owner) : undefined;
      if (p) sp.setPosition(p.x + p.w / 2 + (f.dx ?? 0) * f.face, p.y + p.h / 2 + (f.dy ?? 0));
      else if (!f.owner) sp.setPosition(f.x + (f.dx ?? 0) * f.face, f.y + (f.dy ?? 0));
    };
    follow();
    this.vfxSprites.push({ sp, follow });
    const remove = () => { sp.destroy(); this.vfxSprites = this.vfxSprites.filter(o => o.sp !== sp); };
    const key = vfxKey(f.anim);
    if (f.hold && d.parts?.in && d.parts.loop) {
      // 오래 있는 그림 (설치기): 생기는 칸 → hold 초 동안 반복 칸 → 사라지는 칸 재생 후 지움.
      // 사라지는 칸(out)이 없으면 남은 시간(life − hold) 동안 투명해지며 사라짐
      const out = d.parts.out;
      sp.play(key + ':in').chain(key + ':loop');
      this.time.delayedCall(f.hold * 1000, () => {
        if (!sp.active) return;
        if (out) {
          sp.chain();
          sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, remove);
          sp.play(key + ':out');
        } else {
          this.tweens.add({ targets: sp, alpha: 0, duration: Math.max(0.05, f.life - f.hold!) * 1000, onComplete: remove });
        }
      });
    } else {
      sp.once(Phaser.Animations.Events.ANIMATION_COMPLETE, remove);
      sp.play(key);
    }
    // 위층 (색 안 입힘): 같은 자리·같은 박자로 위에 겹침
    if (d.core) this.playVfx({ ...f, anim: d.core, color: undefined });
  }

  /** 후방 도약 화살: 플레이어 몸에서 서서히 나타남 → 잠깐 멈춤 → 점점 빨라지며 박힐 자리(발판·바닥)로 날아가 박힘 → 박힌 채 남았다가 서서히 사라짐 */
  private dropArrow(f: Extract<Fx, { kind: 'droparrow' }>) {
    const A = DOYAK.arrow, tint = f.color ? hex(f.color) : null, ang = Math.atan2(f.y - f.sy, f.x - f.sx), left = Math.cos(ang) < 0;
    const make = (name: string) => {
      const d = VFX[name], sc = A.len / d.len!;
      return [name, d.core!].map((n, i) => {
        const sp = this.add.sprite(f.x, f.y, vfxKey(n), 0).setDepth(5.5).setOrigin(d.origin![0] / d.frame, d.origin![1] / (d.frameH ?? d.frame))
          .setScale(sc * d.scale).setRotation(ang).setFlipY(left);
        if (i === 0 && tint !== null) sp.setTint(tint);
        return sp;
      });
    };
    const fly = make('arrow_big');
    fly.forEach(sp => sp.play(sp.texture.key).setPosition(f.sx, f.sy).setAlpha(0));
    this.tweens.add({ targets: fly, alpha: 1, duration: A.appear * 1000 });
    this.tweens.add({
      targets: fly, x: f.x, y: f.y, delay: (A.appear + A.hold) * 1000, duration: f.fly * 1000, ease: 'Quad.easeIn',
      onComplete: () => {
        fly.forEach(sp => sp.destroy());
        const stuck = make('arrow_still');
        this.tweens.add({ targets: stuck, alpha: 0, delay: A.stay * 1000, duration: A.fade * 1000, onComplete: () => stuck.forEach(sp => sp.destroy()) });
      },
    });
  }

  /** 날아가는 화살 하나: 촉 끝이 화살 위치, 날아가는 방향으로 돌림. 길이(len)에 맞춰 크기 조절. 원소 없으면 색 안 입힘 */
  /** 마력탄 그림 (색 층 + 흰 심). 화살 그림과 같은 목록(arrowSprites)으로 관리해서 사라지면 같이 지움. 기본 공격은 작게 */
  private drawManaOrb(o: { id: string; x: number; y: number; face: number; skill: string }, tint: number | null) {
    const d = VFX.mana_orb;
    let l = this.arrowSprites.get(o.id);
    if (!l) {
      l = ['mana_orb', d.core!].map((n, i) => {
        const sp = this.add.sprite(o.x, o.y, vfxKey(n), 0).setDepth(5.5);
        if (i === 0 && tint !== null) sp.setTint(tint);
        sp.play(vfxKey(n));
        return sp;
      });
      this.arrowSprites.set(o.id, l);
    }
    const sc = d.scale * (o.skill === 'basic' ? 0.8 : 1);
    l.forEach(sp => sp.setPosition(o.x, o.y).setScale(sc * (o.face < 0 ? -1 : 1), sc));
  }

  private drawArrow(o: { id: string; kind: string; x: number; y: number; ang: number; len?: number }, tint: number | null) {
    const name = o.kind === 'big' ? 'arrow_big' : 'arrow', d = VFX[name], chain = o.kind === 'chain', hd = VFX.harpoon;
    let l = this.arrowSprites.get(o.id);
    if (!l) {
      l = [name, d.core].filter((n): n is string => !!n).map((n, i) => {
        const sp = this.add.sprite(o.x, o.y, vfxKey(n), 0).setDepth(5.5).setOrigin(d.origin![0] / d.frame, d.origin![1] / (d.frameH ?? d.frame));
        if (i === 0 && tint !== null) sp.setTint(tint);
        sp.play(vfxKey(n));
        return sp;
      });
      // 사슬 화살: 끝에 작살 그림 (화살은 작살 뒤에 꽂힌 자루처럼)
      if (chain) {
        const hs = this.add.sprite(o.x, o.y, vfxKey('harpoon'), 0).setDepth(6.6).setOrigin(hd.origin![0] / hd.frame, hd.origin![1] / hd.frameH!);
        if (tint !== null) hs.setTint(tint);
        l.push(hs);
      }
      this.arrowSprites.set(o.id, l);
    }
    const sc = (o.len ?? d.len!) / d.len!, left = Math.cos(o.ang) < 0;
    // 작살이 있으면 화살 촉은 작살 뒤쪽 (작살 길이의 대략 4/5 뒤)
    const back = chain ? 15 * hd.scale : 0, ax = o.x - Math.cos(o.ang) * back, ay = o.y - Math.sin(o.ang) * back;
    l.forEach((sp, i) => {
      if (chain && i === l!.length - 1) sp.setPosition(o.x, o.y).setRotation(o.ang).setScale(hd.scale).setFlipY(left);
      else sp.setPosition(ax, ay).setRotation(o.ang).setScale(sc * d.scale).setFlipY(left);
    });
  }

  /** 검기·원 퍼짐·잔상 */
  private drawFx(dt: number) {
    for (const o of this.vfxSprites) o.follow();
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
      } else if (f.kind === 'streak') {
        // 화살이 날아가는 동안은 깃 끝까지 선을 늘림 (사라지기 시작 안 함). 맞히거나 화살이 없어지면 멈추고 서서히 사라짐
        if (f.proj) {
          const a = this.deps.session.world.projectiles.find(q => q.id === f.proj);
          if (a && !a.dead && a.hit.size === 0) {
            const tail = a.len ?? 40;
            const tx = a.x - Math.cos(a.ang) * tail, ty = a.y - Math.sin(a.ang) * tail;
            // 깃 끝이 아직 쏜 자리 뒤에 있으면 선 없음
            if ((tx - f.x1) * Math.cos(a.ang) + (ty - f.y1) * Math.sin(a.ang) > 0) { f.x2 = tx; f.y2 = ty; }
            o.t = 0;
          } else f.proj = undefined;
        }
        const q = Math.min(1, o.t / f.life), qa = 1 - q, a2 = qa * qa;
        if (f.x2 !== f.x1 || f.y2 !== f.y1) {
          g.lineStyle(f.w * (1 - q * 0.8), hex(f.color), a2 * 0.8).lineBetween(f.x1, f.y1, f.x2, f.y2);
          g.lineStyle(Math.max(1, f.w * 0.35 * (1 - q)), 0xffffff, a2 * qa).lineBetween(f.x1, f.y1, f.x2, f.y2);
        }
      } else if (f.kind === 'charge') {
        // 큰 원이 가운데로 줄어듦 (점점 또렷해짐), 끝나면 사라짐
        const r = f.r0 + (f.r1 - f.r0) * p, a = 0.35 + 0.55 * p;
        g.lineStyle(5, hex(f.color), a).strokeCircle(f.x, f.y, r);
        g.lineStyle(2, 0xffffff, a * 0.8).strokeCircle(f.x, f.y, Math.max(1, r - 4));
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
    for (const p of mapPortals(this.deps.session.save, this.deps.session.world.mapId, this.deps.session.world.cleared)) {
      const py = (p.y ?? GROUND_Y) - 48;
      // 닫힌 포탈은 흐린 회색
      const [fill, line, a] = p.closed ? [0x9a9aa8, 0xb8b8c4, 0.45] : [0xa078ff, 0xbea0ff, 1];
      g.fillStyle(fill, 0.25 * a).fillEllipse(p.x, py, 48, 88);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(4, line, (0.8 - i * 0.2) * a);
        g.strokeEllipse(p.x, py, (26 - i * 6 + Math.sin(t * 4 + i) * 2) * 2, (46 - i * 8) * 2);
      }
    }
  }
}
