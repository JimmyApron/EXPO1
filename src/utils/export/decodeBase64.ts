const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64(value: string): Uint8Array {
  if (!value || value.length % 4 !== 0) throw new Error('PDF 데이터를 읽을 수 없습니다.');
  const padding = value.endsWith('==') ? 2 : value.endsWith('=') ? 1 : 0;
  const bytes = new Uint8Array(value.length / 4 * 3 - padding);
  let offset = 0;
  for (let index = 0; index < value.length; index += 4) {
    const first = alphabet.indexOf(value[index]);
    const second = alphabet.indexOf(value[index + 1]);
    const third = value[index + 2] === '=' ? 0 : alphabet.indexOf(value[index + 2]);
    const fourth = value[index + 3] === '=' ? 0 : alphabet.indexOf(value[index + 3]);
    if (first < 0 || second < 0 || third < 0 || fourth < 0) throw new Error('PDF 데이터를 읽을 수 없습니다.');
    const chunk = (first << 18) | (second << 12) | (third << 6) | fourth;
    bytes[offset++] = chunk >> 16;
    if (offset < bytes.length) bytes[offset++] = chunk >> 8;
    if (offset < bytes.length) bytes[offset++] = chunk;
  }
  return bytes;
}
