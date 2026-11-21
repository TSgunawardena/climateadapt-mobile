import { readFile, writeFile } from 'node:fs/promises';
const target = new URL('../package.json', import.meta.url);
const value = JSON.parse(await readFile(target, 'utf8'));
value.scripts ??= {};
const hook = 'node scripts/prepare-device-privacy-models.mjs';
if (value.scripts['eas-build-post-install'] && value.scripts['eas-build-post-install'] !== hook) {
  throw Error('An EAS post-install hook already exists. Keep it and integrate model preparation before building.');
}
value.scripts['eas-build-post-install'] = hook;
value.scripts['privacy:models'] = hook;
value.scripts['privacy:models:check'] = `${hook} --verify-only`;
await writeFile(target, `${JSON.stringify(value, null, 2)}\n`);
console.log('Registered build-time model preparation. No dependency versions or EAS project settings changed.');
