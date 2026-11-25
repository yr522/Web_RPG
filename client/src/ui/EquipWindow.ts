// 장비창 (U). 인벤토리 창과 따로 떠 있는 창 (따로 끌어서 옮김). 인벤토리에서 장착·해제하면 자동으로 열림.
// 캐릭터 그림 위에 장비 칸. PC: 마우스를 올리면 설명, 우클릭으로 해제. 모바일: 터치 = 설명, 두 번 터치 = 해제.
// 인벤토리 칸을 끌어다 장비 칸에 놓으면 장착 (부위가 안 맞으면 아무 일도 없음) — 놓는 처리는 InventoryWindow.
import { EQUIP_SLOTS, type EquipSlot } from '@shared/data/items';
import { equippedEntry, type BagEntry } from '@shared/rules/inventory';
import { compareGear } from '@shared/rules/gear';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el } from './Dialog';
import { decorateGear, itemIcon } from './icons';
import { ItemTip } from './ItemTip';
import { clampToStage } from './stage';
import { SLOT_ICONS, gradeBorder } from './InventoryWindow';
import { faceOf } from '../scenes/PlayerAvatar';
import { headIcon } from './lookIcon';
import type { ClassId } from '@shared/data/classes';
import walkBody from '../../../assets/img/sprites/bones/player_bone_walk_body_true.png';
import walkHead from '../../../assets/img/sprites/bones/player_bone_walk_head_true.png';
import walkArm from '../../../assets/img/sprites/bones/player_bone_walk_front_arm_true.png';

/** 두 번 터치 인정 시간 (ms) */
const DOUBLE_TAP = 350;
/** Looks(치장) 탭: 장비 칸과 1:1 + 헤어·얼굴 (장비 탭의 빈 자리 위쪽 두 곳) */
type LookSlot = EquipSlot | 'hair' | 'face';
const LOOK_GRID: (LookSlot | null)[] = [
  'hair', 'hat', 'face',
  'ring1', 'necklace', 'weapon',
  'ring2', 'top', 'gloves',
  null, 'bottom', 'shoes',
];
/** 헤어·얼굴 칸 그림: 칸(96) 안의 머리 부분만 잘라서 (x, y, 크기) */

/** 장비창 칸 배치 (시안 순서, null = 빈 자리) */
const EQUIP_GRID: (EquipSlot | null)[] = [
  null, 'hat', null,
  'ring1', 'necklace', 'weapon',
  'ring2', 'top', 'gloves',
  null, 'bottom', 'shoes',
];

export class EquipWindow {
  readonly root = el('div', 'inv eqwin');
  private grid = el('div', 'inv-eq-grid');
  private sig = '';
  private tip = new ItemTip();
  private lastTap = { key: '', t: 0 };
  private lastPointer = 'mouse';
  private tab: 'armor' | 'looks' = 'armor';
  private tabBtns: HTMLButtonElement[] = [];
  /** 헤어·얼굴 칸 그림 (직업마다 한 번 만듦) */
  private iconVer = 0;

