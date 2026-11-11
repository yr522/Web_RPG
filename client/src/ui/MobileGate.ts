// 모바일 접속 조건: 가로 화면 + 전체화면.
// 세로면 "가로로 돌려줘" (CSS #rotate), 가로인데 전체화면이 아니면 "전체화면으로 해줘" + 버튼.
// 전체화면을 지원하지 않는 브라우저(아이폰 사파리 등)와 홈 화면 앱으로 연 경우는 전체화면 안내를 띄우지 않는다.

export function setupMobileGate(isTouch: boolean) {
  const gate = document.getElementById('fsgate');
  const btn = document.getElementById('fsbtn');
  if (!gate || !btn || !isTouch) return;
  const standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (standalone || !document.fullscreenEnabled || !document.documentElement.requestFullscreen) return;

  const refresh = () => gate.classList.toggle('on', !document.fullscreenElement);
  btn.addEventListener('click', async () => {
    try {
      await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
      // 지원하는 기기(안드로이드 크롬 등)는 가로로 고정
      await (screen.orientation as ScreenOrientation & { lock?: (o: string) => Promise<void> }).lock?.('landscape').catch(() => {});
    } catch { /* 거절되면 안내가 그대로 남음 */ }
    refresh();
  });
  document.addEventListener('fullscreenchange', refresh);
  refresh();
}
