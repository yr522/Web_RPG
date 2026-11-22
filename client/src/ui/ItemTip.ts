// 아이템 설명 플로팅: 마우스(손가락) 위치에 반투명 검정 상자, 이름(큰 글씨) + 설명.
import { GRADES, bonusLine, itemDef, itemGrade, type BonusId } from '@shared/data/items';
import { baseBonus, optionValue } from '@shared/rules/gear';
import type { BagEntry } from '@shared/rules/inventory';
import { esc } from './Dialog';
import { GEAR_SETS, setCount, setOf, setPartWorn } from '@shared/data/sets';

const OFFSET = 14;

export class ItemTip {
  private el = document.createElement('div');
  /** 지금 보여 주는 대상 (같은 대상이면 위치만 옮김) */
  key: string | null = null;
  /** 지금 끼고 있는 장비 id (세트 효과 표시용, main 에서 연결) */
  static worn: () => string[] = () => [];

  constructor() {
    this.el.className = 'item-tip';
    document.body.appendChild(this.el);
  }

  /**
   * item: 아이템 id, 또는 가방 칸 (장비는 강화·옵션까지 보여 줌).
   * cmp: 이 장비를 끼면 바뀌는 능력치 (끼고 있는 장비와 비교, 안 끼고 있는 장비만)
   */
  show(key: string, item: string | BagEntry, x: number, y: number, cmp?: { k: BonusId; v: number }[] | null) {
    const e = typeof item === 'string' ? null : item, id = e ? e.id : (item as string);
    const d = itemDef(id);
    if (!d) return this.hide();
    if (cmp) key += `|${JSON.stringify(cmp)}`;
    const set = d.kind === 'equip' ? setOf(id) : null, worn = set ? ItemTip.worn() : [];
    if (set) key += `|${worn.join(',')}`;
    if (this.key !== key) {
      this.key = key;
      // 장비는 이름을 등급 색으로
      const g = itemGrade(d);
      const name = `${e?.enh ? `+${e.enh} ` : ''}${d.name}`;
      let body = `<span>${esc(d.desc)}</span>`;
      // 도구: 내구도 (파괴되면 빨간 글씨)
      if (e && d.kind === 'tool') body = (e.broken ? '<span class="tip-broken">파괴됨</span>' : '') + body + `<span>내구도 ${e.dur ?? 0} / ${d.dur ?? 0}</span>`;
      if (e && d.kind === 'equip') {
        const b = baseBonus(e);
        body = (e.broken ? '<span class="tip-broken">파괴됨</span>' : '')
          + (Object.keys(b) as BonusId[]).map(k => `<span>${esc(bonusLine(k, b[k] ?? 0))}</span>`).join('')
          + (e.opts ?? []).map(o => `<span class="tip-opt">${esc(bonusLine(o.id, optionValue(o)))} <small>${o.tier}단계</small></span>`).join('');
        // 세트: 이름 (낀 개수/전체), 세트 장비 (낀 것은 밝게), 효과 (켜진 것은 밝게)
        if (set) {
          const g = GEAR_SETS[set], n = setCount(set, worn);
          // 여러 개 중 하나인 칸(직업별 무기): 끼고 있는 것 → 이 아이템 → 첫 번째 이름
          const label = (i: string | string[]) => (Array.isArray(i) ? i.find(x => worn.includes(x)) ?? (i.includes(id) ? id : i[0]) : i);
          body += `<hr><span class="tip-set">${esc(g.name)} (${n}/${g.items.length})</span>`
            + g.items.map(i => `<span class="tip-set-item${setPartWorn(i, worn) ? ' on' : ''}">${esc(itemDef(label(i))?.name ?? label(i))}</span>`).join('')
            + g.effects.map(ef => `<span class="tip-set-ef${n >= ef.n ? ' on' : ''}">${ef.n}세트: ${esc((Object.keys(ef.bonus) as BonusId[]).map(k => bonusLine(k, ef.bonus[k] ?? 0)).join(' · '))}</span>`).join('');
        }
        // 끼면 바뀌는 능력치: 오르면 ▲ 초록, 내리면 ▼ 빨강
        if (cmp?.length) {
          body += '<hr>' + cmp.map(c => {
            const line = bonusLine(c.k, Math.abs(c.v)).replace(' +', ' ');
            return `<span class="${c.v > 0 ? 'tip-up' : 'tip-down'}">${c.v > 0 ? '▲' : '▼'} ${esc(line)}</span>`;
          }).join('');
        }
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
