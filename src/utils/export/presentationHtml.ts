import type { PresentationData } from '@/types/presentation';
import { presentationPalette } from '../../lib/presentation-themes.ts';
import { withPresentationViewer } from './presentationViewer.ts';

const escapeHtml = (text: string) => text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);

export function createPresentationHtml(data: PresentationData, { printOnly = false }: { printOnly?: boolean } = {}) {
  const themeId = data.settings?.theme ?? 'minimal-light';
  const theme = presentationPalette[themeId] ?? presentationPalette['minimal-light'];
  const premiumLayout = themeId === 'modern-dark'
    ? `.slide{padding:7% 9% 6% 10%;background:linear-gradient(145deg,#111827 55%,#1f2937)}.slide:before{width:1.3%}.content{max-width:100%;margin:auto 0}.content h1{font-size:clamp(36px,5.6vw,82px);letter-spacing:-.025em;text-wrap:balance;word-break:keep-all;overflow-wrap:anywhere}.content li{font-size:clamp(17px,1.8vw,27px);margin:.45em 0}.slide footer{background:none;border-top:1px solid ${theme.accent};border-radius:0;padding:14px 0}.slide .meta{font-size:clamp(20px,4vw,54px);opacity:.55}`
    : themeId === 'business'
      ? `.slide{padding:6% 7%;background:linear-gradient(90deg,${theme.surface} 0 25%,${theme.background} 25%)}.slide:before{inset:5.5% 7% auto 7%;width:auto;height:4px}.content{max-width:68%;margin:auto 0 auto 23%}.content h1{font-size:clamp(32px,4.4vw,66px);letter-spacing:-.02em;border-bottom:1px solid ${theme.accent};padding-bottom:20px}.content li{margin:.46em 0}.slide .eyebrow{max-width:24ch}.slide footer{margin-left:23%;background:none;border-radius:0;padding:12px 0}.slide .meta{left:7%;right:auto;top:45%;font-size:clamp(26px,4.5vw,64px)}`
      : '';
  const slides = data.slides.map((slide) => `<section class="slide"><div class="meta">${String(slide.slideNumber).padStart(2, '0')} / ${String(data.slides.length).padStart(2, '0')}</div><div class="content"><div class="eyebrow">${escapeHtml(data.presentationTitle)}</div><h1>${escapeHtml(slide.title)}</h1><ul>${slide.bulletPoints.map((point) => `<li>${escapeHtml(point)}</li>`).join('')}</ul></div><footer>${escapeHtml(slide.speakerScript)}</footer></section>`).join('\n');
  const html = `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(data.presentationTitle)}</title><style>
*{box-sizing:border-box}html,body{margin:0;background:#e9edf2;color:${theme.foreground};font-family:system-ui,-apple-system,"Noto Sans KR",sans-serif}.slide{width:min(100vw,160vh);aspect-ratio:16/9;margin:24px auto;padding:6.5% 7%;background:${theme.background};display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden;box-shadow:0 12px 36px #17253d22}.slide:before{content:"";position:absolute;inset:0 auto 0 0;width:1.1%;background:${theme.accent}}.meta,.eyebrow{color:${theme.accent};font-size:clamp(12px,1.3vw,20px);font-weight:700;letter-spacing:.05em}.content{max-width:78%;margin:auto 0}.content h1{font-size:clamp(28px,5vw,72px);line-height:1.16;margin:18px 0 28px}.content ul{padding-left:1.1em;margin:0}.content li{font-size:clamp(16px,2vw,28px);line-height:1.55;margin:.28em 0}.slide footer{font-size:clamp(12px,1.2vw,18px);line-height:1.5;color:${theme.muted};padding:16px 20px;background:${theme.surface};border-radius:12px}.slide .meta{position:absolute;right:7%;top:6.5%}@media(max-width:600px){.slide{width:100vw;margin:8px auto;padding:8%;aspect-ratio:16/10}.content{max-width:100%}.slide footer{padding:8px}}@page{size:13.333in 7.5in;margin:0}@media print{html,body{background:white}.slide{width:13.333in;height:7.5in;aspect-ratio:auto;margin:0;box-shadow:none;break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}}
${premiumLayout}
${printOnly ? 'html,body{background:white}.slide{width:13.333in;height:7.5in;aspect-ratio:auto;margin:0;box-shadow:none;break-after:page;page-break-after:always}.slide:last-child{break-after:auto;page-break-after:auto}' : ''}
</style></head><body>${slides}</body></html>`;
  return printOnly ? html : withPresentationViewer(html, themeId);
}
