# P03 current APK pilot record

Recorded during the facilitated session on 21 November 2026, New Zealand time. Participant code P03. The facilitator reported another person operating the app and explicitly confirmed independent photo-review recovery for T4. Do not include a participant name.

## Evidence sources and version

P03_current_APK_events.csv preserves the clipboard export supplied by the facilitator. It contains 41 event rows, including session start, four task starts and ends, and session end. P03_task_summary.csv contains calculated intervals plus ease ratings and interpretation from the separate conversation notes. Ratings, comments and comprehension are not present in the automatic export.

The user identified this as the current APK with on-device masking. Privacy events occur in T1, T3 and T4. Exact installed APK version, build identifier and source commit were not supplied for this session. Do not infer that a later Git HEAD is the tested binary's commit. Pixel 9 Pro and Android 17 are the previously reported testing device; confirm they were used in this session. Session-start logging is present, but the export does not independently document the consent conversation. Confirm consent in the facilitator record before submitting.

This is new current-build evidence, not a recreation of the missing historical A2 exports. If cited in A2, explain the date and version difference and any applicable submission arrangements. Use it directly as current-build pilot evidence for A3 without claiming a broader participant evaluation has been completed.

## Task outcomes and feedback

- T1 was logged and reported independent. Ease was 5 out of 5. No additional comments were supplied.
- T2 was logged and reported independent. Ease was 5 out of 5. The facilitator relayed that the participant liked image enlargement. A map_opened event supports opening the viewer. Place identity and one-kilometre radius are not recorded by these events and require observation notes.
- T3 task operation was logged independent. Ease was 4 out of 5. Interpretation was provisionally classified partial during this conversation. The participant recognised the qualified-review warning but also referred to future predictions and safety. Follow-up discussion included suggestions from the assistant, so later answers must not be treated as unprompted evidence of understanding. No claim is made that the participant independently explained the percentage of land meeting the screening threshold.
- T4 was logged independent and the facilitator explicitly confirmed the participant reopened the preview without help. Ease was 5 out of 5. The facilitator reported a service-unavailable warning with the photo retained and recovery options available. The recorded failure followed approximately 60 seconds of waiting; the event alone does not establish an immediate connection failure or the server's HTTP status.

## Calculated intervals

| Task | Task interval seconds | Ease out of 5 | Logged operation |
| --- | --- | --- | --- |
| T1 | 130.010 | 5 | independent |
| T2 | 86.291 | 5 | independent |
| T3 | 124.210 | 4 | independent |
| T4 | 82.160 | 5 | independent |

Session length was 790.981 seconds, approximately 13 minutes 11 seconds. Task intervals include app waiting, reading, discussion and facilitator handling. Do not describe them as pure user-interaction time or compare them directly with uninterrupted sessions.

T1 analysis request-to-response was 34.521 seconds. T3 was 10.013 seconds. These are end-to-end request intervals, not isolated model inference. The difference does not prove caching or cold-start causation. T4 analysis-request-to-failure was 60.008 seconds. Failure-to-review reopening was 9.273 seconds.

Privacy-request-to-review-opening intervals were 1.722 seconds in T1, 1.441 in T3 and 1.419 in T4. These are app event intervals that may include native detection and interface transition; they are not benchmarked isolated model times. Privacy-review-opening-to-apply includes human review and cannot be treated as export speed.

## Findings and next steps

The session supports independent operation of the four logged routes on this build and successful recovery to a retained photo after failure. Positive ease ratings coexist with a comprehension issue. One participant is a convenience sample and does not validate model accuracy, future flood likelihood, engineering safety, complete accessibility or detector completeness.

Clarify that neither a photo observation nor an unflagged geographic screen proves future safety. Retest this using neutral prompts before explaining the answer. Complete TalkBack testing separately. Retain the original event CSV and these separate notes with the final assessment evidence.
