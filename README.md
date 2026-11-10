# ClimateAdapt mobile prototype

React Native + Expo + TypeScript, with your existing V3 location backend and a new local Gemma photo endpoint.

**New photo setup:** [Connect local photo analysis](docs/CONNECT-LOCAL-PHOTO-ANALYSIS.md). Your model is already installed; this guide connects the phone's Capture workflow to it.

**Existing place setup:** [Connect your web backend](docs/CONNECT-YOUR-WEB-BACKEND.md).

## What works

- Modern Home, camera/gallery selection, image preparation and a real photo preview.
- Optional notes and GPS, shared only after the user chooses them and submits.
- Local photo upload to Script 55 → Ollama `gemma3:4b` → validated visual categories → readable observations, uncertainty, follow-up and limitations.
- Real photo results have no fabricated confidence percentage. The original photo stays visible for human comparison.
- Optional GPS screening is shown separately. Missing/out-of-coverage GPS does not invalidate an accepted photo response.
- Explore reuses your actual V3 point/radius screening and the existing service's evidence map when its local runtime is installed.
- Waiting, cancellation, a 60-second client limit, stale-response rejection and failure recovery.
- Reports retain chosen text summaries for the session only. No database or persistent photo archive.
- The original mock photo BFF and failure demonstrations remain available as a separate mode.
- Planning remains a future-service screen; this update does not call the planning LLM.

## Keep the two projects separate

`ClimateAdapt-AI` is your existing Python web/backend project. `climateadapt-prototype` is this Expo mobile project.

Copy `backend-addon/55_run_photo_bff.py` and `backend-addon/requirements-photo.txt` into the web project's `scripts` folder. Install the requirements in the web project's existing venv, then start Script 55 there. See the photo setup guide for exact Windows commands.

Keep Scripts 30/54 running for location results. Stop the old Node mock server on 8080 before starting Script 55 on that port.

| Service | Port |
| --- | ---: |
| Existing V3 Script 30 | 8000 |
| Photo Script 55, or optional original mock | 8080 |
| Places Script 54 | 8081 |
| Expo Metro / QR code | 8082 |
| Local Ollama | 11434 |

## Open the updated mobile app

This source uses Expo SDK 58, React Native 0.88.1 and React 19.3.0. Use Node 24 LTS (24.3+) or supported Node 22.13+, and an Expo Go version compatible with this SDK.

Back up your working mobile source before copying over personal edits. In the updated mobile project:

```powershell
npm ci
npx expo start --go --lan --port 8082 --clear
```

Scan that terminal's new QR code. Phone and laptop must be on the same trusted Wi-Fi.

In the app's top **Setup**, connect the photo address `http://YOUR-LAPTOP-IP:8080`. It checks whether the endpoint is a live model or a mock and labels results accordingly. In **Explore**, use its separate connection settings for `http://YOUR-LAPTOP-IP:8081`.

`localhost` on a phone points to the phone. The API's 8080/8081 addresses belong inside the app, not in Expo Go's app-loading field. A Metro tunnel does not automatically tunnel these separate APIs.

## Optional original photo demonstration

For fixed results and course failure demonstrations instead of Gemma, stop Script 55 and run this in the mobile project:

```powershell
npm run backend
```

Reconnect the photo service through Setup. It reports `mode: mock`; the response-mode controls then appear. Normal/low/slow/error/rate/malformed/timeout modes are unchanged. Mock values are not evidence that the photograph contains water.

The real photo contract is `vision-v1`, implemented in `src/domain.ts` and `backend-addon/55_run_photo_bff.py`. The existing mock route/field/failure patterns follow the course approach, but the exact lecturer-supplied Moodle BFF schema has not been supplied here. Compare it before substituting that BFF. Keep all privileged credentials on the server.

## Checks and evidence

```powershell
npm test
npm run typecheck
npm run lint
npm run export:web
npm run export:android
```

For Python checks use the environment with the addon requirements installed:

```powershell
python -m unittest discover -s .\backend-addon -v
```

See [photo verification](docs/PHOTO-VERIFICATION.md) and [place verification](docs/PLACES-VERIFICATION.md). Exports validate assets/JavaScript, not an APK installation. This workspace tested model transport with fixture replies. Real structured Gemma output, performance and native phone operation require testing on your laptop/phone.

The user has separately shown a working phone location result/map and a direct Gemma CLI photo reply of approximately five seconds. Neither proves the new full photo round trip or broad model accuracy. Record actual errors and timings in coursework evidence.

## Privacy and limitations

Photos are re-encoded in the app; Script 55 decodes and re-encodes again without forwarding EXIF to Ollama. The server uses temporary processing only and closes multipart spool files after processing. Abrupt OS/process failure and secure erasure are outside that guarantee. Client copies live in app cache until discard/replacement/normal cleanup or next launch; an OS kill can leave temporary files until restart. The user's original gallery photo is never deleted.

Notes are not instructions to the vision model. Optional GPS is used for a separate V3 request. Reports store chosen text in JS memory and disappear on restart. Explore's original web service still writes area maps/JSON to its existing output directory; these are location-analysis artifacts, not a photo archive.

The API constrains allowed model claims using a fixed code vocabulary and templates. That does not establish visual correctness. Every result needs human review. A V3 susceptibility score is uncalibrated and is not a flood probability; a photograph cannot establish water cause/depth or coastal flooding.

The APIs use local HTTP, permissive CORS and no authentication for a trusted-LAN prototype. Authenticated HTTPS and a reviewed data-retention model are needed before external deployment.

## Design and remaining work

Figma: https://www.figma.com/design/CB6ftilWBAyxpKZdphGtaL?node-id=12-74

The original icons and AI coastline artwork remain from the project design. Manrope is bundled via its package. The app uses the system camera/gallery and has no artificial boot delay.

Remaining work includes native end-to-end photo verification, TalkBack/large text/landscape, classmates' feedback, upload/metadata benchmarks, model-quality evaluation and later saved reports/planning. Web export is a development surface, not an offline/installable PWA.

The ZIP excludes dependencies, build outputs, local Git metadata, runtime rasters/models and user test photographs. No changes were pushed to GitHub. Disclose AI assistance according to your course requirements.
