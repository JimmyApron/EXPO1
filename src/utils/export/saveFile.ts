import { Platform } from 'react-native';

export const safeFileName = (name: string) => name.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_').replace(/[. ]+$/g, '') || 'final_idea';

export async function saveFile(bytes: Uint8Array, name: string, mimeType: string) {
  const fileName = safeFileName(name);
  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: mimeType }));
    const link = document.createElement('a');
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
    return;
  }
  const { File, Paths } = await import('expo-file-system');
  const { isAvailableAsync, shareAsync } = await import('expo-sharing');
  if (!await isAvailableAsync()) throw new Error('이 기기에서는 파일 공유를 사용할 수 없습니다.');
  const file = new File(Paths.cache, fileName);
  file.create({ overwrite: true });
  try {
    file.write(bytes);
    await shareAsync(file.uri, { mimeType, dialogTitle: fileName });
  } finally {
    if (file.exists) file.delete();
  }
}
