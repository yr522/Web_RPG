// 캐릭터 생성 화면 (유저 구상도 기준)
// 왼쪽: 고른 직업·성별 + 배너 일러스트 + 스토리 / 가운데: 캐릭터 도트 / 오른쪽: 직업 · 닉네임 · 성별 · 능력치 · 생성
import { CLASSES, CREATE_STAT_POINTS, NAME_MAX, START_STAT, type ClassId, type StatId } from '@shared/data/classes';
import { createSave, type Gender, type SaveData } from '@shared/sim/save';
import { ATTACK_SHEET, CELL, FOOT_X, FOOT_Y, PARTS, SHEETS, type SheetName } from '../scenes/PlayerAvatar';
import { el, esc } from './Dialog';
import warriorM from '../../../assets/temp/fighter_banner_M.png';
import warriorF from '../../../assets/temp/fighter_banner_F.png';
import mageM from '../../../assets/img/banner/magician_male_none_background.png';
import mageF from '../../../assets/img/banner/magician_female_none_background.png';
import archerM from '../../../assets/temp/archer_banner_M.png';
import archerF from '../../../assets/temp/archer_banner_F.png';

const GENDER_LABEL: Record<Gender, string> = { M: '남성', F: '여성' };
const CLASS_ORDER: ClassId[] = ['warrior', 'mage', 'archer'];
const BANNERS: Record<ClassId, Record<Gender, string>> = {
  warrior: { M: warriorM, F: warriorF },
  mage: { M: mageM, F: mageF },
  archer: { M: archerM, F: archerF },
};
/** 전신 일러스트를 쓰는 직업 (반신 크기로 확대해서 보여줌) */
const FULL_BANNER: ClassId[] = ['mage'];
/** 직업 스토리 (임시 문구 — 세계관 문서에서 비밀이 아닌 부분만 옮김) */
const STORY: Record<ClassId, string> = {
  warrior: '진중하고 조용한 검술과 학생. 평범한 가정의 쌍둥이 남매로 태어나, 마을 이웃이던 스승에게 검을 배웠다. 검을 쥐고 있을 때 마음이 가장 고요해진다.',
  mage: '밝고 호기심 많은 마법학과 수석 입학생. 이곳저곳 떠도는 학자 부부의 하나뿐인 아이로 자랐다. 천재라는 말이 늘 따라다니지만, 그저 모르는 것이 궁금할 뿐이다.',
  archer: '무뚝뚝하고 차분한 궁술과 학생. 갓난아이 때 주워져, 조금 가난하지만 화목한 집에서 사랑받으며 자랐다. 몸에 새겨진 낯선 문신의 뜻은 아직 모른다.',
};
const STATS: { id: StatId; name: string }[] = [
  { id: 'str', name: '근력' },
  { id: 'dex', name: '민첩' },
  { id: 'int', name: '지능' },
];

/** 가운데 캐릭터 미리보기: 기본 자세 → 직업 공격 동작을 반복 */
const PREVIEW: Record<SheetName, { frame: number; time: number }[]> = {
  walk: [{ frame: 0, time: 1 }],
  sword: [{ frame: 0, time: 0.35 }, { frame: 1, time: 0.5 }],
  staff: [{ frame: 0, time: 0.35 }, { frame: 1, time: 0.5 }],
  bow: [{ frame: 0, time: 0.25 }, { frame: 1, time: 0.6 }, { frame: 2, time: 0.35 }],
};

function loadImage(src: string) {
  return new Promise<HTMLImageElement>(res => {
    const img = new Image();
    img.onload = () => res(img);
    img.onerror = () => res(img);
    img.src = src;
  });
}

