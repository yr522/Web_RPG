// 아이템 설명 플로팅: 마우스(손가락) 위치에 반투명 검정 상자, 이름(큰 글씨) + 설명.
import { GRADES, itemDef, itemGrade } from '@shared/data/items';
import { esc } from './Dialog';

const OFFSET = 14;

export class ItemTip {
  private el = document.createElement('div');
  /** 지금 보여 주는 대상 (같은 대상이면 위치만 옮김) */
  key: string | null = null;

  constructor() {
    this.el.className = 'item-tip';
    document.body.appendChild(this.el);
  }

  show(key: string, id: string, x: number, y: number) {
    const d = itemDef(id);
    if (!d) return this.hide();
    if (this.key !== key) {
      this.key = key;
      // 장비는 이름을 등급 색으로
      const g = itemGrade(d);
      this.el.innerHTML = `<b${g ? ` style="color:${GRADES[g].color}"` : ''}>${esc(d.name)}</b><span>${esc(d.desc)}</span>`;
      this.el.style.display = 'block';
    }
    // 화면 밖으로 나가지 않게
    const w = this.el.offsetWidth, h = this.el.offsetHeight;
    let left = x + OFFSET, top = y + OFFSET;
    if (left + w > innerWidth - 4) left = x - OFFSET - w;
    if (top + h > innerHeight - 4) top = y - OFFSET - h;
    this.el.style.left = `${Math.max(4, left)}px`;
    this.el.style.top = `${Math.max(4, top)}px`;
  }

  hide() {
    this.key = null;
    this.el.style.display = 'none';
  }
}
