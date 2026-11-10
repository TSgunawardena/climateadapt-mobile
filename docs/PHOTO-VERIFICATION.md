# Local photo integration — verification and limits

## Change

Capture can now connect to a local `gemma3:4b` photo endpoint (Script 55). The endpoint uses Ollama's `/api/chat` image and JSON-schema capabilities. Visual codes are validated and converted into constrained readable sentences. Free model prose and fabricated numeric confidence are not displayed. Optional explicit GPS requests a separate V3 point screen through the existing Script 54.

The original mock photo endpoint remains available for course failure demonstrations, with a separate health identity and clearly marked mock results. No database, saved photo archive, web-dashboard photo feature, planning LLM call or publication action was added.

## Current evidence

| Check | Outcome | Scope |
| --- | --- | --- |
| TypeScript typecheck and Expo lint | Passed | Updated app source |
| Node tests | 14 passed | Existing photo/place transport contracts plus new live photo schema, readiness identity, no numeric confidence and separate location validation |
| Python tests | 15 passed | 7 existing place tests plus 8 photo endpoint tests |
| Photo upload validation | Passed | Invalid image bytes, missing upload, excessive image/body size, invalid GPS and unsupported demo query rejected before model calls |
| Model reply checks | Passed with fixture responses | Malformed JSON, additional causal prose fields and contradictory observations rejected; limited/unrelated inputs become needs-review |
| Upstream failures | Passed with fixture responses | Unavailable model and timeout do not produce successful findings; unavailable V3 context preserves photo findings |
| Image preparation | Passed | Actual decoded JPEG bounded to 1280 pixels; no EXIF forwarded |
| Temporary upload closure | Passed | Genuine >1 MiB JPEG exercised multipart spooling; handles closed on success and model timeout |
| Browser workflow | Passed | Setup identifies live endpoint, gallery upload, explicit browser geolocation, photo cards and separate V3 score, session summary, uncertainty and unavailable-model recovery |
| Web and Android exports | Passed | Web assets and Android Hermes bundle compile; no APK or phone installation claimed |

Browser and Python model tests used **fixture Ollama responses**. Their output is not evidence of Gemma's visual accuracy. The source workspace has no running Gemma instance and no access to the user's laptop. Test images and screenshots are not included in the ZIP.

The user separately demonstrated an actual local CLI image response and reported approximately **five seconds maximum for that trial**. Its unsupported inference of recent rain was observed and informed the restricted-code response design. We have not yet verified an actual structured response from that laptop or a real phone → Script 55 → Ollama round trip. Five seconds is not a measured distribution or performance guarantee.

Nonfatal environment warnings included Node's module-type notice and the Python test-client deprecation notice. The final functional checks passed.

## Still to check on the user's setup

1. Script 55 health says `vision_ready: true` for the installed local model.
2. The same road photograph produces an accepted structured response through Capture, without unsupported cause/depth/probability claims.
3. Dry-ground, unclear and unrelated images produce suitable outputs; record incorrect labels rather than counting schema compliance as accuracy.
4. Real camera, optional GPS, outside-Nelson GPS, stopped Script 54 and stopped Ollama.
5. End-to-end timing over Wi-Fi, cold model loading, cancellation and retry.
6. TalkBack, large text, landscape, actual native metadata/cache inspection and permission denial.

General-purpose vision outputs remain fallible. Enumerated codes constrain claims but do not validate recognition. Human review remains required for every accepted result.

## Setup

Follow `CONNECT-LOCAL-PHOTO-ANALYSIS.md`. No OpenAI key, external image provider or database is required. The service calls local Ollama and the existing local places service only.

Reproduce source checks with:

```powershell
npm test
npm run typecheck
npm run lint
npm run export:web
npm run export:android
python -m unittest discover -s .\backend-addon -v
```

Use the Python environment with `backend-addon/requirements-photo.txt` installed for Python tests. The final package still uses the existing Expo 58 and React Native 0.88 dependencies. Start Metro on port 8082; Script 54 owns 8081 and Script 55 owns 8080.
