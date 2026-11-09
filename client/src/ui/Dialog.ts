// 대화창·메뉴 창 공통 틀. 열려 있는 동안 게임 입력은 막힌다.
export const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '', onClick?: () => void) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  if (onClick) e.addEventListener('click', onClick);
  return e;
};

export const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

type Listener = (open: boolean) => void;

/** 한 번에 하나의 창만 열린다 */
export class DialogHost {
  private current: { root: HTMLElement; onClose?: () => void } | null = null;
  private listeners: Listener[] = [];

  constructor() {
    addEventListener('keydown', e => {
      if (e.code === 'Escape' && this.current) { e.preventDefault(); e.stopImmediatePropagation(); this.close(); }
    }, true);
  }

  get isOpen() { return !!this.current; }
  onChange(fn: Listener) { this.listeners.push(fn); }

  open(root: HTMLElement, onClose?: () => void) {
    this.close();
    const overlay = el('div', 'dlg-overlay');
    overlay.appendChild(root);
    overlay.addEventListener('pointerdown', e => { if (e.target === overlay) this.close(); });
    document.body.appendChild(overlay);
    this.current = { root: overlay, onClose };
    this.listeners.forEach(f => f(true));
  }

  close() {
    if (!this.current) return;
    const c = this.current;
    this.current = null;
    c.root.remove();
    c.onClose?.();
    this.listeners.forEach(f => f(false));
  }
}