  constructor(private session: Session, private hud: Hud) {
    const panel = el('div', 'inv-panel inv-equip');
    const bar = el('div', 'inv-bar');
    bar.appendChild(el('span', 'inv-title', 'equipment'));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    this.bindDrag(bar);
    panel.appendChild(bar);
    const tabs = el('div', 'inv-tabs');
    for (const t of [{ id: 'armor', label: 'armor' }, { id: 'looks', label: 'Looks' }] as const) {
      const b = el('button', 'inv-tab' + (t.id === this.tab ? ' on' : ''), t.label, () => { this.tab = t.id; this.sig = ''; this.update(); }) as HTMLButtonElement;
      b.dataset.tab = t.id;
      this.tabBtns.push(b);
      tabs.appendChild(b);
    }
    panel.appendChild(tabs);
    const body = el('div', 'inv-body inv-eq-body');
    const fig = el('div', 'inv-figure');
    fig.style.backgroundImage = [walkArm, walkHead, walkBody].map(u => `url("${u}")`).join(', ');
    body.appendChild(fig);
    body.appendChild(this.grid);
    panel.appendChild(body);
    const foot = el('div', 'inv-bar inv-foot');
    this.bindDrag(foot);
    panel.appendChild(foot);
    this.root.appendChild(panel);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);
    document.addEventListener('pointerdown', e => {
      this.lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest?.('.inv-cell')) this.tip.hide();
    }, true);
    addEventListener('resize', () => this.keepInside());
  }

  get isOpen() { return this.root.classList.contains('open'); }

  /** beside: 이 창(인벤토리)의 왼쪽에 붙여서 연다 */
  open(beside?: DOMRect) {
    this.root.classList.add('open');
    this.sig = '';
    this.update();
    if (beside) {
      const r = this.root.getBoundingClientRect();
      this.moveTo(beside.left - r.width - 4, beside.top + (beside.height - r.height) / 2);
    } else this.keepInside();
  }

  close() { this.root.classList.remove('open'); this.tip.hide(); }

  toggle() { if (this.isOpen) this.close(); else this.open(); }

  /** 포인터 아래의 장비 칸 */
  slotAt(x: number, y: number): { cell: HTMLElement; slot: EquipSlot } | null {
    if (!this.isOpen) return null;
    const hit = document.elementFromPoint(x, y) as HTMLElement | null;
    const cell = hit?.closest<HTMLElement>('.eqwin .inv-cell[data-slot]');
    return cell ? { cell, slot: cell.dataset.slot as EquipSlot } : null;
  }

  /** 끌기 중 놓을 칸 표시 */
  mark(cell: HTMLElement | null) {
    for (const c of this.grid.querySelectorAll('.drop')) if (c !== cell) c.classList.remove('drop');
    cell?.classList.add('drop');
  }

  /** 매 프레임: 장비가 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen) return;
    const s = this.session.save;
    const sig = JSON.stringify([s.bag, s.equip, this.tab, s.cls, this.iconVer, s.face, s.eyeColor]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.render();
  }

  private render() {
    const s = this.session.save;
    this.tip.hide();
    this.grid.innerHTML = '';
    for (const b of this.tabBtns) b.classList.toggle('on', b.dataset.tab === this.tab);
    if (this.tab === 'looks') return this.renderLooks();
    for (const slot of EQUIP_GRID) {
      if (!slot) { this.grid.appendChild(el('div', 'inv-gap')); continue; }
      const e = equippedEntry(s, slot);
      const cell = el('div', 'inv-cell eq' + (e ? '' : ' empty'));
      cell.dataset.slot = slot;
      if (e) {
        gradeBorder(cell, e.id);
        cell.appendChild(itemIcon(e.id));
        decorateGear(cell, e);
        this.bindCell(cell, `eq:${slot}:${e.uid}:${e.enh ?? 0}:${JSON.stringify(e.opts ?? '')}`, e, () => this.result(this.session.act({ type: 'unequip', slot })));
      } else {
        // 빈 칸: 부위 아이콘 (흰 선 그림)
        const img = el('img', 'inv-slot-ico') as HTMLImageElement;
        img.src = SLOT_ICONS[slot];
        img.alt = img.title = EQUIP_SLOTS[slot];
        img.draggable = false;
        cell.appendChild(img);
      }
      this.grid.appendChild(cell);
    }
  }

  /**
   * Looks(치장) 탭: 장비 칸마다 치장 칸 (끼면 그 장비 외형을 대신함) + 헤어·얼굴.
   * 치장 아이템은 아직 없어서 장비 칸은 빈 칸, 헤어·얼굴은 지금 모습
   */
  private renderLooks() {
    const cls = this.session.save.cls;
    for (const slot of LOOK_GRID) {
      if (!slot) { this.grid.appendChild(el('div', 'inv-gap')); continue; }
      const cell = el('div', 'inv-cell eq look');
      if (slot === 'hair' || slot === 'face') {
        const url = this.lookIcon(cls, slot);
        cell.classList.toggle('empty', !url);
        if (url) {
          const img = el('img', 'item-ico look-ico') as HTMLImageElement;
          img.src = url;
          img.draggable = false;
          cell.appendChild(img);
        }
      } else {
        cell.classList.add('empty');
        const img = el('img', 'inv-slot-ico') as HTMLImageElement;
        img.src = SLOT_ICONS[slot];
        img.alt = img.title = EQUIP_SLOTS[slot];
        img.draggable = false;
        cell.appendChild(img);
      }
      this.grid.appendChild(cell);
    }
  }

  /** 헤어 칸 = 헤어만, 얼굴 칸 = 피부색 머리 + 얼굴 + 눈동자. 그림이 없으면 null */
  private lookIcon(cls: ClassId, slot: 'hair' | 'face'): string | null {
    const done = () => { this.iconVer++; this.sig = ''; this.update(); };
    if (slot === 'hair') return headIcon(cls, 'hair', done);
    const f = faceOf(this.session.save);
    return f ? headIcon(cls, { face: f, eye: this.session.save.eyeColor }, done) : null;
  }

  /** 칸 하나: 설명 띄우기 + 우클릭(두 번 터치)으로 해제 */
  private bindCell(cell: HTMLElement, key: string, e: BagEntry, action: () => void) {
    const cmp = () => compareGear(this.session.save, e);
    cell.addEventListener('pointermove', ev => { if (ev.pointerType === 'mouse') this.tip.show(key, e, ev.clientX, ev.clientY, cmp()); });
    cell.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') this.tip.hide(); });
    cell.addEventListener('contextmenu', ev => { ev.preventDefault(); if (this.lastPointer === 'mouse') action(); });
    cell.addEventListener('pointerup', ev => {
      if (ev.pointerType === 'mouse') return;
      const now = performance.now();
      if (this.lastTap.key === key && now - this.lastTap.t < DOUBLE_TAP) {
        this.lastTap = { key: '', t: 0 };
        this.tip.hide();
        action();
      } else {
        this.lastTap = { key, t: now };
        this.tip.key = null;
        this.tip.show(key, e, ev.clientX, ev.clientY, cmp());
      }
    });
  }

  private result(r: ActionResult) {
    if (r.banner) this.hud.showBanner(r.banner, '#c8b8ff');
    else if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.update();
  }

  /** 윗줄·아랫줄을 꾹 눌러 끌면 창을 옮긴다 */
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
    bar.addEventListener('pointermove', e => { if (drag?.id === e.pointerId) this.moveTo(e.clientX - drag.dx, e.clientY - drag.dy); });
    const end = (e: PointerEvent) => { if (drag?.id === e.pointerId) { drag = null; this.root.classList.remove('dragging'); } };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) bar.addEventListener(t, end);
  }

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
}
