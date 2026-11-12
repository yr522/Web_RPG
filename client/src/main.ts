import Phaser from 'phaser';
import './style.css';
import { LocalStore, migrateToSlots, slotKey } from '@shared/store/Store';
import { CHAR_SLOTS } from '@shared/data/account';
import { LocalSession } from './session/LocalSession';
import { Input } from './input/Input';
import { Hud, type UiMode } from './hud/Hud';
import { GameScene, VIEW_H } from './scenes/GameScene';
import { DialogHost } from './ui/Dialog';
import { NpcDialog } from './ui/NpcDialog';
import { CharWindow } from './ui/CharWindow';
import { InventoryWindow } from './ui/InventoryWindow';
import { showSelectScreen } from './ui/SelectScreen';
import { pickTalk } from '@shared/rules/story';
import { setupMobileGate } from './ui/MobileGate';

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
  // 모바일: 가로 + 전체화면 안내 (가로 안내와 같은 기준 = 손가락 터치 기기)
  setupMobileGate(matchMedia('(pointer: coarse)').matches);
  // 폰트가 늦게 뜨면 Phaser 글자가 기본 폰트로 그려지므로 먼저 불러온다
  await Promise.race([
    Promise.all([
      document.fonts.load('500 16px Pretendard'),
      document.fonts.load('300 16px Pretendard'),
      document.fonts.load('700 16px Esamanru'),
    ]),
    new Promise(r => setTimeout(r, 2500)),
  ]).catch(() => {});

  // 예전 저장(캐릭터 하나)은 1번 슬롯으로. ?reset 이면 모든 슬롯을 지움
  await migrateToSlots();
  if (params.has('reset')) for (let i = 0; i < CHAR_SLOTS; i++) await new LocalStore(slotKey(i)).clear();
  // 캐릭터 선택 화면 → 고른 캐릭터로 시작 (진행 상황은 슬롯마다 따로 저장)
  const { store, save } = await showSelectScreen();
  await store.save(save);

  const session = new LocalSession(save, store);
  if (import.meta.env.DEV) Object.assign(window, { __session: session });
  const input = new Input();
  const hud = new Hud(input, uiMode);
  const dialogs = new DialogHost();
  dialogs.onChange(open => { input.blocked = open; });
  const npcDialog = new NpcDialog(dialogs, session, hud);
  const charWindow = new CharWindow(dialogs, session, hud);
  const invWindow = new InventoryWindow(session, hud);
  hud.onUpdate.push(() => invWindow.update());
  // 교수님: 이야기 대사(보고 등)가 있으면 그 대화, 아니면 교수님 메뉴
  const profTalk = () => (pickTalk(session.save, 'prof', session.nowMs())?.talk ?? -1) >= 0;
  const openNpc = (id: string) => (id === 'shop' ? npcDialog.openShop() : id === 'prof' ? (profTalk() ? npcDialog.openTalk('prof') : npcDialog.openProfessor()) : npcDialog.openTalk(id));

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen?.().catch(() => {});
  };
  hud.onMenu = id => {
    if (id === 'full') toggleFullscreen();
    else if (id === 'char') charWindow.toggle();
    else if (id === 'inv') invWindow.toggle();
    else if (id === 'boss') npcDialog.openBoss();
    else if (id === 'home') { if (!session.returnHome()) hud.toast('이미 학교에 있어'); }
    // Esc 메뉴: 캐릭터 선택으로 (저장하고 처음 화면으로)
    else npcDialog.openMenu(() => { void store.save(session.save).then(() => location.reload()); });
  };
  input.onHotkey = code => {
    if (code === 'KeyC') hud.onMenu('char');
    if (code === 'KeyI') hud.onMenu('inv');
    if (code === 'Escape') { if (invWindow.isOpen) invWindow.close(); else hud.onMenu('menu'); }
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
  game.scene.add('game', GameScene, true, { session, input, hud, isTouch, openNpc, talk: (npc: string) => npcDialog.openTalk(npc), confirm: (text: string, yes: () => void) => npcDialog.confirm(text, yes), chooseBoss: (boss: string, text?: string) => npcDialog.openDifficulty(boss, text) });
  // 대사 안의 컷신 → 게임 화면에서 재생
  npcDialog.onCutscene = id => (game.scene.getScene('game') as GameScene).playCutscene(id);
  if (import.meta.env.DEV) Object.assign(window, { __cutscene: (id: string) => (game.scene.getScene('game') as GameScene).playCutscene(id) });

  // 창 크기·전체화면·화면 회전이 바뀌면 캔버스를 새 크기에 다시 맞춘다.
  // 브라우저마다 새 크기가 늦게 잡히는 경우가 있어서 조금 뒤에 한 번 더 맞춘다.
  const fit = () => {
    const l = canvasLayout();
    if (game.scale.width !== l.width || game.scale.height !== l.height) game.scale.setGameSize(l.width, l.height);
    game.scale.getParentBounds();
    game.scale.refresh();
  };
  let refitTimer = 0;
  const refit = () => {
    fit();
    requestAnimationFrame(fit);
    clearTimeout(refitTimer);
    refitTimer = window.setTimeout(fit, 300);
  };
  addEventListener('resize', refit);
  document.addEventListener('fullscreenchange', refit);
  visualViewport?.addEventListener('resize', refit);
}

void boot();
