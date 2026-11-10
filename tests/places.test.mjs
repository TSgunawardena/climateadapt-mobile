import test from 'node:test';
import assert from 'node:assert/strict';
import { manualPlace, parseArea, parseCatalogue, parseHealth, parsePoint, parseResolved } from '../src/places.ts';

const point = () => ({ mode: 'live_places', point: {
  prediction: { susceptibility_score: 0.012, operational_threshold: 0.004, susceptible: true,
    risk_band: 'elevated_susceptibility_score', score_is_calibrated_probability: false },
  coverage: { valid_model_coverage: true }, provenance: { model: 'V3 logistic regression' },
  human_review: { required: true, reasons: ['Human review required'] },
  terrain_context: { elevation_metres: 2, slope_degrees: 1, distance_to_coast_metres: 20 },
  limitations: ['Not a calibrated flood probability.'],
} });
const area = () => ({ mode: 'live_places', map_url: '/api/places/maps/abc123', area: {
  status: 'analysis_ready', model: 'V3 logistic regression', score_is_calibrated_probability: false,
  place: { display_name: 'Tāhunanui' }, radius_metres: 500, evaluated_land_area_square_kilometres: 0.7,
  susceptible_area_square_kilometres: 0.07, susceptible_percentage_of_evaluated_land: 10,
  evaluated_land_coverage_percentage: 95, mean_susceptibility_score: 0.02, operational_threshold: 0.004,
  plain_language_summary: '10% of evaluated land flagged.', interpretation_warning: 'Screening only.',
} });
test('place responses and manual coordinates reject blanks, nonfinite and out-of-range values', () => {
  assert.equal(manualPlace('Nelson', '-41.27', '173.28').latitude, -41.27);
  for (const pair of [['', '173'], ['-91', '173'], ['-41', '181'], ['NaN', '173']]) assert.throws(() => manualPlace('X', ...pair));
  assert.equal(parseResolved({ place: { display_name: 'Nelson', latitude: -41, longitude: 173, source: 'catalogue' } }).source, 'catalogue');
  assert.throws(() => parseCatalogue({ places: [{ display_name: 'Incomplete' }] }));
});
test('photo mock health cannot be accepted as a location backend', () => {
  assert.throws(() => parseHealth({ ok: true, mode: 'mock' }));
  assert.equal(parseHealth({ ok: true, mode: 'live_places', contract: 'places-v1', area_ready: false, online_search: false, missing_runtime_files: 2 }).areaReady, false);
});
test('point scores require actual V3 identity, coverage, uncalibrated semantics and review', () => {
  assert.equal(parsePoint(point()).score, 0.012);
  for (const mutate of [
    v => v.point.prediction.susceptibility_score = NaN,
    v => v.point.prediction.operational_threshold = 0,
    v => v.point.prediction.score_is_calibrated_probability = true,
    v => v.point.coverage.valid_model_coverage = false,
    v => v.point.human_review.required = false,
    v => v.point.provenance.model = 'V2 U-Net',
  ]) { const v = point(); mutate(v); assert.throws(() => parsePoint(v)); }
});
test('area results reject invalid percentages, unavailable coverage and external map URLs', () => {
  assert.equal(parseArea(area()).flaggedKm2, 0.07);
  for (const mutate of [
    v => v.area.susceptible_percentage_of_evaluated_land = 101,
    v => v.area.susceptible_area_square_kilometres = 1,
    v => v.area.status = 'data_unavailable',
    v => v.area.radius_metres = 3000,
    v => v.map_url = 'https://elsewhere.example/map',
    v => v.map_url = '/api/places/maps/../../private',
  ]) { const v = area(); mutate(v); assert.throws(() => parseArea(v)); }
});
