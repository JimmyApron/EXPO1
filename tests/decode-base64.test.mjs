import assert from 'node:assert/strict';
import test from 'node:test';
import { decodeBase64 } from '../src/utils/export/decodeBase64.ts';

test('decodes printed PDF bytes, including binary values and padding', () => {
  for (const bytes of [
    Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x00, 0xff]),
    Uint8Array.from([0x00]),
    Uint8Array.from([0x00, 0xff]),
  ]) {
    assert.deepEqual(decodeBase64(Buffer.from(bytes).toString('base64')), bytes);
  }
  assert.throws(() => decodeBase64('invalid'), /PDF 데이터를 읽을 수 없습니다/);
});
