# ClimateAdapt Mobile

Outdoor photo observations and location screening in one mobile app.

ClimateAdapt Mobile is an Android prototype built with React Native and Expo. Users can take or select an outdoor photo, review preliminary observations from a local vision model, and explore geographic screening results for supported locations in Nelson, New Zealand.

The app brings these two workflows together while keeping their results separate. A photograph describes visible conditions. A location score describes susceptibility represented by the geographic model.

<img src="assets/design/coast.jpg" alt="Coastal illustration used in the ClimateAdapt interface" width="880" />

*Interface illustration. This is not a field photograph or a prediction map.*

## What you can do

- **Analyse an outdoor photo** using the camera or gallery, with optional notes and GPS coordinates.
- **Check private details on the phone** using bundled face and number-plate detectors, then review and adjust the covers before analysis. Detection and applying covers work offline.
- **Review before analysis** and see a photo-based scanning animation while the request is pending.
- **Enlarge geographic evidence** to inspect the screening map more closely.
- **Explore a location** and request point or wider-area screening within the prepared data coverage.
- **Inspect the evidence** behind a result, including model observations, limitations and geographic context.
- **Recover from failures** with cancellation, timeout handling and retry actions.
- **Keep session summaries** in app memory without creating a permanent photo archive.

The main navigation has three tabs — Home, Explore and Capture. Connection settings and session summaries are available through Settings.

## How it works

The mobile app communicates with Python backend services running on a laptop. Photo analysis uses Gemma through Ollama. Geographic screening uses the separate ClimateAdapt prediction service.

| Component | Responsibility | Default port |
| --- | --- | --- |
| Android privacy module | Detects faces and plates and exports reviewed covers on the phone | No network service |
| Expo development server | Loads JavaScript during development with a compatible native development build | `8082` |
| Photo backend | Validates photos, calls the vision model and returns observations | `8080` |
| Places backend | Provides place selection and geographic screening requests | `8081` |
| Prediction API | Serves geographic model results | `8000` |
| Ollama | Runs `gemma3:4b` locally | `11434` |

Privacy detection and applying covers run on Android using a local Expo module with ONNX Runtime, YuNet for faces and an open-lpr YOLOX-tiny model for number plates. Gemma photo interpretation and geographic screening still run on the laptop. Covers are solid black areas, not the decorative blur used by the waiting animation. The scanning animation is a waiting indicator and does not measure model progress.

