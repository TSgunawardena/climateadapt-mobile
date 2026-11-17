import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import { validateBaseUrl } from './domain';
import { parseMaskedPhoto, parsePrivacyScan, type MaskRegion, type MaskedPhoto } from './privacy';

async function encodedPhoto(uri: string, signal: AbortSignal) {
  if (signal.aborted) throw Error('Privacy check cancelled.');
  if (Platform.OS !== 'web') return FS.readAsStringAsync(uri, { encoding: FS.EncodingType.Base64 });
  const blob = await (await fetch(uri, { signal })).blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error('The photo could not be read.'));
    reader.onload = () => resolve(String(reader.result).split(',')[1]);
    reader.readAsDataURL(blob);
  });
}
async function request(base: string, route: string, uri: string, signal: AbortSignal, extra = {}) {
  const image_base64 = await encodedPhoto(uri, signal);
  if (image_base64.length > 6990508) throw Error('This photo is too large for privacy checking.');
  const response = await fetch(`${validateBaseUrl(base)}${route}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image_base64, ...extra }), signal,
  });
  let value: unknown;
  try { value = await response.json(); } catch { throw Error('The privacy service returned an unreadable response.'); }
  if (!response.ok) {
    const detail = (value as { detail?: unknown })?.detail;
    throw Error(typeof detail === 'string' && detail.length < 500 ? detail : 'Privacy checking failed. Check Script 56 and its address in Settings.');
  }
  return value;
}
export async function detectPrivacy(base: string, uri: string, signal: AbortSignal) {
  return parsePrivacyScan(await request(base, '/api/privacy/detect', uri, signal));
}
export async function applyPrivacy(base: string, uri: string, source: string, regions: MaskRegion[], signal: AbortSignal,
  expected: { width: number; height: number }): Promise<MaskedPhoto> {
  const result = parseMaskedPhoto(await request(base, '/api/privacy/apply', uri, signal, {
    source_sha256: source, regions, reviewed: true,
  }));
  if (result.width !== expected.width || result.height !== expected.height || result.maskCount !== regions.length) {
    throw Error('The masked image does not match the reviewed photo. Check privacy again.');
  }
  if (signal.aborted) throw Error('Privacy check cancelled.');
  if (Platform.OS === 'web') {
    const bytes = Uint8Array.from(atob(result.base64), v => v.charCodeAt(0));
    return { uri: URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' })), width: result.width,
      height: result.height, bytes: result.bytes, maskCount: result.maskCount };
  }
  if (!FS.cacheDirectory) throw Error('Temporary photo storage is unavailable.');
  const folder = `${FS.cacheDirectory}climateadapt/`;
  await FS.makeDirectoryAsync(folder, { intermediates: true });
  const target = `${folder}masked-${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
  try {
    await FS.writeAsStringAsync(target, result.base64, { encoding: FS.EncodingType.Base64 });
    const info = await FS.getInfoAsync(target);
    if (signal.aborted || !info.exists || info.size !== result.bytes) throw Error('The masked photo could not be saved.');
    return { uri: target, width: result.width, height: result.height, bytes: result.bytes, maskCount: result.maskCount };
  } catch (error) {
    await FS.deleteAsync(target, { idempotent: true }).catch(() => {});
    throw error;
  }
}
