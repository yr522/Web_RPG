// 컷신: 위에서부터 차례로 실행. 하나가 끝나야 다음으로 (wait: false 면 기다리지 않고 바로 다음).
//
// who: 'player' = 플레이어, 'npc:<NPC id>' = 지금 맵의 NPC, 'mob:<이름>' = mob 단계로 만든 연출용 몬스터
// x 자리: 숫자(맵 좌표) 또는 who 와 같은 글자(그 캐릭터 위치)
//
//   { lock: true }                       플레이어 조작 막기 (false = 풀기). 컷신이 끝나면 자동으로 풀림
//   { ui: false }                        화면 UI 숨기기 (true = 보이기). 컷신이 끝나면 자동으로 보임
//   { cam: { x, zoom, time } }           카메라를 x 로 옮기고 zoom 배로 확대 (time 초 동안 부드럽게)
//   { cam: 'follow', time }              카메라를 원래대로 (플레이어 따라가기, 확대 1배)
//   { walk: { who, to, speed } }         걸어서 x = to 까지 (speed 생략 시 보통 걸음)
//   { pose: { who, motion, time } }      모션: 'idle' 서기 · 'crouch' 앉기 · 'jump' 점프 · 'attack' 공격 (time 초 유지)
//   { face: { who, dir } }               바라보는 방향 (1 오른쪽, -1 왼쪽)
//   { say: { who, text, life } }         머리 위 말풍선 (life 초)
//   { talk: 'NPC id' }                   그 NPC 대화창 (닫힐 때까지 기다림)
//   { mob: { id, elem, x, face } }       연출용 몬스터 등장 (겉모습만, 싸우지 않음). elem 생략 = 일반 슬라임
//   { remove: 'mob:<이름>' }              연출용 몬스터 없애기
//   { fight: { who: 'mob:<이름>', tag } } 연출용 몬스터를 그 자리에서 진짜 몬스터로 바꿈.
//                                         컷신이 끝날 때까지 가만히 있다가 끝나면 싸움 시작. tag = 이름표 (퀘스트에서 이 몬스터만 셀 때)
//   { wait: 초 }                          기다리기
//   { do: 효과 }                          이야기 효과 (npcs.ts 의 Effect: 플래그 바꾸기 등)
//
// 2026-11-25 튜토리얼에서 추가:
//   who: 'cls:<직업>'                      그 직업 캐릭터 = 내 직업이면 플레이어, 아니면 그 직업 동급생 NPC (npcs.ts CLASSMATE)
//   { place: { who, x, face } }           NPC·연출용 몬스터를 그 자리로 바로 옮김 (걷지 않고)
//   { fade: 'out' | 'in', time }          화면 어둡게 / 밝게 (time 초)
//   { notice: '글' }                       안내 팝업 (확인을 누를 때까지 기다림)
//   { tint: 'sunset' | null }             화면 색 (노을) / 원래대로. 컷신이 끝나면 원래대로
//   { fx: { kind, at, to, y } }           코드로 그린 임시 연출: boom 폭발 · smoke 연기 · pulse 파동(붉은 기운) · paper 날리는 종이 · flag 떨어지는 깃발 · arrow 화살(at → to)
//   { mob: { …, mob, elite } }            연출용 몬스터를 아무 몬스터로 (mob 없으면 슬라임), elite = 정예 특성
//   단계마다 cls: [직업…]                   그 직업으로 할 때만 이 단계를 함

import type { Element } from './elements';
import { GROUND_Y } from './maps';
import type { Effect } from './npcs';
import type { ClassId } from './classes';
import type { EliteAffix, MonsterId } from './monsters';

export type Who = 'player' | `npc:${string}` | `mob:${string}` | `cls:${ClassId}`;
export type FxKind = 'boom' | 'smoke' | 'pulse' | 'paper' | 'flag' | 'arrow';
export type CutX = number | Who;
export type Motion = 'idle' | 'crouch' | 'jump' | 'attack';

export type CutStep = (
  | { lock: boolean }
  | { ui: boolean }
  | { cam: { x?: CutX; zoom?: number; time?: number } | 'follow'; time?: number }
  | { walk: { who: Who; to: CutX; speed?: number } }
  | { pose: { who: Who; motion: Motion; time?: number } }
  | { face: { who: Who; dir: 1 | -1 } }
  | { say: { who: Who; text: string; life?: number } }
  | { talk: string }
  | { mob: { id: string; elem?: Element | null; x: CutX; face?: 1 | -1; mob?: MonsterId; elite?: EliteAffix[] } }
  | { place: { who: Who; x: CutX; face?: 1 | -1 } }
  | { fade: 'out' | 'in'; time?: number }
  | { notice: string }
  | { tint: 'sunset' | null }
  | { fx: { kind: FxKind; at: CutX; to?: CutX; y?: number } }
  | { remove: Who }
  | { fight: { who: Who; tag?: string } }
  | { wait: number }
  | { do: Effect }
) & { wait?: number | false; cls?: ClassId[] };

