# Mobile places integration — verification

This records the location integration phase. The later real photo endpoint and its separate verification are documented in `PHOTO-VERIFICATION.md`.

## Implemented

- Explore connection to the new mobile places API on port 8081.
- Built-in Nelson place lookup and manual WGS84 coordinates.
- Explicit opt-in to the web service's existing online address resolver, with a one-process limiter/cache and no autocomplete.
- Point requests forwarded to the existing Script 30 `/predict/point` route. The BFF verifies V3 model identity, score semantics, coverage, human review and returned coordinates.
- Radius analysis directly reuses `PlaceAnalysisService.analyse` for 500, 1000 and 2000 metres.
- Existing four-panel evidence maps served through an allowlisted map registry.
- Strict client response adapters, 60-second waiting limit, cancellation, stale-response rejection, missing-runtime/service/coverage errors.
- Original photo upload/demo modes retained. No real photo classifier, planning LLM or publication integration was added.

## Source inspected

Repository: https://github.com/TSgunawardena/ClimateAdapt-AI

Reviewed repository tree SHA: `2e4c51c7c96cbf6d35ab17f16bf71489be2a40cb`.

The integration was based on the actual `scripts/30_run_prediction_api.py`, `src/climateadapt/place_analysis.py`, `dashboard/app.py`, requirements and live workflow source. No changes were pushed to GitHub. The addon is supplied as a new script for the user to copy into the existing web project.

## Checks completed in this workspace

| Check | Outcome | What it establishes |
| --- | --- | --- |
| TypeScript typecheck | Passed | Client source types compile |
| Expo ESLint | Passed, no warnings after fix | Source lint checks |
| Node tests | 11 passed | Existing photo transport/states plus place adapters, coordinate validation, coverage/model guards and safe map URLs |
| Python BFF tests | 7 passed | Health without runtime, listed lookup, online-search caching/rate limiting using a stub resolver, input rejection, point mapping, upstream failure/malformed response rejection, map serving and unavailable area handling |
| Reused upstream code integration | Passed | Original area service ran on generated 5 m EPSG:2193 rasters at all three radii; original Script 30 served real HTTP point requests through the BFF; generated PNG maps were returned; outside-coverage point rejected |
| Browser journey | Passed | Explore connect → lookup → point → 500 m area → map; manual outside-coverage error; cancelled delayed response ignored; original gallery → mock photo result retained |
| Browser visual inspection | Completed | Search at 412 × 892, narrow search at 320 × 700 and area result view inspected; no native device claim |
| Expo web and Android exports | Passed | Web assets and Android Hermes bundle built; this is not an APK install or phone test |

**Synthetic integration values are test fixtures.** They are not Nelson findings or field evidence, and the test rasters are not shipped in the source ZIP. Browser checks used real HTTP and original upstream processing code, but synthetic input rasters. Online geocoding was stubbed for tests; no public address-search request was needed.

The development environment emitted non-fatal Node module-type and Python test-client deprecation warnings. No test failed in the final run. Lint dependencies were added using Expo's install command with its offline SDK metadata after the live dependency-metadata request timed out.

## Not verified here

- Your full Nelson runtime files and actual regional outputs: they are intentionally excluded from GitHub and are not in this workspace.
- Installation and operation on your physical Android phone; real Wi-Fi/firewall configuration.
- Camera/GPS permissions, TalkBack, large font scaling, landscape and native cache/EXIF behaviour for the new combined working setup.
- Public Nominatim availability or an actual online address match.
- Production authentication, HTTPS, load, multi-user operation or background server cancellation.
- Real image analysis, image confidence, location/photo association, LLM planning responses or publication.

## Reproduce source checks

In the Expo project:

```powershell
npm ci
npm test
npm run typecheck
npm run lint
npm run export:web
npm run export:android
```

For the optional BFF tests, use the web project's Python environment with FastAPI and the optional `httpx` test dependency installed. From the mobile folder:

```powershell
python -m unittest discover -s .\backend-addon -v
```

These tests use explicit in-memory service/HTTP fixtures and do not read, modify or distribute your real runtime data.

## Next laptop/phone check

Follow `CONNECT-YOUR-WEB-BACKEND.md`. Compare one mobile point and one mobile radius result against the same coordinates/radius in your existing API/dashboard. Save the actual observations and timing; do not substitute the synthetic test numbers above as assessment evidence.
