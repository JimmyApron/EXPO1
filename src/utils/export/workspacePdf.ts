import { workspaceDocumentHtml } from '@/lib/workspace-export';
import { sharePrintedPdf } from './sharePrintedPdf';
export async function workspacePdf(text: string, title: string) {
  const { printToFileAsync } = await import('expo-print');
  const output = await printToFileAsync({ html: workspaceDocumentHtml(text, title), base64: true });
  await sharePrintedPdf(output.base64, `${title}.pdf`);
}
