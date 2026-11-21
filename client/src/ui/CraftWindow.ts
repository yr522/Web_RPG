// 제작 창 (J, 메뉴의 [제작]). 유저 시안: 왼쪽 = 고른 레시피 (재료 1~4번 칸 → 결과물, 제작 버튼 + 개수),
// 오른쪽 = 레시피 목록 (아이콘·이름·설명·최대 제작 개수) + 아래 "제작중..." 대기열 3칸.
// 개인 공방에서만 [제작]이 눌림. 재료가 모자란 칸과 결과물은 흑백. 지금은 연금술 탭 하나
import { ALCHEMY, ALCHEMY_RECIPES, CRAFT_MAP, alchemyRecipe } from '@shared/data/alchemy';
import { itemDef } from '@shared/data/items';
import { countItem } from '@shared/rules/inventory';
import { alchemyMax, alchemyProgress } from '@shared/rules/alchemy';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { el, esc } from './Dialog';
import { itemIcon } from './icons';
import { PanelWindow } from './PanelWindow';
import alchemyBg from '../../../assets/UI/crafting/alchemy_icon.png';

type Tab = 'alchemy';

/** 재료 칸 자리 (시안: 1·2 위 가운데, 3·4 양옆 조금 아래). 단위 = 시안 px, 결과물 칸은 아래 가운데 */
const SLOT_POS = [[96, 14], [168, 14], [28, 54], [236, 54]] as const;
const RESULT = { x: 126, y: 158, size: 60 };
const SLOT = 48;

export class CraftWindow extends PanelWindow<Tab> {
  private pick = ALCHEMY_RECIPES[0]?.id ?? '';
  private num = el('input', 'cr-num') as HTMLInputElement;
  private makeBtn = el('button', 'cr-make', '제작') as HTMLButtonElement;
  private prog: HTMLElement | null = null;

  constructor(private session: Session, private hud: Hud) {
    super('제작', 'craft', [{ id: 'alchemy', label: '연금술' }], 'alchemy');
    this.num.type = 'number';
    this.num.min = '1';
    this.num.max = String(ALCHEMY.maxN);
    this.num.value = '1';
    // 숫자를 바꾸면 필요 개수·흑백만 다시 그림 (입력 칸은 그대로)
    this.num.addEventListener('input', () => this.refresh());
    this.num.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') this.make(); });
    this.makeBtn.addEventListener('click', () => this.make());
  }

  private get n() {
    const v = Math.floor(Number(this.num.value));
    return v >= 1 ? Math.min(v, ALCHEMY.maxN) : 1;
  }

  private make() {
    const r = this.session.act({ type: 'alchemy', recipe: this.pick, n: this.n });
    if (!r.ok && r.msg) this.hud.toast(r.msg);
    this.refresh();
  }

  /** 매 프레임: 대기열 진행 막대만 따로 움직임 */
  override update() {
    super.update();
    if (this.isOpen && this.prog) this.prog.style.width = `${alchemyProgress(this.session.save, this.session.nowMs()) * 100}%`;
  }

  protected signature() {
    const s = this.session.save;
    return JSON.stringify([s.bag, s.alchemy.queue, s.map, this.pick, this.num.value]);
  }

