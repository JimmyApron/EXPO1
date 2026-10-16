import type { PresentationData } from '@/types/presentation';

const palette = {
  'minimal-light': { background: '#ffffff', foreground: '#171717', accent: '#1e3a8a', muted: '#5f6672', surface: '#f3f5f8' },
  'modern-dark': { background: '#111827', foreground: '#f8fafc', accent: '#60a5fa', muted: '#cbd5e1', surface: '#1f2937' },
  'soft-color': { background: '#fff9ed', foreground: '#302d29', accent: '#c36b54', muted: '#706962', surface: '#f7eadb' },
  business: { background: '#f6f8fb', foreground: '#17253d', accent: '#176b63', muted: '#556477', surface: '#e7edf3' },
} as const;

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function createPresentationHtml(data: PresentationData) {
  const theme = palette[data.settings?.theme ?? 'minimal-light'];
  const slides = data.slides.map((slide) => `<section class="slide"><div class="meta">${String(slide.slideNumber).padStart(2, '0')} / ${String(data.slides.length).padStart(2, '0')}</div><div class="content"><div class="eyebrow">${escapeHtml(data.presentationTitle)}</div><h1>${escapeHtml(slide.title)}</h1><ul>${slide.bulletPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></div><footer>${escapeHtml(slide.speakerScript)}</footer></section>`).join('\n');
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.presentationTitle)}</title><style>
*{box-sizing:border-box}html,body{margin:0;background:#e9edf2;color:${theme.foreground};font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif}.slide{width:min(100vw,160vh);aspect-ratio:16/9;margin:24px auto;padding:6.5% 7%;background:${theme.background};display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;box-shadow:0 12px 36px #17253d22}.slide:before{content:"";position:absolute;inset:0 auto 0 0;width:1.1%;background:${theme.accent}}.meta,.eyebrow{color:${theme.accent};font-size:clamp(12px,1.3vw,20px);font-weight:700;letter-spacing:.05em}.content{max-width:78%;margin:auto 0}.content h1{font-size:clamp(28px,5vw,72px);line-height:1.16;margin:18px 0 28px}.content ul{padding-left:1.1em;margin:0}.content li{font-size:clamp(16px,2vw,28px);line-height:1.55;margin:.28em 0}.slide footer{font-size:clamp(12px,1.2vw,18px);line-height:1.5;color:${theme.muted};padding:16px 20px;background:${theme.surface};border-radius:12px}.slide .meta{position:absolute;right:7%;top:6.5%}@media(max-width:600px){.slide{width:100vw;margin:8px auto;padding:8%;aspect-ratio:16/10}.content{max-width:100%}.slide footer{padding:8px}}@page{size:13.333in 7.5in;margin:0}@media print{html,body{background:white}.slide{width:13.333in;height:7.5in;aspect-ratio:auto;margin:0;box-shadow:none;break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}}
</style></head><body>${slides}</body></html>`;
}
