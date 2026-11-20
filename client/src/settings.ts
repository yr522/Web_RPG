// 설정 (이 브라우저에만 저장, 캐릭터와 상관없음): 배경 음악 음량 · 음소거
const KEY = 'mgs_settings_v1';

export interface Settings {
  /** 배경 음악 음량 0~1 */
  bgm: number;
  /** 음소거 */
  mute: boolean;
}

const DEFAULTS: Settings = { bgm: 0.4, mute: false };

function load(): Settings {
  try { return { ...DEFAULTS, ...JSON.parse(localStorage.getItem(KEY) ?? '{}') }; } catch { return { ...DEFAULTS }; }
}

export const settings: Settings = load();
const listeners: (() => void)[] = [];

/** 설정 바꾸기 (바로 저장, 듣는 곳에 알림) */
export function setSettings(patch: Partial<Settings>) {
  Object.assign(settings, patch);
  try { localStorage.setItem(KEY, JSON.stringify(settings)); } catch { /* 저장 불가 환경은 무시 */ }
  for (const f of listeners) f();
}
export function onSettings(f: () => void) { listeners.push(f); }
