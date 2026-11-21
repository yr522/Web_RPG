// 인벤토리 창 (I). 게임을 멈추지 않는 떠 있는 창.
// 가방 (전체·장비·소비·기타 탭). 왼쪽 위 버튼으로 장비창(EquipWindow, 따로 떠 있는 창)을 열고 닫는다.
// PC: 마우스를 올리면 설명, 우클릭으로 장착·사용·해제. 모바일: 터치하면 설명, 두 번 터치로 장착·사용·해제.
// 가방 칸 끌어다 놓기: 가방 칸이면 옮기기(물건이 있으면 자리 바꿈), 장비창 칸이면 장착(부위가 안 맞으면 아무 일 없음),
// 게임 화면(창 밖)이면 캐릭터 자리 바닥에 버리기. 아래 정렬 버튼으로 자동 정렬.
// 장비는 껴도 가방에 남고, 끼고 있는 칸은 주황색 + "on".
import { BAG_SIZE, GRADES, ITEM_TABS, POTIONS, itemDef, itemGrade, type EquipSlot, type ItemKind } from '@shared/data/items';
import { equippedSlot, type BagEntry } from '@shared/rules/inventory';
import { compareGear } from '@shared/rules/gear';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el } from './Dialog';
import { decorateGear, itemIcon } from './icons';
import { ItemTip } from './ItemTip';
import icoHat from '../../../assets/UI/equipment_icons/hat.png';
import icoRing from '../../../assets/UI/equipment_icons/ring.png';
import icoNeck from '../../../assets/UI/equipment_icons/neck.png';
import icoWeapon from '../../../assets/UI/equipment_icons/weapon.png';
import icoTop from '../../../assets/UI/equipment_icons/top.png';
import icoGloves from '../../../assets/UI/equipment_icons/gloves.png';
import icoBottom from '../../../assets/UI/equipment_icons/bottom.png';
import icoShoes from '../../../assets/UI/equipment_icons/shoes.png';
import { clampToStage } from './stage';
import type { EquipWindow } from './EquipWindow';

/** 장비창 빈 칸 아이콘 (반지1·반지2 같은 그림) */
export const SLOT_ICONS: Record<EquipSlot, string> = {
  hat: icoHat, ring1: icoRing, ring2: icoRing, necklace: icoNeck, weapon: icoWeapon,
  top: icoTop, gloves: icoGloves, bottom: icoBottom, shoes: icoShoes,
};

/** 가방: 한 줄 4칸, 한 번에 5줄이 보이고 나머지는 오른쪽 휠로 내려 본다 */
const COLS = 4, VISIBLE_ROWS = 5;
/** 두 번 터치 인정 시간 (ms) */
const DOUBLE_TAP = 350;
/** 이만큼(px) 움직이면 끌기 시작 */
const DRAG_START = 6;
type Tab = 'all' | ItemKind;

export class InventoryWindow {
  private root = el('div', 'inv invwin');
  private grid = el('div', 'inv-grid');
  private tabsEl = el('div', 'inv-tabs');
  private toggleBtn: HTMLButtonElement;
  private tab: Tab = 'all';
  private sig = '';
  private tip = new ItemTip();
  private lastTap = { key: '', t: 0 };
  private resetArmed = 0;
  /** 마지막으로 누른 포인터 종류 (모바일 길게 누르기가 우클릭으로 처리되지 않게) */
  private lastPointer = 'mouse';
  /** 끌기 중: 집은 칸(가방 번호), 따라다니는 아이콘 */
  private drag: { pid: number; from: number; x: number; y: number; on: boolean; ghost: HTMLElement | null } | null = null;

