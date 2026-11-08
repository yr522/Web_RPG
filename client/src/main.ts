import Phaser from 'phaser';
import './style.css';
import { LocalStore } from '@shared/store/Store';
import { newSave, normalizeSave } from '@shared/sim/save';
import { LocalSession } from './session/LocalSession';
import { Input } from './input/Input';
import { Hud, type UiMode } from './hud/Hud';
import { GameScene, VIEW_H } from './scenes/GameScene';
import { DialogHost } from './ui/Dialog';
import { NpcDialog } from './ui/NpcDialog';

const params = new URLSearchParams(location.search);
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
// ?ui=pc / ?ui=mobile 로 강제 가능 (PC에서 모바일 화면 확인용)
const uiMode: UiMode = params.get('ui') === 'mobile' ? 'mobile' : params.get('ui') === 'pc' ? 'pc' : isTouch ? 'mobile' : 'pc';

/** 월드 화면 폭: 높이 VIEW_H 기준, 화면 비율에 맞춰 720~1280 */
const viewWidth = () => Math.round(Math.max(720, Math.min(1280, (VIEW_H * innerWidth) / innerHeight)));
/**
 * 캔버스 픽셀 크기를 실제 화면 픽셀(CSS 크기 × devicePixelRatio)과 똑같이 맞춘다.
 * 브라우저가 캔버스를 늘리거나 줄이지 않으므로 게임 안 글자가 뭉개지지 않는다.
 * zoom = 월드 1px 이 화면 몇 픽셀인지 (예: 1366×768 노트북 ≈ 1.24)
 */
function canvasLayout() {
  const vw = viewWidth();
  const cssH = Math.min(innerHeight, (innerWidth * VIEW_H) / vw);
  const zoom = (cssH * Math.min(devicePixelRatio || 1, 3)) / VIEW_H;
  return { width: Math.round(vw * zoom), height: Math.round(VIEW_H * zoom), zoom };
}

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
  save = save ? normalizeSave(save) : newSave('견습생', 'warrior', 'M');
  await store.save(save);

  const session = new LocalSession(save, store);
  if (import.meta.env.DEV) Object.assign(window, { __session: session });
  const input = new Input();
  const hud = new Hud(input, uiMode);
  const dialogs = new DialogHost();
  dialogs.onChange(open => { input.blocked = open; });
  const npcDialog = new NpcDialog(dialogs, session, hud);
  const openNpc = (id: 'prof' | 'shop') => (id === 'shop' ? npcDialog.openShop() : npcDialog.openProfessor());

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

  const layout = canvasLayout();
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: 'game',
    backgroundColor: '#000000',
    width: layout.width,
    height: layout.height,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    render: { antialias: true, roundPixels: false },
    input: { keyboard: false, mouse: true, touch: true },
    banner: false,
  });
  game.scene.add('game', GameScene, true, { session, input, hud, isTouch, openNpc });

  addEventListener('resize', () => {
    const l = canvasLayout();
    game.scale.setGameSize(l.width, l.height);
  });
}

void boot();
