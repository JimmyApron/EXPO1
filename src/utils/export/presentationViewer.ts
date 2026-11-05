const viewerCss = `
.deck-header,.deck-controls{display:none}
.presentation-mode{overflow:hidden}
.presentation-mode .deck{height:100dvh;display:flex;align-items:center;justify-content:center;padding:calc(var(--header-height,56px) + 8px) 8px calc(var(--controls-height,64px) + 8px)}
.presentation-mode .deck-viewport{position:relative;flex:none}
.presentation-mode .slide-stage{width:1280px;height:720px;position:absolute;left:0;top:0;transform:scale(var(--deck-scale,1));transform-origin:top left}
.presentation-mode .slide-stage .slide{display:none;width:1280px;height:720px;aspect-ratio:auto;margin:0}
.presentation-mode .slide-stage .slide.is-active{display:flex}
.presentation-mode .meta,.presentation-mode .eyebrow{font-size:18px}
.presentation-mode .content h1{font-size:64px}
.presentation-mode .content li{font-size:26px;line-height:1.45}
.presentation-mode .slide footer{font-size:16px}
.presentation-mode .slide .meta{font-size:42px}
.presentation-mode.theme-modern-dark .content h1{font-size:72px}
.presentation-mode.theme-business .content h1{font-size:60px}
.presentation-mode .deck-header{position:fixed;z-index:1;top:0;left:0;right:0;display:flex;align-items:center;gap:12px;min-height:56px;padding:max(8px,env(safe-area-inset-top)) 12px 8px;background:#172033;color:white;font:14px system-ui,-apple-system,"Noto Sans KR",sans-serif}
.presentation-mode .deck-controls{position:fixed;bottom:0;left:0;right:0;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;padding:8px 12px max(8px,env(safe-area-inset-bottom));background:#172033;color:white;font:14px system-ui,-apple-system,"Noto Sans KR",sans-serif}
.deck-header button,.deck-controls button{min-height:40px;padding:6px 12px;border:1px solid #74839c;border-radius:8px;background:#27354c;color:white;font:inherit;cursor:pointer}
.deck-controls button:disabled{opacity:.4;cursor:default}
.deck-header button:focus-visible,.deck-controls button:focus-visible{outline:2px solid #8bc1ff;outline-offset:2px}
.deck-controls button[hidden]{display:none}
.deck-exit-note{font-size:12px;line-height:1.3}
.deck-count{min-width:48px;text-align:center;font-variant-numeric:tabular-nums}
@media print{
html,body,.presentation-mode{background:white;overflow:visible!important;print-color-adjust:exact;-webkit-print-color-adjust:exact}
.presentation-mode .deck{display:block;height:auto;padding:0}
.presentation-mode .deck-viewport{width:auto!important;height:auto!important}
.presentation-mode .slide-stage{position:static;width:auto;height:auto;transform:none!important}
.slide,.presentation-mode .slide-stage .slide{display:flex!important;position:relative;width:13.333in;height:7.5in;aspect-ratio:auto;margin:0;box-shadow:none;break-after:page;page-break-after:always}
.slide:last-child,.presentation-mode .slide-stage .slide:last-child{break-after:auto;page-break-after:auto}
.meta,.eyebrow{font-size:18px}.content h1{font-size:64px}.content li{font-size:26px;line-height:1.45}.slide footer{font-size:16px}.slide .meta{font-size:42px}
.theme-modern-dark .content h1{font-size:72px}.theme-business .content h1{font-size:60px}
.deck-header,.deck-controls,.presentation-mode .deck-header,.presentation-mode .deck-controls{display:none!important}
}`;

const viewerHeader = `<header class="deck-header"><button type="button" id="deck-back" aria-label="발표 화면에서 돌아가기">← 돌아가기</button><span class="deck-exit-note" id="deck-exit-note" role="status"></span></header>`;
const viewerControls = `<nav class="deck-controls" aria-label="슬라이드 탐색"><button type="button" id="deck-prev" aria-label="이전 슬라이드">이전</button><span class="deck-count" id="deck-count" aria-live="polite"></span><button type="button" id="deck-next" aria-label="다음 슬라이드">다음</button><button type="button" id="deck-fullscreen">전체 화면</button><button type="button" id="deck-print">PDF 저장</button></nav>`;