  protected render() {
    const s = this.session.save;
    const typing = document.activeElement === this.num;
    this.body.innerHTML = '';
    const wrap = el('div', 'cr-wrap');
    wrap.appendChild(this.renderLeft());

    // 오른쪽: 레시피 목록 + 대기열
    const right = el('div', 'cr-right');
    const list = el('div', 'cr-list');
    for (const r of ALCHEMY_RECIPES) {
      const d = itemDef(r.out);
      const card = el('div', 'cr-card' + (r.id === this.pick ? ' on' : ''), '', () => { this.pick = r.id; this.num.value = '1'; this.refresh(); });
      const ico = el('div', 'inv-cell cr-ico');
      ico.appendChild(itemIcon(r.out));
      card.appendChild(ico);
      const text = el('div', 'cr-text', `<b>${esc(d?.name ?? r.out)}</b><small>${esc(d?.desc ?? '')}</small>`);
      card.appendChild(text);
      card.appendChild(el('span', 'cr-max', `최대 ${alchemyMax(s, r.id)}개 제작가능`));
      list.appendChild(card);
    }
    right.appendChild(list);

    const qbox = el('div', 'cr-queue');
    qbox.appendChild(el('div', 'cr-qtitle', '제작중...'));
    const row = el('div', 'cr-qrow' + (s.alchemy.queue.length ? ' run' : ''));
    row.appendChild(el('span', 'cr-arrows in', '<i>▶</i><i>▶</i><i>▶</i>'));
    this.prog = null;
    for (let i = 0; i < ALCHEMY.queueMax; i++) {
      const q = s.alchemy.queue[i];
      const cell = el('div', 'inv-cell cr-qcell');
      const r = q && alchemyRecipe(q.r);
      if (q && r) {
        cell.appendChild(itemIcon(r.out));
        cell.appendChild(el('span', 'inv-n', String(q.n - q.got)));
        if (i === 0) {
          const bar = el('div', 'cr-qbar');
          this.prog = el('i');
          bar.appendChild(this.prog);
          cell.appendChild(bar);
        }
      }
      row.appendChild(cell);
    }
    row.appendChild(el('span', 'cr-arrows out', '<i>▶</i><i>▶</i><i>▶</i>'));
    qbox.appendChild(row);
    right.appendChild(qbox);
    wrap.appendChild(right);
    this.body.appendChild(wrap);
    if (typing) this.num.focus();
    this.update();
  }

  /** 왼쪽: 재료 칸 → 결과물, 이름, [제작] + 개수 */
  private renderLeft() {
    const s = this.session.save;
    const left = el('div', 'cr-left');
    left.style.setProperty('--bg', `url("${alchemyBg}")`);
    const r = alchemyRecipe(this.pick);
    const area = el('div', 'cr-area');
    const n = this.n;
    let short = !r;
    // 재료 칸에서 결과물 위로 꺾여 내려가는 줄
    const lines: string[] = [];
    SLOT_POS.forEach(([x, y], i) => {
      const m = r?.mats[i];
      const cell = el('div', 'inv-cell cr-slot' + (m ? '' : ' empty'));
      cell.style.left = `calc(${x} * var(--s))`;
      cell.style.top = `calc(${y} * var(--s))`;
      if (m) {
        const need = m.n * n, have = countItem(s, m.item), lack = have < need;
        if (lack) { short = true; cell.classList.add('lack'); }
        cell.appendChild(itemIcon(m.item));
        cell.appendChild(el('span', 'cr-need', `${have}/${need}`));
        cell.title = itemDef(m.item)?.name ?? m.item;
        const sx = x + SLOT / 2, sy = y + SLOT, ex = RESULT.x + RESULT.size * (0.2 + 0.2 * i), mid = RESULT.y - 18 + i * 4;
        lines.push(`<polyline points="${sx},${sy} ${sx},${mid} ${ex},${mid} ${ex},${RESULT.y}" class="${lack ? 'lack' : ''}"/>`);
      }
      area.appendChild(cell);
    });
    area.insertAdjacentHTML('afterbegin', `<svg class="cr-lines" viewBox="0 0 312 230">${lines.join('')}</svg>`);
    const res = el('div', 'inv-cell cr-result' + (short ? ' lack' : ''));
    if (r) res.appendChild(itemIcon(r.out));
    area.appendChild(res);
    // 시안: 결과물 오른쪽 아래 작은 칸 (약병 같은 아이템 자리, 지금은 비어 있음)
    area.appendChild(el('div', 'inv-cell cr-aux empty'));
    left.appendChild(area);
    left.appendChild(el('div', 'cr-name', esc(r ? itemDef(r.out)?.name ?? r.out : '')));
    const act = el('div', 'cr-act');
    act.appendChild(this.makeBtn);
    act.appendChild(this.num);
    left.appendChild(act);
    this.makeBtn.disabled = !r || short || s.map !== CRAFT_MAP || s.alchemy.queue.length >= ALCHEMY.queueMax;
    return left;
  }
}
