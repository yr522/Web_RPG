// 화면 위 UI (HTML). UI 구상도(PC / 모바일)를 따른다.
// 게임 상태를 읽어서 보여주기만 하고, 버튼 입력은 Input 으로 넘긴다.
import { CLASSES, DOWN_TIME, SKILLS, SLOT_KEYS, unlockLevel, expNeed, type SlotKey } from '@shared/data/classes';
import { ELEMENTS, NO_ELEMENT } from '@shared/data/elements';
import { PHASES, timeInfo } from '@shared/sim/clock';
import { QUEST_HUD_MAX, questTitle } from '@shared/data/quests';
import { hudQuests, questLines } from '@shared/rules/quests';
import { countItem } from '@shared/rules/inventory';
import { BUFFS, playerBuffs, type BuffId } from '@shared/data/buffs';
import { BOSS_BAR } from '@shared/data/bosses';
import { comboColor } from '@shared/data/combo';
import { MONSTERS } from '@shared/data/monsters';
import type { Session } from '../session/LocalSession';
import type { Action, Input } from '../input/Input';
import icoProfile from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Profile.png';
import icoInventory from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Inventory.png';
import icoSpell from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Spell.png';
import icoBattle from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Battle.png';
import icoPicto from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_PictoIcon_Thumbnails.Png?url';
import icoSkill from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Skill.png';
import icoGold from '../../../assets/UI/menu_icons/2D Icons - Menu Icon Set 1/PNG/128/Icon_Gold.png';

export type UiMode = 'pc' | 'mobile';

const h = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', html = '') => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (html) e.innerHTML = html;
  return e;
};


/** 왼쪽 위 메뉴 버튼. icon 이 있으면 그림만 (이름은 마우스를 올리면), 없으면 글자 */
const MENU = [
  { id: 'char', label: '캐릭터', key: 'C', icon: icoProfile },
  { id: 'inv', label: '인벤토리', key: 'I', icon: icoInventory },
  { id: 'skill', label: '스킬', key: 'K', icon: icoSkill },
  { id: 'quest', label: '퀘스트', key: '', icon: icoSpell },
  { id: 'boss', label: '보스', key: '', icon: icoBattle },
  { id: 'menu', label: '메뉴', key: 'Esc', icon: icoPicto },
  { id: 'home', label: '귀환', key: '', icon: '' },
  { id: 'full', label: '전체 화면', key: '', icon: '' },
] as const;
export type MenuId = (typeof MENU)[number]['id'];

interface SlotView { slot: SlotKey; name: string; sub: string; color: string; locked: boolean; empty: boolean; cd: number; ready?: boolean }

