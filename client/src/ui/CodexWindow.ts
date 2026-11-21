// 몬스터 도감: 잡은 몬스터 종류별 기록 (잡은 수 · 기본 정보 · 떨어뜨리는 물건 · 나오는 곳). 안 잡은 몬스터는 ??? 로
import { MONSTERS, type MonsterId } from '@shared/data/monsters';
import { itemDef } from '@shared/data/items';
import { CODEX_MOBS, codexCount, mobMaps } from '@shared/rules/achievements';
import type { Session } from '../session/LocalSession';
import { el, esc } from './Dialog';
import { PanelWindow } from './PanelWindow';
import slimeUrl from '../../../assets/img/sprites/enemies/01_slime/slime.png';
import honeyUrl from '../../../assets/img/sprites/enemies/03_honeySlime/Honey_slime.png';

/** 도감 그림 (32×32 칸 시트의 첫 칸). 그림이 없는 몬스터는 빈 칸 */
const LOOK: Partial<Record<MonsterId, { url: string; frames: number; filter?: string }>> = {
  slime: { url: slimeUrl, frames: 3 },
  slime_elem: { url: slimeUrl, frames: 3, filter: 'grayscale(1) brightness(1.3)' },
  honey_slime: { url: honeyUrl, frames: 5 },
};

export class CodexWindow extends PanelWindow {
  private picked: MonsterId = CODEX_MOBS[0];

  constructor(private session: Session) { super('monster book', 'codex', [], ''); }

  protected signature() {
    return JSON.stringify([this.picked, CODEX_MOBS.map(id => this.session.save.mobKills[id] ?? 0)]);
  }

  protected render() {
    const s = this.session.save;
    this.body.innerHTML = '';
    const list = el('div', 'qw-list'), detail = el('div', 'qw-detail');
    list.appendChild(el('div', 'cx-count', `${codexCount(s)} / ${CODEX_MOBS.length}`));
    for (const id of CODEX_MOBS) {
      const known = (s.mobKills[id] ?? 0) > 0;
      list.appendChild(el('div', `qw-item${id === this.picked ? ' on' : ''}${known ? '' : ' unknown'}`,
        `<span class="qw-name">${known ? esc(MONSTERS[id].name) : '???'}</span>`, () => { this.picked = id; this.refresh(); }));
    }
    const id = this.picked, m = MONSTERS[id], kills = s.mobKills[id] ?? 0;
    const pic = el('div', 'cx-pic');
    const look = LOOK[id];
    if (look) {
      pic.style.backgroundImage = `url("${look.url}")`;
      pic.style.backgroundSize = `${look.frames * 100}% 100%`;
      if (look.filter) pic.style.filter = look.filter;
    }
    if (!kills) pic.classList.add('unknown');
    detail.appendChild(pic);
    if (!kills) {
      detail.appendChild(el('div', 'qw-title', '<b>???</b>'));
      detail.appendChild(el('p', 'qw-desc', '아직 잡은 적 없음'));
    } else {
      detail.appendChild(el('div', 'qw-title', `<b>${esc(m.name)}</b>`));
      detail.appendChild(el('div', 'qw-row', `<span class="qw-label">잡은 수</span>${kills.toLocaleString('ko-KR')}`));
      detail.appendChild(el('div', 'qw-row', `<span class="qw-label">HP</span>${m.hp.toLocaleString('ko-KR')} <span class="qw-label cx-gap">EXP</span>${m.exp}`));
      const drops = (m.drops ?? []).filter(d => !d.quest).map(d => `${esc(itemDef(d.item)?.name ?? d.item)} ${Math.round(d.chance * 1000) / 10}%`);
      detail.appendChild(el('div', 'qw-label', '떨어뜨리는 물건'));
      detail.appendChild(el('p', 'qw-desc', drops.length ? drops.join(' · ') : '없음'));
      const maps = mobMaps(id);
      detail.appendChild(el('div', 'qw-label', '나오는 곳'));
      detail.appendChild(el('p', 'qw-desc', maps.length ? maps.map(esc).join(' · ') : '?'));
    }
    this.body.appendChild(list);
    this.body.appendChild(detail);
  }
}