/** 컷신 기본값 */
export const CUTSCENE = {
  /** walk 의 기본 걸음 속도 (월드 px/초) */
  walkSpeed: 160,
  /** cam 의 기본 이동 시간 (초) */
  camTime: 0.8,
  /** say 의 기본 표시 시간 (초) */
  sayLife: 2.5,
  /** fade 기본 시간 (초) */
  fadeTime: 0.6,
};

/** 마법공학의 유산 12번: 골렘을 쓰러뜨리자마자 수상한 자가 들이닥쳐 결정체를 가져감 (장면 전용 맵 golem_scene) */
const steal = (friend: Who): CutStep[] => [
  { lock: true },
  { ui: false },
  { face: { who: 'player', dir: 1 } },
  { cam: { x: 650, zoom: 1.15, time: 0.8 } },
  { say: { who: friend, text: '해냈다…!', life: 1.4 }, wait: 1.2 },
  { walk: { who: 'npc:villain', to: 820, speed: 320 } },
  { say: { who: 'npc:villain', text: '이건 우리가 가져간다.', life: 2.2 }, wait: 2 },
  { walk: { who: 'npc:villain', to: 1450, speed: 420 }, wait: false },
  { say: { who: friend, text: '거기 서!', life: 1.6 }, wait: 1.6 },
  { cam: 'follow', time: 0.6 },
  { do: { flag: 'mg_stolen', set: 1 } },
];

// ---- 튜토리얼: 입학식 (2026-11-25). 'cls:<직업>' = 그 직업 캐릭터 (내 직업이면 나). 연출은 임시 그림(fx) ----
const TUT: Record<string, CutStep[]> = {
  // 장면 1. 학교 홀 — 첫 충돌 (새 캐릭터가 학교 홀에 들어오면, 맵 enterScene)
  tu_open: [
    { lock: true },
    { ui: false },
    // 내 자리로: 검사 = 복도 쪽, 궁수 = 기둥, 마법사 = 오른쪽에서 달려옴
    { walk: { who: 'player', to: 620 }, cls: ['warrior'] },
    { walk: { who: 'player', to: 760 }, cls: ['archer'] },
    { walk: { who: 'player', to: 1080 }, cls: ['mage'] },
    { place: { who: 'cls:mage', x: 1120, face: -1 } },
    { face: { who: 'cls:warrior', dir: 1 } },
    { cam: { x: 760, zoom: 1.25, time: 0.8 } },
    { walk: { who: 'cls:mage', to: 'cls:archer', speed: 380 } },
    // 부딪혀 넘어짐 + 종이가 날아가 검사 얼굴에
    { fx: { kind: 'paper', at: 'cls:archer', to: 'cls:warrior' } },
    { pose: { who: 'cls:mage', motion: 'crouch', time: 0.2 }, wait: false },
    { say: { who: 'cls:mage', text: '!', life: 1.4 }, wait: 1.0 },
    { say: { who: 'cls:warrior', text: '……', life: 1.4 }, wait: 1.2 },
    { talk: 'tut_scene' },
    { cam: 'follow', time: 0.6 },
  ],
  // 장면 2. 강당 — 수석 대표의 돌발 사고 (강당에 들어가면, tu1 readyScene)
  tu_cer: [
    { lock: true },
    { ui: false },
    // 내 자리: 검사 = 앞줄, 궁수 = 뒷줄, 마법사 = 단상
    { walk: { who: 'player', to: 720 }, cls: ['warrior'] },
    { walk: { who: 'player', to: 300 }, cls: ['archer'] },
    { walk: { who: 'player', to: 980 }, cls: ['mage'] },
    { place: { who: 'cls:mage', x: 980, face: 1 } },
    { face: { who: 'player', dir: 1 } },
    { cam: { x: 1080, zoom: 1.2, time: 1 } },
    { talk: 'tut_scene' },
    { face: { who: 'cls:mage', dir: 1 } },
    { pose: { who: 'cls:mage', motion: 'attack' } },
    // 작은 폭발 + 검은 연기 → 마법사가 단상 아래로 튕겨 나가고, 앞줄 검사가 받아 냄
    { fx: { kind: 'boom', at: 1040 } },
    { fx: { kind: 'smoke', at: 1040 } },
    { walk: { who: 'cls:mage', to: 780, speed: 520 }, wait: false },
    { walk: { who: 'cls:warrior', to: 760, speed: 300 } },
    // 천장에서 불붙은 깃발 → 뒷줄 궁수가 활로 빗겨 냄
    { fx: { kind: 'flag', at: 640 }, wait: 0.35 },
    { face: { who: 'cls:archer', dir: 1 } },
    { pose: { who: 'cls:archer', motion: 'attack' }, wait: false },
    { fx: { kind: 'arrow', at: 'cls:archer', to: 640, y: GROUND_Y - 60 }, wait: 0.5 },
    { cam: { x: 720, zoom: 1, time: 0.8 } },
    { talk: 'tut_scene' },
    { cam: 'follow', time: 0.6 },
  ],
  // 장면 3. 방과 후 학교 홀 (벌청소 보고, 동급생 대화에서) → 페이드 → 안내
  tu_sunset: [
    { lock: true },
    { ui: false },
    { tint: 'sunset' },
    { cam: { x: 'player', zoom: 1.2, time: 0.8 } },
    { talk: 'tut_scene' },
    { fade: 'out', time: 0.8 },
    { tint: null },
    { cam: 'follow', time: 0.1 },
    { notice: '[입학식 완료! 학교 홀의 훈련교관 레온에게 말을 걸어 기초 안내를 받으세요.]' },
    { fade: 'in', time: 0.6 },
  ],
  // 기숙사 방에 처음 들어옴 (tu3): 혼잣말
  tu_dorm: [
    { say: { who: 'player', text: '여기가 내가 지낼 기숙사 방이군. 침대도 깔끔하고…… 밤이 되면 여기서 쉴 수 있겠어.', life: 4 } },
    { do: { flag: 'tu_dorm', set: 1 } },
  ],
  // 제3막 1. 합동 훈련실에 처음 들어옴 (tu6)
  tu_joint: [
    { lock: true },
    { ui: false },
    { cam: { x: 600, zoom: 1.1, time: 0.8 } },
    { talk: 'tut_scene' },
    { do: { flag: 'tu_joint', set: 1 } },
  ],
  // 제3막 2. 인형 3기를 다 잡으면 (tu6 readyScene, 폭주한 인형이 있는 맵으로): 검사로 할 때만 손끝 파동, 그다음 인형 줌인
  tu_berserk: [
    { lock: true },
    { ui: false },
    { cam: { x: 'player', zoom: 1.5, time: 0.6 }, cls: ['warrior'] },
    { fx: { kind: 'pulse', at: 'player' }, cls: ['warrior'], wait: 1.2 },
    { cam: { x: 920, zoom: 1.5, time: 0.8 } },
    { fx: { kind: 'pulse', at: 920 }, wait: 1.2 },
    { cam: { x: 660, zoom: 1.1, time: 0.6 } },
    { talk: 'tut_scene' },
  ],
  // 제3막 3. 폭주한 인형을 잡으면 (tu7 readyScene): 카일라가 달려옴 → 마무리 대화 → 보상 → 안내
  tu_end: [
    { lock: true },
    { ui: false },
    { walk: { who: 'npc:kyla', to: 'player', speed: 340 } },
    { talk: 'kyla' },
    { notice: '[튜토리얼 완료! 각 학과 강의실(학교 복도)에서 첫 기본 스킬을 배우고, 레벨 5를 달성해 밤마다 들리는 소음 사건(「마법공학의 유산」)을 확인하세요.]' },
  ],
};

