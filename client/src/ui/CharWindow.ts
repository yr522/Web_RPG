// 캐릭터 창 (C). 게임을 멈추지 않는 떠 있는 창 (인벤토리 창과 같은 틀). 유저 시안:
// CHARACTER: 왼쪽 닉네임 + 정보 상자(레벨·직업·경험치·처치), 가운데 오른쪽 보는 캐릭터, 오른쪽 장비 칸 2줄.
// 오른쪽 세로 탭(▶)을 누르면 STATUS 창이 옆에 펼쳐짐 (능력치 분배·전투 수치). 남은 포인트가 있으면 열 때 펼쳐진 채로.
// 장비 칸: PC 마우스를 올리면 설명, 우클릭으로 해제. 모바일 터치 = 설명, 두 번 터치 = 해제.
import { CLASSES, expNeed, type StatId } from '@shared/data/classes';
import { EQUIP_SLOTS, GRADES, itemDef, itemGrade, type EquipSlot } from '@shared/data/items';
import { equipBonus, equippedEntry } from '@shared/rules/inventory';
import { advanceLine } from '@shared/rules/advance';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el, esc } from './Dialog';
import { decorateGear, itemIcon } from './icons';
import type { BagEntry } from '@shared/rules/inventory';
import { ItemTip } from './ItemTip';
import { SLOT_ICONS } from './InventoryWindow';
import walkBody from '../../../assets/img/sprites/bones/player_bone_walk_body_true.png';
import walkHead from '../../../assets/img/sprites/bones/player_bone_walk_head_true.png';
import walkArm from '../../../assets/img/sprites/bones/player_bone_walk_front_arm_true.png';
import { clampToStage } from './stage';

const STATS: Record<StatId, { name: string; desc: string }> = {
  str: { name: '근력', desc: '검사 데미지 · 최대 체력' },
  dex: { name: '민첩', desc: '궁수 데미지 · 이동속도' },
  int: { name: '지능', desc: '마법사 데미지 · MP 회복속도' },
};

/** 장비 칸 (2줄, 위에서부터. 마지막 줄은 1칸) */
const EQUIP_ROWS: EquipSlot[][] = [
  ['hat', 'necklace'],
  ['top', 'gloves'],
  ['bottom', 'shoes'],
  ['ring1', 'ring2'],
  ['weapon'],
];

const DOUBLE_TAP = 350;

export class CharWindow {
  private root = el('div', 'inv cwin');
  private statusPanel = el('div', 'inv-panel cw-status');
  private info = el('div', 'cw-info');
  private equipEl = el('div', 'cw-equip');
  private statusBody = el('div', 'inv-body cw-sbody');
  private sideBtn: HTMLButtonElement;
  private statusOpen = false;
  private sig = '';
  private tip = new ItemTip();
  private lastTap = { key: '', t: 0 };
  private lastPointer = 'mouse';

