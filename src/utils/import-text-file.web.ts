export async function importTextFile(): Promise<{ name: string; content: string } | null> {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input'); input.type = 'file'; input.accept = '.txt,text/plain';
    input.oncancel = () => resolve(null);
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) { resolve(null); return; }
      if (file.size > 2_000_000) { reject(new Error('2MB 이하의 TXT 파일을 선택해 주세요.')); return; }
      try { resolve({ name: file.name, content: await file.text() }); } catch { reject(new Error('파일을 읽지 못했습니다. UTF-8 TXT 파일을 확인해 주세요.')); }
    };
    input.click();
  });
}
