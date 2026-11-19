// 로딩 화면: 캐릭터를 골라 들어간 뒤 그림·소리 등을 다 불러올 때까지 (특히 모바일은 대기 시간이 김)
export interface Loading {
  /** 0 ~ 1 */
  set(p: number): void;
  /** 화면을 서서히 지우고 없앰 */
  done(): void;
}

export function showLoading(): Loading {
  const root = document.createElement('div');
  root.id = 'loading';
  root.innerHTML = '<div class="ld-text">로딩 중<span class="ld-dots"></span></div><div class="ld-bar"><i></i></div><div class="ld-pct">0%</div>';
  document.body.appendChild(root);
  const bar = root.querySelector('.ld-bar i') as HTMLElement, pct = root.querySelector('.ld-pct') as HTMLElement;
  let shown = 0, target = 0, closed = false;
  // 막대가 뒤로 가거나 튀지 않게 부드럽게 따라감
  const tick = () => {
    shown += (target - shown) * 0.2;
    if (target - shown < 0.002) shown = target;
    bar.style.width = `${shown * 100}%`;
    pct.textContent = `${Math.round(shown * 100)}%`;
    if (!closed) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return {
    set(p) { target = Math.max(target, Math.min(1, p)); },
    done() {
      if (closed) return;
      closed = true;
      root.classList.add('out');
      setTimeout(() => root.remove(), 400);
    },
  };
}