const viewerScript = `<script>
(() => {
  if (window.self !== window.top) return;
  const slides = [...document.querySelectorAll('.slide-stage .slide')];
  if (!slides.length) return;
  const viewport = document.querySelector('.deck-viewport');
  const header = document.querySelector('.deck-header');
  const controls = document.querySelector('.deck-controls');
  const prev = document.getElementById('deck-prev');
  const next = document.getElementById('deck-next');
  const count = document.getElementById('deck-count');
  const fullscreen = document.getElementById('deck-fullscreen');
  let index = 0;
  const show = (newIndex) => {
    index = Math.max(0, Math.min(newIndex, slides.length - 1));
    slides.forEach((slide, i) => slide.classList.toggle('is-active', i === index));
    count.textContent = (index + 1) + ' / ' + slides.length;
    prev.disabled = index === 0;
    next.disabled = index === slides.length - 1;
  };
  const fit = () => {
    const headerHeight = header.getBoundingClientRect().height;
    const controlsHeight = controls.getBoundingClientRect().height;
    const width = window.visualViewport?.width ?? window.innerWidth;
    const height = window.visualViewport?.height ?? window.innerHeight;
    const scale = Math.max(0.05, Math.min((width - 16) / 1280, (height - headerHeight - controlsHeight - 16) / 720, 1));
    viewport.style.width = (1280 * scale) + 'px';
    viewport.style.height = (720 * scale) + 'px';
    document.body.style.setProperty('--header-height', headerHeight + 'px');
    document.body.style.setProperty('--controls-height', controlsHeight + 'px');
    document.documentElement.style.setProperty('--deck-scale', String(scale));
  };
  document.body.classList.add('presentation-mode');
  show(0);
  if (!document.documentElement.requestFullscreen) fullscreen.hidden = true;
  fit();
  prev.addEventListener('click', () => show(index - 1));
  next.addEventListener('click', () => show(index + 1));
  document.getElementById('deck-back').addEventListener('click', () => {
    if (window.opener && !window.opener.closed) {
      window.opener.focus();
      window.close();
      return;
    }
    if (window.history.length > 1) {
      window.history.back();
      return;
    }
    window.close();
    document.getElementById('deck-exit-note').textContent = '브라우저 탭을 닫아 이전 화면으로 돌아가세요.';
  });
  document.getElementById('deck-print').addEventListener('click', () => window.print());
  fullscreen.addEventListener('click', async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch { /* Fullscreen may be unavailable on mobile browsers. */ }
  });
  document.addEventListener('fullscreenchange', () => { fullscreen.textContent = document.fullscreenElement ? '전체 화면 닫기' : '전체 화면'; fit(); });
  document.addEventListener('keydown', (event) => { if (event.key === 'ArrowRight') show(index + 1); if (event.key === 'ArrowLeft') show(index - 1); });
  window.addEventListener('resize', fit);
  window.visualViewport?.addEventListener('resize', fit);
  let touchX = null;
  viewport.addEventListener('touchstart', (event) => { touchX = event.changedTouches[0].screenX; }, { passive: true });
  viewport.addEventListener('touchend', (event) => { if (touchX === null) return; const distance = event.changedTouches[0].screenX - touchX; if (Math.abs(distance) > 40) show(index + (distance < 0 ? 1 : -1)); touchX = null; }, { passive: true });
})();
</script>`;

export function withPresentationViewer(html: string, themeId: string) {
  const safeThemeId = themeId.replace(/[^a-z0-9-]/gi, '');
  return html
    .replace('</style>', `${viewerCss}</style>`)
    .replace('<body>', `<body class="theme-${safeThemeId}">${viewerHeader}<main class="deck"><div class="deck-viewport"><div class="slide-stage">`)
    .replace('</body>', `</div></div></main>${viewerControls}${viewerScript}</body>`);
}
