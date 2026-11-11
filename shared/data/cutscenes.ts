// 컷신: 위에서부터 차례로 실행. 하나가 끝나야 다음으로 (wait: false 면 기다리지 않고 바로 다음).
//
// who: 'player' = 플레이어, 'npc:<NPC id>' = 지금 맵의 NPC
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
//   { wait: 초 }                          기다리기

export type Who = 'player' | `npc:${string}`;
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
  | { wait: number }
) & { wait?: number | false };

/** 컷신 기본값 */
export const CUTSCENE = {
  /** walk 의 기본 걸음 속도 (월드 px/초) */
  walkSpeed: 160,
  /** cam 의 기본 이동 시간 (초) */
  camTime: 0.8,
  /** say 의 기본 표시 시간 (초) */
  sayLife: 2.5,
};

export const CUTSCENES: Record<string, CutStep[]> = {
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
};
