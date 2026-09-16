import type { ExportData } from '../../types/export';
import { reportHtml, type PdfDocumentKind } from './exportFormats';

export async function exportToPdf(data: ExportData, kind: PdfDocumentKind) {
  // Keep this synchronous until window.open to preserve the user's click activation.
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('팝업을 허용한 뒤 다시 시도해 주세요.');
  preview.opener = null;
  preview.document.open();
  preview.document.write(reportHtml(data, kind));
  preview.document.close();
  await preview.document.fonts.ready;
  preview.focus();
  preview.print();
}