const escHtml = (t: string) => t.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`);

/** 핀 그림 */
export const PIN_SVG = '<svg viewBox="0 0 16 16"><path d="M5 1h6l-1 5 3 3H9.5L8 15 6.5 9H3l3-3z"/></svg>';

/** 화면 왼쪽 퀘스트 한 칸 */
function questCard(id: string, name: string, main: boolean, pin: boolean, lines: { text: string; done: boolean }[]) {
  const goals = lines.map(l => `<div class="q-goal${l.done ? ' done' : ''}">${escHtml(l.text)}</div>`).join('');
  return `<div class="quest${main ? ' main' : ''}"><i class="q-dot"></i>`
    + `<div class="q-head"><b class="q-name">${escHtml(name)}</b><button class="q-pin${pin ? ' on' : ''}" data-id="${id}">${PIN_SVG}</button></div>${goals}</div>`;
}

export class Hud {
  readonly root = h('div');
  private els: Record<string, HTMLElement> = {};
  private slotEls = new Map<SlotKey, HTMLElement>();
  private cache: Record<string, string> = {};
  private bannerTimer = 0;
  /** 버프 아이콘: 걸린 순서대로 (끝나면 빠지고 앞으로 당겨짐) */
  private buffEls = new Map<BuffId, HTMLElement>();
  onMenu: (id: MenuId) => void = () => {};
  /** 쓰러짐 창 [부활하기] */
  onRevive: () => void = () => {};
  /** 퀘스트 핀 버튼 */
  onQuestPin: (id: string) => void = () => {};
  /** 매 프레임 같이 갱신할 창들 (인벤토리 등) */
  onUpdate: (() => void)[] = [];

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
      const b = h('button', m.icon ? 'menu-btn ico' : 'menu-btn', m.icon ? `<img src="${m.icon}" alt="${m.label}" draggable="false">` : `<span>${m.label}</span>`);
      b.title = m.key ? `${m.label} (${m.key})` : m.label;
      b.addEventListener('click', () => this.onMenu(m.id));
      menu.appendChild(b);
    }
    r.appendChild(menu);

    // 왼쪽: 하는 중인 퀘스트 (핀 → 메인 → 일반 순)
    const quests = h('div', 'quests');
    quests.addEventListener('click', e => {
      const pin = (e.target as HTMLElement).closest<HTMLElement>('.q-pin');
      if (pin?.dataset.id) this.onQuestPin(pin.dataset.id);
    });
    r.appendChild(quests);
    this.els.quests = quests;

    // 오른쪽 위: 맵 · 시간 · 골드 (구상도에 없던 것, 임시 위치)
    this.els.info = r.appendChild(h('div', 'info'));
    // 위 가운데: 보스 이름 + 여러 줄 HP 바 (보스가 있을 때만)
    this.els.boss = r.appendChild(h('div', 'bossbar', '<div class="bb-head"><b class="bb-name"></b><span class="bb-n"></span></div><div class="bb-bar"><i class="bb-under"></i><i class="bb-trail"></i><i class="bb-fill"></i></div>'));
    // 오른쪽 가운데: 콤보 (큰 기울인 숫자 + 아래 작고 굵은 Combo)
    this.els.combo = r.appendChild(h('div', 'hcombo', '<b class="hc-n"></b><span class="hc-l">Combo</span>'));
    this.els.banner = r.appendChild(h('div', 'banner'));
    this.els.toast = r.appendChild(h('div', 'toast'));

    // 쓰러짐 창: 닫을 수 없음. [부활하기]로 바로, 안 누르면 시간이 다 되면 저절로
    const down = h('div', 'down', '<div class="down-title">너의 죽음!</div><button class="down-btn">부활하기</button><div class="down-time"></div><div class="down-gauge"><i></i></div>');
    down.querySelector('button')!.addEventListener('click', () => this.onRevive());
    this.els.down = r.appendChild(down);

    // 아래: 버프 · 포션 · HP/MP · (PC) 스킬 슬롯
    const bottom = h('div', 'bottom');
    const top = h('div', 'bottom-top');
    this.els.buffs = top.appendChild(h('div', 'buffs'));
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
  showBanner(text: string, color = '#ffffff') {
    const b = this.els.banner;
    b.textContent = text;
    b.style.color = color;
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

  private set(key: string, el: HTMLElement, prop: 'text' | 'html' | 'width' | 'height' | 'class' | 'background', value: string) {
    if (this.cache[key] === value) return;
    this.cache[key] = value;
    if (prop === 'text') el.textContent = value;
    else if (prop === 'html') el.innerHTML = value;
    else if (prop === 'class') el.className = value;
    else el.style[prop] = value;
  }

  private slotView(s: Session, k: SlotKey): SlotView {
    const save = s.save, id = save.skillKeys[k];
    if (!id) return { slot: k, name: '', sub: '', color: '', locked: false, empty: true, cd: 0 };
    const i = CLASSES[save.cls].skills.indexOf(id);
    const learned = id in save.learned;
    if (!learned && i === 0) return { slot: k, name: SKILLS.basic.name, sub: '무속성', color: NO_ELEMENT.color, locked: false, empty: false, cd: 0 };
    const sk = SKILLS[id];
    const name = sk.short ?? sk.name;
    if (!learned) return { slot: k, name, sub: `Lv${unlockLevel(save.cls, id)}`, color: '', locked: true, empty: false, cd: 0 };
    const el = save.learned[id];
    const e = el ? ELEMENTS[el] : NO_ELEMENT;
    const me = s.me();
    let cd = sk.cd ? Math.min(1, (me.cd[id] ?? 0) / sk.cd) : 0;
    // 천붕: 질풍참 직후에만 쓸 수 있음
    if (id === 'cheonbung') cd = me.cbWindow > 0 ? 0 : 1;
    // 마력 해방 중: 남은 버프 시간
    if (id === 'haebang' && me.buffT > 0) return { slot: k, name, sub: me.buffT.toFixed(1), color: e.color, locked: false, empty: false, cd: 0 };
    const remain = me.cd[id] ?? 0;
    return { slot: k, name, sub: remain > 0 ? remain.toFixed(1) : `${e.name} Lv${save.skillLevels[id] ?? 1}`, color: e.color, locked: false, empty: false, cd, ready: id === 'cheonbung' && me.cbWindow > 0 };
  }

  /** 보스 HP 바 뒤로 천천히 따라오는 흰 줄 (지금 줄 안에서 0~1) */
  private bossTrail = { id: '', layer: -1, f: 1, t: 0 };

  /** 보스 HP 바: 한 줄 = BOSS_BAR.layerHp 쯤. 한 줄이 다 깎이면 아래 줄 색이 나옴 */
  private bossBar(s: Session) {
    const e = s.world.enemies.find(o => MONSTERS[o.mob].boss && !o.dead && !o.held);
    this.set('bossOn', this.els.boss, 'class', e ? 'bossbar on' : 'bossbar');
    if (!e) return;
    const layers = Math.max(1, Math.round(e.maxHp / BOSS_BAR.layerHp)), per = e.maxHp / layers;
    const hp = Math.max(0, e.hp), li = Math.max(0, Math.ceil(hp / per) - 1), f = hp <= 0 ? 0 : (hp - li * per) / per;
    const col = (i: number) => BOSS_BAR.colors[i % BOSS_BAR.colors.length];
    const tr = this.bossTrail, now = performance.now();
    if (tr.id !== e.id || tr.layer !== li) { tr.id = e.id; tr.layer = li; tr.f = 1; }
    const dt = Math.min(0.1, (now - (tr.t || now)) / 1000);
    tr.t = now;
    tr.f = Math.max(f, tr.f - dt * 0.8);
    const q = (c: string) => this.els.boss.querySelector<HTMLElement>(c)!;
    this.set('bossName', q('.bb-name'), 'text', MONSTERS[e.mob].name);
    this.set('bossN', q('.bb-n'), 'text', `x${li + 1}`);
    this.set('bossFill', q('.bb-fill'), 'width', `${(f * 100).toFixed(2)}%`);
    this.set('bossFillC', q('.bb-fill'), 'background', col(li));
    this.set('bossTrail', q('.bb-trail'), 'width', `${(tr.f * 100).toFixed(2)}%`);
    this.set('bossUnder', q('.bb-under'), 'background', li > 0 ? col(li - 1) : 'transparent');
  }

  private lastHits = 0;
  /** 콤보: 1 이상일 때만 보임. 오를 때마다 톡 튀고, 끊기기 1초 전부터 흐려짐 */
  private comboView(p: { hits: number; hitsT: number }) {
    const el = this.els.combo, n = el.querySelector<HTMLElement>('.hc-n')!;
    this.set('comboOn', el, 'class', p.hits > 0 ? 'hcombo on' : 'hcombo');
    if (p.hits <= 0) { this.lastHits = 0; return; }
    this.set('comboN', n, 'text', String(p.hits));
    el.style.setProperty('--cc', comboColor(p.hits));
    el.style.opacity = String(Math.max(0.25, Math.min(1, p.hitsT)));
    if (p.hits > this.lastHits) { n.classList.remove('pop'); void n.offsetWidth; n.classList.add('pop'); }
    this.lastHits = p.hits;
  }

  update(s: Session) {
    const p = s.me(), save = s.save, st = p.stats;

    const isDown = p.downT > 0;
    this.set('down', this.els.down, 'class', isDown ? 'down on' : 'down');
    if (isDown) {
      this.set('downT', this.els.down.querySelector('.down-time')!, 'text', `자동 부활까지 ${Math.ceil(p.downT)}초`);
      this.set('downW', this.els.down.querySelector('.down-gauge i')!, 'width', `${(100 * p.downT / DOWN_TIME).toFixed(2)}%`);
    }

    this.bossBar(s);
    this.comboView(p);

    const hpTxt = `${Math.ceil(p.hp)} / ${st.maxHp}`;
    this.set('hpW', this.els.hp.querySelector('i')!, 'width', `${(100 * p.hp / st.maxHp).toFixed(2)}%`);
    this.set('hpT', this.els.hp.querySelector('b')!, 'text', hpTxt);
    this.set('mpW', this.els.mp.querySelector('i')!, 'width', `${(100 * p.mp / st.maxMp).toFixed(2)}%`);
    this.set('mpT', this.els.mp.querySelector('b')!, 'text', `${Math.floor(p.mp)} / ${st.maxMp}`);

    const need = expNeed(save.level);
    this.set('expT', this.els.exp.querySelector('span')!, 'text', `EXP ${(100 * save.exp / need).toFixed(2)}%`);
    this.set('expW', this.els.exp.querySelector('i')!, 'width', `${(100 * save.exp / need).toFixed(2)}%`);

    this.set('potHp', this.els.potHp.querySelector('b')!, 'text', String(countItem(save, 'hp')));
    this.set('potMp', this.els.potMp.querySelector('b')!, 'text', String(countItem(save, 'mp')));

    // 버프·디버프: 없으면 아무것도 없음, 새로 걸리면 뒤에 붙음, 끝나면 빠짐
    const buffs = playerBuffs(p);
    for (const [id, el] of this.buffEls) if (!buffs.some(b => b.id === id)) { el.remove(); this.buffEls.delete(id); }
    for (const b of buffs) {
      let el = this.buffEls.get(b.id);
      if (!el) {
        const def = BUFFS[b.id];
        el = h('div', `buff${def.debuff ? ' debuff' : ''}`, '<i></i>');
        el.style.background = def.color;
        el.title = def.name;
        this.els.buffs.appendChild(el);
        this.buffEls.set(b.id, el);
      }
      // 지나간 시간만큼 위에서부터 어둡게
      (el.firstChild as HTMLElement).style.height = `${(100 * (1 - b.t / b.max)).toFixed(1)}%`;
    }

    const ti = timeInfo(s.nowMs());
    const sec = Math.ceil(ti.remain / 1000);
    const info = `${escHtml(s.world.map.name)}　${PHASES[ti.phase].icon} ${PHASES[ti.phase].name} ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}　<img class="gold-ico" src="${icoGold}" alt=""> ${save.gold} G　Lv ${save.level}`;
    this.set('info', this.els.info, 'html', info);

    // 퀘스트: 바뀌었을 때만 다시 그림
    const qs = hudQuests(save, QUEST_HUD_MAX).map(q => ({ q, lines: questLines(save, q), pin: save.questPins.includes(q.id) }));
    const qSig = JSON.stringify(qs.map(o => [o.q.id, o.lines, o.pin]));
    if (this.cache.quests !== qSig) {
      this.cache.quests = qSig;
      this.els.quests.innerHTML = qs.map(({ q, lines, pin }) => questCard(q.id, questTitle(q), !!q.main, pin, lines)).join('');
    }

    for (const k of SLOT_KEYS) {
      const v = this.slotView(s, k), el = this.slotEls.get(k)!;
      const sig = `${v.name}|${v.sub}|${v.color}|${v.locked}|${v.empty}|${v.ready}`;
      if (this.cache['slot' + k] !== sig) {
        this.cache['slot' + k] = sig;
        el.querySelector('.name')!.textContent = v.name;
        el.querySelector('small')!.textContent = v.sub;
        el.classList.toggle('locked', v.locked);
        el.classList.toggle('empty', v.empty);
        el.classList.toggle('ready', !!v.ready);
        el.style.setProperty('--ec', v.color || 'transparent');
      }
      this.set('cd' + k, el.querySelector<HTMLElement>('.cd')!, 'height', `${v.cd * 100}%`);
    }
    for (const f of this.onUpdate) f();
  }
}