  constructor(private session: Session, private hud: Hud) {
    // CHARACTER
    const main = el('div', 'inv-panel cw-main');
    const bar = el('div', 'inv-bar');
    bar.appendChild(el('span', 'inv-title', 'CHARACTER'));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    this.bindDrag(bar);
    main.appendChild(bar);
    const body = el('div', 'inv-body cw-body');
    body.appendChild(this.info);
    const fig = el('div', 'cw-figure');
    const sprite = el('div', 'cw-sprite');
    sprite.style.backgroundImage = [walkArm, walkHead, walkBody].map(u => `url("${u}")`).join(', ');
    fig.appendChild(sprite);
    body.appendChild(fig);
    body.appendChild(this.equipEl);
    main.appendChild(body);
    const foot = el('div', 'inv-bar inv-foot');
    this.bindDrag(foot);
    main.appendChild(foot);

    // 오른쪽 세로 탭: STATUS 펼치기·접기
    this.sideBtn = el('button', 'cw-side', '', () => this.setStatus(!this.statusOpen)) as HTMLButtonElement;

    // STATUS
    const sbar = el('div', 'inv-bar');
    sbar.appendChild(el('span', 'inv-title', 'STATUS'));
    this.bindDrag(sbar);
    this.statusPanel.appendChild(sbar);
    this.statusPanel.appendChild(this.statusBody);
    const sfoot = el('div', 'inv-bar inv-foot');
    this.bindDrag(sfoot);
    this.statusPanel.appendChild(sfoot);

    this.root.appendChild(main);
    this.root.appendChild(this.sideBtn);
    this.root.appendChild(this.statusPanel);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);
    document.addEventListener('pointerdown', e => {
      this.lastPointer = e.pointerType;
      if (e.pointerType !== 'mouse' && !(e.target as HTMLElement).closest?.('.cw-equip .inv-cell')) this.tip.hide();
    }, true);
    addEventListener('resize', () => this.keepInside());
    this.setStatus(false);
  }

  get isOpen() { return this.root.classList.contains('open'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  /** 열 때: 올릴 능력치(남은 포인트)가 있으면 STATUS 를 펼친 채로 */
  open() {
    this.root.classList.add('open');
    this.setStatus(this.session.save.statPts > 0);
  }
  close() { this.root.classList.remove('open'); this.tip.hide(); }

  private setStatus(v: boolean) {
    this.statusOpen = v;
    this.statusPanel.style.display = v ? '' : 'none';
    this.sideBtn.textContent = v ? '◀' : '▶';
    this.sig = '';
    this.update();
    this.keepInside();
  }

  /** 매 프레임: 바뀐 게 있을 때만 다시 그린다 */
  update() {
    if (!this.isOpen) return;
    const sig = this.signature();
    if (sig !== this.sig) this.render();
  }

  private signature() {
    const s = this.session.save, st = this.session.me()?.stats;
    return JSON.stringify([s.name, s.level, s.exp, s.kills, s.stats, s.statPts, s.equip, s.bag.filter(e => e?.uid !== undefined && Object.values(s.equip).includes(e.uid)), st, this.statusOpen]);
  }

  private render() {
    this.sig = this.signature();
    this.tip.hide();
    const s = this.session.save, cls = CLASSES[s.cls];
    // 올릴 능력치가 있는데 STATUS 를 닫아 두면 여는 탭이 깜빡임
    this.sideBtn.classList.toggle('blink', !this.statusOpen && s.statPts > 0);

    // 왼쪽: 닉네임 + 정보 상자
    this.info.innerHTML = '';
    this.info.appendChild(el('div', 'cw-name', esc(s.name)));
    const box = el('div', 'cw-box');
    const line = (k: string, v: string) => box.appendChild(el('div', 'cw-line', `<b>${k}</b><span>${v}</span>`));
    line('LV.', String(s.level));
    const adv = advanceLine(s);
    line('직업', cls.name);
    if (adv) line('전직', adv.name);
    line('EXP', `${s.exp} / ${expNeed(s.level)}`);
    line('처치', String(s.kills));
    this.info.appendChild(box);

    // 오른쪽: 장비 칸
    this.equipEl.innerHTML = '';
    for (const row of EQUIP_ROWS) {
      const r = el('div', 'cw-row');
      for (const slot of row) r.appendChild(this.equipCell(slot));
      this.equipEl.appendChild(r);
    }

    if (this.statusOpen) this.renderStatus();
  }

  private equipCell(slot: EquipSlot) {
    const s = this.session.save, e = equippedEntry(s, slot);
    const cell = el('div', 'inv-cell eq' + (e ? '' : ' empty'));
    if (e) {
      const g = itemGrade(itemDef(e.id));
      if (g) { cell.classList.add('graded', `g-${g}`); cell.style.setProperty('--gc', GRADES[g].color); }
      cell.appendChild(itemIcon(e.id));
      decorateGear(cell, e);
      this.bindCell(cell, `cw:${slot}:${e.uid}:${e.enh ?? 0}:${JSON.stringify(e.opts ?? '')}`, e, () => this.result(this.session.act({ type: 'unequip', slot })));
    } else {
      const img = el('img', 'inv-slot-ico') as HTMLImageElement;
      img.src = SLOT_ICONS[slot];
      img.alt = img.title = EQUIP_SLOTS[slot];
      img.draggable = false;
      cell.appendChild(img);
    }
    return cell;
  }

  private renderStatus() {
    const s = this.session.save, cls = CLASSES[s.cls], b = this.statusBody, st = this.session.me().stats;
    b.innerHTML = '';
    b.appendChild(el('div', 'cw-pts', `남은 포인트 <span class="pts">${s.statPts}</span>`));
    const bonus = equipBonus(s);
    for (const k of Object.keys(STATS) as StatId[]) {
      const row = el('div', 'cw-stat');
      row.appendChild(el('b', '', STATS[k].name + (cls.main === k ? ' ★' : '')));
      row.appendChild(el('span', 'v', String(s.stats[k])));
      row.appendChild(el('span', 'eqb', bonus[k] ? `+${bonus[k]}` : ''));
      const plus = el('button', 'plus', '+', () => { this.session.act({ type: 'stat', stat: k }); this.update(); }) as HTMLButtonElement;
      plus.disabled = s.statPts <= 0;
      row.appendChild(plus);
      b.appendChild(row);
      b.appendChild(el('div', 'cw-desc', STATS[k].desc));
    }
    const list = el('div', 'cw-box cw-derived');
    const line = (k: string, v: string) => list.appendChild(el('div', 'cw-line', `<b>${k}</b><span>${v}</span>`));
    line('공격력', st.atk.toFixed(1));
    line('방어력', String(st.def));
    line('최대 HP', String(st.maxHp));
    line('최대 MP', String(st.maxMp));
    line('이동속도', String(Math.round(st.speed)));
    line('MP 회복', `${st.regen.toFixed(1)}/초`);
    // 장비 옵션으로 생긴 것만
    const pct = (v: number) => `${Math.round(v * 1000) / 10}%`;
    if (st.hpRegen > 0) line('HP 회복', `${st.hpRegen.toFixed(1)}/초`);
    if (st.crit > 0) line('치명타 확률', `+${pct(st.crit)}`);
    if (st.mpCost > 0) line('MP 소모 감소', pct(st.mpCost));
    if (st.boss > 0) line('보스 피해', `+${pct(st.boss)}`);
    if (st.mob > 0) line('일반몹 피해', `+${pct(st.mob)}`);
    b.appendChild(list);
    b.appendChild(el('div', 'cw-desc', `★ = ${cls.name} 주 능력치`));
  }

  /** 장비 칸: 설명 띄우기 + 우클릭(두 번 터치)으로 해제 */
  private bindCell(cell: HTMLElement, key: string, id: string | BagEntry, action: () => void) {
    cell.addEventListener('pointermove', e => { if (e.pointerType === 'mouse') this.tip.show(key, id, e.clientX, e.clientY); });
    cell.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') this.tip.hide(); });
    cell.addEventListener('contextmenu', e => { e.preventDefault(); if (this.lastPointer === 'mouse') action(); });
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

  private result(r: ActionResult) {
    if (r.banner) this.hud.showBanner(r.banner, '#c8b8ff');
    else if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.update();
  }

  // ---------- 창 옮기기 (윗줄·아랫줄을 끌어서) ----------
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
    this.root.classList.add('moved');
    const c = clampToStage(x, y, r.width, r.height);
    this.root.style.left = `${c.x}px`;
    this.root.style.top = `${c.y}px`;
  }

  private keepInside() {
    if (!this.isOpen || !this.root.classList.contains('moved')) return;
    const r = this.root.getBoundingClientRect();
    this.moveTo(r.left, r.top);
  }
}
