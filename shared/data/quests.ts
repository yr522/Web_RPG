// 반복 퀘스트 (기획서 6장)
export interface QuestDef {
  id: string;
  name: string;
  desc: string;
  need: number;
  /** 어떤 몬스터를 잡아야 세는지 */
  target: 'normal' | 'elemental';
  exp: (level: number) => number;
}

export const QUESTS: QuestDef[] = [
  { id: 'q1', name: '슬라임 퇴치', desc: '학교 뒷숲에서 일반 슬라임 8마리 처치', need: 8, target: 'normal', exp: lv => 60 + lv * 12 },
  { id: 'q2', name: '원소 슬라임 조사', desc: '원소 슬라임 서식지에서 원소 슬라임 5마리 처치', need: 5, target: 'elemental', exp: lv => 100 + lv * 18 },
];
