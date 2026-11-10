// 게임 화면. Session 의 상태를 읽어서 그리기만 한다 (게임 규칙은 shared/ 에).
import Phaser from 'phaser';
import { GROUND_Y } from '@shared/data/maps';
import { CLASSES } from '@shared/data/classes';
import type { Session } from '../session/LocalSession';
import type { Input } from '../input/Input';
import type { Hud } from '../hud/Hud';
import { palette } from './palette';
import { professorHasNews } from '@shared/rules/progress';
import { ELEMENTS } from '@shared/data/elements';
import type { Fx } from '@shared/sim/types';

const hex = (c: string) => parseInt(c.slice(1, 7), 16);
import { PlayerAvatar, preloadAvatar } from './PlayerAvatar';
import slimeUrl from '../../../assets/img/sprites/새 폴더/01_slime/slime.png';
import { COIN } from '@shared/data/monsters';

/** 화면 높이 (월드 좌표). 땅(470)이 화면 76% 높이에 오도록 해서 아래쪽 HUD에 캐릭터가 가리지 않게 한다. 폭은 화면 비율에 따라 720~1280 */
export const VIEW_H = 620;
const FONT = 'Pretendard, system-ui, sans-serif';
const ROBE: Record<string, number> = { warrior: 0x8a3a3a, mage: 0x4a3a8a, archer: 0x2f6a4a };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 977) % 2600, y: (i * 389) % 300, s: (i % 3) + 1 }));

export interface SceneDeps { session: Session; input: Input; hud: Hud; isTouch: boolean; openNpc: (id: 'prof' | 'shop') => void }

