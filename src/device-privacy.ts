import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { parseMaskedPhoto, parsePrivacyScan, parseRegions, type MaskRegion } from './privacy';
import { createDevicePrivacy, type DevicePrivacyModule } from './device-privacy-core';

function module(): DevicePrivacyModule | null {
  if (Platform.OS !== 'android') return null;
  return requireOptionalNativeModule<DevicePrivacyModule>('ClimateAdaptPrivacy');
}
// Native availability is checked only when needed, so Expo Go can still open the UI.
const device = createDevicePrivacy(module);
export async function detectOnDevice(uri: string, signal: AbortSignal) {
  return parsePrivacyScan(await device.detect(uri, signal));
}
export async function applyOnDevice(uri: string, source: string, regions: MaskRegion[], signal: AbortSignal) {
  const validated = parseRegions(regions);
  return parseMaskedPhoto(await device.apply(uri, source, validated, signal));
}
