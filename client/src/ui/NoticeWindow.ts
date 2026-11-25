// 공지 창: 왼쪽 목록(최근 글이 위) + 오른쪽 상세. 공지 내용은 코드가 아니라 notices.json 에 있고 처음 열 때 불러옴
import { el, esc } from './Dialog';
import { PanelWindow } from './PanelWindow';

interface Notice { id: string; date: string; title: string; body: { heading?: string; lines: string[] }[] }

export class NoticeWindow extends PanelWindow {
  private list: Notice[] = [];
  private picked = '';
  private loaded = false;

  constructor() { super('notice', 'notice', [], ''); }

  open() { super.open(); void this.load(); }

  private async load() {
    if (this.loaded) return;
    this.loaded = true;
    try {
      const r = await fetch(`./notices.json?v=${Date.now()}`);
      const data = (await r.json()) as Notice[];
      // 날짜 최신순 (같은 날짜면 파일에서 아래에 있는 것이 위)
      this.list = data.map((n, i) => ({ n, i })).sort((a, b) => b.n.date.localeCompare(a.n.date) || b.i - a.i).map(x => x.n);
      this.picked = this.list[0]?.id ?? '';
    } catch { this.loaded = false; }
    this.refresh();
  }

  protected signature() { return `${this.picked}|${this.list.length}`; }

  protected render() {
    this.body.innerHTML = '';
    const list = el('div', 'qw-list'), detail = el('div', 'qw-detail');
    for (const n of this.list) {
      list.appendChild(el('div', `qw-item${n.id === this.picked ? ' on' : ''}`,
        `<span class="qw-name">${esc(n.title)}</span><span class="nt-date">${esc(n.date)}</span>`, () => { this.picked = n.id; this.refresh(); }));
    }
    const n = this.list.find(x => x.id === this.picked);
    if (n) {
      detail.appendChild(el('div', 'qw-title', `<b>${esc(n.title)}</b>`));
      detail.appendChild(el('div', 'nt-date', esc(n.date)));
      for (const sec of n.body) {
        if (sec.heading) detail.appendChild(el('div', 'qw-label', esc(sec.heading)));
        for (const line of sec.lines) detail.appendChild(el('p', 'qw-desc nt-line', esc(line)));
      }
    }
    this.body.appendChild(list);
    this.body.appendChild(detail);
  }
}
