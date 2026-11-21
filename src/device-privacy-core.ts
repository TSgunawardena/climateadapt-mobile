// The adapter has no transport dependency. Missing native code cannot trigger an upload.
export interface DevicePrivacyModule {
  detect(uri: string): Promise<unknown>;
  apply(uri: string, source: string, regionsJson: string, reviewed: boolean): Promise<unknown>;
}
export function createDevicePrivacy(resolve: () => DevicePrivacyModule | null) {
  function ready(signal: AbortSignal) {
    if (signal.aborted) throw Error('Privacy check cancelled.');
    const native = resolve();
    if (!native) throw Error('On-device privacy needs the new Android build. Expo Go and the previous APK cannot run it. No photo was uploaded.');
    return native;
  }
  function current(signal: AbortSignal, value: unknown) {
    if (signal.aborted) throw Error('Privacy check cancelled.');
    return value;
  }
  return {
    async detect(uri: string, signal: AbortSignal) {
      return current(signal, await ready(signal).detect(uri));
    },
    async apply(uri: string, source: string, regions: unknown[], signal: AbortSignal) {
      return current(signal, await ready(signal).apply(uri, source, JSON.stringify(regions), true));
    },
  };
}
