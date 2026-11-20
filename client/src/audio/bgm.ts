// 배경 음악: 맵마다 MAP_BGM 의 곡을 반복 재생. 같은 곡인 맵으로 옮기면 끊지 않고 이어서, 다른 곡이면 짧게 줄였다가 바꿈.
// 브라우저는 사람이 한 번 누르기 전에는 소리를 못 내서, 못 틀었으면 다음 클릭·키 입력 때 다시 틈.
const FILES = import.meta.glob('../../../assets/sound/BGM/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const URLS: Record<string, string> = {};
for (const [path, url] of Object.entries(FILES)) URLS[decodeURIComponent(path.split('/').pop()!.replace(/\.mp3$/, ''))] = url;

import { onSettings, settings } from '../settings';

/** 곡 바꿀 때 걸리는 시간(초). 음량은 설정 창 (기본 0.4) */
const FADE = 0.6;
const volume = () => (settings.mute ? 0 : settings.bgm);

let cur: { name: string; el: HTMLAudioElement } | null = null;
let fading: HTMLAudioElement[] = [];

function fadeTo(el: HTMLAudioElement, to: number, done?: () => void) {
  const from = el.volume, t0 = performance.now();
  const tick = () => {
    const k = Math.min(1, (performance.now() - t0) / (FADE * 1000));
    el.volume = Math.max(0, Math.min(1, from + (to - from) * k));
    if (k < 1) requestAnimationFrame(tick); else done?.();
  };
  requestAnimationFrame(tick);
}

function tryPlay(el: HTMLAudioElement) {
  el.play().catch(() => {
    // 자동 재생이 막힘: 다음 입력 때 다시
    const retry = () => { if (cur?.el === el) void el.play().catch(() => {}); };
    addEventListener('pointerdown', retry, { once: true });
    addEventListener('keydown', retry, { once: true });
  });
}

/** 이 곡으로 (null = 음악 끔). 지금 곡과 같으면 그대로 이어짐 */
export function playBgm(name: string | null | undefined) {
  const want = name && URLS[name] ? name : null;
  if ((cur?.name ?? null) === want) return;
  if (cur) {
    const old = cur.el;
    fading.push(old);
    fadeTo(old, 0, () => { old.pause(); fading = fading.filter(a => a !== old); });
  }
  cur = null;
  if (!want) return;
  const el = new Audio(URLS[want]);
  el.loop = true;
  el.volume = 0;
  cur = { name: want, el };
  tryPlay(el);
  fadeTo(el, volume());
}

// 설정을 바꾸면 지금 곡 음량을 바로 맞춤
onSettings(() => { if (cur) cur.el.volume = volume(); });
