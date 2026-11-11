// 인벤토리 창 (I). 게임을 멈추지 않는 떠 있는 창.
// 오른쪽: 가방 (전체·장비·소비·기타 탭), 왼쪽 위 버튼을 누르면 왼쪽에 장비창이 펼쳐진다.
// PC: 마우스를 올리면 설명, 우클릭으로 장착·사용·해제. 모바일: 터치하면 설명, 두 번 터치로 장착·사용·해제.
// 가방 칸은 끌어다 놓아 옮길 수 있다 (빈 칸이면 옮기고, 물건이 있으면 자리 바꿈). 아래 정렬 버튼으로 자동 정렬.
// 장비는 껴도 가방에 남고, 끼고 있는 칸은 주황색 + "on".
import { BAG_SIZE, EQUIP_SLOTS, ITEM_TABS, itemDef, type EquipSlot, type ItemKind } from '@shared/data/items';
import { equippedEntry, equippedSlot } from '@shared/rules/inventory';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el } from './Dialog';
import { itemIcon } from './icons';
import { ItemTip } from './ItemTip';
import walkBody from '../../../assets/img/sprites/bones/player_bone_walk_body.png';
import walkHead from '../../../assets/img/sprites/bones/player_bone_walk_head.png';
import walkArm from '../../../assets/img/sprites/bones/player_bone_walk_front_arm.png';
import icoHat from '../../../assets/UI/equipment_icons/hat.png';
import icoRing from '../../../assets/UI/equipment_icons/ring.png';
import icoNeck from '../../../assets/UI/equipment_icons/neck.png';
import icoWeapon from '../../../assets/UI/equipment_icons/weapon.png';
import icoTop from '../../../assets/UI/equipment_icons/top.png';
import icoGloves from '../../../assets/UI/equipment_icons/gloves.png';
import icoBottom from '../../../assets/UI/equipment_icons/bottom.png';
import icoShoes from '../../../assets/UI/equipment_icons/shoes.png';

/** 장비창 빈 칸 아이콘 (반지1·반지2 같은 그림) */
const SLOT_ICONS: Record<EquipSlot, string> = {
  hat: icoHat, ring1: icoRing, ring2: icoRing, necklace: icoNeck, weapon: icoWeapon,
  top: icoTop, gloves: icoGloves, bottom: icoBottom, shoes: icoShoes,
};

