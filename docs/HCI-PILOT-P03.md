# ClimateAdapt P03 pilot protocol

This records the revised four-task procedure used for the current-APK session. The earlier docs/HCI-PILOT.md is preserved as version 1. Its mock-only T3 was replaced with interpretation of an actual photo result. A normal done response is valid for this comprehension task.

## Setup

Use a supplied non-identifying photo, leave GPS off and check live photo and Explore services before the session. Explain participation, backend photo processing, anonymous event logging and withdrawal. Obtain consent before enabling evaluation. Record the actual installed APK, device, operating system, date and backend conditions. The current APK includes on-device privacy review. Its implementation details belong to the later build documentation.

Start the session in Settings, Evaluation controls using P03. Read prompts without route hints. Start each task at Home. At its endpoint, record operation as independent, assisted, incomplete or service blocked. Record help separately. Ask ease from 1 very difficult to 5 very easy. This is a custom rating, not SUS.

## T1 photo without GPS

Prompt
Use the supplied photo to find out what the app can tell you about the scene. Keep your location private.

Endpoint
The participant selects and reviews the photo, applies reviewed covers on the current APK and reaches a real photo result without adding GPS. Observe location state manually because the event log intentionally excludes coordinates.

## T2 area and map

Prompt
Find Monaco, Nelson. Check the area within one kilometre and show where you would inspect the map in more detail.

Endpoint
The correct area result appears and the evidence map opens. Record the place and radius in observation notes because map_opened only proves the viewer was opened.

## T3 interpretation

Prompt
In your own words, what does this result tell you? What cannot it tell you, and what would you do before relying on it?

Capture the initial explanation before correction. Accurate interpretation recognises preliminary observations and qualified review and does not infer future flood likelihood or safety. Partial means some ideas are recognised but an important limit is unclear. Mistaken means the answer treats the result as a verified forecast or safety guarantee. Record no answer when none is supplied. Score this separately from operating the interface.

In P03, follow-up discussion explored future flooding, flagged locations and safety. Guidance was also suggested through the facilitator conversation. Later responses must not be counted as independent unprompted understanding. The provisional P03 score is partial. The participant ease rating was 4.

## T4 unavailable-service recovery

Before timing, stop Script 55 and explain that failure is deliberate. Leave the app and on-device privacy path available.

Prompt
The analysis service is deliberately unavailable. Submit the supplied photo, then show how you would return to review it after the error.

Endpoint
The participant recognises failure and reopens the retained photo. The expected service failure is not automatically a blocked task. Record recovery independently of analysis success. Restore Script 55 afterward.

## Export and interpretation

End the session and save the complete CSV text from Android's share sheet before closing or clearing the app. Confirm session_start, task starts/ends and session_end are present. Preserve the raw export unchanged. Ratings, comments, interpretation and consent belong in separate facilitator notes.

Task duration is task_end minus task_start. Request round trip includes transfer, backend work and parsing. Failure-to-review is review_opened minus request_failed for the same attempt. Timings include discussion and facilitator handling. A small convenience pilot cannot establish population usability or model accuracy.

## P03 observed record

The supplied export contains 41 events. All four operation outcomes are independent. Ease ratings were 5, 5, 4 and 5. T2 includes map_opened. T4 includes request_failed followed by review_opened, and the facilitator explicitly confirmed independent recovery. T3 interpretation remains partial despite independent operation. Exact APK identification, consent record, device and source-photo details require confirmation in the final evidence notes.
