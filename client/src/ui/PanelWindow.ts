// 떠 있는 창 공통 틀 (퀘스트 창과 같은 모양): 제목 줄(끌어서 옮기기·닫기) + 탭(있으면) + 본문.
// 게임을 멈추지 않음. 내용은 상속한 창이 render() 에서 그린다.
import { el } from './Dialog';
import { clampToStage } from './stage';

export abstract class PanelWindow<T extends string = string> {
  protected root: HTMLElement;
  protected body: HTMLElement;
  protected tabsEl = el('div', 'inv-tabs');
  protected tab: T;
  private sig = '';

  constructor(title: string, cls: string, tabs: { id: T; label: string }[], first: T) {
    this.root = el('div', `inv pwin ${cls}`);
    this.tab = first;
    const panel = el('div', 'inv-panel');
    const bar = el('div', 'inv-bar');
    bar.appendChild(el('span', 'inv-title', title));
    bar.appendChild(el('button', 'inv-btn inv-close', '✕', () => this.close()));
    this.bindDrag(bar);
    panel.appendChild(bar);
    if (tabs.length) {
      for (const t of tabs) {
        const b = el('button', 'inv-tab', t.label, () => { this.tab = t.id; this.refresh(); });
        b.dataset.tab = t.id;
        this.tabsEl.appendChild(b);
      }
      panel.appendChild(this.tabsEl);
    }
    this.body = el('div', 'inv-body pw-body');
    panel.appendChild(this.body);
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
  open() { this.root.classList.add('open'); this.refresh(); this.keepInside(); }
  close() { this.root.classList.remove('open'); }

  /** 매 프레임: 내용이 바뀌었을 때만 다시 그림 */
  update() {
    if (!this.isOpen) return;
    if (this.signature() !== this.sig) this.refresh();
  }
  protected refresh() {
    this.sig = this.signature();
    for (const b of this.tabsEl.children) (b as HTMLElement).classList.toggle('on', (b as HTMLElement).dataset.tab === this.tab);
    this.render();
  }
  /** 이 값이 바뀌면 다시 그림 */
  protected abstract signature(): string;
  protected abstract render(): void;

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
