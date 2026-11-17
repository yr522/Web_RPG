// 아이템 설명 플로팅: 마우스(손가락) 위치에 반투명 검정 상자, 이름(큰 글씨) + 설명.
import { GRADES, bonusLine, itemDef, itemGrade, type BonusId } from '@shared/data/items';
import { baseBonus, optionValue } from '@shared/rules/gear';
import type { BagEntry } from '@shared/rules/inventory';
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

  /** item: 아이템 id, 또는 가방 칸 (장비는 강화·옵션까지 보여 줌) */
  show(key: string, item: string | BagEntry, x: number, y: number) {
    const e = typeof item === 'string' ? null : item, id = e ? e.id : (item as string);
    const d = itemDef(id);
    if (!d) return this.hide();
    if (this.key !== key) {
      this.key = key;
      // 장비는 이름을 등급 색으로
      const g = itemGrade(d);
      const name = `${e?.enh ? `+${e.enh} ` : ''}${d.name}`;
      let body = `<span>${esc(d.desc)}</span>`;
      if (e && d.kind === 'equip') {
        const b = baseBonus(e);
        body = (e.broken ? '<span class="tip-broken">파괴됨</span>' : '')
          + (Object.keys(b) as BonusId[]).map(k => `<span>${esc(bonusLine(k, b[k] ?? 0))}</span>`).join('')
          + (e.opts ?? []).map(o => `<span class="tip-opt">${esc(bonusLine(o.id, optionValue(o)))} <small>${o.tier}단계</small></span>`).join('');
      }
      this.el.innerHTML = `<b${g ? ` style="color:${GRADES[g].color}"` : ''}>${esc(name)}</b>${body}`;
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
