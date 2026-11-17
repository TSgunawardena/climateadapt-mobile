import test from 'node:test';
import assert from 'node:assert/strict';
import { canAnalysePhoto, drawnRegion, parsePrivacyScan, parseMaskedPhoto, parseRegions } from '../src/privacy.ts';
import { createEvaluation } from '../src/evaluation.ts';

test('analysis requires a reviewed replacement and a closed editor', () => {
  for (const photo of [null, {}, { privacy: 'unchecked' }]) assert.equal(canAnalysePhoto(photo), false);
  assert.equal(canAnalysePhoto({ privacy: 'reviewed' }, true), false);
  assert.equal(canAnalysePhoto({ privacy: 'reviewed' }), true);
});
test('privacy instrumentation records stages without region or image data', () => {
  const log = createEvaluation(() => 0);
  log.start('P03', true); log.startTask('T1');
  for (const name of ['privacy_requested', 'privacy_review_opened', 'privacy_applied']) {
    log.log(name);
    log.log(name, 'face at 10,20');
  }
  const csv = log.csv();
  assert.match(csv, /privacy_applied/);
  assert.doesNotMatch(csv, /face|10,20/);
  log.finish('independent'); log.end();
});
test('privacy detections require source binding, review and bounded rectangles', () => {
  const scan = { contract: 'privacy-v1', review_required: true, source_sha256: 'a'.repeat(64),
    width: 100, height: 60, regions: [{ x: .1, y: .2, width: .3, height: .4, kind: 'face' }] };
  assert.equal(parsePrivacyScan(scan).regions[0].kind, 'face');
  for (const patch of [{ review_required: false }, { source_sha256: 'photo.jpg' }, { contract: 'vision-v1' },
    { regions: [{ x: NaN, y: 0, width: 1, height: 1, kind: 'plate' }] },
    { regions: [{ x: .9, y: 0, width: .3, height: 1, kind: 'manual' }] }]) {
    assert.throws(() => parsePrivacyScan({ ...scan, ...patch }));
  }
});
test('drawing in either direction and at boundaries produces valid covers', () => {
  for (const [start, end] of [[{ x: .8, y: .7 }, { x: .1, y: .2 }], [{ x: 1, y: 1 }, { x: 1, y: 1 }],
    [{ x: -.1, y: .1 }, { x: 1.2, y: .9 }]]) {
    assert.equal(parseRegions([drawnRegion(start, end)]).length, 1);
  }
});
test('a masked reply cannot substitute a URI, wrong format or incomplete image', () => {
  const reply = { contract: 'privacy-v1', mime_type: 'image/jpeg', image_base64: '/9j/2Q==', bytes: 4,
    width: 10, height: 10, mask_count: 1, sha256: 'b'.repeat(64) };
  assert.equal(parseMaskedPhoto(reply).maskCount, 1);
  for (const patch of [{ image_base64: 'http://example/image.jpg' }, { bytes: 100 },
    { image_base64: 'AAAAAA==' }, { mask_count: -1 }, { mime_type: 'image/png' }]) {
    assert.throws(() => parseMaskedPhoto({ ...reply, ...patch }));
  }
});
