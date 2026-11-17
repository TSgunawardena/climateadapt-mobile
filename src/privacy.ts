export type MaskKind = 'face' | 'plate' | 'manual';
export type MaskRegion = { x: number; y: number; width: number; height: number; kind: MaskKind };
export type PrivacyScan = { source_sha256: string; width: number; height: number; regions: MaskRegion[] };
export type MaskedPhoto = { uri: string; width: number; height: number; bytes: number; maskCount: number };

const digest = /^[a-f0-9]{64}$/;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Unreadable privacy response.');
  return value as Record<string, unknown>;
}
export function parseRegions(value: unknown): MaskRegion[] {
  if (!Array.isArray(value) || value.length > 100) throw Error('Invalid privacy covers.');
  return value.map(item => {
    const region = object(item);
    const { x, y, width, height, kind } = region;
    if (![x, y, width, height].every(v => typeof v === 'number' && Number.isFinite(v)) ||
        typeof x !== 'number' || typeof y !== 'number' || typeof width !== 'number' || typeof height !== 'number' ||
        x < 0 || y < 0 || width <= 0 || height <= 0 || x + width > 1.000001 || y + height > 1.000001 ||
        (kind !== 'face' && kind !== 'plate' && kind !== 'manual')) throw Error('Invalid privacy covers.');
    return { x, y, width, height, kind };
  });
}
function dimensions(value: Record<string, unknown>) {
  const { width, height } = value;
  if (typeof width !== 'number' || typeof height !== 'number' || !Number.isInteger(width) ||
      !Number.isInteger(height) || width < 1 || height < 1 || width * height > 2560000) throw Error('Invalid privacy image dimensions.');
  return { width, height };
}
export function parsePrivacyScan(value: unknown): PrivacyScan {
  const data = object(value);
  if (data.contract !== 'privacy-v1' || data.review_required !== true ||
      typeof data.source_sha256 !== 'string' || !digest.test(data.source_sha256)) throw Error('Unreadable privacy detection response.');
  return { ...dimensions(data), source_sha256: data.source_sha256, regions: parseRegions(data.regions) };
}
export function parseMaskedPhoto(value: unknown) {
  const data = object(value);
  if (data.contract !== 'privacy-v1' || data.mime_type !== 'image/jpeg' ||
      typeof data.image_base64 !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(data.image_base64) ||
      typeof data.bytes !== 'number' || !Number.isInteger(data.bytes) || data.bytes < 4 || data.bytes > 5 * 1024 * 1024 ||
      data.image_base64.length !== 4 * Math.ceil(data.bytes / 3) || !data.image_base64.startsWith('/9j/') ||
      data.image_base64.length * 3 / 4 - (data.image_base64.endsWith('==') ? 2 : data.image_base64.endsWith('=') ? 1 : 0) !== data.bytes ||
      typeof data.mask_count !== 'number' || !Number.isInteger(data.mask_count) || data.mask_count < 0 || data.mask_count > 100 ||
      typeof data.sha256 !== 'string' || !digest.test(data.sha256)) throw Error('Unreadable masked photo. The original will not be submitted.');
  return { ...dimensions(data), base64: data.image_base64, bytes: data.bytes, maskCount: data.mask_count };
}
export function canAnalysePhoto(photo: { privacy?: string } | null, editorOpen = false) {
  return photo?.privacy === 'reviewed' && !editorOpen;
}
export function drawnRegion(start: { x: number; y: number }, end: { x: number; y: number }): MaskRegion {
  const clamp = (n: number) => Math.max(0, Math.min(1, n));
  const left = Math.min(.998, clamp(start.x), clamp(end.x)), top = Math.min(.998, clamp(start.y), clamp(end.y));
  return { x: left, y: top, width: Math.max(.002, Math.abs(clamp(end.x) - clamp(start.x))),
    height: Math.max(.002, Math.abs(clamp(end.y) - clamp(start.y))), kind: 'manual' };
}
