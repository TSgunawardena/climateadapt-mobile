# First working prototype demonstration

This checklist is for the original mock photo demonstration. For the real local model setup and new tests, use `CONNECT-LOCAL-PHOTO-ANALYSIS.md` and `PHOTO-VERIFICATION.md`.

Do these on the actual Android phone. Mark each only after observing it.

- [ ] App opens in Expo Go, all five navigation destinations respond.
- [ ] Phone browser can reach the laptop BFF health URL.
- [ ] Setup check confirms mock mode.
- [ ] Capture shows a purpose/destination notice and Not now works.
- [ ] Gallery selection opens a real picker and produces a preview.
- [ ] Camera permission granted captures a photo; denied camera offers the gallery path.
- [ ] Optional location can be granted, denied or removed; photo-only still works.
- [ ] Normal response displays an explicitly labelled mock finding.
- [ ] Low confidence displays Needs review in text, not colour alone.
- [ ] Service unavailable, busy and malformed replies show recovery options without crashing.
- [ ] Slow mode can be cancelled; old replies do not replace newer results.
- [ ] Timeout mode stops after 60 seconds with an explanatory message.
- [ ] Backgrounding during a request cancels waiting and permits a new attempt.
- [ ] Reports include only manually retained summaries and clear on restart.
- [ ] Discard removes the app-owned prepared photo; verify storage behaviour.
- [ ] Inspect a native upload with metadata tools; record EXIF findings.
- [ ] TalkBack can complete the core task with labelled controls and result announcements.
- [ ] Largest text size, landscape and remove-animations setting are usable.
- [ ] Two classmates complete a task; record one design change from feedback.
- [ ] Capture idle, preview, waiting, result, review and failed screenshots.
- [ ] Record actual image bytes and end-to-end time; distinguish these from upload-only time.
- [ ] Record a short backup video and commit source/README to Gitea.

Suggested live demo: Home, privacy notice, choose a photo, submit, show mock result. Then show Needs review and one failure. Explain that transport/UI work, while real model integration remains pending.

No field-risk assessment or operational council deployment is demonstrated by a fixed mock response.
