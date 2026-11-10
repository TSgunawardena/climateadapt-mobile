# ClimateAdapt Mobile

Outdoor photo observations and location screening in one mobile app.

ClimateAdapt Mobile is an Android prototype built with React Native and Expo. Users can take or select an outdoor photo, review preliminary observations from a local vision model, and explore geographic screening results for supported locations in Nelson, New Zealand.

The app brings these two workflows together while keeping their results separate. A photograph describes visible conditions. A location score describes susceptibility represented by the geographic model.

<img src="assets/design/coast.jpg" alt="Coastal illustration used in the ClimateAdapt interface" width="880" />

*Interface illustration. This is not a field photograph or a prediction map.*

## What you can do

- **Analyse an outdoor photo** using the camera or gallery, with optional notes and GPS coordinates.
- **Review before sending** and see a photo-based scanning animation while the request is pending.
- **Explore a location** and request point or wider-area screening within the prepared data coverage.
- **Inspect the evidence** behind a result, including model observations, limitations and geographic context.
- **Recover from failures** with cancellation, timeout handling and retry actions.
- **Keep session summaries** in app memory without creating a permanent photo archive.

The main navigation has three tabs — Home, Explore and Capture. Connection settings and session summaries are available through Settings.

## How it works

The mobile app communicates with Python backend services running on a laptop. Photo analysis uses Gemma through Ollama. Geographic screening uses the separate ClimateAdapt prediction service.

| Component | Responsibility | Default port |
| --- | --- | --- |
| Expo development server | Loads the app in Expo Go | `8082` |
| Photo backend | Validates photos, calls the vision model and returns observations | `8080` |
| Places backend | Provides place selection and geographic screening requests | `8081` |
| Prediction API | Serves geographic model results | `8000` |
| Ollama | Runs `gemma3:4b` locally | `11434` |

Inference runs on the laptop rather than on the phone. The scanning animation is a waiting indicator and does not measure model progress.

The geographic backend is maintained in [ClimateAdapt-AI](https://github.com/TSgunawardena/ClimateAdapt-AI). This mobile repository includes integration scripts in `backend-addon` and connection guides in `docs`.

## Run the mobile app

### Requirements

- Node.js compatible with the `engines` field in `package.json`
- npm
- An Android phone with a compatible Expo Go version
- Phone and laptop connected to the same reachable local network
- The backend services below for live results

From the mobile project folder, install dependencies and start Expo.

```powershell
npm ci
npx expo start --go --lan --port 8082
```

Scan the terminal QR code with Expo Go.

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

### Connect your phone

Find your laptop’s Wi-Fi IPv4 address with `ipconfig`. Set the photo service address in Settings and the places service address in Explore’s connection settings.

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

The photo service should report `vision_ready` as `true`. A successful health check confirms service readiness but does not guarantee that every analysis will complete successfully.

## Try the workflow

1. Open Capture and take or select an outdoor photo.
2. Review the photo and optionally attach notes or location.
3. Tap Analyse and wait for the result.
4. Compare the observations with the original image and read the uncertainty.
5. Open Explore to select a supported location and request geographic screening.

Optional GPS is used for separate geographic screening. A photo result should not be treated as confirmation of the geographic model.

## Privacy and current limits

The photo backend processes uploads without creating a permanent image archive. Images still travel from the phone to the configured laptop and are processed there. The app keeps a temporary working preview, and session summaries remain in memory until the app restarts.

**Automatic face and number-plate masking is planned and is not implemented in this version.** The animated blur on the waiting screen is only a visual effect. It does not redact the uploaded image.

Photo observations may be incomplete or incorrect. They do not establish water depth, the cause of water or a calibrated flood probability. Geographic screening is limited to the prepared Nelson dataset and requires human interpretation.

This is an academic prototype for preliminary screening and review. It is not an emergency-warning service or a substitute for a site assessment. Model response times depend on hardware, image content and available resources. The first request may take longer while the model loads.

Android is the current testing target. iOS and a complete installable PWA have not been verified.

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

## Next steps

- Automatic face and number-plate detection with a redacted preview
- Simpler Capture, Explore and results screens
- Broader testing of image suitability, accessibility and request recovery
- A repeatable standalone Android build

## Author

Tharusha Gunawardena

Developed as part of the Master of Information Technology programme at NMIT.

## Licence

See [LICENSE](LICENSE). Third-party models, libraries and datasets remain subject to their own terms.
