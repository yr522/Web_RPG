// NPC 대화창: 교수님(스킬 배우기 · 수업 · 퀘스트), 매점 모리(물약·주문서 구매), 대화 NPC(대사 + 선택지).
// 버튼은 session.act() 로 행동을 요청만 하고, 결과를 다시 그린다.
import { CLASSES, SKILLS, SLOT_KEYS, UNLOCK_LEVELS, MAX_SKILL_LEVEL } from '@shared/data/classes';
import { ELEMENTS, type Element } from '@shared/data/elements';
import { ITEMS, SHOP_ITEMS } from '@shared/data/items';
import { countItem } from '@shared/rules/inventory';
import { QUESTS } from '@shared/data/quests';
import { questProgressText, questState } from '@shared/rules/quests';
import { TALK_NPCS, type DialogueStep } from '@shared/data/npcs';
import { pickTalk } from '@shared/rules/story';
import { PHASES, PHASE_MS, timeInfo } from '@shared/sim/clock';
import { canAttend, learned, nextToLearn, skillLevel, type ActionResult, type MenuAction } from '@shared/rules/progress';
import type { Session } from '../session/LocalSession';
import type { Hud } from '../hud/Hud';
import { DialogHost, el, esc } from './Dialog';
import { itemIcon } from './icons';
import profMagePortrait from '../../../assets/temp/magician_professer_portrait.png';
import moriPortrait from '../../../assets/temp/mori_portrait.png';

/** 교수님 포트레이트 (임시로 모든 학과 교수님이 같은 그림). 학과별 그림이 생기면 여기만 바꾸면 된다 */
const PROF_PORTRAIT: Record<string, string | null> = { warrior: profMagePortrait, mage: profMagePortrait, archer: profMagePortrait };
const PROF_ICON: Record<string, string> = { warrior: '⚔️', mage: '🔮', archer: '🏹' };

/** 교수님 메뉴에 나오는 퀘스트 */
const PROF_QUESTS = () => QUESTS.filter(q => q.giver === 'prof');

const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

type ProfView = 'main' | 'learn' | 'class' | 'quest' | 'test';

export class NpcDialog {
  private body: HTMLElement | null = null;
  private refresh: (() => void) | null = null;
  private pickElem: Element | null = null;

  constructor(private host: DialogHost, private session: Session, private hud: Hud) {}

  private act(a: MenuAction): ActionResult {
    const r = this.session.act(a);
    if (r.banner) this.hud.showBanner(r.banner);
    else if (r.msg) this.hud.toast(r.msg);
    this.refresh?.();
    return r;
  }

  /** 대화창 틀: 왼쪽 포트레이트, 오른쪽 이름·대사·선택지 */
  private frame(name: string, portrait: string | null, icon: string) {
    const box = el('div', 'npc-dlg');
    const pic = el('div', 'npc-portrait');
    if (portrait) { const img = el('img'); img.src = portrait; img.alt = name; pic.appendChild(img); }
    else pic.appendChild(el('div', 'npc-portrait-ph', `<span>${icon}</span><small>그림 준비 중</small>`));
    box.appendChild(pic);
    const panel = el('div', 'npc-panel');
    panel.appendChild(el('div', 'npc-name', esc(name)));
    const body = el('div', 'npc-body');
    panel.appendChild(body);
    panel.appendChild(el('button', 'npc-x', '✕', () => this.host.close()));
    box.appendChild(panel);
    this.body = body;
    return box;
  }

  openProfessor() {
    const cls = CLASSES[this.session.save.cls];
    const box = this.frame(cls.professor, PROF_PORTRAIT[this.session.save.cls], PROF_ICON[this.session.save.cls]);
    let view: ProfView = 'main';
    const go = (v: ProfView) => { view = v; this.refresh!(); };
    this.refresh = () => this.renderProf(view, go);
    this.refresh();
    this.host.open(box, () => { this.refresh = null; this.pickElem = null; });
  }

