import type { ExportData } from '../../types/export';
import { reportHtml, type PdfDocumentKind } from './exportFormats';
import { safeFileName, saveFile } from './saveFile';

export async function exportToPdf(data: ExportData, kind: PdfDocumentKind) {
  const { printToFileAsync } = await import('expo-print');
  const { File } = await import('expo-file-system');
  const result = await printToFileAsync({ html: reportHtml(data, kind), width: 595, height: 842 });
  const source = new File(result.uri);
  try {
    const suffix = kind === 'business-plan' ? 'business_plan' : 'final_report';
    await saveFile(await source.bytes(), `${safeFileName(data.projectTitle).slice(0, 80)}_${suffix}.pdf`, 'application/pdf');
  } finally {
    if (source.exists) source.delete();
  }
}
