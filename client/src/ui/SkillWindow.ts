// 스킬 창 (왼쪽 위 [스킬], K). 게임을 멈추지 않는 떠 있는 창 (인벤토리·퀘스트 창과 같은 틀).
// - 스킬 트리: 줄마다 왼쪽에 열리는 레벨, 직업 스킬이 위에서부터 한 줄씩. 한 줄에 최대 3칸 (지금은 첫 칸만, 나머지는 빈 칸 틀)
// - 오른쪽 위: 패시브 칸 (빈 칸)
// - 테두리 색 = 배운 원소 (안 배움·무속성은 흰색). 아래 "레벨/마스터"
// - 스킬 포인트(초기화 주문서로 돌려받은 레벨)가 있을 때만 왼쪽 위에 SP 가 깜빡이고, 배운 스킬에 + 버튼
// - 오른쪽 아래 ▼ 를 누르면 스킬 키 칸이 펼쳐짐. 배운 스킬을 끌어다 키에 등록·교체, 키끼리 끌어서 옮기기
//   (화면 아래 고정 스킬 칸은 끌기 안 됨)
import { CLASSES, MAX_SKILL_LEVEL, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, type SlotKey } from '@shared/data/classes';
import { ELEMENTS } from '@shared/data/elements';
import { learned, skillLevel } from '@shared/rules/progress';
import type { ActionResult } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el, esc } from './Dialog';

/** 한 줄 칸 수 (첫 칸 = 직업 스킬, 나머지는 나중에 갈래 스킬) */
const ROW_CELLS = 3;
/** 이만큼(px) 움직이면 끌기 시작 */
const DRAG_START = 6;

type DragSrc = { skill: string } | { key: SlotKey };

export class SkillWindow {
  private root = el('div', 'inv skw');
  private body = el('div', 'inv-body skw-body');
  private keysEl = el('div', 'skw-keys');
  private toggleBtn: HTMLButtonElement;
  private expanded = false;
  private sig = '';
  private drag: { pid: number; src: DragSrc; x: number; y: number; on: boolean; ghost: HTMLElement | null } | null = null;