  /** 예 / 아니오 묻기 (포탈 들어가기 전 등) */
  confirm(text: string, onYes: () => void) {
    const box = el('div', 'npc-dlg');
    const panel = el('div', 'npc-panel'), body = el('div', 'npc-body');
    body.appendChild(el('p', 'line', esc(text)));
    const opts = el('div', 'opts');
    opts.appendChild(el('button', 'opt', '예', () => { this.host.close(); onYes(); }));
    opts.appendChild(el('button', 'opt', '아니오', () => this.host.close()));
    body.appendChild(opts);
    panel.appendChild(body);
    panel.appendChild(el('button', 'npc-x', '✕', () => this.host.close()));
    box.appendChild(panel);
    this.host.open(box);
  }

  openShop() {
    const box = this.frame('매점 모리', moriPortrait, '🛒');
    this.refresh = () => this.renderShop();
    this.refresh();
    this.host.open(box, () => { this.refresh = null; });
  }

  /**
   * 대화 NPC: 대사를 한 줄씩 보여 주고(클릭 · ↑ · Space · Enter · Z 로 넘김),
   * 선택지가 나오면 바로 앞 대사 아래에 교수님 메뉴와 같은 모양의 버튼으로 띄운다.
   */
  openTalk(id: string): Promise<void> {
    const npc = TALK_NPCS[id];
    const pick = npc && pickTalk(this.session.save, id, this.session.nowMs());
    if (!npc || !pick) return Promise.resolve();
    const box = this.frame(npc.name, null, npc.icon);
    const body = this.body!, nameEl = box.querySelector<HTMLElement>('.npc-name')!;
    // 대사 하나 + 데이터 안 위치 (효과를 보낼 때 씀)
    type Item = { step: DialogueStep; path: number[] };
    let queue: Item[] = pick.steps.map((step, i) => ({ step, path: [i] }));
    let line: string | null = null;
    let waitingChoice = false;
    let cutscene: string | null = null;

    const render = () => {
      body.innerHTML = '';
      const next = queue[0];
      if (line !== null) body.appendChild(el('p', 'line', `"${esc(line)}"`));
      if (next && 'choices' in next.step) {
        waitingChoice = true;
        const opts = el('div', 'opts');
        next.step.choices.forEach((c, ci) => {
          opts.appendChild(el('button', 'opt', esc(c.label), () => {
            queue = [...c.reply.map((step, j) => ({ step, path: [...next.path, ci, j] })), ...queue.slice(1)];
            waitingChoice = false;
            advance();
          }));
        });
        body.appendChild(opts);
      } else {
        waitingChoice = false;
        body.appendChild(el('div', 'talk-next', '▼'));
      }
    };
    const advance = () => {
      for (;;) {
        const it = queue[0];
        if (!it) { this.host.close(); return; }
        const step = it.step;
        if ('choices' in step) { render(); return; }
        queue.shift();
        // 효과: 화면에 안 보이고 바로 처리 (퀘스트 받기·보고 알림은 뜸). 실패하면(가방 가득 등) 대화를 거기서 끝냄
        if ('do' in step) {
          if (!this.act({ type: 'storyDo', npc: id, talk: pick.talk, path: it.path }).ok) { this.host.close(); return; }
          continue;
        }
        // 컷신: 대화창을 닫고 재생
        if ('cutscene' in step) { cutscene = step.cutscene; this.host.close(); return; }
        line = step.line;
        nameEl.textContent = step.who === 'player' ? this.session.save.name : (step.who && TALK_NPCS[step.who]?.name) || npc.name;
        render();
        return;
      }
    };
    // 대사 넘기기: 창 아무 곳이나 클릭 (선택지·닫기 버튼 제외) 또는 키
    box.addEventListener('click', e => {
      if (waitingChoice || (e.target as HTMLElement).closest('button')) return;
      advance();
    });
    const onKey = (e: KeyboardEvent) => {
      if (e.repeat || waitingChoice) return;
      if (e.code === 'Space' || e.code === 'Enter' || e.code === 'ArrowUp' || e.code === 'KeyZ') { e.preventDefault(); advance(); }
    };
    addEventListener('keydown', onKey);
    box.classList.add('talk');
    return new Promise(resolve => {
      this.host.open(box, () => {
        removeEventListener('keydown', onKey);
        if (cutscene) this.onCutscene(cutscene);
        resolve();
      });
      advance();
    });
  }

