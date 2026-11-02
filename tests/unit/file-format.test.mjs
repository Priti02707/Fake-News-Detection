import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileSignatureMatches } from '../../frontend/file-format.ts';

test('audio MIME types require the matching container signature', async () => {
  for (const [type, signature] of [
    ['audio/wav', 'RIFF0000WAVE'], ['audio/x-wav', 'RIFF0000WAVE'],
    ['audio/mpeg', 'ID3'], ['audio/mp3', new Uint8Array([255, 251, 144, 0])],
    ['audio/mp4', '0000ftypM4A '], ['audio/x-m4a', '0000ftypM4A '],
    ['audio/ogg', 'OggS'], ['audio/flac', 'fLaC'],
    ['audio/webm', new Uint8Array([26, 69, 223, 163])],
  ]) {
    assert.equal(await fileSignatureMatches(new File([signature], 'sample', { type })), true, type);
    assert.equal(await fileSignatureMatches(new File(['unrelated contents'], 'sample', { type })), false, type);
    assert.equal(await fileSignatureMatches(new File([], 'sample', { type })), false, type);
  }
  assert.equal(await fileSignatureMatches(new File(['RIFF0000WEBP'], 'image.wav', { type: 'audio/wav' })), false);
});
