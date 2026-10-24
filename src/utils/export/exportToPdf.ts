import type { ExportData } from '../../types/export';
import { reportHtml, type PdfDocumentKind } from './exportFormats';
import { safeFileName } from './saveFile';
import { sharePrintedPdf } from './sharePrintedPdf';

export async function exportToPdf(data: ExportData, kind: PdfDocumentKind) {
  const { printToFileAsync } = await import('expo-print');
  const result = await printToFileAsync({ html: reportHtml(data, kind), width: 595, height: 842, base64: true });
  const suffix = kind === 'business-plan' ? 'business_plan' : 'final_report';
  await sharePrintedPdf(result.base64, `${safeFileName(data.projectTitle).slice(0, 80)}_${suffix}.pdf`);
}
