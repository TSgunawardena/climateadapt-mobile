import test from 'node:test';
import assert from 'node:assert/strict';
import { parseResult, parsePhotoHealth } from '../src/domain.ts';

const live = () => ({ status: 'done', label: 'Possible standing water', requestId: 'photo-1',
  mode: 'live_vision', contract: 'vision-v1', model: 'gemma3:4b', confidence: null,
  humanReviewRequired: true, summary: 'Possible standing water was identified.',
  observations: ['A road appears visible.'], uncertainties: ['Cause cannot be established.'],
  nextSteps: ['Review the photo.'], limitations: ['Not a flood probability.'],
  locationScreening: { status: 'not_requested', message: 'No GPS attached.' } });
test('live photo replies accept no numeric confidence and require model/review/context', () => {
  const result = parseResult(live());
  assert.equal(result.demo, false);
  assert.equal(result.confidence, null);
  for (const mutate of [v => v.confidence = .95, v => v.humanReviewRequired = false,
    v => v.contract = 'unknown', v => v.model = 'qwen3:4b', v => v.observations = [],
    v => v.locationScreening = null]) {
    const v = live(); mutate(v); assert.throws(() => parseResult(v));
  }
});
test('photo health distinguishes mock, places, unavailable model and live vision', () => {
  assert.equal(parsePhotoHealth({ ok: true, mode: 'mock' }), 'mock');
  const value = { ok: true, mode: 'live_vision', contract: 'vision-v1', model: 'gemma3:4b', vision_ready: true };
  assert.equal(parsePhotoHealth(value), 'live_vision');
  assert.throws(() => parsePhotoHealth({ ...value, vision_ready: false }));
  assert.throws(() => parsePhotoHealth({ ok: true, mode: 'live_places' }));
});
test('attached location scores stay separate and invalid measurements are rejected', () => {
  const v = live();
  v.locationScreening = { status: 'ready', score: .012, threshold: .004, flagged: true,
    model: 'V3 logistic regression', latitude: -41.28, longitude: 173.24 };
  assert.equal(parseResult(v).locationScreening.score, .012);
  v.locationScreening.score = NaN;
  assert.throws(() => parseResult(v));
});