  /** 대사 안의 { cutscene } → 재생 (main 에서 연결) */
  onCutscene: (id: string) => void = () => {};

  // ---------- 교수님 ----------
  private renderProf(view: ProfView, go: (v: ProfView) => void) {
    const b = this.body!, s = this.session.save, now = this.session.nowMs();
    b.innerHTML = '';
    const back = () => b.appendChild(el('button', 'opt back', '← 돌아가기', () => go('main')));

    if (view === 'main') {
      b.appendChild(el('p', 'line', `"어서 와, ${esc(s.name)}. 오늘도 열심히 해보자."`));
      const ni = nextToLearn(s);
      const learnNew = ni >= 0 && s.level >= UNLOCK_LEVELS[ni];
      const classOk = canAttend(s, now) === null;
      const questNew = PROF_QUESTS().some(q => { const st = questState(s, q.id); return st === 'none' || st === 'ready'; });
      const opts = el('div', 'opts');
      const opt = (label: string, news: boolean, v: ProfView) =>
        opts.appendChild(el('button', 'opt' + (news ? ' news' : ''), `${label}${news ? '<i>!</i>' : ''}`, () => go(v)));
      opt('📚 스킬 배우기', learnNew, 'learn');
      opt('🕘 수업 듣기', classOk, 'class');
      opt('📋 퀘스트', questNew, 'quest');
      opt('🧪 테스트용 기능', false, 'test');
      opts.appendChild(el('button', 'opt', '👋 안녕히 계세요', () => this.host.close()));
      b.appendChild(opts);
      return;
    }

    if (view === 'learn') {
      const cls = CLASSES[s.cls], ni = nextToLearn(s);
      if (ni < 0) b.appendChild(el('p', 'line', '"모든 스킬을 배웠구나! 이제 수업으로 마스터를 노려보자."'));
      else {
        const id = cls.skills[ni], sk = SKILLS[id];
        if (s.level < UNLOCK_LEVELS[ni]) {
          b.appendChild(el('p', 'line', `"다음은 <b>${sk.name}</b>이야. <b>Lv ${UNLOCK_LEVELS[ni]}</b>이 되면 다시 오렴." <span class="note">(지금 Lv ${s.level})</span>`));
        } else {
          b.appendChild(el('p', 'line', `"이번에 배울 건 <b>${sk.name}</b>이야. <span class="note">(${SLOT_KEYS[ni]} 키)</span>`));
          if (sk.elements.length) {
            if (this.pickElem && !sk.elements.includes(this.pickElem)) this.pickElem = null;
            b.appendChild(el('p', 'note', '어떤 원소로 배울지 골라줘. 한 번 고르면 스킬트리 초기화 주문서로만 바꿀 수 있어."'));
            const row = el('div', 'chips');
            for (const e of sk.elements) {
              const c = el('button', 'chip' + (this.pickElem === e ? ' sel' : ''), `${ELEMENTS[e].icon} ${ELEMENTS[e].name}`, () => { this.pickElem = e; this.refresh!(); });
              c.style.setProperty('--c', ELEMENTS[e].color);
              row.appendChild(c);
            }
            b.appendChild(row);
          } else b.appendChild(el('p', 'note', '원소가 없는 버프 스킬이야."'));
          const btn = el('button', 'big', '배우기', () => {
            const r = this.act({ type: 'learn', skill: id, element: sk.elements.length ? this.pickElem : null });
            if (r.ok) { this.pickElem = null; go('main'); }
          }) as HTMLButtonElement;
          btn.disabled = !!sk.elements.length && !this.pickElem;
          b.appendChild(btn);
        }
      }
      back();
      return;
    }

    if (view === 'class') {
      const ti = timeInfo(now), why = canAttend(s, now);
      const toMorning = ti.phase === 0 ? 0 : ti.remain + (2 - ti.phase) * PHASE_MS;
      if (why === 'notMorning') b.appendChild(el('p', 'line', `"지금은 ${PHASES[ti.phase].icon} ${PHASES[ti.phase].name}이라 수업이 없어." <span class="note">다음 아침까지 ${mmss(toMorning)}</span>`));
      else if (why === 'done') b.appendChild(el('p', 'line', '"오늘 아침 수업은 이미 들었어. 내일 아침에 다시 와!"'));
      else if (why === 'noSkill') b.appendChild(el('p', 'line', '"배운 스킬이 없구나. 먼저 스킬을 배워보자."'));
      else if (why === 'allMaster') b.appendChild(el('p', 'line', '"모든 스킬을 마스터했구나! 🎓"'));
      else {
        b.appendChild(el('p', 'line', `"🌅 아침 수업 시간이야! 어떤 스킬을 연습할래?" <span class="note">남은 시간 ${mmss(ti.remain)} · +1 레벨, 레벨당 데미지 +10%</span>`));
        const opts = el('div', 'opts');
        for (const id of CLASSES[s.cls].skills.filter(x => learned(s, x))) {
          const lv = skillLevel(s, id);
          const btn = el('button', 'opt', lv >= MAX_SKILL_LEVEL ? `${SKILLS[id].name} 마스터` : `${SKILLS[id].name} Lv${lv} → ${lv + 1}`, () => this.act({ type: 'attend', skill: id })) as HTMLButtonElement;
          btn.disabled = lv >= MAX_SKILL_LEVEL;
          opts.appendChild(btn);
        }
        b.appendChild(opts);
      }
      back();
      return;
    }

    if (view === 'quest') {
      b.appendChild(el('p', 'line', '"부탁할 일이 있어. 언제든 다시 받을 수 있단다."'));
      for (const q of PROF_QUESTS()) {
        const st = questState(s, q.id), pr = questProgressText(s, q), card = el('div', 'card');
        const exp = typeof q.reward.exp === 'function' ? q.reward.exp(s.level) : q.reward.exp ?? 0;
        card.appendChild(el('div', '', `<b>${q.name}</b> <span class="note">보상 EXP ${exp}</span><br><span class="note">${q.desc}</span>`));
        if (st === 'none') card.appendChild(el('button', 'sm', '퀘스트 받기', () => this.act({ type: 'questAccept', id: q.id })));
        else if (st === 'ready') card.appendChild(el('button', 'sm go', '보고하기', () => this.act({ type: 'questReport', id: q.id })));
        else card.appendChild(el('div', 'note', `진행 중 ${pr}`));
        b.appendChild(card);
      }
      back();
      return;
    }

    // 테스트용
    b.appendChild(el('p', 'note', '개발 확인용 버튼이야. 실제 게임에는 없어.'));
    const opts = el('div', 'opts');
    opts.appendChild(el('button', 'opt', '⏩ 다음 시간대로', () => this.act({ type: 'debug', what: 'nextPhase' })));
    opts.appendChild(el('button', 'opt', '⬆️ 레벨 +1', () => this.act({ type: 'debug', what: 'levelUp' })));
    opts.appendChild(el('button', 'opt', '💰 골드 +1000', () => this.act({ type: 'debug', what: 'gold' })));
    opts.appendChild(el('button', 'opt', '📖 이야기 테스트 초기화', () => this.act({ type: 'debug', what: 'resetStory' })));
    b.appendChild(opts);
    back();
  }

  // ---------- 매점 ----------
  private renderShop() {
    const b = this.body!, s = this.session.save;
    b.innerHTML = '';
    b.appendChild(el('p', 'line', `"어서 와~ 필요한 거 있으면 골라봐!" <span class="gold">💰 ${s.gold} G</span>`));
    for (const id of SHOP_ITEMS) {
      const it = ITEMS[id], card = el('div', 'card shop'), price = it.price ?? 0;
      card.appendChild(itemIcon(id));
      card.appendChild(el('div', 'grow', `<b>${it.name}</b> <span class="gold">${price} G</span><br><span class="note">${it.desc} · 가진 개수 ${countItem(s, id)}</span>`));
      for (const n of it.bulk ?? [1]) {
        const btn = el('button', 'sm go', `${n}개`, () => this.act({ type: 'buy', item: id, n })) as HTMLButtonElement;
        btn.disabled = s.gold < price * n;
        card.appendChild(btn);
      }
      b.appendChild(card);
    }
    b.appendChild(el('p', 'note', '초기화 주문서는 캐릭터 창(C)에서 쓸 수 있어.'));
  }
}