  constructor(private session: Session, private hud: Hud, private equipWin: EquipWindow) {
    const main = el('div', 'inv-panel inv-main');
    const bar = el('div', 'inv-bar');
    this.bindDrag(bar);
    this.toggleBtn = el('button', 'inv-btn', '◀', () => this.toggleEquip()) as HTMLButtonElement;
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
    equipWin.onToggle = () => { this.toggleBtn.textContent = equipWin.isOpen ? '▶' : '◀'; };
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
    ({ x, y } = clampToStage(x, y, r.width, r.height));
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

  /** 장비창 열고 닫기: 처음 열 때는 인벤토리 왼쪽에 붙여서 */
  private toggleEquip() {
    if (this.equipWin.isOpen) this.equipWin.close();
    else this.equipWin.open(this.equipWin.root.classList.contains('moved') ? undefined : this.root.getBoundingClientRect());
  }

  /** 매 프레임: 가방·장비가 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen || this.drag?.on) return;
    const s = this.session.save;
    const sig = JSON.stringify([s.bag, s.equip, this.tab]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.render();
  }

  private render() {
    const s = this.session.save;
    this.sig = JSON.stringify([s.bag, s.equip, this.tab]);
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
        gradeBorder(cell, e.id);
        cell.appendChild(itemIcon(e.id));
        decorateGear(cell, e);
        if (e.n > 1) cell.appendChild(el('span', 'inv-n', String(e.n)));
        if (equippedSlot(s, e.uid)) { cell.classList.add('on'); cell.appendChild(el('span', 'inv-on', 'on')); }
        this.bindCell(cell, `bag${it.i}:${e.id}:${e.uid ?? ''}:${e.enh ?? 0}:${e.broken ? 1 : 0}:${JSON.stringify(e.opts ?? '')}`, e, () => this.useBag(it.i, e.id));
        this.bindItemDrag(cell, it.i);
      }
      this.grid.appendChild(cell);
    }
    requestAnimationFrame(() => this.syncScroll());

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
    const eq = this.equipWin.slotAt(e.clientX, e.clientY);
    this.equipWin.mark(eq && fitsSlot(this.session.save.bag[d.from]?.id, eq.slot) ? eq.cell : null);
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (d.on) {
      const target = this.dropTarget(e);
      this.dragCancel();
      // 끌기 직후의 터치는 두 번 터치로 치지 않음
      this.lastTap = { key: '', t: 0 };
      const eq = this.equipWin.slotAt(e.clientX, e.clientY);
      if (target) {
        const to = Number(target.dataset.index);
        if (to !== d.from) this.result(this.session.act({ type: 'moveItem', from: d.from, to }));
      } else if (eq) {
        // 장비 칸에 놓기: 부위가 안 맞으면 아무 일 없음
        this.result(this.session.act({ type: 'equipTo', index: d.from, slot: eq.slot }));
        this.equipWin.update();
      } else if (overGame(e)) this.session.dropBag(d.from);
    } else this.drag = null;
  }

  private dragCancel() {
    this.drag?.ghost?.remove();
    this.drag = null;
    for (const c of this.grid.querySelectorAll('.picked, .drop')) c.classList.remove('picked', 'drop');
    this.equipWin.mark(null);
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
  private bindCell(cell: HTMLElement, key: string, id: string | BagEntry, action: () => void) {
    const cmp = () => (typeof id === 'string' ? null : compareGear(this.session.save, id));
    cell.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.tip.show(key, id, e.clientX, e.clientY, cmp()); });
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
        this.tip.show(key, id, e.clientX, e.clientY, cmp());
      }
    });
  }

  /** 가방 칸 우클릭: 장비는 장착·해제, 포션·주문서는 사용 */
  private useBag(index: number, id: string) {
    const d = itemDef(id);
    if (!d) return;
    if (d.kind === 'equip') return this.result(this.session.act({ type: 'equip', index }));
    if (POTIONS[id]) return this.session.usePotion(id);
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

/** 이 물건을 이 장비 칸에 낄 수 있는지 (부위만 봄) */
function fitsSlot(id: string | undefined, slot: EquipSlot) {
  const part = id ? itemDef(id)?.part : undefined;
  return part === 'ring' ? slot === 'ring1' || slot === 'ring2' : !!part && part === slot;
}

/** 포인터가 창·버튼이 아닌 게임 화면 위에 있는지 (바닥에 버리기) */
function overGame(e: PointerEvent) {
  const hit = document.elementFromPoint(e.clientX, e.clientY);
  return hit instanceof HTMLCanvasElement && !!hit.closest('#game');
}

/** 장비 등급 색 테두리 (장비가 아니면 그대로) */
export function gradeBorder(cell: HTMLElement, id: string) {
  const g = itemGrade(itemDef(id));
  if (!g) return;
  cell.classList.add('graded', `g-${g}`);
  cell.style.setProperty('--gc', GRADES[g].color);
}
