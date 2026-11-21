import * as FS from 'expo-file-system/legacy';
import { detectOnDevice, applyOnDevice } from './device-privacy';
import { type MaskRegion, type MaskedPhoto } from './privacy';

export async function detectPrivacy(uri: string, signal: AbortSignal) {
  return detectOnDevice(uri, signal);
}
export async function applyPrivacy(uri: string, source: string, regions: MaskRegion[], signal: AbortSignal,
  expected: { width: number; height: number }): Promise<MaskedPhoto> {
  const result = await applyOnDevice(uri, source, regions, signal);
  if (result.width !== expected.width || result.height !== expected.height || result.maskCount !== regions.length) {
    throw Error('The masked image does not match the reviewed photo. Check privacy again.');
  }
  if (signal.aborted) throw Error('Privacy check cancelled.');
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