export const CUTSCENES: Record<string, CutStep[]> = {
  ...TUT,
  mg_steal: steal('npc:mage_friend'),
  // 마법사 직업: 동급생 검사와 함께
  mg_steal_w: steal('npc:warrior_friend'),
  // ---- 이야기 장치 테스트용 (시나리오가 들어오면 지움). 대사는 전부 임시 ----
  test: [
    { lock: true },
    { walk: { who: 'player', to: 440 } },
    { ui: false },
    { cam: { x: 'npc:story_test', zoom: 1.5, time: 1 } },
    { say: { who: 'npc:story_test', text: '컷신 테스트 1', life: 1.5 }, wait: 1.5 },
    { walk: { who: 'npc:story_test', to: 'player' } },
    { face: { who: 'player', dir: -1 } },
    { pose: { who: 'player', motion: 'crouch', time: 0.8 } },
    { say: { who: 'player', text: '컷신 테스트 2', life: 1.5 }, wait: 1.5 },
    { pose: { who: 'player', motion: 'jump' } },
    { pose: { who: 'player', motion: 'attack' } },
    { walk: { who: 'player', to: 420 } },
    { walk: { who: 'npc:story_test', to: 340 } },
    { cam: 'follow', time: 0.8 },
    { ui: true },
    { lock: false },
    { talk: 'story_test' },
  ],
  // 몬스터 연출 테스트: 불 슬라임 등장 → 카메라·말풍선·점프·다가옴 → 진짜 몬스터로 바뀌고 컷신 끝나면 싸움
  test_mob: [
    { lock: true },
    { ui: false },
    { walk: { who: 'player', to: 600 } },
    { mob: { id: 'boss', elem: 'fire', x: 1010 } },
    { cam: { x: 'mob:boss', zoom: 1.6, time: 0.8 } },
    { say: { who: 'mob:boss', text: '!', life: 1 }, wait: 0.6 },
    { pose: { who: 'mob:boss', motion: 'jump' } },
    { pose: { who: 'mob:boss', motion: 'crouch', time: 0.5 } },
    { walk: { who: 'mob:boss', to: 'player', speed: 120 }, wait: false },
    { cam: { x: 'player', zoom: 1.2, time: 1.2 } },
    { fight: { who: 'mob:boss', tag: 'test_boss' } },
    { cam: 'follow', time: 0.5 },
  ],
};
