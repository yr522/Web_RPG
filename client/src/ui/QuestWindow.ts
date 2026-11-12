// 퀘스트 창 (왼쪽 위 [퀘스트]). 게임을 멈추지 않는 떠 있는 창 (인벤토리 창과 같은 틀).
// 탭: 진행 중 / 수락 대기 / 완료. 왼쪽 목록에서 고르면 오른쪽에 제목·관련 NPC·개요·조건.
// 진행 중 탭은 목록에서 핀을 꽂고 뺄 수 있다 (핀 꽂은 퀘스트는 화면 왼쪽 맨 위에 항상 보임).
import { QUEST_PIN_MAX, type QuestDef } from '@shared/data/quests';
import { doneQuests, npcName, questLines, sortedActive } from '@shared/rules/quests';
import { offeredQuests } from '@shared/rules/story';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { PIN_SVG } from '../hud/Hud';
import { el, esc } from './Dialog';

type Tab = 'active' | 'offer' | 'done';
const TABS: { id: Tab; label: string }[] = [
  { id: 'active', label: '진행 중' },
  { id: 'offer', label: '수락 대기' },
  { id: 'done', label: '완료' },
];

export class QuestWindow {
  private root = el('div', 'inv qwin');
  private tabsEl = el('div', 'inv-tabs');
  private list = el('div', 'qw-list');
  private detail = el('div', 'qw-detail');
  private tab: Tab = 'active';
  /** 탭마다 고른 퀘스트 */
  private picked: Record<Tab, string | null> = { active: null, offer: null, done: null };
  private sig = '';

  constructor(private session: Session, private hud: Hud) {
    const panel = el('div', 'inv-panel');
    const bar = el('div', 'inv-bar');
    bar.appendChild(el('span', 'inv-title', 'quest'));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    this.bindDrag(bar);
    panel.appendChild(bar);
    for (const t of TABS) {
      const b = el('button', 'inv-tab', t.label, () => { this.tab = t.id; this.render(); });
      b.dataset.tab = t.id;
      this.tabsEl.appendChild(b);
    }
    panel.appendChild(this.tabsEl);
    const body = el('div', 'inv-body qw-body');
    body.appendChild(this.list);
    body.appendChild(this.detail);
    panel.appendChild(body);
    const foot = el('div', 'inv-bar inv-foot');
    this.bindDrag(foot);
    panel.appendChild(foot);
    this.root.appendChild(panel);
    this.root.addEventListener('contextmenu', e => e.preventDefault());
    document.body.appendChild(this.root);
    addEventListener('resize', () => this.keepInside());
  }

  get isOpen() { return this.root.classList.contains('open'); }
  toggle() { if (this.isOpen) this.close(); else this.open(); }
  open() { this.root.classList.add('open'); this.sig = ''; this.update(); this.keepInside(); }
  close() { this.root.classList.remove('open'); }

  /** 탭별 목록 */
  private entries(tab: Tab): QuestDef[] {
    const s = this.session.save;
    if (tab === 'active') return sortedActive(s);
    if (tab === 'offer') return offeredQuests(s, this.session.nowMs());
    return doneQuests(s);
  }

  /** 매 프레임: 내용이 바뀌었을 때만 다시 그린다 */
  update() {
    if (!this.isOpen) return;
    if (this.signature() !== this.sig) this.render();
  }

  private signature() {
    const s = this.session.save, list = this.entries(this.tab);
    return JSON.stringify([this.tab, this.picked[this.tab], s.questPins, list.map(q => [q.id, questLines(s, q, this.lineState())])]);
  }

  /** 조건 줄 상태: 완료 탭은 전부 다 함, 수락 대기 탭은 전부 0 */
  private lineState() { return this.tab === 'done' ? 'done' as const : this.tab === 'offer' ? 'none' as const : undefined; }

  private render() {
    this.sig = this.signature();
    const s = this.session.save, list = this.entries(this.tab), tab = this.tab;
    for (const b of this.tabsEl.children) (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.tab === tab);
    if (!list.some(q => q.id === this.picked[tab])) this.picked[tab] = list[0]?.id ?? null;
    const full = s.questPins.length >= QUEST_PIN_MAX;

    this.list.innerHTML = '';
    for (const q of list) {
      const pin = s.questPins.includes(q.id);
      const item = el('div', `qw-item${q.main ? ' main' : ''}${q.id === this.picked[tab] ? ' on' : ''}`,
        `<i class="qw-dot"></i><span class="qw-name">${esc(q.name)}</span>`, () => { this.picked[tab] = q.id; this.render(); });
      if (tab === 'active') {
        const b = el('button', `q-pin qw-pin${pin ? ' on' : ''}`, PIN_SVG) as HTMLButtonElement;
        b.disabled = !pin && full;
        b.addEventListener('click', e => {
          e.stopPropagation();
          const r = this.session.act({ type: 'questPin', id: q.id });
          if (!r.ok && r.msg) this.hud.toast(r.msg);
          this.render();
        });
        item.appendChild(b);
      }
      this.list.appendChild(item);
    }

    const q = list.find(o => o.id === this.picked[tab]);
    this.detail.innerHTML = '';
    if (!q) return;
    this.detail.appendChild(el('div', `qw-title${q.main ? ' main' : ''}`, `<i class="qw-dot"></i><b>${esc(q.name)}</b>`));
    this.detail.appendChild(el('div', 'qw-row', `<span class="qw-label">관련 NPC</span>${esc(npcName(s, q.giver))}`));
    this.detail.appendChild(el('div', 'qw-label', '개요'));
    this.detail.appendChild(el('p', 'qw-desc', esc(q.desc)));
    this.detail.appendChild(el('div', 'qw-label', '조건'));
    const lines = questLines(s, q, this.lineState());
    for (const l of lines) this.detail.appendChild(el('div', `qw-goal${l.done ? ' done' : ''}`, esc(l.text)));
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
    this.root.style.left = `${Math.max(0, Math.min(innerWidth - r.width, x))}px`;
    this.root.style.top = `${Math.max(0, Math.min(innerHeight - r.height, y))}px`;
  }

  private keepInside() {
    if (!this.isOpen || !this.root.classList.contains('moved')) return;
    const r = this.root.getBoundingClientRect();
    this.moveTo(r.left, r.top);
  }
}
