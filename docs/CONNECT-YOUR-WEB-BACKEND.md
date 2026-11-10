# Connect the mobile app to your existing ClimateAdapt web backend

This update adds place lookup, real V3 point screening, and 500 m / 1 km / 2 km area analysis to **Explore**. It reuses your existing web project's code and local runtime files. The Streamlit dashboard does not need changing.

This guide covers the location integration. For the new real photo endpoint, follow `CONNECT-LOCAL-PHOTO-ANALYSIS.md` (Script 55). The original mock photo BFF remains optional. Your existing planning language model does not inspect photographs; Gemma 3 4B handles the new photo endpoint. Location replies here are deterministic explanations of V3 results, not LLM planning briefs.

## Keep the projects separate

You already have two projects:

- `ClimateAdapt-AI`: your Python/FastAPI/Streamlit project, with the large local runtime files.
- `climateadapt-prototype`: this Expo mobile project.

Use the updated mobile source in this ZIP. Keep a backup of your working mobile folder before copying over any files you have personally edited. Run `npm ci` in the updated mobile folder because lint dependencies were added. Your existing photo demo still starts with `npm run backend`.

## 1. Add one new Python script to the web project

Copy **`backend-addon/54_run_mobile_bff.py`** from this mobile project into the **`scripts`** folder of your existing `ClimateAdapt-AI` web project.

The resulting path should be:

```text
ClimateAdapt-AI/scripts/54_run_mobile_bff.py
```

Do not run the script from its original `backend-addon` folder. It needs to find the web project's `src`, `data` and `outputs` directories beside `scripts`. It does not replace Script 30, the Streamlit dashboard, the models or your rasters. No new model download, API key or `.env` file is needed for location screening.

The existing web environment must have its repository requirements installed. If that environment already runs your dashboard, reuse it. Python 3.12 is recommended by your web README.

## 2. Start the existing prediction API

Open a terminal in the **web project**, activate its existing virtual environment, then run:

```powershell
.\.venv\Scripts\Activate.ps1
python .\scripts\30_run_prediction_api.py
```

If the prediction API is already running, keep that instance; do not start a second one on the same port. Check on the laptop:

```text
http://127.0.0.1:8000/health
http://127.0.0.1:8000/model
```

Script 30 can stay bound to localhost. Only the mobile places service needs to be reachable from the phone.

## 3. Start the mobile places API

In a second terminal in the **web project**, using the same virtual environment:

```powershell
.\.venv\Scripts\Activate.ps1
python .\scripts\54_run_mobile_bff.py
```

Check on the laptop:

```text
http://127.0.0.1:8081/api/health
```

Expected fields include `mode: live_places`, `contract: places-v1`, `area_ready: true`. If `area_ready` is false, it also reports a count of missing files. The service can list and resolve built-in places without those rasters, but it cannot invent area results. Use the **complete V3 runtime already used by your web project** to restore missing `data` and `outputs` files.

## 4. Connect the Android app

In the **updated mobile project**, run:

```powershell
npm ci
npx expo start --go --lan --port 8082
```

Keep the phone and laptop on the same trusted Wi-Fi. Find the laptop's Wi-Fi IPv4 address using `ipconfig`.

In the phone's browser test, replacing the example IP:

```text
http://192.168.1.20:8081/api/health
```

In the app, open **Explore → Connection settings**. Enter the base address:

```text
http://192.168.1.20:8081
```

Tap **Connect places service**, choose a listed place, confirm its coordinates, and press **Screen this point** or **Analyse 1 km area**. You can change the radius to 500 m or 2 km.

The phone must use the laptop's IP, not `localhost`. If its browser cannot reach the health address, check that Python is allowed on the private network and the Wi-Fi does not isolate devices. Do not disable the firewall or expose these development services to the public internet.

## Which address is which?

| Service | Default port | Used by |
| --- | ---: | --- |
| Existing V3 prediction API | 8000 | Mobile places API, on the laptop |
| Photo Script 55, or original **demo** BFF | 8080 | App's global Setup and Capture workflow |
| New mobile places API | 8081 | Explore's Connection settings |
| Metro | Expo-selected | Expo Go loading the app |

