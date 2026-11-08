// 게임 화면. Session 의 상태를 읽어서 그리기만 한다 (게임 규칙은 shared/ 에).
import Phaser from 'phaser';
import { GROUND_Y } from '@shared/data/maps';
import { CLASSES } from '@shared/data/classes';
import type { Session } from '../session/LocalSession';
import type { Input } from '../input/Input';
import type { Hud } from '../hud/Hud';
import { palette } from './palette';
import fighterUrl from '../../../assets/temp/player_fighter_sprite_demo.png';

/** 화면 높이 (월드 좌표). 땅(470)이 화면 76% 높이에 오도록 해서 아래쪽 HUD에 캐릭터가 가리지 않게 한다. 폭은 화면 비율에 따라 720~1280 */
export const VIEW_H = 620;
const FONT = 'Pretendard, system-ui, sans-serif';
const ROBE: Record<string, number> = { warrior: 0x8a3a3a, mage: 0x4a3a8a, archer: 0x2f6a4a };
const STARS = Array.from({ length: 90 }, (_, i) => ({ x: (i * 977) % 2600, y: (i * 389) % 300, s: (i % 3) + 1 }));

export interface SceneDeps { session: Session; input: Input; hud: Hud; isTouch: boolean }

export class GameScene extends Phaser.Scene {
  private deps!: SceneDeps;
  private bg!: Phaser.GameObjects.Graphics;
  private fx!: Phaser.GameObjects.Graphics;
  private overlay!: Phaser.GameObjects.Graphics;
  private mapLayer!: Phaser.GameObjects.Container;
  private player!: Phaser.GameObjects.Image;
  private nameTag!: Phaser.GameObjects.Text;
  private bubble!: Phaser.GameObjects.Text;
  private camX = 0;
  private fade = 1;
  private viewW = 960;
  private zoom = 1;

  constructor() { super('game'); }

  init(deps: SceneDeps) { this.deps = deps; }

  preload() {
    this.load.image('fighter', fighterUrl);
  }

  create() {
    this.textures.get('fighter').setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.zoom = this.scale.height / VIEW_H;
    this.bg = this.add.graphics().setScrollFactor(0).setDepth(0);
    this.mapLayer = this.add.container(0, 0).setDepth(1);
    this.fx = this.add.graphics().setDepth(2);
    this.player = this.add.image(0, 0, 'fighter').setOrigin(0.5, 1).setScale(1.25).setDepth(5);
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
    for (const n of map.npcs) {
      const x = n.x, y = GROUND_Y;
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
    const events = session.update(dt, () => input.readCommand());
    for (const ev of events) {
      if (ev.type === 'mapEnter') { this.buildMap(); hud.showBanner(session.world.map.name); }
      if (ev.type === 'notice') hud.toast(ev.text);
    }

    const me = session.me(), prev = session.prevPos(), a = session.alpha;
    const px = prev.x + (me.x - prev.x) * a, py = prev.y + (me.y - prev.y) * a;
    const target = this.cameraTarget(px + me.w / 2, me.face);
    this.camX += (target - this.camX) * Math.min(1, dt * 6);
    this.cameras.main.setScroll(Math.round(this.camX * this.zoom) / this.zoom, 0);

    const pal = palette(Date.now());
    this.drawBackground(pal);
    this.drawPortals();

    this.player.setPosition(px + me.w / 2, py + me.h).setFlipX(me.face < 0);
    this.nameTag.setPosition(px + me.w / 2, py + me.h + 6);

    const portal = session.world.portalNear(me);
    const npc = session.world.map.npcs.find(n => Math.abs(n.x - (me.x + me.w / 2)) < 60);
    if (portal) this.showBubble(portal.x, GROUND_Y - 118, '↑ 이동');
    else if (npc) this.showBubble(npc.x, GROUND_Y - 122, npc.id === 'shop' ? '상점 (준비 중)' : '대화 (준비 중)');
    else this.bubble.setVisible(false);

    this.fade = Math.max(0, this.fade - dt * 2.5);
    this.overlay.clear();
    if (pal.phase === 2) this.overlay.fillStyle(0x0a0a32, 0.18).fillRect(0, 0, this.viewW, VIEW_H);
    if (this.fade > 0) this.overlay.fillStyle(0x000000, this.fade).fillRect(0, 0, this.viewW, VIEW_H);

    hud.update(session);
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
