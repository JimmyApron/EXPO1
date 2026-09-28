import PptxGenJS from 'pptxgenjs';
import type { ExportData } from '../../types/export';
import { presentationPages } from './exportFormats.ts';

export async function createPptx(data: ExportData) {
  const pptx = new PptxGenJS();
  pptx.layout = 'LAYOUT_WIDE';
  pptx.title = data.presentation?.presentationTitle || data.projectTitle;
  pptx.author = 'Watt';
  pptx.subject = data.idea.title;
  pptx.theme = { headFontFace: 'Malgun Gothic', bodyFontFace: 'Malgun Gothic' };
  const pages = presentationPages(data);
  pages.forEach((page, index) => {
    const slide = pptx.addSlide();
    slide.background = { color: 'F8FAFC' };
    slide.addText(page.title, { x: 0.6, y: 0.4, w: 12.1, h: 1.1, fontSize: 28, bold: true, color: '1D4ED8', fit: 'shrink', margin: 0 });
    slide.addText(page.content, { x: 0.7, y: 1.8, w: 11.9, h: 4.7, fontSize: 22, color: '172033', valign: 'top', fit: 'shrink', margin: 0 });
    slide.addText(`${data.projectTitle} · ${index + 1} / ${pages.length}`, { x: 0.7, y: 7, w: 11.9, h: 0.25, fontSize: 10, color: '667085', margin: 0 });
    if (page.notes) slide.addNotes(page.notes);
  });
  const output = await pptx.write({ outputType: 'uint8array', compression: true });
  if (!(output instanceof Uint8Array)) throw new Error('발표 파일을 생성하지 못했습니다.');
  return output;
}
