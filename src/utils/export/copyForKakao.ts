import * as Clipboard from 'expo-clipboard';
import type { ExportData } from '../../types/export';
import { formatForKakao } from './exportFormats';

export async function copyForKakao(data: ExportData) {
  if (!await Clipboard.setStringAsync(formatForKakao(data))) throw new Error('클립보드에 접근할 수 없습니다.');
}
