import test from 'node:test';
import assert from 'node:assert/strict';
import { createDevicePrivacy } from '../src/device-privacy-core.ts';

test('missing phone module fails without trying a backend', async () => {
  const privacy = createDevicePrivacy(() => null);
  await assert.rejects(privacy.detect('file:///cache/photo.jpg', new AbortController().signal), /new Android build/);
  await assert.rejects(privacy.apply('file:///cache/photo.jpg', 'digest', [], new AbortController().signal), /No photo was uploaded/);
});
test('aborted operations cannot invoke or accept native results', async () => {
  let calls = 0, finish;
  const controller = new AbortController();
  const privacy = createDevicePrivacy(() => ({
    detect: async () => { calls++; return new Promise(resolve => { finish = resolve; }); },
    apply: async () => { calls++; return {}; },
  }));
  const pending = privacy.detect('file:///cache/photo.jpg', controller.signal);
  controller.abort(); finish({ regions: [] });
  await assert.rejects(pending, /cancelled/);
  await assert.rejects(privacy.apply('file:///cache/photo.jpg', 'digest', [], controller.signal), /cancelled/);
  assert.equal(calls, 1);
});
test('only the reviewed region data reaches local export', async () => {
  let argumentsSeen;
  const privacy = createDevicePrivacy(() => ({ detect: async () => ({}), apply: async (...args) => { argumentsSeen = args; return { native: true }; } }));
  const region = { x: .1, y: .2, width: .2, height: .2, kind: 'face' };
  assert.deepEqual(await privacy.apply('file:///cache/photo.jpg', 'source', [region], new AbortController().signal), { native: true });
  assert.deepEqual(argumentsSeen, ['file:///cache/photo.jpg', 'source', JSON.stringify([region]), true]);
});