/** 캐릭터를 만들 때까지 화면을 띄우고, 만든 저장 데이터를 돌려준다 */
export function showCreateScreen(): Promise<SaveData> {
  return new Promise(resolve => {
    let cls: ClassId = 'warrior', gender: Gender = 'F';
    const add: Record<StatId, number> = { str: 0, dex: 0, int: 0 };
    const used = () => add.str + add.dex + add.int;

    const root = el('div', 'cc');
    // ---- 왼쪽 ----
    const left = el('div', 'cc-left');
    const title = el('div', 'cc-title');
    const banner = el('img', 'cc-banner') as HTMLImageElement;
    banner.alt = '';
    const story = el('p', 'cc-story');
    left.append(title, banner, story);

    // ---- 가운데 ----
    const mid = el('div', 'cc-mid');
    const canvas = el('canvas', 'cc-sprite') as HTMLCanvasElement;
    canvas.width = CELL; canvas.height = CELL;
    mid.append(canvas, el('div', 'cc-stage'));

    // ---- 오른쪽 ----
    const right = el('div', 'cc-right');
    right.appendChild(el('div', 'cc-label', '직업'));
    const classRow = el('div', 'cc-classes');
    const classBtns = CLASS_ORDER.map(id => {
      const b = el('button', 'cc-class', CLASSES[id].name, () => { cls = id; render(); });
      classRow.appendChild(b);
      return b;
    });
    right.appendChild(classRow);

    const form = el('div', 'cc-form');
    const name = el('input', 'cc-name') as HTMLInputElement;
    name.maxLength = NAME_MAX;
    name.placeholder = '닉네임';
    name.autocomplete = 'off';
    name.spellcheck = false;
    form.appendChild(name);

    const genderRow = el('div', 'cc-row', '<span class="cc-k">성별:</span>');
    const genderBtns = (['F', 'M'] as Gender[]).map(g => {
      const b = el('button', `cc-gender ${g === 'F' ? 'f' : 'm'}`, '', () => { gender = g; render(); });
      b.title = GENDER_LABEL[g];
      b.setAttribute('aria-label', GENDER_LABEL[g]);
      genderRow.appendChild(b);
      return b;
    });
    form.appendChild(genderRow);

    const statVals = new Map<StatId, HTMLElement>();
    for (const st of STATS) {
      const row = el('div', 'cc-row cc-stat', `<span class="cc-k">${st.name}</span>`);
      const minus = el('button', 'cc-pm', '−', () => { if (add[st.id] > 0) { add[st.id]--; render(); } });
      const val = el('span', 'cc-v');
      const plus = el('button', 'cc-pm', '+', () => { if (used() < CREATE_STAT_POINTS) { add[st.id]++; render(); } });
      minus.setAttribute('aria-label', `${st.name} 내리기`);
      plus.setAttribute('aria-label', `${st.name} 올리기`);
      row.append(minus, val, plus);
      statVals.set(st.id, val);
      form.appendChild(row);
    }
    const left2 = el('div', 'cc-row cc-left-pts', '<span class="cc-k">남은 포인트</span>');
    const ptsVal = el('span', 'cc-v');
    left2.appendChild(ptsVal);
    form.appendChild(left2);
    right.appendChild(form);

    const create = el('button', 'cc-create', '생성', () => {
      stop = true;
      root.remove();
      resolve(createSave(name.value, cls, gender, add));
    });
    right.appendChild(create);

    root.append(left, mid, right);
    document.body.appendChild(root);

    // ---- 캐릭터 도트 미리보기 ----
    const images = new Map<string, HTMLImageElement>();
    void Promise.all((Object.keys(SHEETS) as SheetName[]).flatMap(sh => PARTS.map(async pt => {
      images.set(`${sh}_${pt}`, await loadImage(SHEETS[sh][pt]));
    })));
    const ctx = canvas.getContext('2d')!;
    let stop = false, t = 0, last = performance.now();
    const drawPreview = (now: number) => {
      if (stop) return;
      t += Math.min(0.1, (now - last) / 1000);
      last = now;
      const atk = ATTACK_SHEET[cls];
      const steps = [...PREVIEW.walk.map(s => ({ ...s, sheet: 'walk' as SheetName })), ...PREVIEW[atk].map(s => ({ ...s, sheet: atk }))];
      const total = steps.reduce((a, s) => a + s.time, 0);
      let k = t % total, step = steps[0];
      for (const s of steps) { if (k < s.time) { step = s; break; } k -= s.time; }
      ctx.clearRect(0, 0, CELL, CELL);
      for (const pt of PARTS) {
        const img = images.get(`${step.sheet}_${pt}`);
        if (img?.complete && img.naturalWidth) ctx.drawImage(img, step.frame * CELL, 0, CELL, CELL, 0, 0, CELL, CELL);
      }
      requestAnimationFrame(drawPreview);
    };
    requestAnimationFrame(drawPreview);
    // 발 기준점이 단상 위에 오도록
    canvas.style.setProperty('--fx', String(FOOT_X / CELL));
    canvas.style.setProperty('--fy', String(FOOT_Y / CELL));

    function render() {
      title.textContent = `${CLASSES[cls].name} / ${GENDER_LABEL[gender]}`;
      const src = BANNERS[cls][gender];
      if (banner.getAttribute('src') !== src) banner.src = src;
      banner.classList.toggle('full', FULL_BANNER.includes(cls));
      const text = esc(STORY[cls]);
      story.innerHTML = `<span class="cc-cap">${text[0]}</span>${text.slice(1)}`;
      classBtns.forEach((b, i) => b.classList.toggle('sel', CLASS_ORDER[i] === cls));
      genderBtns.forEach((b, i) => b.classList.toggle('sel', (['F', 'M'] as Gender[])[i] === gender));
      for (const st of STATS) statVals.get(st.id)!.textContent = String(START_STAT + add[st.id]);
      ptsVal.textContent = String(CREATE_STAT_POINTS - used());
      left2.classList.toggle('zero', used() >= CREATE_STAT_POINTS);
    }
    render();
  });
}