/** 가방: 한 줄 4칸, 한 번에 5줄이 보이고 나머지는 오른쪽 휠로 내려 본다 */
const COLS = 4, VISIBLE_ROWS = 5;
/** 두 번 터치 인정 시간 (ms) */
const DOUBLE_TAP = 350;
/** 이만큼(px) 움직이면 끌기 시작 */
const DRAG_START = 6;
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
  /** 마지막으로 누른 포인터 종류 (모바일 길게 누르기가 우클릭으로 처리되지 않게) */
  private lastPointer = 'mouse';
  /** 끌기 중: 집은 칸(가방 번호), 따라다니는 아이콘 */
  private drag: { pid: number; from: number; x: number; y: number; on: boolean; ghost: HTMLElement | null } | null = null;

  constructor(private session: Session, private hud: Hud) {
    // 장비창 (왼쪽)
    const eqBar = el('div', 'inv-bar', '<span class="inv-title">equipment</span>');
    this.bindDrag(eqBar);
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
    const eqFoot = el('div', 'inv-bar inv-foot');
    this.bindDrag(eqFoot);
    this.equipPanel.appendChild(eqFoot);

    // 가방 (오른쪽)
    const main = el('div', 'inv-panel inv-main');
    const bar = el('div', 'inv-bar');
    this.bindDrag(bar);
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
    const body = el('div', 'inv-body inv-bag');
    body.appendChild(this.grid);
    body.appendChild(this.makeScrollbar());
    main.appendChild(body);
    // 아래 여백줄: 오른쪽에 자동 정렬 버튼
    const foot = el('div', 'inv-bar inv-foot');
    this.bindDrag(foot);
    foot.appendChild(el('span', 'inv-title'));
    const sortBtn = el('button', 'inv-btn inv-sort', '<i></i><i></i><i></i>', () => this.result(this.session.act({ type: 'sortBag' })));
    sortBtn.title = '자동 정렬';
    foot.appendChild(sortBtn);
    main.appendChild(foot);

    this.root.appendChild(this.equipPanel);
    this.root.appendChild(main);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);

    // 모바일: 칸 밖 아무 데나 터치하면 설명 닫기
    document.addEventListener('pointerdown', e => {
      this.lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest?.('.inv-cell')) this.tip.hide();
    }, true);
    addEventListener('pointermove', e => this.dragMove(e));
    addEventListener('pointerup', e => this.dragEnd(e));
    addEventListener('pointercancel', e => { if (this.drag?.pid === e.pointerId) this.dragCancel(); });
    this.setExpanded(false);
    // 화면 크기가 바뀌면 창이 화면 밖으로 나가지 않게
    addEventListener('resize', () => this.keepInside());
  }

  /** 윗줄(제목줄)을 꾹 눌러 끌면 창을 옮긴다. 버튼 위에서는 안 끌림 */
  private bindDrag(bar: HTMLElement) {
    let drag: { id: number; dx: number; dy: number } | null = null;
    bar.addEventListener('pointerdown', e => {
      if ((e.target as HTMLElement).closest('button') || (e.pointerType === 'mouse' && e.button !== 0)) return;
      e.preventDefault();
      const r = this.root.getBoundingClientRect();
      this.moveTo(r.left, r.top);
      drag = { id: e.pointerId, dx: e.clientX - r.left, dy: e.clientY - r.top };
      try { bar.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
      this.root.classList.add('dragging');
    });
    bar.addEventListener('pointermove', e => {
      if (drag?.id === e.pointerId) this.moveTo(e.clientX - drag.dx, e.clientY - drag.dy);
    });
    const end = (e: PointerEvent) => {
      if (drag?.id !== e.pointerId) return;
      drag = null;
      this.root.classList.remove('dragging');
    };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) bar.addEventListener(t, end);
  }

  /** 창 왼쪽 위를 (x, y) 로. 창이 화면 밖으로 나가지 않게 */
  private moveTo(x: number, y: number) {
    const r = this.root.getBoundingClientRect();
    x = Math.max(0, Math.min(innerWidth - r.width, x));
    y = Math.max(0, Math.min(innerHeight - r.height, y));
    this.root.classList.add('moved');
    this.root.style.left = `${x}px`;
    this.root.style.top = `${y}px`;
  }

  private keepInside() {
    if (!this.isOpen || !this.root.classList.contains('moved')) return;
    const r = this.root.getBoundingClientRect();
    this.moveTo(r.left, r.top);
  }

  get isOpen() { return this.root.classList.contains('open'); }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  open() { this.root.classList.add('open'); this.sig = ''; this.update(); this.keepInside(); }

  close() { this.root.classList.remove('open'); this.tip.hide(); }

  private setExpanded(v: boolean) {
    // 옮겨 둔 창이면 가방 쪽은 제자리에 두고 장비창이 왼쪽으로 펼쳐지게
    const main = this.root.lastElementChild as HTMLElement | null;
    const before = main?.getBoundingClientRect().left ?? 0;
    this.expanded = v;
    this.equipPanel.style.display = v ? '' : 'none';
    this.toggleBtn.textContent = v ? '▶' : '◀';
    this.sig = '';
    this.update();
    if (this.isOpen && this.root.classList.contains('moved') && main) {
      const r = this.root.getBoundingClientRect();
      this.moveTo(r.left + before - main.getBoundingClientRect().left, r.top);
    } else this.keepInside();
  }

  /** 매 프레임: 가방·장비가 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen || this.drag?.on) return;
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

    // 가방: 전체 탭은 실제 칸 그대로(빈 칸 유지), 다른 탭은 그 종류만 앞에서부터
    this.grid.innerHTML = '';
    const list = this.tab === 'all'
      ? s.bag.map((e, i) => ({ e, i }))
      : s.bag.map((e, i) => ({ e, i })).filter(({ e }) => e && itemDef(e.id)?.kind === this.tab);
    const cells = Math.max(BAG_SIZE, VISIBLE_ROWS * COLS);
    for (let c = 0; c < cells; c++) {
      const it = list[c];
      const cell = el('div', 'inv-cell');
      if (it) cell.dataset.index = String(it.i);
      const e = it?.e;
      if (e && it) {
        cell.classList.add('has');
        cell.appendChild(itemIcon(e.id));
        if (e.n > 1) cell.appendChild(el('span', 'inv-n', String(e.n)));
        if (equippedSlot(s, e.uid)) { cell.classList.add('on'); cell.appendChild(el('span', 'inv-on', 'on')); }
        this.bindCell(cell, `bag${it.i}:${e.id}:${e.uid ?? ''}`, e.id, () => this.useBag(it.i, e.id));
        this.bindItemDrag(cell, it.i);
      }
      this.grid.appendChild(cell);
    }
    requestAnimationFrame(() => this.syncScroll());

    // 장비창
    if (this.expanded) {
      this.equipGrid.innerHTML = '';
      for (const slot of EQUIP_GRID) {
        if (!slot) { this.equipGrid.appendChild(el('div', 'inv-gap')); continue; }
        const e = equippedEntry(s, slot);
        const cell = el('div', 'inv-cell eq' + (e ? '' : ' empty'));
        if (e) {
          cell.appendChild(itemIcon(e.id));
          this.bindCell(cell, `eq:${slot}:${e.uid}`, e.id, () => this.result(this.session.act({ type: 'unequip', slot })));
        } else {
          // 빈 칸: 부위 아이콘 (흰 선 그림)
          const img = el('img', 'inv-slot-ico') as HTMLImageElement;
          img.src = SLOT_ICONS[slot];
          img.alt = img.title = EQUIP_SLOTS[slot];
          img.draggable = false;
          cell.appendChild(img);
        }
        this.equipGrid.appendChild(cell);
      }
    }
  }

  // ---------- 끌어다 놓기 ----------
  private bindItemDrag(cell: HTMLElement, index: number) {
    cell.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragCancel();
      this.drag = { pid: e.pointerId, from: index, x: e.clientX, y: e.clientY, on: false, ghost: null };
    });
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START) return;
      // 끌기 시작: 집은 칸 표시 + 아이콘이 손가락(마우스)을 따라다님
      const entry = this.session.save.bag[d.from];
      if (!entry) { this.drag = null; return; }
      d.on = true;
      this.tip.hide();
      this.cellAt(d.from)?.classList.add('picked');
      d.ghost = el('div', 'inv-ghost');
      const icoW = this.cellAt(d.from)?.querySelector('.item-ico')?.getBoundingClientRect().width;
      if (icoW) d.ghost.style.setProperty('--ico', `${icoW}px`);
      d.ghost.appendChild(itemIcon(entry.id));
      // 창(.inv)에는 그림자 효과가 있어 안에 넣으면 위치가 어긋나므로 문서에 바로 붙인다
      document.body.appendChild(d.ghost);
    }
    e.preventDefault();
    d.ghost!.style.left = `${e.clientX}px`;
    d.ghost!.style.top = `${e.clientY}px`;
    const target = this.dropTarget(e);
    for (const c of this.grid.querySelectorAll('.drop')) if (c !== target) c.classList.remove('drop');
    if (target && Number(target.dataset.index) !== d.from) target.classList.add('drop');
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (d.on) {
      const target = this.dropTarget(e);
      this.dragCancel();
      // 끌기 직후의 터치는 두 번 터치로 치지 않음
      this.lastTap = { key: '', t: 0 };
      if (target) {
        const to = Number(target.dataset.index);
        if (to !== d.from) this.result(this.session.act({ type: 'moveItem', from: d.from, to }));
      }
    } else this.drag = null;
  }

  private dragCancel() {
    this.drag?.ghost?.remove();
    this.drag = null;
    for (const c of this.grid.querySelectorAll('.picked, .drop')) c.classList.remove('picked', 'drop');
    this.sig = '';
  }

  /** 포인터 아래의 가방 칸 (가방 번호가 있는 칸만) */
  private dropTarget(e: PointerEvent): HTMLElement | null {
    const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    const cell = hit?.closest<HTMLElement>('.inv-grid .inv-cell');
    return cell?.dataset.index !== undefined ? cell : null;
  }

  private cellAt(index: number) {
    return this.grid.querySelector<HTMLElement>(`.inv-cell[data-index="${index}"]`);
  }

  /** 가방 오른쪽 휠 (모바일에서도 보이게 직접 그림). 휠 굴리기·손잡이 끌기·막대 누르기로 내려 본다 */
  private makeScrollbar() {
    const track = el('div', 'inv-sb'), thumb = el('div', 'inv-sb-thumb');
    track.appendChild(thumb);
    const g = this.grid;
    const sync = () => {
      const max = g.scrollHeight - g.clientHeight, th = track.clientHeight;
      const h = max > 0 ? Math.max(20, th * g.clientHeight / g.scrollHeight) : th;
      thumb.style.height = `${h}px`;
      thumb.style.transform = `translateY(${max > 0 ? (th - h) * g.scrollTop / max : 0}px)`;
    };
    this.syncScroll = sync;
    g.addEventListener('scroll', sync);
    let drag: { id: number; y: number; top: number } | null = null;
    const scrollTo = (thumbTop: number) => {
      const max = g.scrollHeight - g.clientHeight, room = track.clientHeight - thumb.offsetHeight;
      if (room > 0) g.scrollTop = Math.max(0, Math.min(1, thumbTop / room)) * max;
    };
    track.addEventListener('pointerdown', e => {
      e.preventDefault();
      const r = track.getBoundingClientRect();
      if (e.target !== thumb) scrollTo(e.clientY - r.top - thumb.offsetHeight / 2);
      drag = { id: e.pointerId, y: e.clientY, top: g.scrollTop };
      try { track.setPointerCapture(e.pointerId); } catch { /* 무시 */ }
    });
    track.addEventListener('pointermove', e => {
      if (drag?.id !== e.pointerId) return;
      const max = g.scrollHeight - g.clientHeight, room = track.clientHeight - thumb.offsetHeight;
      if (room > 0) g.scrollTop = drag.top + (e.clientY - drag.y) * max / room;
    });
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) track.addEventListener(t, e => { if (drag?.id === e.pointerId) drag = null; });
    track.addEventListener('wheel', e => { g.scrollTop += e.deltaY; }, { passive: true });
    return track;
  }

  private syncScroll = () => {};

  /** 칸 하나: 설명 띄우기 + 우클릭(두 번 터치)으로 행동 */
  private bindCell(cell: HTMLElement, key: string, id: string, action: () => void) {
    cell.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.tip.show(key, id, e.clientX, e.clientY); });
    cell.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.tip.hide(); });
    cell.addEventListener('contextmenu', e => { e.preventDefault(); if (this.lastPointer === 'mouse') action(); });
    cell.addEventListener('pointerup', e => {
      if (e.pointerType === 'mouse') return;
      // 끌기를 놓는 순간은 터치로 치지 않음 (칸의 pointerup 이 창 전체보다 먼저 온다)
      if (this.drag?.on) return;
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

  /** 가방 칸 우클릭: 장비는 장착·해제, 포션·주문서는 사용 */
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
