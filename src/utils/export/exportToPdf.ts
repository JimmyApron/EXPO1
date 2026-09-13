import type { ExportData } from '../../types/export';
import { reportHtml } from './exportFormats';
import { safeFileName, saveFile } from './saveFile';

export async function exportToPdf(data: ExportData) {
  const { printToFileAsync } = await import('expo-print');
  const { File } = await import('expo-file-system');
  const result = await printToFileAsync({ html: reportHtml(data), width: 595, height: 842 });
  const source = new File(result.uri);
  try {
    await saveFile(await source.bytes(), `${safeFileName(data.projectTitle).slice(0, 80)}_final_report.pdf`, 'application/pdf');
  } finally {
    if (source.exists) source.delete();
  }
}
