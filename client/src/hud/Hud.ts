// 화면 위 UI (HTML). UI 구상도(PC / 모바일)를 따른다.
// 게임 상태를 읽어서 보여주기만 하고, 버튼 입력은 Input 으로 넘긴다.
import { CLASSES, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, expNeed, type SlotKey } from '@shared/data/classes';
import { ELEMENTS, NO_ELEMENT } from '@shared/data/elements';
import { PHASES, timeInfo } from '@shared/sim/clock';
import type { Session } from '../session/LocalSession';
import type { Action, Input } from '../input/Input';

export type UiMode = 'pc' | 'mobile';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};

const MENU = [
  { id: 'char', label: '캐릭터', key: 'C' },
  { id: 'home', label: '귀환', key: '' },
  { id: 'full', label: '전체 화면', key: '' },
  { id: 'menu', label: '메뉴', key: 'Esc' },
] as const;
export type MenuId = (typeof MENU)[number]['id'];

interface SlotView { slot: SlotKey; name: string; sub: string; color: string; locked: boolean; empty: boolean; cd: number }

export class Hud {
  readonly root = h('div');
  private els: Record<string, HTMLElement> = {};
  private slotEls = new Map<SlotKey, HTMLElement>();
  private cache: Record<string, string> = {};
  private bannerTimer = 0;
  onMenu: (id: MenuId) => void = () => {};

  constructor(private input: Input, readonly mode: UiMode) {
    this.root.id = 'hud';
    this.root.className = mode;
    document.body.appendChild(this.root);
    this.build();
    input.onChange = (a, down) => this.root.querySelectorAll(`[data-action="${a}"]`).forEach(el => el.classList.toggle('on', down));
  }

  private build() {
    const r = this.root;

    // 왼쪽 위: 메뉴 버튼
    const menu = h('div', 'menu');
    for (const m of MENU) {
      const b = h('button', 'menu-btn', `<span>${m.label}</span>`);
      b.title = m.key ? `${m.label} (${m.key})` : m.label;
      b.addEventListener('click', () => this.onMenu(m.id));
      menu.appendChild(b);
    }
    r.appendChild(menu);

    // 왼쪽: 퀘스트 알림 (퀘스트는 아직 없음 → 빈 칸 3개)
    const quests = h('div', 'quests');
    for (let i = 0; i < 3; i++) quests.appendChild(h('div', 'quest empty', '<span>퀘스트 없음</span>'));
    r.appendChild(quests);
    this.els.quests = quests;

    // 오른쪽 위: 맵 · 시간 · 골드 (구상도에 없던 것, 임시 위치)
    this.els.info = r.appendChild(h('div', 'info'));
    this.els.banner = r.appendChild(h('div', 'banner'));
    this.els.toast = r.appendChild(h('div', 'toast'));

    // 아래: 버프 · 포션 · HP/MP · (PC) 스킬 슬롯
    const bottom = h('div', 'bottom');
    const top = h('div', 'bottom-top');
    this.els.buffs = top.appendChild(h('div', 'buffs'));
    for (let i = 0; i < 3; i++) this.els.buffs.appendChild(h('div', 'buff placeholder'));
    const potions = h('div', 'potions');
    this.els.potHp = potions.appendChild(this.potion('hp'));
    this.els.potMp = potions.appendChild(this.potion('mp'));
    top.appendChild(potions);
    bottom.appendChild(top);

    const bars = h('div', 'bars');
    this.els.hp = bars.appendChild(h('div', 'bar hp', '<i></i><b></b>'));
    this.els.mp = bars.appendChild(h('div', 'bar mp', '<i></i><b></b>'));
    bottom.appendChild(bars);

    if (this.mode === 'pc') {
      const slots = h('div', 'slots');
      for (const k of SLOT_KEYS) slots.appendChild(this.slot(k));
      bottom.appendChild(slots);
    }
    r.appendChild(bottom);

    if (this.mode === 'mobile') {
      r.appendChild(this.joystick());
      const pad = h('div', 'mskills');
      for (const k of SLOT_KEYS) pad.appendChild(this.slot(k));
      const jump = h('div', 'mbtn jump', '<span>점프</span>');
      jump.dataset.action = 'jump';
      this.bindButton(jump, 'jump');
      pad.appendChild(jump);
      // 모바일은 포션 버튼을 스킬 버튼 쪽으로 옮긴다
      pad.appendChild(this.els.potHp);
      pad.appendChild(this.els.potMp);
      r.appendChild(pad);
    }

    // 맨 아래: 경험치
    const exp = h('div', 'exp', '<span></span><div class="exp-bar"><i></i></div>');
    this.els.exp = exp;
    r.appendChild(exp);

    // 손가락이 모두 떨어지면 눌린 버튼 전부 해제 (버튼이 눌린 채로 멈추는 것 방지)
    const releaseAll = (e: TouchEvent) => {
      if (e.touches.length) return;
      for (const a of ['left', 'right', 'up', 'down', 'jump', 'potionHp', 'potionMp', ...SLOT_KEYS.map(k => `skill${k}`)] as Action[]) this.input.set(a, false);
      this.resetStick?.();
    };
    document.addEventListener('touchend', releaseAll, true);
    document.addEventListener('touchcancel', releaseAll, true);
  }

