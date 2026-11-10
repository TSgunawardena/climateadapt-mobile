export const modes = ['normal', 'low', 'slow', 'error', 'rate', 'malformed', 'timeout'] as const;
export type DemoMode = typeof modes[number];
type ResultBase = {
  status: 'done' | 'needs_review'; label: string; requestId: string;
  alternatives: { label: string; confidence: number }[];
};
export type PhotoBackendKind = 'mock' | 'live_vision';
export type LocationScreening =
  | { status: 'not_requested' | 'unavailable'; message: string }
  | { status: 'ready'; score: number; threshold: number; flagged: boolean; model: string; latitude: number; longitude: number };
export type AnalysisResult = (ResultBase & {
  demo: true; confidence: number;
}) | (ResultBase & {
  demo: false; confidence: null; model: string; summary: string;
  observations: string[]; uncertainties: string[]; nextSteps: string[]; limitations: string[];
  humanReviewRequired: true; locationScreening: LocationScreening;
});
export type AnalysisState =
  | { kind: 'idle' }
  | { kind: 'uploading'; started: number }
  | { kind: 'result'; result: AnalysisResult; elapsedMs: number }
  | { kind: 'failed'; message: string; retryable: boolean };

export function parseResult(value: unknown): AnalysisResult {
  if (!value || typeof value !== 'object') throw Error('The service returned an unreadable result.');
  const v = value as Record<string, unknown>;
  if (v.mode === 'live_vision') return parseLiveResult(v);
  if (v.mode !== 'mock') throw Error('The photo service returned an unknown result type.');
  if (!['done', 'needs_review'].includes(String(v.status)) || typeof v.label !== 'string' || !v.label.trim() ||
      typeof v.confidence !== 'number' || !Number.isFinite(v.confidence) || v.confidence < 0 || v.confidence > 1 ||
      typeof v.requestId !== 'string') throw Error('The service returned an incomplete result.');
  const alternatives = Array.isArray(v.alternatives) ? v.alternatives.filter((a): a is {label:string;confidence:number} =>
    a && typeof a.label === 'string' && typeof a.confidence === 'number' && Number.isFinite(a.confidence) && a.confidence >= 0 && a.confidence <= 1) : [];
  return { status: v.confidence < 0.7 ? 'needs_review' : v.status as AnalysisResult['status'], label: v.label,
    confidence: v.confidence, requestId: v.requestId, alternatives, demo: true };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Incomplete photo context.');
  return value as Record<string, unknown>;
}
function photoText(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || value.length > 1000) throw Error('Incomplete photo description.');
  return value;
}
function photoList(value: unknown): string[] {
  if (!Array.isArray(value) || !value.length || value.length > 12) throw Error('Incomplete photo observations.');
  return value.map(photoText);
}
function finite(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) throw Error('Invalid location measurement.');
  return value;
}
function parseLiveResult(v: Record<string, unknown>): AnalysisResult {
  if (v.contract !== 'vision-v1' || v.model !== 'gemma3:4b' || v.confidence !== null || v.humanReviewRequired !== true ||
      !['done', 'needs_review'].includes(String(v.status))) throw Error('The photo result did not pass its review checks.');
  const l = record(v.locationScreening);
  let locationScreening: LocationScreening;
  if (l.status === 'ready') {
    if (l.model !== 'V3 logistic regression' || typeof l.flagged !== 'boolean') throw Error('Unexpected location model.');
    locationScreening = { status: 'ready', score: finite(l.score, 0, 1), threshold: finite(l.threshold, Number.MIN_VALUE, 1),
      flagged: l.flagged, model: l.model, latitude: finite(l.latitude, -90, 90), longitude: finite(l.longitude, -180, 180) };
  } else if (l.status === 'unavailable' || l.status === 'not_requested') {
    locationScreening = { status: l.status, message: photoText(l.message) };
  } else throw Error('Missing location-screening status.');
  return { status: v.status as AnalysisResult['status'], label: photoText(v.label), requestId: photoText(v.requestId),
    demo: false, confidence: null, model: v.model, summary: photoText(v.summary),
    observations: photoList(v.observations), uncertainties: photoList(v.uncertainties), nextSteps: photoList(v.nextSteps),
    limitations: photoList(v.limitations), humanReviewRequired: true, locationScreening, alternatives: [] };
}
export function parsePhotoHealth(value: unknown): PhotoBackendKind {
  const v = record(value);
  if (v.ok !== true) throw Error('The photo backend is not ready.');
  if (v.mode === 'mock') return 'mock';
  if (v.mode !== 'live_vision' || v.contract !== 'vision-v1' || v.model !== 'gemma3:4b') {
    throw Error('Use Script 55 on port 8080 for photos. Explore uses Script 54 on 8081.');
  }
  if (v.vision_ready !== true) throw Error('The photo service is running, but Gemma vision is unavailable. Check Ollama on the laptop.');
  return 'live_vision';
}

// Cancelling fetch is not enough: ignore responses that arrive from obsolete requests.
export class RequestGate {
  private generation = 0;
  next() { return ++this.generation; }
  accepts(id: number) { return id === this.generation; }
  invalidate() { ++this.generation; }
}

export function validateBaseUrl(input: string): string {
  const u = new URL(input.trim());
  if (!['http:', 'https:'].includes(u.protocol) || u.username || u.password || u.search || u.hash || (u.pathname !== '/' && u.pathname !== '')) {
    throw Error('Enter a base address such as http://192.168.1.20:8080, with no path or password.');
  }
  return u.origin;
}
