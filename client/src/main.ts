import Phaser from 'phaser';
import './style.css';
import { LocalStore } from '@shared/store/Store';
import { newSave } from '@shared/sim/save';
import { LocalSession } from './session/LocalSession';
import { Input } from './input/Input';
import { Hud, type UiMode } from './hud/Hud';
import { GameScene, VIEW_H } from './scenes/GameScene';

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// ?ui=pc / ?ui=mobile 로 강제 가능 (PC에서 모바일 화면 확인용)
const uiMode: UiMode = params.get('ui') === 'mobile' ? 'mobile' : params.get('ui') === 'pc' ? 'pc' : isTouch ? 'mobile' : 'pc';

/** 월드 화면 폭: 높이 VIEW_H 기준, 화면 비율에 맞춰 720~1280 */
const viewWidth = () => Math.round(Math.max(720, Math.min(1280, (VIEW_H * innerWidth) / innerHeight)));
/** 선명하게 그리기 위한 렌더 배율 (1~2) */
const renderScale = () => Math.max(1, Math.min(2, Math.round((innerHeight * (devicePixelRatio || 1)) / VIEW_H)));

async function boot() {
  // 폰트가 늦게 뜨면 Phaser 글자가 기본 폰트로 그려지므로 먼저 불러온다
  await Promise.race([
    Promise.all([
      document.fonts.load('500 16px Pretendard'),
      document.fonts.load('300 16px Pretendard'),
      document.fonts.load('700 16px Esamanru'),
    ]),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});

  const store = new LocalStore();
  if (params.has('reset')) await store.clear();
  // 캐릭터 생성 화면은 다음 단계. 지금은 테스트용 전사 캐릭터로 시작.
  let save = await store.load();
  if (!save) { save = newSave('견습생', 'warrior', 'M'); await store.save(save); }

  const session = new LocalSession(save, store);
  if (import.meta.env.DEV) Object.assign(window, { __session: session });
  const input = new Input();
  const hud = new Hud(input, uiMode);

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  hud.onMenu = id => {
    if (id === 'full') toggleFullscreen();
    else hud.toast({ char: '캐릭터 창은 준비 중이에요', home: '귀환은 준비 중이에요', menu: '메뉴는 준비 중이에요' }[id]);
  };
  input.onHotkey = code => {
    if (code === 'KeyC') hud.onMenu('char');
    if (code === 'Escape') hud.onMenu('menu');
  };

  const s = renderScale();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    width: viewWidth() * s,
    height: VIEW_H * s,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { keyboard: false },
    banner: false,
  });
  game.scene.add('game', GameScene, true, { session, input, hud, renderScale, isTouch });

  addEventListener('resize', () => {
    const sc = renderScale();
    game.scale.setGameSize(viewWidth() * sc, VIEW_H * sc);
  });
}

void boot();
