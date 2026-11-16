# ClimateAdapt HCI evaluation tool version 1

This instrument is designed for the Android prototype. Its pilot checks whether the
instructions, scoring anchors and event logging are usable. It is not a completed
user study or evidence that the vision model is accurate.

## Evaluation questions

1. Can a first-time user prepare and submit the supplied photo without sharing GPS?
   Measure independent completion, assistance, observed retakes and preparation errors.
2. Can a user distinguish uncertain photo observations from geographic susceptibility?
   Measure a spoken explanation, response to a mock needs-review finding, and inspection
   of evidence. Do not score acceptance of a model label as proof of accuracy.
3. Can a user recognise waiting or failed processing and recover without losing the photo?
   Measure observed hesitation, cancellation or retry, and independent recovery.

Use the same device and neutral supplied images. Set services up before each task.
Book one classmate for the pilot, then five to eight participants for the finished-app
evaluation as described in Lecture 11. Keep sessions within 20 minutes.
If this schedule is not feasible, report the actual sample and limitations.

## Consent script

“I am testing this interface, not your ability. Participation is voluntary and you
can stop at any time. I will record an anonymous code, task outcomes and app events
with timings. I will not record your name, personal images or location. Please use
only the supplied image and leave location sharing off. You can ask for the session
log to be deleted before it is included in the report. Are you happy to continue?”

Obtain the response before checking consent in Settings → Evaluation controls.
Do not audio/video record without separate agreement. No names, notes, GPS,
filenames, image contents or backend responses are included in the automatic log.
Photo analysis still sends the test image to the configured backend, separately
from the evaluation logger. Explain this distinction.

## Facilitator workflow

1. Record the phone, Android version, tested commit and whether the model is warm.
2. Check services, select code P01 and record consent. Start session.
3. Read a prompt, choose its task timer, then hand over the phone at Home.
4. Observe without coaching. If help is requested, record your hint.
5. At the endpoint, open the Evaluation button and select the task outcome.
   Controls add facilitator handling time. Record that delay separately.
   Finishing a task cancels any outstanding photo request to avoid leaking its
   result into a later task's log.
6. Ask “How easy was that task, from 1 very difficult to 5 very easy?”
   This custom item is not SUS or a validated questionnaire.
7. Reset Home. Configure mock/failed services between tasks, outside the timer.
8. End session. Export CSV and confirm the text/file was saved. Only then clear.
   On Android the standard Share sheet shares CSV TEXT, not an attachment.
   Select a suitable notes/storage app and save it as CSV. Web offers a download.
   Keep a facilitator copy securely. Do not commit identifiable raw data.

## Tasks

T1 — Live photo, no GPS.
Prompt: “Use the supplied street photo to find out what the app can tell you.
Keep your location private.”
Success: reaches real photo feedback without GPS or route guidance.
Start from Home. Use a neutral photo with no identifying details.
Record spontaneous retakes and whether preview was checked.

T2 — Geographic evidence.
Prompt: “Find Monaco, Nelson, check the area within one kilometre and show where
you would read the map in more detail. Explain what the flagged-land percentage means.”
Success: correct area and enlarged map. Record map discoverability.
Interpretation is accurate if they explain evaluated land meeting a threshold
and distinguish it from flood probability, partial if one idea is clear with
no contradiction, and mistaken if they claim a flood chance or confirmed flood.
Keep their words in the observation sheet.

T3 — Uncertain finding, explicitly simulated.
Tell the participant this is a fixed demonstration response.
Prompt: “Review this demonstration result. Explain what is uncertain and what you
would do before relying on it.”
Before timing, stop Script 55 on port 8080, start the repo mock server with
npm run backend, reconnect in Settings and choose Needs review. Do not run both
servers on the same port. Never present the mock confidence as measured accuracy.
Success: recognises uncertainty and proposes checking/retaking/human review.
A route that submits a review to a person is not implemented. Do not claim one.
Record answer manually, including whether they think the result is verified.

T4 — Deliberately unavailable service.
Restore Script 55, reconnect successfully, then stop it BEFORE starting the task.
Explain that this task deliberately tests failure handling.
Prompt: “Submit the supplied photo. If the request fails, show how you would return
to review the photo.”
Success: recognises failure and reaches the retained preview without help.
This task's backend failure is expected. Score the recovery itself.
Restore service after the session.

## Outcomes

Independent — reaches endpoint without a route/control hint.
Assisted — reaches endpoint after a facilitator hint.
Incomplete — stops or does not reach endpoint.
Service blocked — an unexpected service problem prevents assessment.
An expected failure in T4 is not automatically a blocked task.

Record comprehension separately from technical completion.

## Adapted heuristic inspection

Use evidence (screen, observed action or participant words), severity and recommendation
for EACH check. At least half of the checks concern media, waiting or uncertainty.

H1 Status — text explains pending analysis; animation does not imply real model attention.
H2 Language — users can explain susceptibility without interpreting it as flood probability.
H3 Control — cancelling waiting returns to the retained photo.
H4 Consistency — Home, Explore and Capture labels match the actions.
H5 Prevention — preview and optional location are understandable before submission.
H6 Recognition — next actions are visible rather than remembered from instructions.
MM1 Media — original preview permits checking whether the supplied image is usable.
MM2 Evidence — map enlargement is discoverable and its labels remain readable.
AI1 Uncertainty — needs-review and uncertain observations are distinguishable from verification.
AI2 Evidence separation — location screening does not appear to confirm the photograph.
AI3 Recovery — an unusable or failed response is not presented as an accepted result.
A11Y Access — inspect larger text, TalkBack, reduced motion and non-colour meaning.

Severity anchors
0 — no observed usability problem.
1 — cosmetic issue without task impact, such as inconsistent spacing.
2 — minor friction with independent recovery, such as a hard-to-find map link.
3 — major problem requiring help or causing repeated failure.
4 — critical misunderstanding or blockage, such as treating screening as a verified warning.
These project anchors require evidence. They do not establish engineering safety.

## Timing definitions

elapsed_ms uses a monotonic clock relative to session start.
task duration = task_end minus task_start, including facilitator handling delay.
preparation = photo_ready minus photo_selected. Selection occurs AFTER the picker
returns, so capture_opened → photo_selected includes navigation and picker time.
request round trip = result_received minus analysis_requested, including upload,
backend wait/inference, download and parsing. This is NOT isolated inference time.
display effect delay = result_shown minus result_received. React effect timing
does not prove pixels have rendered. A result is recorded again if revisited.
Cancel/failure events end an attempt. Do not subtract a successful attempt across
different task IDs or across earlier cancelled attempts.
No separate upload-end or server-inference boundaries are measured in this version.
T2 logs map opening, while selection and screening time require observer notes.
Retakes are observed manually. photo_selected counts gallery selections as well.

## Pilot and analysis

Have one classmate try the protocol. Check consent, timing boundaries, error recovery,
CSV export and comprehension scoring. Record confusing instructions, missing events,
fixes and the retest. No pilot result has been supplied with this package.
For A3, use the refined tool on the finished build. Present counts with denominators,
typical times (median), qualitative difficulties and model waiting separately.
Do not generalise a small convenience sample to all users.

