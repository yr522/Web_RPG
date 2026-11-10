// 캐릭터 창 (C): 능력치 분배, 소지품(초기화 주문서 사용), 스킬 목록
import { CLASSES, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, MAX_SKILL_LEVEL, expNeed, type StatId } from '@shared/data/classes';
import { ELEMENTS, NO_ELEMENT } from '@shared/data/elements';
import { learned, skillLevel } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { DialogHost, el, esc } from './Dialog';

const STATS: Record<StatId, { name: string; desc: string }> = {
  str: { name: '근력', desc: '검사 데미지 · 최대 체력' },
  dex: { name: '민첩', desc: '궁수 데미지 · 이동속도' },
  int: { name: '지능', desc: '마법사 데미지 · MP 회복속도' },
};

export class CharWindow {
  private body: HTMLElement | null = null;
  private armedReset = false;

  constructor(private host: DialogHost, private session: Session, private hud: Hud) {}

  toggle() {
    if (this.body && this.host.isOpen) { this.host.close(); return; }
    const box = el('div', 'win');
    box.appendChild(el('button', 'npc-x', '✕', () => this.host.close()));
    this.body = el('div', 'win-body');
    box.appendChild(this.body);
    this.armedReset = false;
    this.render();
    this.host.open(box, () => { this.body = null; });
  }

  private render() {
    const b = this.body!, s = this.session.save, me = this.session.me(), cls = CLASSES[s.cls];
    b.innerHTML = '';
    b.appendChild(el('h2', '', `${esc(s.name)} <span class="note">${cls.name} · Lv ${s.level}</span>`));
    b.appendChild(el('p', 'note', `EXP ${s.exp} / ${expNeed(s.level)} · 처치 ${s.kills}`));

    b.appendChild(el('h3', '', `능력치 · 남은 포인트 <span class="pts">${s.statPts}</span>`));
    for (const k of Object.keys(STATS) as StatId[]) {
      const row = el('div', 'stat');
      row.appendChild(el('b', '', STATS[k].name + (cls.main === k ? ' ★' : '')));
      row.appendChild(el('span', 'v', String(s.stats[k])));
      const plus = el('button', 'plus', '+', () => { this.session.act({ type: 'stat', stat: k }); this.render(); }) as HTMLButtonElement;
      plus.disabled = s.statPts <= 0;
      row.appendChild(plus);
      row.appendChild(el('span', 'd', STATS[k].desc));
      b.appendChild(row);
    }
    const st = me.stats;
    b.appendChild(el('p', 'note', `★ = ${cls.name} 주 능력치 · 공격력 ${st.atk.toFixed(1)} · 최대 HP ${st.maxHp} · 최대 MP ${st.maxMp} · 이동속도 ${Math.round(st.speed)} · MP 회복 ${st.regen.toFixed(1)}/초`));

    b.appendChild(el('h3', '', `소지품 · <span class="gold">💰 ${s.gold} G</span>`));
    const inv = el('div', 'card');
    inv.appendChild(el('div', '', `🧪 HP 포션 ×${s.inventory.hp} · 💧 MP 포션 ×${s.inventory.mp} · 📜 초기화 주문서 ×${s.inventory.reset}`));
    if (s.inventory.reset > 0) {
      inv.appendChild(el('button', 'sm', this.armedReset ? '정말 쓸까? 한 번 더 누르면 사용' : '📜 초기화 주문서 사용', () => {
        if (!this.armedReset) { this.armedReset = true; this.render(); return; }
        this.armedReset = false;
        const r = this.session.act({ type: 'useReset' });
        if (r.banner) this.hud.showBanner(r.banner, '#c8b8ff');
        this.render();
      }));
    }
    b.appendChild(inv);

    b.appendChild(el('h3', '', '스킬'));
    cls.skills.forEach((id, i) => {
      const sk = SKILLS[id];
      let t: string;
      if (learned(s, id)) {
        const e = s.learned[id] ? ELEMENTS[s.learned[id]!] : NO_ELEMENT, lv = skillLevel(s, id);
        t = `${sk.name} · ${e.icon} ${e.name} · Lv ${lv}${lv >= MAX_SKILL_LEVEL ? ' (마스터)' : ''}`;
      } else {
        t = `${sk.name} · <span class="note">Lv ${UNLOCK_LEVELS[i]}에 해금${s.level >= UNLOCK_LEVELS[i] ? ' — 교수님께 배우러 가자!' : ''}</span>`;
      }
      b.appendChild(el('div', 'card', `[${SLOT_KEYS[i]}] ${t}`));
    });
  }
}
