# Automatic face and number plate masking

This feature is prepared against main commit d919db568c0b7ded03ab16541e73ebe81025b77c
on feature/privacy-masking. It uses a separate laptop helper on port 8083.
The existing services on 8000, 8081 and 8080 keep their existing roles.
There are no new mobile dependencies or model weights in the phone bundle.

## What the user does

1. Take or choose a photo.
2. Privacy detection starts automatically. The original prepared JPEG goes to the configured laptop.
3. The covered preview opens automatically. Use Adjust covers only if something was missed or covered incorrectly. Drawing is enabled only after choosing Draw a cover.
4. Remove false detections if necessary. Check the whole image and tick the review checkbox.
5. Tap Use this photo. A newly encoded JPEG returns to the phone and replaces its upload image.
6. Review that image, then tap Analyse observation. Gemma receives this reviewed image.

Analysis is blocked while the new photo is unchecked, while the editor is open,
and when detection or export fails. There is no silent fallback to the original.
Cancelling the editor leaves the current photo unchanged and unchecked if it was
not reviewed earlier. Applying another edit cannot restore pixels covered in a
previous edit. Choose the source photo again to start over.

Zero detections do not establish that the photo contains no private information.
The user must still review and confirm. The zero-cover path also creates a fresh
JPEG without source metadata. Other identifying details, such as addresses or
clothing, require manual covers. This is an assistive feature, not guaranteed
anonymisation or an identity-recognition system.

## Install the laptop helper

Run these from the mobile repository in a NEW PowerShell terminal. A separate
Python environment avoids modifying the working AI backend environment.

```powershell
python -m venv .venv-privacy
.\.venv-privacy\Scripts\python.exe -m pip install -r .\backend-addon\requirements-privacy.txt
.\.venv-privacy\Scripts\python.exe .\backend-addon\prepare_privacy_models.py
.\.venv-privacy\Scripts\python.exe .\backend-addon\56_run_privacy_bff.py
```

The one-time model download needs internet access. Downloads are pinned to exact
revisions and checked against SHA-256 digests. Normal photo processing uses the
local CPU and does not call a cloud inference API. Neither OCR nor face identity
recognition is performed. Both detectors must load successfully before detection
reports ready. A missing or mismatched model produces an unavailable state.

In another terminal, check readiness.

```powershell
Invoke-RestMethod http://127.0.0.1:8083/api/health
```

Expect ok true, ready true, contract privacy-v1 and photo_storage no_archive.
Keep this terminal and the existing model/photo/place services running.
In app Settings set Privacy backend address to the laptop's Wi-Fi IPv4 address
on port 8083. The default uses the Expo laptop address. A phone cannot use the
laptop service through 127.0.0.1. Both devices need a reachable LAN connection.
Allow Python on the private network if Windows Firewall asks.

Reload Expo after installing the source changes. No mobile package installation
is required. The service and UI are prototype LAN components; this update does
not supply HTTPS, authentication or a public internet deployment.

## Data handling and API

The original prepared image reaches the laptop privacy service twice, once for
detection and once to apply the reviewed covers. The service holds request images
in memory and creates no photo archive or original-image job store. Models are
the only downloaded files. Access logging is disabled and responses use no-store.
The original remains in the phone's temporary cache until the replacement is
successfully accepted or the photo is discarded. This does not erase a user's
original gallery image. No new gallery image is saved.

POST /api/privacy/detect accepts JSON with image_base64. It returns bounded,
normalised rectangles, source SHA-256 and oriented image dimensions.
POST /api/privacy/apply accepts the same image_base64, source_sha256, regions
and reviewed true. A source mismatch is rejected. Covers are flattened into
pixels using Pillow and a new JPEG is encoded without source EXIF or thumbnails.
The response is base64 JPEG data, never a URL pointing back to the original.
Requests are capped at 8 MiB and decoded images at 5 MiB and 2.56 megapixels.

The mobile upload continues through the existing src/api.ts. Its URI now points
to the reviewed replacement. Optional notes and GPS do not go to the privacy helper.
Photos are not sent to Gemma merely by opening or applying the privacy editor.
Check the image after applying and deliberately press Analyse to start that step.

## Evaluation changes for Assessment 3

The A2 pilot predates this feature and is not evidence that masking was usable.
Use the new build consistently for A3 participants. Add the privacy review to T1
and T3. In T4 complete privacy review before making only the photo service
unavailable, so the task still assesses photo-analysis recovery.

The evaluation logger adds privacy_requested, privacy_review_opened,
privacy_applied, privacy_failed and privacy_cancelled. These are bounded event
names with no region coordinates, photo content, identities, paths or OCR text.
Detection timing includes request/response handling. Review-to-apply also includes
the participant's review and a second transfer. Neither is pure model inference.
Manually record missed detections, incorrect covers, correction effort and
whether users understand that the original reaches the laptop.

## Verification

The prepared update passes TypeScript, 22 JavaScript tests and eight Python API/
pixel-processing tests. It bundles for Android. New modules pass targeted lint.
Existing hook lint findings in App.tsx and the unused EvidenceImageViewer.tsx
are not represented as resolved. Backend tests check permanent black pixels,
metadata stripping, source binding, invalid inputs, oversize rejection, detector
failure and review requirements. They are functional checks, not accuracy scores.

The real pinned detectors were exercised on one public face sample and one
public plate sample, returning a face and plate respectively. The supplied field
photo examples returned zero detections. This reinforces the need for review;
the tests do not establish performance on New Zealand plates or all face poses.
Pixel 9 Pro touch, masking alignment and final Gemma interaction must be checked
on the actual phone before claiming device verification or merging into main.

Suggested phone checks

- Find a face and a readable plate in suitable consented test images.
- Confirm covers align after applying, including near image edges and in portrait images.
- Remove a false detection, add a missed region and check the new JPEG before analysis.
- Cancel detection and cancel review. An unchecked original must remain blocked.
- Stop Script 56. Checking must fail clearly without submitting the original to Gemma.
- Confirm the results screen displays the same masked photo used for analysis.
- Check reduced motion, large text and the manual correction controls.

## Model provenance

Face model is OpenCV Zoo YuNet face_detection_yunet_2023mar.onnx, revision
d4938dfc9d4ec5d098bfa33e98b3f3345a236586. Upstream directory licence is MIT.
https://github.com/opencv/opencv_zoo/tree/main/models/face_detection_yunet
https://github.com/opencv/opencv_zoo/blob/main/models/face_detection_yunet/LICENSE

Plate model is faisalthaheem/open-lpr-models plate_yolox_tiny_640.onnx, revision
aed0df35ec2891c5a90437041ebeadb592cc516b. The publisher declares Apache-2.0
for the detector weights. This update does not use its OCR artifacts. Inference
uses its published centred RGB letterbox and decoded YOLOX output contract.
https://huggingface.co/faisalthaheem/open-lpr-models
https://github.com/faisalthaheem/open-lpr/blob/main/lpr_app/pipeline/stages/detect.py

The model weights are not included in the update or intended for Git commits.
Retain the upstream model licence and notices if redistributing weights later.
No model accuracy figures are claimed for ClimateAdapt.

Internal inference fixtures, not redistributed in the update
https://github.com/opencv/opencv/blob/master/samples/data/lena.jpg
https://github.com/faisalthaheem/open-lpr/blob/main/blackbox/jeep.jpg
