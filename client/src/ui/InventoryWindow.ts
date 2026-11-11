// 인벤토리 창 (I). 게임을 멈추지 않는 떠 있는 창.
// 오른쪽: 가방 (전체·장비·소비·기타 탭), 왼쪽 위 버튼을 누르면 왼쪽에 장비창이 펼쳐진다.
// PC: 마우스를 올리면 설명, 우클릭으로 장착·사용·해제. 모바일: 터치하면 설명, 두 번 터치로 장착·사용·해제.
import { EQUIP_SLOTS, ITEM_TABS, itemDef, type EquipSlot, type ItemKind } from '@shared/data/items';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el } from './Dialog';
import { itemIcon } from './icons';
import { ItemTip } from './ItemTip';
import walkBody from '../../../assets/img/sprites/bones/player_bone_walk_body.png';
import walkHead from '../../../assets/img/sprites/bones/player_bone_walk_head.png';
import walkArm from '../../../assets/img/sprites/bones/player_bone_walk_front_arm.png';

/** 가방은 최소 이만큼 칸을 보여 준다 (4줄 × 5칸 = 시안) */
const COLS = 4, MIN_ROWS = 5;
/** 두 번 터치 인정 시간 (ms) */
const DOUBLE_TAP = 350;
/** 장비창 칸 배치 (시안 순서, null = 빈 자리) */
const EQUIP_GRID: (EquipSlot | null)[] = [
  null, 'hat', null,
  'ring1', 'necklace', 'weapon',
  'ring2', 'top', 'gloves',
  null, 'bottom', 'shoes',
];

type Tab = 'all' | ItemKind;

export class InventoryWindow {
  private root = el('div', 'inv');
  private equipPanel = el('div', 'inv-panel inv-equip');
  private grid = el('div', 'inv-grid');
  private tabsEl = el('div', 'inv-tabs');
  private equipGrid = el('div', 'inv-eq-grid');
  private toggleBtn: HTMLButtonElement;
  private tab: Tab = 'all';
  private expanded = false;
  private sig = '';
  private tip = new ItemTip();
  private lastTap = { key: '', t: 0 };
  private resetArmed = 0;

  constructor(private session: Session, private hud: Hud) {
    // 장비창 (왼쪽)
    const eqBar = el('div', 'inv-bar', '<span class="inv-title">equipment</span>');
    this.equipPanel.appendChild(eqBar);
    const eqTabs = el('div', 'inv-tabs');
    eqTabs.appendChild(el('button', 'inv-tab on', 'armor'));
    eqTabs.appendChild(el('button', 'inv-tab', 'Looks'));
    this.equipPanel.appendChild(eqTabs);
    const eqBody = el('div', 'inv-body inv-eq-body');
    const fig = el('div', 'inv-figure');
    fig.style.backgroundImage = [walkArm, walkHead, walkBody].map(u => `url("${u}")`).join(', ');
    eqBody.appendChild(fig);
    eqBody.appendChild(this.equipGrid);
    this.equipPanel.appendChild(eqBody);

    // 가방 (오른쪽)
    const main = el('div', 'inv-panel inv-main');
    const bar = el('div', 'inv-bar');
    this.toggleBtn = el('button', 'inv-btn', '', () => this.setExpanded(!this.expanded)) as HTMLButtonElement;
    bar.appendChild(this.toggleBtn);
    bar.appendChild(el('span', 'inv-title', 'inventory'));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    main.appendChild(bar);
    for (const t of ITEM_TABS) {
      const b = el('button', 'inv-tab', t.label, () => { this.tab = t.id; this.render(); });
      b.dataset.tab = t.id;
      this.tabsEl.appendChild(b);
    }
    main.appendChild(this.tabsEl);
    const body = el('div', 'inv-body');
    body.appendChild(this.grid);
    main.appendChild(body);

    this.root.appendChild(this.equipPanel);
    this.root.appendChild(main);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);