The geographic backend is maintained in [ClimateAdapt-AI](https://github.com/TSgunawardena/ClimateAdapt-AI). This mobile repository includes integration scripts in `backend-addon` and connection guides in `docs`.

## Run the mobile app

### Use an installed APK

Install the current Android preview APK and open it directly. Metro and Expo Go are not needed. Face and number-plate detection and applying covers work without Wi-Fi or GPS. Live photo analysis and location screening require the laptop services and a reachable network connection.

Older APKs built before on-device masking still use the laptop privacy helper. Install a current build before testing the new workflow.

### Prepare or build from source

Requirements

- Node.js compatible with the `engines` field in `package.json` and npm
- An Expo account for cloud builds
- An Android phone for device testing
- The backend services below for live results

From the mobile project folder

```powershell
npm ci
npm run privacy:models
npm run privacy:models:check
npm run typecheck
npm test
npx eas-cli@latest build --platform android --profile preview
```

The preview profile in `eas.json` produces an installable APK. Model preparation downloads pinned weights and verifies their SHA-256 hashes. Keep downloaded models out of Git. The EAS post-install hook prepares them for cloud builds.

Expo Go cannot execute the custom native privacy module. For JavaScript development, use a compatible native development build with the module included. Rebuild the native app after native-module or launcher-icon changes.

### Start the live services

In your configured **ClimateAdapt AI backend project**, activate its Python environment and run each service in a separate terminal.

```powershell
python .\scripts\30_run_prediction_api.py
```

```powershell
python .\scripts\54_run_mobile_bff.py
```

```powershell
python .\scripts\55_run_photo_bff.py
```

Ollama must also be running with `gemma3:4b` installed.

```powershell
ollama pull gemma3:4b
```

The Python commands above run from the backend project, not the mobile project. For initial configuration and the scripts supplied with this repository, see [photo analysis setup](docs/CONNECT-LOCAL-PHOTO-ANALYSIS.md) and [geographic backend setup](docs/CONNECT-YOUR-WEB-BACKEND.md).

### On-device privacy

The current Android app does not need Script 56, a privacy-service address or a separate Python privacy environment. Those backend files can remain for older clients.

See [on-device privacy](docs/ON-DEVICE-PRIVACY.md) for the native module, model sources, release-build keep rules and remaining validation work. The earlier [laptop privacy guide](docs/PRIVACY-MASKING.md) describes the previous architecture.

### Connect your phone

Find your laptop’s Wi-Fi IPv4 address with `ipconfig`. Set the photo-service address in Settings and the places-service address in Explore’s connection settings.

| Connection | Example address |
| --- | --- |
| Photo analysis | `http://192.168.1.20:8080` |
| Places and screening | `http://192.168.1.20:8081` |

Replace the example IP with your laptop’s current address. `localhost` and `127.0.0.1` on the phone refer to the phone itself.

These addresses are for local development. The prototype is not configured as an authenticated public service.

### Check service health

Open these addresses on the laptop.

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8081/api/health
http://127.0.0.1:8080/api/health
```

The photo service should report `vision_ready` as `true`. There is no HTTP health endpoint for the on-device privacy module. A successful health check confirms service readiness but does not guarantee that every analysis will complete successfully.

## Try the workflow

1. Open Capture and take or select an outdoor photo. Privacy checking starts automatically on the phone.
2. Review the detected covers. Use **Adjust covers** if private details were missed or an incorrect area was covered.
3. Confirm that you checked the whole photo and tap **Use this photo**. This exports a fresh JPEG with permanent covers.
4. Add optional notes or location, then tap **Analyse observation**.
5. Compare the observations with the reviewed image and read the uncertainty.
6. Open Explore to select a supported location and request geographic screening. Tap its evidence map to enlarge it.

Optional GPS is used for separate geographic screening. A photo result should not be treated as confirmation of the geographic model.

## Privacy and current limits

The photo backend processes uploads without creating a permanent image archive. After privacy review, the covered replacement image travels from the phone to the configured laptop for analysis. The app keeps a temporary working preview, and session summaries remain in memory until the app restarts.

**Automatic face and number-plate detection runs on the phone, with human review before analysis.** Detection and applying covers do not upload the original to the laptop. Applying covers exports a fresh JPEG with the covered pixels replaced and without copying source EXIF metadata. When Analyse is tapped, the app sends that reviewed replacement to the photo backend. Explicitly attached GPS and notes remain separate metadata.

Detection can miss faces or plates and can cover the wrong detail. Users must check the complete image, including other identifying details that these detectors do not target. Zero detections do not guarantee that an image contains no private information. Analysis remains blocked for unchecked photos and while the privacy editor is open. A failed check does not silently send the unchecked original.

The phone keeps temporary working files rather than creating a photo archive. The animated blur on the analysis waiting screen remains a visual effect and does not perform privacy masking. These local development services are not authenticated public endpoints; the review gate is enforced by the app, not a security guarantee against callers sending requests directly to the photo API.

Photo observations may be incomplete or incorrect. They do not establish water depth, the cause of water or a calibrated flood probability. Geographic screening is limited to the prepared Nelson dataset and requires human interpretation.

This is an academic prototype for preliminary screening and review. It is not an emergency-warning service or a substitute for a site assessment. Model response times depend on hardware, image content and available resources. The first request may take longer while the model loads.

Android is the current testing target. The custom on-device privacy module does not support iOS or web. A web export is not a complete working equivalent of the Android workflow.

## Development

```powershell
npm run typecheck
npm run lint
npm test
```

Optional exports are available through `npm run export:android` and `npm run export:web`. A web export alone does not establish offline PWA support.

The original mock backend is available for development and failure demonstrations.

```powershell
npm run backend
```

Mock responses are demonstrations rather than model findings. Use either the live photo backend or the mock backend on the photo-service port, not both at once.

## Evaluation support

Settings includes facilitator-only Evaluation controls. Obtain voluntary consent, enter a participant code and start a session before recording tasks. The event log stays in memory and must be exported before the app closes or restarts. It excludes photos, GPS coordinates, observation notes and model response text.

See [pilot protocol](docs/HCI-PILOT.md) and [pilot notes](docs/HCI-PILOT-NOTES.md). Developer rehearsals and participant sessions should be reported separately. Device accessibility checks do not establish full accessibility conformance.

## Device checks

Developer testing on a Pixel 9 Pro running Android 17 confirmed that the release APK could detect private details and apply covers with Wi-Fi and GPS disabled. Photo analysis was also reported working after connecting to the laptop. These checks are functional observations, not a detector accuracy benchmark, comprehensive security audit or proof of full accessibility conformance.

An initial release-build crash in ONNX Runtime was resolved in device testing after adding the required JNI keep rule through the module's `consumer-rules.pro`. Keep that rule wired through `consumerProguardFiles` when rebuilding.

The laptop model can take longer on its first image request. If analysis times out, inspect Script 55 and Ollama logs. A working health endpoint does not guarantee that inference completes before the configured backend and mobile time limits.

## Next steps

- Broader testing of privacy detection and manual correction
- Refine the interface using participant feedback
- Broader testing of image suitability, accessibility and request recovery
- Measure APK size, inference speed and memory use across Android devices

## Author

Tharusha Gunawardena

Developed as part of the Master of Information Technology programme at NMIT.

## Licence

See [LICENSE](LICENSE). Third-party models, libraries and datasets remain subject to their own terms.

