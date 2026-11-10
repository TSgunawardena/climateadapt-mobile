import { fetch } from 'expo/fetch';
import { Platform } from 'react-native';
import {
  parseResult,
  type DemoMode,
  type PhotoBackendKind,
} from './domain';

type PhotoMetadata = {
  location: {
    latitude: number;
    longitude: number;
  } | null;
  notes: string;
  created: string;
};

export async function analyse(
  base: string,
  mode: DemoMode,
  uri: string,
  signal: AbortSignal,
  metadata: PhotoMetadata,
  backend: PhotoBackendKind = 'mock',
) {
  const form = new FormData();

  if (Platform.OS === 'web') {
    const photoResponse = await fetch(uri, { signal });
    const blob = await photoResponse.blob();

    form.append('image', blob, 'observation.jpg');
  } else {
    form.append('image', {
      uri,
      name: 'observation.jpg',
      type: 'image/jpeg',
    } as unknown as Blob);
  }

  if (metadata.location) {
    form.append('location', JSON.stringify(metadata.location));
  }

  if (metadata.notes) {
    form.append('notes', metadata.notes);
  }

  form.append('capturedAt', metadata.created);

  const suffix =
    backend === 'live_vision' || mode === 'normal'
      ? ''
      : `?fail=${encodeURIComponent(mode)}`;

  const url = `${base.replace(/\/+$/, '')}/api/analyse${suffix}`;

  const response =
    Platform.OS === 'web'
      ? await fetch(url, {
          method: 'POST',
          body: form,
          signal,
        })
      : await uploadNative(url, form, signal);

  if (!response.ok) {
    const retryable = [408, 429, 500, 502, 503, 504].includes(
      response.status,
    );

    let detail: unknown;

    try {
      const body = await response.json();
      detail = body?.detail;
    } catch {
      // Some error responses do not contain JSON.
    }

    const message =
      typeof detail === 'string' && detail.length < 1000
        ? detail
        : response.status === 429
          ? 'The service is busy. Please wait a little before trying again.'
          : response.status === 413
            ? 'This image is too large. Choose a smaller photograph.'
            : response.status === 415
              ? 'This image could not be accepted. Choose another photo.'
              : 'The analysis service could not complete the request. Check the connection and try again.';

    throw Object.assign(new Error(message), { retryable });
  }

  let result: ReturnType<typeof parseResult>;

  try {
    result = parseResult(await response.json());
  } catch {
    throw Object.assign(
      new Error(
        'The service returned an unreadable result. Your app is still safe to use.',
      ),
      { retryable: true },
    );
  }

  if (result.demo !== (backend === 'mock')) {
    throw Object.assign(
      new Error('Photo service changed. Reconnect in Setup.'),
      { retryable: true },
    );
  }

  return result;
}

function uploadNative(
  url: string,
  form: FormData,
  signal: AbortSignal,
): Promise<Pick<Response, 'ok' | 'status' | 'json'>> {
  return new Promise((resolve, reject) => {
    const abortError = () =>
      Object.assign(new Error('Upload cancelled.'), {
        name: 'AbortError',
      });

    if (signal.aborted) {
      reject(abortError());
      return;
    }

    const xhr = new XMLHttpRequest();
    const cancel = () => xhr.abort();

    const cleanup = () => {
      signal.removeEventListener('abort', cancel);
    };

    xhr.onload = () => {
      cleanup();

      const text = xhr.responseText;

      console.info('[photo-upload:xhr-v1] HTTP', xhr.status);

      resolve({
        ok: xhr.status >= 200 && xhr.status < 300,
        status: xhr.status,
        json: async () => JSON.parse(text),
      });
    };

    xhr.onerror = () => {
      cleanup();

      reject(
        Object.assign(
          new Error(
            'Photo upload failed. Check the backend connection.',
          ),
          { retryable: true },
        ),
      );
    };

    xhr.ontimeout = () => {
      cleanup();

      reject(
        Object.assign(
          new Error('Photo analysis timed out. Please try again.'),
          { retryable: true },
        ),
      );
    };

    xhr.onabort = () => {
      cleanup();
      reject(abortError());
    };

    try {
      xhr.open('POST', url);
      xhr.timeout = 60000;
      xhr.setRequestHeader('Accept', 'application/json');

      // Let the native uploader set the multipart Content-Type.
      signal.addEventListener('abort', cancel, { once: true });

      if (signal.aborted) {
        cleanup();
        reject(abortError());
        return;
      }

      console.info('[photo-upload:xhr-v1] Sending photo');

      xhr.send(form);
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}