Keep `npm run backend` running in the mobile project if you also want to demonstrate the mock photo journey. Ports 8080 and 8081 deliberately report different contracts; entering the photo address in Explore is rejected.

## Search scope and optional online addresses

**By default, online address search is OFF.** You can search the built-in Nelson places (Nelson CBD, Tāhunanui, Rocks Road, Stoke, Monaco and Atawhai) and enter WGS84 latitude/longitude manually. No external geocoding account is needed for those paths.

The web project's existing `resolve_place` implementation uses the public OpenStreetMap Nominatim service for other addresses. Enabling that path is an explicit developer choice governed by the [Nominatim usage policy](https://operations.osmfoundation.org/policies/nominatim/): user-triggered searches only, no autocomplete, at most one upstream request per second across the application, identifying User-Agent, caching and attribution. The mobile API adds a one-process lock, a 1.1-second spacing check, a bounded one-day memory cache, and the app displays attribution. It sends search text to the existing resolver only after the user presses Search. Do not use multiple workers, replicas or multiple copies of this service against the public geocoder. Existing web dashboard searches are outside this limiter; avoid running public online search simultaneously in the dashboard and mobile service. A shared server-side limiter/provider integration is needed for broader use.

After reviewing that policy and choosing to use your existing resolver for this small local prototype, stop the mobile places service and restart it in PowerShell with:

```powershell
$env:CLIMATEADAPT_ONLINE_SEARCH = "1"
python .\scripts\54_run_mobile_bff.py
```

Then reconnect in Explore. To disable online lookup, remove the setting and restart:

```powershell
Remove-Item Env:CLIMATEADAPT_ONLINE_SEARCH -ErrorAction SilentlyContinue
python .\scripts\54_run_mobile_bff.py
```

Search is bounded by the original service to the Nelson region. Search matches do not establish valid model coverage; that is checked separately. If the public service is unavailable or no trustworthy match is found, use a listed place or manual coordinates. Switching online lookup off requires no mobile app rebuild.

## Results and retention

- Point results show an uncalibrated susceptibility score, the frozen threshold, supporting terrain features and human-review reasons. They never display a score as a percentage chance of flooding.
- Area results show evaluated land, flagged land, the flagged percentage, land coverage and the original four-panel evidence map. A location below threshold is not described as safe from flooding.
- The existing area service writes JSON and a map under the **web project's** `outputs/place_analysis_v3`, as it already does for web analysis. It does not receive photographs. Those analysis artifacts remain on the laptop until you remove them. The mobile map registry keeps the latest 64 maps per service process; after a restart, rerun analysis to obtain a fresh map link.
- Search cache, app settings and results are in memory. Explore cancels waiting when you leave the screen or background the app; returning to Explore requires reconnecting. Cancellation blocks obsolete responses from updating the UI, but it does not guarantee cancellation of already-running raster work on the laptop.
- One area analysis runs at a time. A second request receives a retry message. The client waits up to 60 seconds without invented progress percentages.
- No new Gitea publication, human approval action, LLM call, raster training or model change is performed by this update.

## Optional settings

Server-only environment settings are available for a non-default local setup:

```powershell
$env:CLIMATEADAPT_PREDICTION_URL = "http://127.0.0.1:8000"
$env:CLIMATEADAPT_MOBILE_PORT = "8081"
```

The default mobile bind address is `0.0.0.0` to support your phone over LAN. This is a development API with permissive CORS and no authentication; it needs authenticated HTTPS before external deployment.

## Validation and remaining phone check

See `docs/PLACES-VERIFICATION.md` for checks completed in this workspace. The full Nelson runtime is not present here, so real regional outputs and physical Android behaviour still require verification on your laptop/phone.

Your next evidence capture should include: a successful point, each radius, outside coverage, stopped Script 30, cancelled waiting, and the original mock photo flow. These are test tasks, not claimed completed phone tests.