export class GameScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private bg!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private mapLayer!: Phaser.GameObjects.Container;
  private player!: PlayerAvatar;
  private nameTag!: Phaser.GameObjects.Text;
  private bubble!: Phaser.GameObjects.Text;
  private floats: { t: Phaser.GameObjects.Text; age: number; life: number }[] = [];
  private profMark: Phaser.GameObjects.Text | null = null;
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
  private coinG!: Phaser.GameObjects.Graphics;
  private fade = 1;
  private viewW = 960;
  private zoom = 1;

  constructor() { super('game'); }

  init(deps: SceneDeps) { this.deps = deps; }

  preload() {
    preloadAvatar(this);
    // 슬라임: 32×32 칸 3개 (1 기본 · 2 이동 · 3 점프 준비)
    this.load.spritesheet('slime', slimeUrl, { frameWidth: 32, frameHeight: 32 });
  }

  create() {
    this.makeGraySlime();
    this.zoom = this.scale.height / VIEW_H;
    this.bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.mapLayer = this.add.container(0, 0).setDepth(1);
    this.fx = this.add.graphics().setDepth(2);
    this.combat = this.add.graphics().setDepth(4);
    this.coinG = this.add.graphics().setDepth(4.5);
    this.fxG = this.add.graphics().setDepth(6);
    this.underG = this.add.graphics().setDepth(4.8);
    this.projG = this.add.graphics().setDepth(6.5);
    this.player = new PlayerAvatar(this).setDepth(5);
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
  private buildMap() {
    this.mapLayer.removeAll(true);
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
        g.fillStyle(0x2b2a3f).fillRect(0, p.y, map.width, p.h);
        g.fillStyle(map.building ? 0x7a6a8a : 0x4a7a4a).fillRect(0, p.y, map.width, 6);
      } else {
        g.fillStyle(0x6b5640).fillRect(p.x, p.y, p.w, p.h);
        g.fillStyle(0x8fae6a).fillRect(p.x, p.y, p.w, 4);
      }
    }
    for (const s of map.signs) {
      g.fillStyle(0x5a4630).fillRect(s.x - 3, GROUND_Y - 50, 6, 50);
      g.fillStyle(0x7a6040).fillRect(s.x - 75, GROUND_Y - 74, 150, 28);
      this.mapLayer.add(this.text(s.text, 14, '#fff3d0').setStroke('#000', 0).setOrigin(0.5).setPosition(s.x, GROUND_Y - 60));
    }
    for (const pt of map.portals) {
      this.mapLayer.add(this.text(pt.label, 12, '#e8dcff').setOrigin(0.5, 1).setPosition(pt.x, GROUND_Y - 98));
    }
    this.profMark = null;
    for (const n of map.npcs) {
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
    const me = this.deps.session.me();
    this.camX = this.cameraTarget(me.x + me.w / 2, me.face);
    this.fade = 1;
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
    return Math.max(0, Math.min(Math.max(0, w - this.viewW), cx - this.viewW / 2 + face * 60));
  }

  private lastFrame = performance.now();

  update() {
    const { session, input, hud } = this.deps;
    // Phaser 의 delta 는 튀는 값을 깎아서 느린 기기에서 게임이 느려진다 → 실제 경과 시간을 직접 잰다
    const nowMs = performance.now();
    const dt = Math.min(0.25, (nowMs - this.lastFrame) / 1000);
    this.lastFrame = nowMs;
    // 타격감: 맞는 순간 아주 잠깐 멈칫(hitstop)
    const events = this.hitstop > 0 ? [] : session.update(dt, () => input.readCommand());
    this.hitstop = Math.max(0, this.hitstop - dt);
    for (const ev of events) {
      if (ev.type === 'mapEnter') { this.buildMap(); hud.showBanner(session.world.map.name); }
      if (ev.type === 'notice') hud.toast(ev.text);
      if (ev.type === 'interact') this.deps.openNpc(ev.npc);
      if (ev.type === 'float') this.addFloat(ev.x, ev.y, ev.text, ev.color, ev.size, ev.life);
      if (ev.type === 'banner') hud.showBanner(ev.text, ev.color);
      if (ev.type === 'fx') this.fxList.push({ f: ev.fx, t: 0 });
      if (ev.type === 'hit') {
        this.flash.set(ev.enemyId, 0.1);
        this.hitstop = Math.max(this.hitstop, ev.reaction ? 0.08 : ev.heavy ? 0.045 : 0.02);
        if (ev.reaction) this.shake = Math.max(this.shake, 7);
      }
      if (ev.type === 'died') this.shake = 0;
    }

    const me = session.me(), prev = session.prevPos(), a = session.alpha;
    const px = prev.x + (me.x - prev.x) * a, py = prev.y + (me.y - prev.y) * a;
    const target = this.cameraTarget(px + me.w / 2, me.face);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    this.shake = Math.max(0, this.shake - 30 * dt);
    const sx = (Math.random() - 0.5) * this.shake, sy = (Math.random() - 0.5) * this.shake;
    this.cameras.main.setScroll(Math.round((this.camX + sx) * this.zoom) / this.zoom, Math.round(sy * this.zoom) / this.zoom);

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
    this.player.setVisible(!(me.invT > 0 && Math.floor(this.time.now / 50) % 2 === 0));
    this.nameTag.setPosition(px + me.w / 2, py + me.h + 6);

    const portal = session.world.portalNear(me);
    const npc = session.world.map.npcs.find(n => Math.abs(n.x - (me.x + me.w / 2)) < 60);
    if (portal) this.showBubble(portal.x, GROUND_Y - 118, '↑ 이동');
    else if (npc) this.showBubble(npc.x, GROUND_Y - 126, `↑ / ${this.deps.isTouch ? '터치' : '클릭'}: ${npc.id === 'shop' ? '상점' : '대화'}`);
    else this.bubble.setVisible(false);
    if (this.bubble.visible && input.blocked) this.bubble.setVisible(false);

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
        sp = this.add.sprite(0, 0, e.elem ? 'slime_gray' : 'slime', 0).setOrigin(0.5, 1).setScale(1.45).setDepth(4);
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
      else sp.clearTint();
      if (!label) {
        label = this.text(e.elem ? `${ELEMENTS[e.elem].name} 슬라임` : '슬라임', 11, '#ffffff').setStroke('#000', 2).setOrigin(0.5, 0).setDepth(4);
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
    for (const [id, t] of this.enemyLabels) if (!alive.has(id)) t.setVisible(false);
    for (const [id, sp] of this.enemySprites) if (!alive.has(id)) sp.setVisible(false);

    // 골드: 빙글빙글 도는 동전, 사라지기 5초 전부터 깜빡임
    const cg = this.coinG;
    cg.clear();
    for (const c of world.coins) {
      if (c.t > COIN.life - COIN.blinkLast && Math.floor(c.t * 8) % 2) continue;
      const spin = Math.abs(Math.cos(this.time.now / 250 + c.x));
      const rx = 7 * (0.35 + 0.65 * spin);
      cg.fillStyle(0xffd84a).fillEllipse(c.x + 7, c.y + 7, rx * 2, 14);
      cg.lineStyle(1.5, 0xb8901a).strokeEllipse(c.x + 7, c.y + 7, rx * 2, 14);
    }

    const me = this.deps.session.me();
    // 천붕 준비: 몸 주위 원
    if (me.cbWindow > 0 && me.data.learned.cheonbung !== undefined) {
      const el = me.data.learned.cheonbung;
      g.fillStyle(el ? hex(ELEMENTS[el].color) : 0xffffff, 0.3).fillCircle(me.x + me.w / 2, me.y + me.h / 2, 34);
    }
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
    for (const p of this.deps.session.world.map.portals) {
      g.fillStyle(0xa078ff, 0.25).fillEllipse(p.x, GROUND_Y - 48, 48, 88);
      for (let i = 0; i < 3; i++) {
        g.lineStyle(4, 0xbea0ff, 0.8 - i * 0.2);
        g.strokeEllipse(p.x, GROUND_Y - 48, (26 - i * 6 + Math.sin(t * 4 + i) * 2) * 2, (46 - i * 8) * 2);
      }
    }
  }
}