    // 모바일: 칸 밖 아무 데나 터치하면 설명 닫기
    document.addEventListener('pointerdown', e => {
      if (e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest?.('.inv-cell')) this.tip.hide();
    }, true);
    this.setExpanded(false);
  }

  get isOpen() { return this.root.classList.contains('open'); }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  open() { this.root.classList.add('open'); this.sig = ''; this.update(); }

  close() { this.root.classList.remove('open'); this.tip.hide(); }

  private setExpanded(v: boolean) {
    this.expanded = v;
    this.equipPanel.style.display = v ? '' : 'none';
    this.toggleBtn.textContent = v ? '▶' : '◀';
    this.sig = '';
    this.update();
  }

  /** 매 프레임: 가방·장비가 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen) return;
    const s = this.session.save;
    const sig = JSON.stringify([s.bag, s.equip, this.tab, this.expanded]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.render();
  }

  private render() {
    const s = this.session.save;
    this.sig = JSON.stringify([s.bag, s.equip, this.tab, this.expanded]);
    this.tip.hide();
    for (const b of this.tabsEl.children) (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.tab === this.tab);

    // 가방: 탭에 맞는 물건만, 얻은 순서대로
    this.grid.innerHTML = '';
    const list = s.bag.map((e, i) => ({ e, i })).filter(({ e }) => this.tab === 'all' || itemDef(e.id)?.kind === this.tab);
    const cells = Math.max(MIN_ROWS * COLS, Math.ceil(list.length / COLS) * COLS);
    for (let c = 0; c < cells; c++) {
      const it = list[c];
      const cell = el('div', 'inv-cell');
      if (it) {
        cell.appendChild(itemIcon(it.e.id));
        if (it.e.n > 1) cell.appendChild(el('span', 'inv-n', String(it.e.n)));
        this.bindCell(cell, `bag${it.i}:${it.e.id}`, it.e.id, () => this.useBag(it.i, it.e.id));
      }
      this.grid.appendChild(cell);
    }

    // 장비창
    if (this.expanded) {
      this.equipGrid.innerHTML = '';
      for (const slot of EQUIP_GRID) {
        if (!slot) { this.equipGrid.appendChild(el('div', 'inv-gap')); continue; }
        const id = s.equip[slot];
        const cell = el('div', 'inv-cell eq' + (id ? '' : ' empty'));
        if (id) {
          cell.appendChild(itemIcon(id));
          this.bindCell(cell, `eq:${slot}:${id}`, id, () => this.result(this.session.act({ type: 'unequip', slot })));
        } else cell.appendChild(el('span', 'inv-label', EQUIP_SLOTS[slot]));
        this.equipGrid.appendChild(cell);
      }
    }
  }

  /** 칸 하나: 설명 띄우기 + 우클릭(두 번 터치)으로 행동 */
  private bindCell(cell: HTMLElement, key: string, id: string, action: () => void) {
    cell.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.tip.show(key, id, e.clientX, e.clientY); });
    cell.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.tip.hide(); });
    cell.addEventListener('contextmenu', e => { e.preventDefault(); action(); });
    cell.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse') return;
      const now = performance.now();
      if (this.lastTap.key === key && now - this.lastTap.t < DOUBLE_TAP) {
        this.lastTap = { key: '', t: 0 };
        this.tip.hide();
        action();
      } else {
        this.lastTap = { key, t: now };
        this.tip.key = null;
        this.tip.show(key, id, e.clientX, e.clientY);
      }
    });
  }

  /** 가방 칸 우클릭: 장비는 장착, 포션·주문서는 사용 */
  private useBag(index: number, id: string) {
    const d = itemDef(id);
    if (!d) return;
    if (d.kind === 'equip') return this.result(this.session.act({ type: 'equip', index }));
    if (id === 'hp' || id === 'mp') return this.session.usePotion(id);
    if (id === 'reset') {
      // 한 번 더 눌러야 사용 (캐릭터 창과 같은 방식)
      const now = performance.now();
      if (now - this.resetArmed > 3000) { this.resetArmed = now; this.hud.toast('정말 쓸까? 한 번 더 누르면 사용'); return; }
      this.resetArmed = 0;
      this.result(this.session.act({ type: 'useReset' }));
    }
  }

  private result(r: ActionResult) {
    if (r.banner) this.hud.showBanner(r.banner, '#c8b8ff');
    else if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.update();
  }
}
