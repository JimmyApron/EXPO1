import * as Clipboard from 'expo-clipboard';
import type { ExportData } from '../../types/export';
import { formatForNotion } from './exportFormats';

export async function copyForNotion(data: ExportData) {
  if (!await Clipboard.setStringAsync(formatForNotion(data))) throw new Error('클립보드에 접근할 수 없습니다.');
}
