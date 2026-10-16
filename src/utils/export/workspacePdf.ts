import { workspaceDocumentHtml } from '@/lib/workspace-export';
import { saveFile } from './saveFile';
export async function workspacePdf(text: string, title: string) {
  const { printToFileAsync } = await import('expo-print');
  const { File } = await import('expo-file-system');
  const output = await printToFileAsync({ html: workspaceDocumentHtml(text, title) });
  const file = new File(output.uri);
  try { await saveFile(await file.bytes(), `${title}.pdf`, 'application/pdf'); }
  finally { if (file.exists) file.delete(); }
}
