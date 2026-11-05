import { decodeBase64 } from './decodeBase64';
import { saveFile } from './saveFile';

export async function sharePrintedPdf(base64: string | undefined, name: string) {
  if (!base64) throw new Error('PDF 데이터를 받지 못했습니다.');
  await saveFile(decodeBase64(base64), name, 'application/pdf');
}
