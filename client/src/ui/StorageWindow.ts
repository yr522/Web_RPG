// 창고 (창고지기 NPC): 개인 창고(이 캐릭터만) / 공용 창고(같은 계정의 캐릭터끼리).
// 위 = 창고 칸, 아래 = 가방. 가방 칸을 누르면 맡기고, 창고 칸을 누르면 꺼냄 (칸째로). 끼고 있는 장비는 못 맡김
import { itemDef } from '@shared/data/items';
import { equippedSlot, type Bag, type BagEntry } from '@shared/rules/inventory';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el } from './Dialog';
import { decorateGear, itemIcon } from './icons';
import { PanelWindow } from './PanelWindow';

type Box = 'personal' | 'shared';

export class StorageWindow extends PanelWindow<Box> {
  constructor(private session: Session, private hud: Hud) {
    super('storage', 'storage', [{ id: 'personal', label: '개인 창고' }, { id: 'shared', label: '공용 창고' }], 'personal');
  }

  private box(): Bag { return this.tab === 'personal' ? this.session.save.storage : this.session.sharedBox(); }

  protected signature() {
    const key = (b: Bag) => b.map(e => (e ? `${e.id}:${e.n}:${e.uid ?? ''}` : '')).join(',');
    return JSON.stringify([this.tab, key(this.box()), key(this.session.save.bag), this.session.save.equip]);
  }

  private cell(e: BagEntry | null, onClick: () => void, equipped = false) {
    const c = el('div', 'inv-cell' + (e ? '' : ' empty'));
    if (e) {
      c.appendChild(itemIcon(e.id));
      if (e.n > 1) c.appendChild(el('span', 'inv-n', String(e.n)));
      decorateGear(c, e);
      if (equipped) { c.classList.add('on'); c.appendChild(el('span', 'inv-on', 'on')); }
      c.title = itemDef(e.id)?.name ?? e.id;
      c.addEventListener('click', onClick);
    }
    return c;
  }

  private move(kind: 'deposit' | 'withdraw', index: number) {
    const r = this.tab === 'personal' ? this.session.act({ type: kind, index }) : this.session.shareMove(kind, index);
    if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.refresh();
  }

  protected render() {
    const s = this.session.save;
    this.body.innerHTML = '';
    const wrap = el('div', 'st-wrap');
    wrap.appendChild(el('div', 'st-label', this.tab === 'personal' ? '개인 창고' : '공용 창고 (모든 캐릭터)'));
    const top = el('div', 'st-grid');
    this.box().forEach((e, i) => top.appendChild(this.cell(e, () => this.move('withdraw', i))));
    wrap.appendChild(top);
    wrap.appendChild(el('div', 'st-label', '가방'));
    const bag = el('div', 'st-grid');
    s.bag.forEach((e, i) => bag.appendChild(this.cell(e, () => this.move('deposit', i), !!e && equippedSlot(s, e.uid) !== null)));
    wrap.appendChild(bag);
    this.body.appendChild(wrap);
  }
}
