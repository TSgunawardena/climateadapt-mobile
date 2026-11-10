# Connect Capture to your local Gemma vision model

This update replaces the fixed photo demo when you connect to the new **Script 55**. Your existing place workflow remains on Script 54. No database or image archive is added.

Your direct CLI test confirmed that `gemma3:4b` accepted one photograph and replied in approximately five seconds. That is a user-reported single trial, not a guaranteed app response time or an accuracy benchmark. The original model reply also inferred rain despite being told not to: that is an observed instruction-following failure. This integration therefore does not display arbitrary model prose.

## 1. Update the mobile project

Extract the updated ZIP separately first. Back up your currently working mobile folder, especially any personal edits. Use the updated `climateadapt-prototype` source for this version. Do not copy the entire mobile folder into the Python web project.

The update changes `App.tsx`, `src/domain.ts`, `src/api.ts`, adds `src/PhotoFindings.tsx`, and updates package scripts/documentation/tests. The existing place UI and Script 54 remain available. There are no new native Expo dependencies. If you copy the complete updated folder, run `npm ci` there before starting Expo.

## 2. Add Script 55 to the existing Python web project

From the mobile project's `backend-addon` folder, copy these **two files** into your existing web project's `scripts` folder:

- `55_run_photo_bff.py`
- `requirements-photo.txt`

You should now have Scripts 30, 54 and 55 in that folder. Keep Script 54 as it is. The web dashboard gets no photo upload UI.

## 3. Install the photo endpoint's Python dependencies

Open a new VS Code terminal in your **existing web project**, activate the same environment you used for Scripts 30 and 54, and run:

```powershell
.\.venv\Scripts\Activate.ps1
python -m pip install -r .\scripts\requirements-photo.txt
```

The list contains FastAPI/Uvicorn, HTTPX, Python multipart support and Pillow. Existing versions that satisfy its requirements are reused. Your Ollama models remain in their current location; do not copy the 3.4 GB model into either source project.

## 4. Start the real photo endpoint on port 8080

If the terminal running `npm run backend` (the original **Node mock photo server**) is still open, stop that server with Ctrl+C. Both it and Script 55 use port 8080; run one at a time.

Keep Ollama running in the background. You can type `/bye` to leave an interactive `ollama run` chat without uninstalling or removing the model. Keep Scripts 30 and 54 running for optional GPS screening.

In the new Python terminal:

```powershell
python .\scripts\55_run_photo_bff.py
```

On the laptop open:

```text
http://127.0.0.1:8080/api/health
```

Expected fields:

```json
{
  "ok": true,
  "mode": "live_vision",
  "contract": "vision-v1",
  "model": "gemma3:4b",
  "vision_ready": true
}
```

Other fields may also be present. `vision_ready` checks the local Ollama `/api/show` capabilities; it does not run a photograph or validate model accuracy. If false, confirm Ollama is running, the model is installed, and your Ollama version exposes the model's vision capability. An older version may need updating. Do not silently substitute a text-only model.

Script 54's older health field `photo_analysis: not_connected` describes **that service**, which has no photo route. The real photo service has its own health endpoint on port 8080; Script 54 does not need changing.

## 5. Restart Expo on port 8082 and scan its new QR code

In the updated mobile project:

```powershell
npx expo start --go --lan --port 8082 --clear
```

The new `npm start` script also selects 8082. This avoids the earlier clash with Script 54 on 8081. Scan the Expo terminal's QR code in Expo Go. Never enter the Python API address as the app-loading address in Expo Go.

## 6. Connect inside the app

Once the home screen opens, tap the top **Setup** button. Enter your laptop's current Wi-Fi IPv4 address with port 8080. For the last address you reported, that is:

```text
http://10.28.2.59:8080
```

Use your current address if `ipconfig` shows it changed. Tap **Check connection and apply**. The message should say **Connected to local Gemma photo analysis. Settings applied.** The demo-mode radio buttons disappear for the real endpoint.

Keep your phone and laptop on the same trusted Wi-Fi. You can test `http://YOUR-LAPTOP-IP:8080/api/health` in the phone's browser before applying it in the app. Do not disable your firewall or publicly expose these development services.

Open **Capture**, take/select a photo, optionally attach GPS, and press **Analyse observation**. The result includes the actual photo for comparison, visible-feature observations, uncertainty, follow-up and limitations. Use **Keep summary for this session** only if you want its text in Reports until the app restarts; it does not permanently save a photograph or report.

