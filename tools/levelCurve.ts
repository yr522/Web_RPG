// 레벨 곡선 확인: 퀘스트 라인을 순서대로 하면 몇 레벨이 되는지 계산 (2026-11-25, 최대 레벨 14 잠금)
// 실행: npm run curve  → 표 출력 + document/레벨곡선.md 를 새로 씀
// 경험치 표(classes.ts EXP_TABLE)·몬스터 경험치(monsters.ts)·퀘스트 보상(quests.ts)을 바꾼 뒤 다시 돌려서 목표 구간에 맞는지 본다.
// 사냥 마릿수: 퀘스트에 꼭 필요한 마릿수(드롭은 기댓값) × 1.3 (가는 길에 잡는 것). 콤보·정예 보너스는 빼고 셈
import { writeFileSync } from 'node:fs';
import { expNeed, MAX_LEVEL } from '../shared/data/classes';
import { MONSTERS, expGapMult, type MonsterId } from '../shared/data/monsters';
import { QUESTS } from '../shared/data/quests';

interface Step {
  label: string;
  /** 이 단계 보상을 받는 퀘스트 */
  quests?: string[];
  /** 잡는 몬스터 [몬스터, 마릿수] (정예면 ×4) */
  kills?: [MonsterId, number, 'elite'?][];
  /** 이 레벨이 될 때까지 이 몬스터 사냥 (사냥 구간) */
  grind?: { mob: MonsterId; until: number };
  /** 이 단계가 끝날 때 목표 레벨 구간 [최소, 최대] */
  want?: [number, number];
  /** 꼭 하지 않아도 되는 단계 (계산에서 빼고, 했을 때 레벨만 따로 보여 줌) */
  optional?: boolean;
}

const AROUND = 1.3;

const STEPS: Step[] = [
  // ---- 튜토리얼: 입학식 (1~3) ----
  { label: '튜토리얼 1~4 (입학식·벌청소·기숙사·카일라)', quests: ['tu1', 'tu2', 'tu3', 'tu4'] },
  { label: '튜토리얼 5 기초 타격 연습', quests: ['tu5'], kills: [['training_doll', 3 * AROUND]] },
  { label: '튜토리얼 6~7 합동 훈련실', quests: ['tu6', 'tu7'], kills: [['training_doll', 3], ['training_doll_x', 1, 'elite']], want: [2.5, 3.5] },
  // ---- 사냥 (3~5) ----
  { label: '학교 뒷숲 슬라임 사냥 → Lv 4', grind: { mob: 'slime', until: 4 } },
  { label: '원소 슬라임 서식지 사냥 → Lv 5', grind: { mob: 'slime_elem', until: 5 }, want: [5, 5.3] },
  // ---- 마법공학의 유산 (5~10). 검사·궁수 기준 (마법사는 mgm2·mgm4 로 보상 같음) ----
  { label: '유산 1~5 (숲 둘러보기·잠자기·밤의 숲)', quests: ['mg2', 'mg4', 'mg5'] },
  { label: '유산 6 경비기계A 5', quests: ['mg6'], kills: [['guard_a', 5 * AROUND]] },
  { label: '유산 7 경비기계B 4', quests: ['mg7'], kills: [['guard_b', 4 * AROUND]] },
  // 여는 장치: 5% 드롭 → 기댓값 20마리
  { label: '유산 9 여는 장치 (경비기계B ~20)', quests: ['mg9'], kills: [['guard_b', 20]] },
  { label: '유산 10 공방 지하 (C 4 · D 4)', quests: ['mg10'], kills: [['guard_c', 4], ['guard_d', 4]] },
  { label: '유산 11 마법 골렘', quests: ['mg11'], kills: [['golem', 1]] },
  { label: '유산 12~13 후일담·교수님 보고', quests: ['mg12', 'mg13'], want: [9.8, 10.5] },
  // ---- 던전 (선택) ----
  { label: '(선택) 던전 잊힌 공방 1회', optional: true, kills: [['guard_a', 6], ['guard_b', 4], ['guard_c', 5], ['guard_d', 7], ['guard_boss', 1, 'elite']] },
  // ---- 영주님의 생일잔치 (10~12). 꿀 50개(70%) → ~72마리, 쓸만한 고철 5개(15%) → ~33마리 ----
  { label: '생일 1 꿀케이크 (꿀 슬라임 ~72)', quests: ['bd1'], kills: [['honey_slime', 72]] },
  { label: '생일 2 동상 의뢰 (경비기계A·B ~33)', quests: ['bd2'], kills: [['guard_a', 17], ['guard_b', 16]] },
  { label: '생일 3 초대장 배달', quests: ['bd3'] },
  { label: '생일 4 날아간 악보 (들짐승 ~10)', quests: ['bd4'], kills: [['beast', 10]], want: [11.7, 12.5] },
  // ---- 그 뒤 (12~14): 일일 퀘스트·사냥 ----
  { label: '(선택) 폭죽 재료 원소 구슬 10개 (원소 슬라임 ~100)', optional: true, kills: [['slime_elem', 100]] },
];

