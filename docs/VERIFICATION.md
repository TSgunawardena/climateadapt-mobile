# Initial mock build — historical verification

For the current location/photo integration checks, read `PLACES-VERIFICATION.md` and `PHOTO-VERIFICATION.md`.

Implemented checks, run in the development environment:

- TypeScript compilation (`npm run typecheck`).
- Seven Node tests: health and normal/low/slow results; unavailable/rate/malformed handling; bad/missing/EXIF/oversized uploads; network cancellation; stale-request guard; malformed-confidence validation; endpoint-address validation.
- Expo SDK dependency compatibility check.
- Metro web bundle export and Android Hermes bundle export.

See README for run commands. These checks do not certify a native install. Physical Android camera/gallery, GPS permissions, TalkBack, cache retention, battery/memory behaviour and comparison with the lecturer's actual Moodle BFF remain unverified.

Browser interaction checks on a 412 × 892 viewport also passed: gallery file selection, JPEG preparation, preview, upload, normal mock result, low-confidence review, 503 error, malformed response and cancellation back to review. Home was also visually inspected at 320 × 700. This used the web rendering of the Expo source and does not replace physical Android tests. The intentional 503 scenario generates a browser network-console error, as expected.