  private potion(kind: 'hp' | 'mp') {
    const action: Action = kind === 'hp' ? 'potionHp' : 'potionMp';
    const el = h('div', `potion ${kind}`, `<span class="key">${kind === 'hp' ? '1' : '2'}</span><b></b>`);
    el.dataset.action = action;
    el.title = kind === 'hp' ? 'HP 포션 (1)' : 'MP 포션 (2)';
    this.bindButton(el, action);
    return el;
  }

  private slot(k: SlotKey) {
    const cls = this.mode === 'pc' ? 'slot' : `mbtn slot s${k}`;
    const el = h('div', cls, `<span class="key">${k}</span><span class="name"></span><small></small><i class="cd"></i>`);
    el.dataset.action = `skill${k}`;
    this.bindButton(el, `skill${k}`);
    this.slotEls.set(k, el);
    return el;
  }

  private bindButton(el: HTMLElement, a: Action) {
    let pid: number | null = null;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      pid = e.pointerId;
      try { el.setPointerCapture(pid); } catch { /* 무시 */ }
      this.input.set(a, true);
    });
    const off = (e: PointerEvent) => {
      if (pid !== null && e.pointerId !== pid) return;
      pid = null;
      this.input.set(a, false);
    };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) el.addEventListener(t, off);
  }

  private resetStick?: () => void;

  private joystick() {
    const pad = h('div', 'stick', '<div class="stick-ring"></div><div class="stick-knob"></div>');
    const knob = pad.querySelector<HTMLElement>('.stick-knob')!;
    let pid: number | null = null;
    const apply = (e: PointerEvent) => {
      const r = pad.getBoundingClientRect();
      const rad = r.width / 2;
      let dx = e.clientX - (r.left + rad), dy = e.clientY - (r.top + r.height / 2);
      const len = Math.hypot(dx, dy), max = rad * 0.55;
      if (len > max) { dx *= max / len; dy *= max / len; }
      knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
      const fx = dx / max, fy = dy / max;
      this.input.set('left', fx < -0.3);
      this.input.set('right', fx > 0.3);
      this.input.set('up', fy < -0.55);
      this.input.set('down', fy > 0.55);
    };
    this.resetStick = () => {
      knob.style.transform = 'translate(-50%, -50%)';
      for (const a of ['left', 'right', 'up', 'down'] as const) this.input.set(a, false);
    };
    pad.addEventListener('pointerdown', e => {
      e.preventDefault();
      pid = e.pointerId;
      try { pad.setPointerCapture(pid); } catch { /* 무시 */ }
      apply(e);
    });
    pad.addEventListener('pointermove', e => { if (e.pointerId === pid) apply(e); });
    const end = (e: PointerEvent) => { if (e.pointerId !== pid) return; pid = null; this.resetStick!(); };
    for (const t of ['pointerup', 'pointercancel', 'lostpointercapture'] as const) pad.addEventListener(t, end);
    return pad;
  }

  /** 맵 이름 같은 큰 글씨 */
  showBanner(text: string) {
    const b = this.els.banner;
    b.textContent = text;
    b.classList.remove('show');
    void b.offsetWidth;
    b.classList.add('show');
    clearTimeout(this.bannerTimer);
    this.bannerTimer = window.setTimeout(() => b.classList.remove('show'), 1600);
  }

  /** 아래쪽 작은 알림 */
  toast(text: string) {
    const t = this.els.toast;
    t.textContent = text;
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
  }

  private set(key: string, el: HTMLElement, prop: 'text' | 'width' | 'height', value: string) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'text') el.textContent = value;
    else el.style[prop] = value;
  }

  private slotView(s: Session, k: SlotKey): SlotView {
    const i = SLOT_KEYS.indexOf(k);
    const save = s.save;
    if (i >= 4) return { slot: k, name: '', sub: '', color: '', locked: false, empty: true, cd: 0 };
    const id = CLASSES[save.cls].skills[i];
    const learned = id in save.learned;
    if (!learned && i === 0) return { slot: k, name: SKILLS.basic.name, sub: '무속성', color: NO_ELEMENT.color, locked: false, empty: false, cd: 0 };
    const sk = SKILLS[id];
    const name = sk.short ?? sk.name;
    if (!learned) return { slot: k, name, sub: `Lv${UNLOCK_LEVELS[i]}`, color: '', locked: true, empty: false, cd: 0 };
    const el = save.learned[id];
    const e = el ? ELEMENTS[el] : NO_ELEMENT;
    return { slot: k, name, sub: `${e.name} Lv${save.skillLevels[id] ?? 1}`, color: e.color, locked: false, empty: false, cd: 0 };
  }

  update(s: Session) {
    const p = s.me(), save = s.save, st = p.stats;

    const hpTxt = `${Math.ceil(p.hp)} / ${st.maxHp}`;
    this.set('hpW', this.els.hp.querySelector('i')!, 'width', `${(100 * p.hp / st.maxHp).toFixed(2)}%`);
    this.set('hpT', this.els.hp.querySelector('b')!, 'text', hpTxt);
    this.set('mpW', this.els.mp.querySelector('i')!, 'width', `${(100 * p.mp / st.maxMp).toFixed(2)}%`);
    this.set('mpT', this.els.mp.querySelector('b')!, 'text', `${Math.floor(p.mp)} / ${st.maxMp}`);

    const need = expNeed(save.level);
    this.set('expT', this.els.exp.querySelector('span')!, 'text', `EXP ${(100 * save.exp / need).toFixed(2)}%`);
    this.set('expW', this.els.exp.querySelector('i')!, 'width', `${(100 * save.exp / need).toFixed(2)}%`);

    this.set('potHp', this.els.potHp.querySelector('b')!, 'text', String(save.inventory.hp));
    this.set('potMp', this.els.potMp.querySelector('b')!, 'text', String(save.inventory.mp));

    const ti = timeInfo(Date.now());
    const sec = Math.ceil(ti.remain / 1000);
    const info = `${s.world.map.name}　${PHASES[ti.phase].icon} ${PHASES[ti.phase].name} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}　💰 ${save.gold} G　Lv ${save.level}`;
    this.set('info', this.els.info, 'text', info);

    for (const k of SLOT_KEYS) {
      const v = this.slotView(s, k), el = this.slotEls.get(k)!;
      const sig = `${v.name}|${v.sub}|${v.color}|${v.locked}|${v.empty}`;
      if (this.cache['slot' + k] !== sig) {
        this.cache['slot' + k] = sig;
        el.querySelector('.name')!.textContent = v.name;
        el.querySelector('small')!.textContent = v.sub;
        el.classList.toggle('locked', v.locked);
        el.classList.toggle('empty', v.empty);
        el.style.setProperty('--ec', v.color || 'transparent');
      }
      this.set('cd' + k, el.querySelector<HTMLElement>('.cd')!, 'height', `${v.cd * 100}%`);
    }
  }
}
