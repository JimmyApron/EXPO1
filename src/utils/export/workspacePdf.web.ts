import { workspaceDocumentHtml } from '@/lib/workspace-export';
export async function workspacePdf(text: string, title: string) {
  const preview = window.open('', '_blank');
  if (!preview) throw new Error('팝업을 허용하고 다시 시도해 주세요.');
  preview.opener = null; preview.document.open(); preview.document.write(workspaceDocumentHtml(text, title)); preview.document.close();
  await preview.document.fonts.ready; preview.focus(); preview.print();
}
