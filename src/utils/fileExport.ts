import { Alert, Clipboard, Platform } from 'react-native';

export const copyToClipboard = async (text: string) => {
  try {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
    } else {
      await Clipboard.setString(text);
    }

    Alert.alert('복사 완료', '클립보드에 복사되었습니다.');
  } catch (error) {
    console.error('복사 실패:', error);
    Alert.alert('복사 실패', '클립보드 복사에 실패했습니다.');
  }
};

export const downloadAsFile = (content: string, fileName: string) => {
  if (Platform.OS === 'web') {
    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain;charset=utf-8' });

    element.href = URL.createObjectURL(file);
    element.download = fileName;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    return;
  }

  Alert.alert('다운로드 지원', '이 환경에서는 파일 다운로드를 직접 지원하지 않습니다.');
};