  constructor(private session: Session, private hud: Hud) {
    const panel = el('div', 'inv-panel');
    const bar = el('div', 'inv-bar');
    bar.appendChild(el('span', 'inv-title', 'skill'));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    this.bindMove(bar);
    panel.appendChild(bar);
    panel.appendChild(this.body);
    panel.appendChild(this.keysEl);
    const foot = el('div', 'inv-bar inv-foot');
    this.bindMove(foot);
    foot.appendChild(el('span', 'inv-title'));
    this.toggleBtn = el('button', 'inv-btn', '▼', () => this.setExpanded(!this.expanded)) as HTMLButtonElement;
    foot.appendChild(this.toggleBtn);
    panel.appendChild(foot);
    this.root.appendChild(panel);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);
    addEventListener('pointermove', e => this.dragMove(e));
    addEventListener('pointerup', e => this.dragEnd(e));
    addEventListener('pointercancel', e => { if (this.drag?.pid === e.pointerId) this.dragCancel(); });
    addEventListener('resize', () => this.keepInside());
    this.setExpanded(false);
  }

  get isOpen() { return this.root.classList.contains('open'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  open() { this.root.classList.add('open'); this.sig = ''; this.update(); this.keepInside(); }
  close() { this.dragCancel(); this.root.classList.remove('open'); }

  private setExpanded(v: boolean) {
    this.expanded = v;
    this.keysEl.style.display = v ? '' : 'none';
    this.toggleBtn.textContent = v ? '▲' : '▼';
    this.sig = '';
    this.update();
    this.keepInside();
  }

  /** 매 프레임: 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen || this.drag?.on) return;
    const s = this.session.save;
    const sig = JSON.stringify([s.level, s.learned, s.skillLevels, s.skillPts, s.skillKeys, this.expanded]);
    if (sig === this.sig) return;
    this.sig = sig;
    this.render();
  }

  private render() {
    const s = this.session.save, cls = CLASSES[s.cls];
    this.body.innerHTML = '';

    // 위: 스킬 포인트(있을 때만) · 패시브 칸
    const top = el('div', 'skw-top');
    top.appendChild(s.skillPts > 0 ? el('div', 'skw-sp', `SP: ${s.skillPts}`) : el('div'));
    top.appendChild(el('div', 'skw-cell skw-empty skw-passive'));
    this.body.appendChild(top);

    // 스킬 트리
    const tree = el('div', 'skw-tree');
    cls.skills.forEach((id, i) => {
      const row = el('div', 'skw-row');
      row.appendChild(el('div', `skw-lv${s.level >= UNLOCK_LEVELS[i] ? ' open' : ''}`, `Lv.${UNLOCK_LEVELS[i]}`));
      row.appendChild(this.node(id, i));
      for (let c = 1; c < ROW_CELLS; c++) row.appendChild(el('div', 'skw-cell skw-empty'));
      tree.appendChild(row);
    });
    this.body.appendChild(tree);

    // 스킬 키 칸
    this.keysEl.innerHTML = '';
    if (this.expanded) {
      for (const k of SLOT_KEYS) {
        const id = s.skillKeys[k];
        const cell = el('div', 'skw-key' + (id ? ' has' : ''), `<span class="skw-k">${k}</span>`);
        cell.dataset.key = k;
        if (id) {
          const sk = SKILLS[id], on = learned(s, id);
          cell.appendChild(el('span', 'skw-kname' + (on ? '' : ' off'), esc(sk.short ?? sk.name)));
          cell.style.setProperty('--ec', this.color(id));
          this.bindDrag(cell, { key: k });
        }
        this.keysEl.appendChild(cell);
      }
    }
  }

  /** 스킬 칸 하나 (+ 아래 레벨, 위 선) */
  private node(id: string, i: number) {
    const s = this.session.save, sk = SKILLS[id], on = learned(s, id);
    const lv = on ? skillLevel(s, id) : 0;
    const prev = i > 0 ? learned(s, CLASSES[s.cls].skills[i - 1]) : false;
    const cell = el('div', `skw-cell skw-node${on ? ' on' : ''}`, `<span class="skw-name">${esc(sk.short ?? sk.name)}</span><span class="skw-badge">${lv}/${MAX_SKILL_LEVEL}</span>`);
    cell.style.setProperty('--ec', this.color(id));
    if (i > 0) cell.appendChild(el('i', `skw-line${prev && on ? ' on' : ''}`));
    if (on) this.bindDrag(cell, { skill: id });
    // 스킬 포인트로 레벨 올리기
    if (on && s.skillPts > 0 && lv < MAX_SKILL_LEVEL) {
      const plus = el('button', 'skw-plus', '+');
      plus.addEventListener('pointerdown', e => e.stopPropagation());
      plus.addEventListener('click', e => { e.stopPropagation(); this.result(this.session.act({ type: 'skillUp', skill: id })); });
      cell.appendChild(plus);
    }
    return cell;
  }

  /** 테두리 색: 배운 원소, 안 배움·무속성은 흰색 */
  private color(id: string) {
    const el = this.session.save.learned[id];
    return el ? ELEMENTS[el].color : '#ffffff';
  }

  // ---------- 끌어다 놓기 (스킬 → 키, 키 → 키) ----------
  private bindDrag(cell: HTMLElement, src: DragSrc) {
    cell.classList.add('drag');
    cell.addEventListener('pointerdown', e => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      this.dragCancel();
      this.drag = { pid: e.pointerId, src, x: e.clientX, y: e.clientY, on: false, ghost: null };
    });
  }

  private dragMove(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (!d.on) {
      if (Math.hypot(e.clientX - d.x, e.clientY - d.y) < DRAG_START) return;
      d.on = true;
      const id = 'skill' in d.src ? d.src.skill : this.session.save.skillKeys[d.src.key]!;
      const sk = SKILLS[id];
      d.ghost = el('div', 'skw-ghost', esc(sk.short ?? sk.name));
      d.ghost.style.setProperty('--ec', this.color(id));
      const s = getComputedStyle(this.root).getPropertyValue('--s');
      d.ghost.style.setProperty('--s', s);
      document.body.appendChild(d.ghost);
      // 키 칸이 접혀 있으면 펼침
      if (!this.expanded) { this.expanded = true; this.keysEl.style.display = ''; this.toggleBtn.textContent = '▲'; this.render(); this.keepInside(); }
    }
    e.preventDefault();
    d.ghost!.style.left = `${e.clientX}px`;
    d.ghost!.style.top = `${e.clientY}px`;
    const t = this.dropTarget(e);
    for (const c of this.keysEl.querySelectorAll('.drop')) if (c !== t) c.classList.remove('drop');
    t?.classList.add('drop');
  }

  private dragEnd(e: PointerEvent) {
    const d = this.drag;
    if (!d || d.pid !== e.pointerId) return;
    if (!d.on) { this.drag = null; return; }
    const t = this.dropTarget(e);
    this.dragCancel();
    const key = t?.dataset.key as SlotKey | undefined;
    if (!key) return;
    if ('skill' in d.src) this.result(this.session.act({ type: 'bindSkill', key, skill: d.src.skill }));
    else if (d.src.key !== key) this.result(this.session.act({ type: 'swapKeys', from: d.src.key, to: key }));
  }

  private dragCancel() {
    this.drag?.ghost?.remove();
    this.drag = null;
    for (const c of this.keysEl.querySelectorAll('.drop')) c.classList.remove('drop');
    this.sig = '';
  }

  private dropTarget(e: PointerEvent): HTMLElement | null {
    const hit = document.elementFromPoint(e.clientX, e.clientY) as HTMLElement | null;
    return hit?.closest<HTMLElement>('.skw-key') ?? null;
  }

  private result(r: ActionResult) {
    if (r.banner) this.hud.showBanner(r.banner, '#c8b8ff');
    else if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.sig = '';
    this.update();
  }

  // ---------- 창 옮기기 (윗줄·아랫줄을 끌어서) ----------
  private bindMove(bar: HTMLElement) {
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
    this.root.style.left = `${Math.max(0, Math.min(innerWidth - r.width, x))}px`;
    this.root.style.top = `${Math.max(0, Math.min(innerHeight - r.height, y))}px`;
  }

  private keepInside() {
    if (!this.isOpen || !this.root.classList.contains('moved')) return;
    const r = this.root.getBoundingClientRect();
    this.moveTo(r.left, r.top);
  }
}