/** 레벨을 소수로 (12.5 = Lv 12 에서 다음 레벨 경험치 절반) */
const lvNum = (lv: number, exp: number) => (lv >= MAX_LEVEL ? lv : lv + exp / expNeed(lv));

function main() {
  let lv = 1, exp = 0;
  const gain = (n: number) => {
    if (lv >= MAX_LEVEL) return;
    exp += n;
    while (lv < MAX_LEVEL && exp >= expNeed(lv)) { exp -= expNeed(lv); lv++; }
    if (lv >= MAX_LEVEL) exp = 0;
  };
  const killExp = (mob: MonsterId, n: number, elite?: 'elite') => {
    const d = MONSTERS[mob];
    // 한 마리씩 (레벨이 오르면 레벨 차이 감소가 바뀜)
    let whole = Math.floor(n);
    const part = n - whole;
    let got = 0;
    for (let i = 0; i < whole + (part > 0 ? 1 : 0); i++) {
      const k = i === whole ? part : 1;
      const e = d.exp * (elite ? 4 : 1) * expGapMult(lv, d.level) * k;
      got += e;
      gain(e);
    }
    return got;
  };
  const rows: string[] = [];
  const bad: string[] = [];
  for (const st of STEPS) {
    const save = { lv, exp };
    let mobExp = 0, questExp = 0, grindN = 0;
    for (const [mob, n, el] of st.kills ?? []) mobExp += killExp(mob, n, el);
    if (st.grind) {
      while (lv < st.grind.until && grindN < 10000) { mobExp += killExp(st.grind.mob, 1); grindN++; }
    }
    for (const id of st.quests ?? []) {
      const q = QUESTS.find(x => x.id === id);
      if (!q) { bad.push(`퀘스트 없음: ${id}`); continue; }
      const r = typeof q.reward.exp === 'function' ? q.reward.exp(lv) : q.reward.exp ?? 0;
      questExp += r;
      gain(r);
    }
    const now = lvNum(lv, exp);
    const ok = st.want ? now >= st.want[0] && now <= st.want[1] : true;
    if (!ok) bad.push(`${st.label}: Lv ${now.toFixed(2)} (목표 ${st.want![0]}~${st.want![1]})`);
    const lvText = st.optional ? `(했으면 ${now.toFixed(2)})` : now.toFixed(2);
    rows.push(`| ${st.label}${st.grind ? ` (${grindN}마리)` : ''} | ${Math.round(mobExp)} | ${questExp} | ${lvText} | ${st.want ? `${st.want[0]}~${st.want[1]} ${ok ? '✅' : '❌'}` : ''} |`);
    // 선택 단계는 안 한 것으로 되돌림
    if (st.optional) { lv = save.lv; exp = save.exp; }
  }
  const md = [
    '# 레벨 곡선 (자동)',
    '',
    '> `npm run curve` 로 만든 표. 손으로 고치지 말고 수치를 바꾼 뒤 다시 돌린다.',
    `> 최대 레벨 ${MAX_LEVEL}. 사냥 마릿수 = 퀘스트에 꼭 필요한 마릿수(드롭은 기댓값) × ${AROUND} (오가며 잡는 것), 콤보·정예 보너스 뺌. 레벨 차이 경험치 감소 포함.`,
    '> 레벨 = 소수점까지 (12.5 = Lv 12 에서 다음 레벨까지 절반). (선택) 단계는 안 한 것으로 이어서 계산.',
    '',
    '| 단계 | 사냥 EXP | 보상 EXP | 끝난 뒤 레벨 | 목표 |',
    '|---|---|---|---|---|',
    ...rows,
    '',
    `경험치 표 (Lv → 다음 레벨): ${Array.from({ length: MAX_LEVEL - 1 }, (_, i) => `${i + 1}→${expNeed(i + 1)}`).join(' · ')}`,
    '',
  ].join('\n');
  writeFileSync('document/레벨곡선.md', md);
  console.log(md);
  if (bad.length) { console.error('\n목표 밖:\n' + bad.join('\n')); process.exitCode = 1; }
}

main();
