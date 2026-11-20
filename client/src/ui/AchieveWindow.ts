// 업적 · 칭호: 업적 목록(진행도), 달성한 업적은 칭호로 달 수 있음 (능력치 없음)
import { ACHIEVEMENTS, achievementDef } from '@shared/data/achievements';
import { achievementProgress } from '@shared/rules/achievements';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el, esc } from './Dialog';
import { PanelWindow } from './PanelWindow';

export class AchieveWindow extends PanelWindow {
  constructor(private session: Session, private hud: Hud) { super('achievement', 'achieve', [], ''); }

  protected signature() {
    const s = this.session.save;
    return JSON.stringify([s.title, s.achievements, ACHIEVEMENTS.map(a => achievementProgress(s, a).cur)]);
  }

  protected render() {
    const s = this.session.save;
    this.body.innerHTML = '';
    const wrap = el('div', 'ac-wrap');
    const cur = achievementDef(s.title);
    wrap.appendChild(el('div', 'ac-head',
      `<span class="qw-label">칭호</span>${cur ? `<b style="color:${cur.color ?? 'inherit'}">「${esc(cur.name)}」</b>` : '없음'}<span class="ac-n">${s.achievements.length} / ${ACHIEVEMENTS.length}</span>`));
    const list = el('div', 'ac-list');
    for (const a of ACHIEVEMENTS) {
      const done = s.achievements.includes(a.id), p = achievementProgress(s, a);
      const row = el('div', `ac-item${done ? ' done' : ''}${s.title === a.id ? ' on' : ''}`);
      row.appendChild(el('div', 'ac-text', `<b>${esc(a.name)}</b><small>${esc(a.desc)}</small>`));
      if (done) {
        const on = s.title === a.id;
        row.appendChild(el('button', `sm${on ? '' : ' go'}`, on ? '떼기' : '칭호 달기', () => {
          const r = this.session.act({ type: 'title', id: on ? null : a.id });
          if (!r.ok && r.msg) this.hud.toast(r.msg);
          this.refresh();
        }));
      } else {
        const k = Math.min(1, p.cur / p.need);
        row.appendChild(el('div', 'ac-prog', `<i style="width:${k * 100}%"></i><span>${Math.min(p.cur, p.need).toLocaleString('ko-KR')} / ${p.need.toLocaleString('ko-KR')}</span>`));
      }
      list.appendChild(row);
    }
    wrap.appendChild(list);
    this.body.appendChild(wrap);
  }
}
