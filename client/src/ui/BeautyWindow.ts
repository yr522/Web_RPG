// 성형 창 (성형사 NPC, 테스트): 얼굴 고르기 + 눈동자 색 7색. 누르면 바로 바뀜
import { EYE_COLORS, FACES } from '@shared/data/looks';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { faceOf } from '../scenes/PlayerAvatar';
import { el } from './Dialog';
import { headIcon } from './lookIcon';
import { PanelWindow } from './PanelWindow';

export class BeautyWindow extends PanelWindow {
  private iconVer = 0;
  constructor(private session: Session, private hud: Hud) {
    super('성형', 'beauty', [], '');
  }

  protected signature() {
    const s = this.session.save;
    return JSON.stringify([s.cls, s.face, s.eyeColor, this.iconVer]);
  }

  private set(look: { face?: string; eyeColor?: string }) {
    const r = this.session.act({ type: 'setLook', ...look });
    if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.refresh();
  }

  protected render() {
    const s = this.session.save, now = faceOf(s);
    this.body.innerHTML = '';
    const wrap = el('div', 'st-wrap');
    wrap.appendChild(el('div', 'st-label', '얼굴'));
    const faces = el('div', 'st-grid bt-row');
    FACES.forEach(f => {
      const c = el('div', 'inv-cell' + (f === now ? ' on' : ''));
      const url = headIcon(s.cls, { face: f, eye: s.eyeColor }, () => { this.iconVer++; this.update(); });
      if (url) { const img = el('img', 'item-ico look-ico') as HTMLImageElement; img.src = url; img.draggable = false; c.appendChild(img); }
      c.addEventListener('click', () => this.set({ face: f }));
      faces.appendChild(c);
    });
    wrap.appendChild(faces);
    wrap.appendChild(el('div', 'st-label', '눈동자'));
    const eyes = el('div', 'st-grid bt-row');
    for (const hex of EYE_COLORS) {
      const c = el('div', 'inv-cell bt-color' + (hex === s.eyeColor ? ' on' : ''));
      c.style.background = hex;
      c.addEventListener('click', () => this.set({ eyeColor: hex }));
      eyes.appendChild(c);
    }
    wrap.appendChild(eyes);
    this.body.appendChild(wrap);
  }
}