## Service map

| Service | Port | Purpose |
| --- | ---: | --- |
| Existing Script 30 | 8000 | V3 raster point prediction |
| Script 55 | 8080 | Photo upload → local Ollama vision → guarded photo result |
| Existing Script 54 | 8081 | Places and area analysis; also optional GPS point lookup for Script 55 |
| Expo Metro | 8082 | QR code / loading the mobile app |
| Ollama | 11434, laptop localhost | Runs `gemma3:4b` |

Ollama stays on localhost. The phone sends its selected image to Script 55, which calls Ollama locally. If GPS is explicitly attached, Script 55 requests a point screen through Script 54. Missing GPS, stopped V3 services, or coordinates outside Nelson coverage do not turn a valid photo finding into a location result; the app reports location screening as unavailable/not requested.

## How the response stays readable

Gemma is asked for a JSON schema containing only:

- scene category;
- possible standing water / wet surface only / no standing water identified / unclear;
- image usability;
- a limited vocabulary of visible features and visibility issues.

The backend validates those codes and checks some contradictions. It then generates readable sentences from fixed templates. Extra model prose, numerical confidence, unsupported cause fields, malformed JSON and truncated responses are rejected. Notes and GPS are not passed into the vision prompt. Text appearing inside a photo is treated as scene content, not instructions.

These checks constrain what can be claimed; they **do not prove that the selected visual labels are correct**. Model output must still be checked against the original photograph by a person. No calibrated confidence percentage is supplied. Both usable and uncertain photo results retain human-review requirements. These are general visual observations, not a validated water detector or a flood-risk model.

## Timing and retry

The app waits up to 60 seconds, shows elapsed time and permits cancellation. The local model request times out after 45 seconds, leaving time for an optional location request. The server keeps a model warm for five minutes, but Ollama may evict it. Initial loading, other models and hardware can change latency; a five-second CLI trial is not an app SLA.

One photo inference runs at a time in this service. A second receives a busy response. A cancelled mobile wait prevents stale results being displayed, but it does not guarantee that Ollama has immediately stopped work. A server-side request timeout closes its HTTP request, and already-running local model work may finish independently.

If GPU initialization fails again, inspect Ollama's terminal/logs and test it directly before retrying the app. This update does not change drivers or persist CPU-only settings.

## Photo handling and storage

- Maximum selected upload: 5 MiB; server accepts JPEG/PNG and decodes the actual bytes, with a 12-megapixel source cap.
- The app still prepares its 1600-pixel JPEG. The server re-encodes to at most 1280 pixels before passing image bytes to local Ollama; EXIF/GPS and other metadata are not forwarded in that JPEG.
- Uploads may spool to the OS temporary folder during multipart parsing. The upload context is closed after processing and on handled errors, which deletes its temporary spool. No named photo file, database record or photo archive is created by Script 55. This is not a secure-memory-erasure guarantee; abrupt process/OS failure needs OS cleanup.
- Notes, capture time and optional GPS travel with the observation; notes/time are validated but are not used for the vision classification and are not archived by this endpoint.
- Ollama and Python temporarily hold image data in memory. The endpoint does not log photo bytes, prompts, notes or coordinates. Your original photograph remains wherever you selected it from.
- Client cache behaviour is unchanged: prepared copies can remain until discard/replacement/restart, including after an OS kill. Reports contain session text only.
- Area maps/JSON from Explore retain their previous web-project output behaviour; they are not photo archives.

This is a trusted-LAN prototype with no authentication and permissive CORS. Authenticated HTTPS and a reviewed retention model are required before external deployment.

## Verification and your next phone check

See `PHOTO-VERIFICATION.md`. The integration was checked here with fixture Ollama responses; this workspace does not have access to your laptop's model. Your next test is the real phone → Script 55 → your local Gemma path, using the same photograph you tried in the CLI.

Record its displayed response and elapsed time, then try a dry-ground image, a deliberately unclear image and an unrelated image. Keep observations and model mistakes as actual evaluation evidence. No test screenshot or user photograph is included in the deliverable ZIP.

References: [Ollama vision](https://docs.ollama.com/capabilities/vision), [structured outputs](https://docs.ollama.com/capabilities/structured-outputs), [chat API](https://docs.ollama.com/api/chat).
