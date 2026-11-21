import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile, rename, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
const directory = new URL('../modules/climateadapt-privacy/android/src/main/assets/privacy/', import.meta.url);
const models = [
  ['face_detection_yunet_2023mar.onnx', 'https://huggingface.co/opencv/opencv_zoo/resolve/d4938dfc9d4ec5d098bfa33e98b3f3345a236586/models/face_detection_yunet/face_detection_yunet_2023mar.onnx', '8f2383e4dd3cfbb4553ea8718107fc0423210dc964f9f4280604804ed2552fa4'],
  ['plate_yolox_tiny_640.onnx', 'https://huggingface.co/faisalthaheem/open-lpr-models/resolve/aed0df35ec2891c5a90437041ebeadb592cc516b/onnx/plate_yolox_tiny_640.onnx', 'e5350bb2152eb44fa129b2438d1e39bbbf3c27accfe51cd893ce6e17d028d0b9'],
];
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
await mkdir(directory, { recursive: true });
for (const [name, url, expected] of models) {
  const target = new URL(name, directory);
  const existing = await readFile(target).catch(() => null);
  if (existing && hash(existing) === expected) { console.log(`${name} verified`); continue; }
  if (process.argv.includes('--verify-only')) throw Error(`Missing or invalid ${name}. Run node scripts/prepare-device-privacy-models.mjs before building.`);
  const response = await fetch(url, { signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw Error(`Model download failed with HTTP ${response.status}.`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > 30 * 1024 * 1024 || hash(bytes) !== expected) throw Error(`Checksum mismatch for ${name}.`);
  const temporary = new URL(`${name}.part`, directory);
  try { await writeFile(temporary, bytes); await rename(temporary, target); }
  finally { await unlink(temporary).catch(() => {}); }
  console.log(`${name} downloaded and verified`);
}
console.log(`Verified bundled models in ${fileURLToPath(directory)}`);
