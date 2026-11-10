// Strict adapter for the mobile BFF, not a guess at the web dashboard's UI.
export type Place = { display_name: string; latitude: number; longitude: number; source: string };
export type PointResult = {
  score: number; threshold: number; flagged: boolean; band: string;
  elevation: number | null; slope: number | null; coastDistance: number | null;
  model: string; reasons: string[]; limitations: string[];
};
export type AreaResult = {
  name: string; radius: number; evaluatedKm2: number; flaggedKm2: number;
  flaggedPercent: number; coveragePercent: number; meanScore: number;
  threshold: number; summary: string; warning: string; mapPath: string | null;
};
type ObjectValue = Record<string, unknown>;
function object(v: unknown): ObjectValue {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw Error('The service returned an unreadable result.');
  return v as ObjectValue;
}
function text(v: unknown): string {
  if (typeof v !== 'string' || !v.trim()) throw Error('The service returned an incomplete result.');
  return v;
}
function number(v: unknown, min = -Infinity, max = Infinity): number {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max) throw Error('The service returned an invalid measurement.');
  return v;
}
function optionalNumber(v: unknown): number | null { return v == null ? null : number(v); }
function strings(v: unknown): string[] {
  if (!Array.isArray(v) || !v.every(x => typeof x === 'string')) throw Error('The service returned incomplete context.');
  return v;
}
export function parsePlace(value: unknown): Place {
  const v = object(value);
  return { display_name: text(v.display_name), latitude: number(v.latitude, -90, 90),
    longitude: number(v.longitude, -180, 180), source: text(v.source) };
}
export function parsePoint(value: unknown): PointResult {
  const envelope = object(value);
  if (envelope.mode !== 'live_places') throw Error('Expected a live location response.');
  const v = object(envelope.point), p = object(v.prediction), coverage = object(v.coverage);
  const provenance = object(v.provenance), review = object(v.human_review), terrain = object(v.terrain_context);
  if (p.score_is_calibrated_probability !== false || coverage.valid_model_coverage !== true ||
      provenance.model !== 'V3 logistic regression' || review.required !== true || typeof p.susceptible !== 'boolean') {
    throw Error('The result did not pass the V3 coverage and review checks.');
  }
  return { score: number(p.susceptibility_score, 0, 1), threshold: number(p.operational_threshold, Number.MIN_VALUE, 1),
    flagged: p.susceptible, band: text(p.risk_band), model: text(provenance.model),
    elevation: optionalNumber(terrain.elevation_metres), slope: optionalNumber(terrain.slope_degrees),
    coastDistance: optionalNumber(terrain.distance_to_coast_metres), reasons: strings(review.reasons), limitations: strings(v.limitations) };
}
export function parseArea(value: unknown): AreaResult {
  const envelope = object(value), a = object(envelope.area), place = object(a.place);
  if (envelope.mode !== 'live_places' || a.status !== 'analysis_ready' || a.score_is_calibrated_probability !== false ||
      a.model !== 'V3 logistic regression' || ![500, 1000, 2000].includes(Number(a.radius_metres))) {
    throw Error('The result did not pass the V3 area checks.');
  }
  const map = envelope.map_url;
  if (map != null && (typeof map !== 'string' || !/^\/api\/places\/maps\/[a-zA-Z0-9_-]+$/.test(map))) {
    throw Error('The service returned an invalid evidence map.');
  }
  const evaluatedKm2 = number(a.evaluated_land_area_square_kilometres, Number.MIN_VALUE);
  return { name: text(place.display_name), radius: number(a.radius_metres), evaluatedKm2,
    flaggedKm2: number(a.susceptible_area_square_kilometres, 0, evaluatedKm2),
    flaggedPercent: number(a.susceptible_percentage_of_evaluated_land, 0, 100),
    coveragePercent: number(a.evaluated_land_coverage_percentage, 0, 100),
    meanScore: number(a.mean_susceptibility_score, 0, 1), threshold: number(a.operational_threshold, Number.MIN_VALUE, 1),
    summary: text(a.plain_language_summary), warning: text(a.interpretation_warning), mapPath: map as string | null ?? null };
}
export function manualPlace(name: string, latitude: string, longitude: string): Place {
  if (!latitude.trim() || !longitude.trim()) throw Error('Enter both latitude and longitude.');
  return parsePlace({ display_name: name.trim() || 'Selected coordinate', latitude: Number(latitude),
    longitude: Number(longitude), source: 'manual_coordinate' });
}

export async function placeRequest(base: string, path: string, signal: AbortSignal, body?: unknown): Promise<unknown> {
  const res = await fetch(`${base}${path}`, { signal, ...(body === undefined ? {} : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  }) });
  let value: unknown;
  try { value = await res.json(); } catch { throw Error('The location service returned an unreadable response.'); }
  if (!res.ok) {
    const detail = object(value).detail;
    throw Error(typeof detail === 'string' ? detail : 'The location request could not be completed. Check the inputs and try again.');
  }
  return value;
}
export function parseHealth(value: unknown): { areaReady: boolean; online: boolean; missing: number } {
  const v = object(value);
  if (v.ok !== true || v.mode !== 'live_places' || v.contract !== 'places-v1' || typeof v.area_ready !== 'boolean' || typeof v.online_search !== 'boolean') {
    throw Error('Use the mobile places API on port 8081. The photo demo runs separately on 8080.');
  }
  return { areaReady: v.area_ready, online: v.online_search, missing: number(v.missing_runtime_files, 0) };
}
export function parseCatalogue(value: unknown): Place[] {
  const v = object(value);
  if (!Array.isArray(v.places)) throw Error('The places list could not be read.');
  return v.places.map(parsePlace);
}
export function parseResolved(value: unknown): Place { return parsePlace(object(value).place); }
