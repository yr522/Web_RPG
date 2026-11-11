// 머리 위 작은 말풍선. NPC 와 플레이어 모두 쓸 수 있다 (시나리오 장면에서 GameScene.say 로 띄움).
import Phaser from 'phaser';

const FONT = 'Pretendard, system-ui, sans-serif';
const PAD_X = 8, PAD_Y = 5, TAIL = 6, RADIUS = 7;
/** 사라질 때 흐려지는 시간 (초) */
const FADE = 0.3;

export class SpeechBubble {
  readonly root: Phaser.GameObjects.Container;
  private g: Phaser.GameObjects.Graphics;
  private label: Phaser.GameObjects.Text;
  private left = 0;

  constructor(scene: Phaser.Scene, resolution: number) {
    this.g = scene.add.graphics();
    this.label = scene.add.text(0, 0, '', { fontFamily: FONT, fontSize: '12px', fontStyle: 'bold', color: '#222' })
      .setOrigin(0.5, 1).setResolution(resolution);
    this.root = scene.add.container(0, 0, [this.g, this.label]).setDepth(7.5).setVisible(false);
  }

  get visible() { return this.left > 0; }

  /** life 초 동안 보여 준다 */
  show(text: string, life: number) {
    this.left = life;
    if (this.label.text !== text) this.label.setText(text);
    const w = this.label.width + PAD_X * 2, h = this.label.height + PAD_Y * 2;
    // (0,0) = 꼬리 끝. 말풍선은 그 위에 그린다
    this.g.clear()
      .fillStyle(0xffffff, 0.95).fillRoundedRect(-w / 2, -TAIL - h, w, h, RADIUS)
      .fillTriangle(-5, -TAIL - 1, 5, -TAIL - 1, 0, 0)
      .lineStyle(1.5, 0x333333, 0.6).strokeRoundedRect(-w / 2, -TAIL - h, w, h, RADIUS);
    this.label.setPosition(0, -TAIL - PAD_Y);
    this.root.setVisible(true).setAlpha(1);
  }

  hide() { this.left = 0; this.root.setVisible(false); }

  /** 매 프레임: (x, y) = 머리 꼭대기 */
  update(dt: number, x: number, y: number) {
    if (this.left <= 0) return;
    this.left -= dt;
    if (this.left <= 0) { this.hide(); return; }
    this.root.setPosition(x, y).setAlpha(Math.min(1, this.left / FADE));
  }

  destroy() { this.root.destroy(); }
}
