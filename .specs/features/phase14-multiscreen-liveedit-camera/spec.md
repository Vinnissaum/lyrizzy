# Phase 14 — Multi-Screen Launch, Live Lyrics Editing, Camera Stream Quality

**Status:** Specified (2026-08-11)
**Depends on:** Phase 7 (3-pane operator layout), D-47 (dual independent outputs), Phase 8 (WebView stream modes)

---

## Problem Statement

Three unrelated pains surfaced during live Sunday services on the church install:

1. **Multi-screen launch is manual and ambiguous.** Multi-screen and mirror are persisted settings (`output.multi_screen_enabled`, `output.mirror_enabled`) but neither is surfaced when the operator presses **Apresentar**. Screen 2 only starts via a separate `OutputSwitcher` tab → `OutputLaunchModal` flow, so the operator repeats the same clicks every service, and the two screens are identified only as "Tela 1"/"Tela 2" with no relation to which TV they actually drive.
2. **A lyric error cannot be fixed while presenting.** Slides are computed once by `load_set_for_presentation` and cached in `presentation_slides`. Correcting a typo or a missing verse today means leaving presentation mode, editing, and reloading the set — which resets position and blacks the projector mid-service.
3. **The camera feed degrades over the service.** The camera outputs 4K, and the operator reports packet loss plus latency that grows monotonically. The same degradation appears in the camera's *own* built-in HTTP viewer, which places the bottleneck entirely upstream of Lyrizzy.

---

## Root-Cause Analysis: Camera Degradation

This was specified as "set the resolution on camera webview". **That framing does not solve the problem, and this phase deliberately does not implement it.**

**Pipeline:** camera → (RTSP over the LAN) → MediaMTX sidecar (`services/mediamtx.rs`) → WebRTC/WHEP on localhost → `<video>` in WebView2.

**Findings:**

| # | Finding | Consequence |
|---|---------|-------------|
| F-1 | Packets are lost on the camera→PC leg, before any Lyrizzy code runs | No downstream setting can recover bits that never arrived |
| F-2 | Latency **growing over time** is a sustained throughput deficit, not random loss — the stream arrives slower than real time and the receiver backlog accumulates | The pipe is too narrow for the bitrate; only reducing bitrate at the source fixes it |
| F-3 | The camera's own HTTP viewer shows the same degradation | Confirms F-1 — the fault is upstream of Lyrizzy entirely |
| F-4 | MediaMTX **does not transcode**; it remuxes. Re-encoding requires spawning FFmpeg per stream | A resolution control would need FFmpeg, which D-6 deliberately does not bundle |
| F-5 | Downscaling on the receiving PC costs CPU and changes nothing on the wire | Actively counterproductive |
| F-6 | IP/PTZ cameras serve concurrent **main** and **sub** streams from one sensor, at independent resolution/bitrate, on different RTSP paths | Lyrizzy can pull a light sub-stream while OBS/YouTube keeps the 4K main stream — **4K live quality is preserved** |
| F-7 | 4K ≈ 8–25 Mbps sustained; 1080p sub-stream ≈ 2–4 Mbps | 5–10× reduction on the degraded link |
| F-8 | RTSP transport (`udp`/`tcp`/`automatic`) is **already** operator-selectable at `WebViewSetItemEditor.tsx:269`, defaulting to `udp` | TCP retransmits lost packets — a zero-cost remedy already shipping today |

**Conclusion:** the actionable fix is camera-side configuration. Lyrizzy's job is to make pulling a *second, lighter stream* easy to select and switch — which is what P14-16..P14-21 specify. The HDMI-over-IP leg carrying the composited desktop to the TVs is a separate bottleneck, relieved indirectly by a lighter camera feed, but Lyrizzy cannot set an extender's or the OS's display mode and does not attempt to.

**Field actions (configuration, not code) — recommend before this phase ships:**

- Switch the camera set-item's RTSP transport from `udp` to `tcp` and re-test.
- Enable a 1080p (or 720p) sub-stream on the camera and point Lyrizzy at that RTSP path.
- Verify the negotiated NIC link speed at both ends — a damaged pair silently drops a gigabit link to 100 Mbps.

---

## Goals

- [ ] Pressing **Apresentar** with multi-screen enabled starts every screen in one action, with a configurable default that removes the prompt once the church settles into a routine
- [ ] Each physical monitor carries an operator-chosen name that outputs inherit, so screens are identified by what they drive rather than by index
- [ ] A lyric error is corrected and re-projected without leaving presentation mode and without losing position
- [ ] The camera view can be switched between operator-defined stream profiles (e.g. 4K main / 1080p sub) at any time, with zero impact on the 4K feed OBS/YouTube consumes
- [ ] The app icon evokes song and worship rather than a bare letter, from one committed vector source

## Out of Scope

| Feature | Reason |
|---------|--------|
| Resolution/bitrate control of the camera *display* in Lyrizzy | F-1..F-5 — cannot fix upstream loss; needs unbundled FFmpeg; counterproductive |
| FFmpeg transcoding sidecar | D-6 keeps FFmpeg an optional PATH dependency; bundling it for a fix that does not work is unjustified |
| Setting OS display mode / HDMI-over-IP extender resolution | Outside application control; configuration concern |
| Camera diagnostics overlay (bitrate, dropped frames, buffer delay) | Considered and deferred — valuable but not required to fix the reported pain |
| Auto-recovery on latency drift (silent WebRTC re-sync) | Deferred to a follow-up phase; profile switching addresses the root cause first |
| Changing the RTSP transport *default* from `udp` to `tcp` | Kept as a field action so the current default is not changed under installs that work today |
| Naming/creating a third output | Dual-output (D-47) remains the ceiling |
| Live editing of non-song items (media, countdown, webview, slideshow) | Lyric correction is the demonstrated pain; other item types stay edit-on-exit |
| Live editing from the presentation window | Presentation window is read-only (architecture invariant) |

---

## User Stories

### 14A — Multi-Screen Launch & Screen Naming

#### P1: One-action multi-screen launch ⭐ MVP

**User Story**: As an operator, I want pressing **Apresentar** to start all screens at once, so that I don't repeat the same per-screen setup every service.

**Why P1**: This is the recurring weekly friction and the explicit request.

**Acceptance Criteria**:

1. WHEN the operator presses Apresentar AND multi-screen is enabled AND launch policy is `ask` THEN the system SHALL show a modal asking whether to mirror all screens, offering an affirmative and a negative choice
2. WHEN the operator answers affirmatively THEN the system SHALL enable mirror mode, load the same set on every output, open each output's window on its assigned monitor, and start every output at the first item's first slide
3. WHEN the operator answers negatively THEN the system SHALL launch only the main output and SHALL NOT open a window for the second output
4. WHEN multi-screen is disabled THEN the system SHALL NOT show the modal and SHALL behave exactly as it does today
5. WHEN the operator dismisses the modal via Esc or the close control THEN the system SHALL launch nothing and leave all state unchanged
6. WHEN a set is empty THEN the system SHALL surface `presentation.empty_set` before opening any window, for every output

**Independent Test**: With two monitors and multi-screen on, press Apresentar → modal appears → answer yes → both TVs show item 1 slide 1. Repeat answering no → only the main TV lights up.

---

#### P1: Configurable launch default ⭐ MVP

**User Story**: As an operator, I want to set what Apresentar does by default, so that the prompt disappears once we've settled on a routine.

**Why P1**: Explicitly requested as "a configuration to set the default behaviour"; without it the modal becomes its own weekly friction.

**Acceptance Criteria**:

1. WHEN the operator opens settings THEN the system SHALL offer a multi-screen launch policy with exactly three values: ask every time, always mirror all screens, only the main screen
2. WHEN no policy has been chosen THEN the system SHALL default to ask every time
3. WHEN the policy is "always mirror all screens" THEN Apresentar SHALL launch all screens mirrored with no modal
4. WHEN the policy is "only the main screen" THEN Apresentar SHALL launch only the main output with no modal
5. WHEN the policy is changed THEN the system SHALL persist it and honour it on the next launch without an app restart
6. WHEN multi-screen is disabled THEN the policy control SHALL be visibly inapplicable and SHALL NOT affect behaviour

**Independent Test**: Set policy to "always mirror", press Apresentar → no modal, both screens start. Switch to "only main" → no modal, one screen starts.

---

#### P2: Named monitors, inherited by outputs

**User Story**: As an operator, I want to name each physical monitor so the UI tells me which TV I'm driving instead of showing "Tela 2".

**Why P2**: Real ergonomic gain, but the launch behaviour above is what hurts weekly. Ships alongside, not before.

**Acceptance Criteria**:

1. WHEN the operator opens display settings THEN the system SHALL list every detected monitor with its resolution and allow an editable name for each
2. WHEN a monitor has an operator-chosen name THEN the system SHALL display that name wherever an output is identified — output switcher, launch modal, monitor pickers, settings
3. WHEN an output is assigned to a monitor THEN the output SHALL display that monitor's name
4. WHEN a monitor has no operator-chosen name THEN the system SHALL fall back to the OS-reported name, and failing that to a generated label including its index and resolution
5. WHEN the app restarts THEN operator-chosen monitor names SHALL persist and re-associate with the same physical monitors
6. WHEN a named monitor is no longer detected THEN the system SHALL retain its stored name and SHALL NOT reassign that name to a different monitor
7. WHEN monitor enumeration order changes between runs THEN a stored name SHALL follow its monitor rather than its former index

**Independent Test**: Name monitor 2 "Congregação", restart the app, open the output switcher → the second tab reads "Congregação". Unplug it and reconnect → the name returns to the same physical screen.

---

### 14B — Live Lyrics Editing During Presentation

#### P1: Edit and re-project without leaving presentation ⭐ MVP

**User Story**: As an operator, I want to correct a song's lyrics while it is being projected and see the correction appear, so that a typo or missing verse doesn't force me to stop the service.

**Why P1**: The projector currently goes black and loses position for what is often a one-character fix.

**Acceptance Criteria**:

1. WHEN the operator is in presentation mode THEN the system SHALL offer a way to open the song editor for the currently projected song without exiting presentation mode
2. WHEN the operator saves an edit THEN the system SHALL persist it to the library song, regenerate that item's slides, and update the projection without reloading the whole set
3. WHEN slides are regenerated THEN the system SHALL keep the projection on the same section it was showing before the edit, wherever that section still exists
4. WHEN the regenerated item has fewer slides than the current slide index THEN the system SHALL clamp to the last valid slide and SHALL NOT blank or crash the projection
5. WHEN the section being projected no longer exists after the edit THEN the system SHALL move to the nearest valid slide and SHALL NOT blank the projection
6. WHEN the operator edits a song that is NOT currently projected THEN the system SHALL regenerate its slides and SHALL leave the live projection untouched
7. WHEN mirror mode is active THEN the system SHALL apply the regenerated slides to every mirrored output
8. WHEN the presentation is blanked or frozen during the edit THEN the system SHALL preserve that mode across the regeneration
9. WHEN the operator cancels the editor THEN the system SHALL leave both the song and the projection unchanged
10. WHEN an edit fails to save THEN the system SHALL surface the error and SHALL leave the live projection on its pre-edit slides

**Independent Test**: Project a song, open the live editor, fix a word in the verse currently on screen, save → the projector shows the corrected word on the same verse, with no black frame and no jump to slide 1.

---

### 14C — Camera Stream Quality Selection

#### P1: Per-camera stream profiles ⭐ MVP

**User Story**: As an operator, I want to define more than one stream for a camera and switch between them, so that Lyrizzy can pull a lighter feed while OBS keeps the 4K one.

**Why P1**: This is the only implementable remedy for the reported degradation (see Root-Cause Analysis).

**Acceptance Criteria**:

1. WHEN the operator edits a camera set item THEN the system SHALL allow defining two or more named stream profiles, each with its own URL and, where the protocol supports it, its own transport
2. WHEN more than one profile is defined THEN the system SHALL let the operator switch the active profile from the operator UI without opening the item editor
3. WHEN the active profile changes THEN the system SHALL restart the stream proxy against the new source and resume playback on the new profile
4. WHEN the active profile changes THEN the system SHALL NOT alter any other profile's configuration
5. WHEN the active profile is chosen THEN the system SHALL persist that choice per item and restore it on the next launch
6. WHEN only one profile is defined THEN the system SHALL behave exactly as today and SHALL NOT present a switcher
7. WHEN a profile's URL is invalid THEN the system SHALL reject it with the existing `stream.invalid_url` error and SHALL NOT tear down the active stream
8. WHEN switching profiles fails THEN the system SHALL surface the error and SHALL leave the previously active profile selected
9. WHEN the operator views the camera editor THEN the system SHALL explain that profiles select which camera stream to pull, that a lighter sub-stream reduces network load, and that it does not affect the stream other consumers pull

**Independent Test**: Define "Alta (4K)" and "Baixa (1080p)" profiles pointing at the camera's main and sub RTSP paths. Present the camera on the 4K profile, switch to 1080p mid-presentation → the feed continues on the lighter stream; OBS's 4K feed is unaffected throughout.

---

### 14D — Icon Rebranding

#### P2: An icon that reads as song and worship

**User Story**: As the church, we want the app icon to say "songs" at a glance instead of showing a bare letter, so the app is recognisable on the production PC's taskbar.

**Why P2**: Cosmetic and fully isolated from the three functional slices — but cheap, and the current plain "L" carries no meaning to anyone but us.

**Chosen concept** (decided 2026-08-11): the Lyrizzy **L whose vertical stroke doubles as a music-note stem**, with a filled notehead fused at the corner where the L turns. Keeps the existing letterform and palette (purple mark on a dark rounded square); adds the song reference without a denominational symbol.

**Acceptance Criteria**:

1. WHEN icon assets are generated THEN the system SHALL generate every one of them from a **single committed SVG** source, which is the only hand-edited icon artefact
2. WHEN the mark is rendered at 32×32 THEN it SHALL remain legible as both an L and a music note, with no detail that collapses at that size
3. WHEN the source SVG is authored THEN it SHALL bake in its own dark rounded-square background, because the generator preserves transparency and adds no backdrop of its own
4. WHEN assets are regenerated THEN every path listed in `tauri.conf.json` `bundle.icon` SHALL be updated, along with the Windows Store, macOS `.icns`, Android and iOS variants the generator emits
5. WHEN either window loads THEN its favicon SHALL show the new mark — `public/icons/` is a separate surface the generator does **not** write to, and SHALL be synced explicitly
6. WHEN the app is packaged THEN the installer, taskbar and window icons SHALL all show the new mark
7. WHEN the palette is chosen THEN it SHALL stay within the existing brand colours; this story SHALL NOT introduce a new brand palette

**Independent Test**: Regenerate from the SVG, launch the app → taskbar, both window title bars and both browser-tab favicons show the L-note. Shrink the 32×32 asset on screen → still reads as an L and as a note.

---

## Edge Cases

**Multi-screen:**

- WHEN only one monitor is detected AND multi-screen is enabled THEN the system SHALL still honour the launch policy, deferring to existing single-monitor placement rules (D-33, `use_windowed_fallback`)
- WHEN a second presentation window is already open AND Apresentar is pressed THEN the system SHALL remain idempotent per output (existing `enter_presentation` focus-only behaviour)
- WHEN all monitors are filtered out as phantoms (D-32) THEN the system SHALL surface `presentation.no_monitors` and open nothing
- WHEN both outputs auto-resolve to the same monitor THEN existing exclusion logic (`resolve_output_monitor`) SHALL continue to apply

**Live editing:**

- WHEN the same song appears twice in one set THEN regenerating it SHALL update every occurrence
- WHEN an edit removes every section from a song THEN the system SHALL keep the item present and SHALL NOT crash navigation
- WHEN a blackout-after-song sentinel (D-38) exists for the item THEN regeneration SHALL preserve it
- WHEN a title slide is enabled THEN regeneration SHALL rebuild it, including author-credit normalization (D-43)
- WHEN the operator exits presentation while the editor is open THEN the system SHALL not leave an orphaned editor blocking the UI

**Camera profiles:**

- WHEN a profile uses a protocol without a transport concept (RTMP, SRT, multicast) THEN the system SHALL omit the transport control for that profile
- WHEN the active profile is deleted THEN the system SHALL fall back to the first remaining profile
- WHEN MediaMTX is unavailable THEN existing `stream.mediamtx_not_found` handling SHALL apply unchanged
- WHEN the camera is presented on a second output THEN profile switching SHALL respect the single-proxy constraint (`stream_proxy` is global — one camera at a time, per D-47)

---

## Requirement Traceability

| ID | Story | Group | Phase | Status |
|----|-------|-------|-------|--------|
| P14-01 | P1: One-action multi-screen launch | 14A | Tasks | T13, T14, T15, T16 |
| P14-02 | P1: Mirror-all launches every output at item 1 | 14A | Tasks | T13 |
| P14-03 | P1: Negative answer launches main output only | 14A | Tasks | T13 |
| P14-04 | P1: Modal suppressed when multi-screen disabled | 14A | Tasks | T13, T15 |
| P14-05 | P1: Dismissal launches nothing, mutates nothing | 14A | Tasks | T14, T15 |
| P14-06 | P1: Empty-set guard honoured per output | 14A | Tasks | T13, T16 |
| P14-07 | P1: Launch policy setting with three values | 14A | Tasks | T12, T17 |
| P14-08 | P1: Policy defaults to ask every time | 14A | Tasks | T12 |
| P14-09 | P1: Non-ask policies bypass the modal | 14A | Tasks | T13, T15 |
| P14-10 | P1: Policy persists and applies without restart | 14A | Tasks | T12, T17 |
| P14-11 | P2: Per-monitor editable names | 14A | Tasks | T19 |
| P14-12 | P2: Outputs inherit assigned monitor's name | 14A | Tasks | T20 |
| P14-13 | P2: Name fallback chain (custom → OS → generated) | 14A | Tasks | T18, T20 |
| P14-14 | P2: Names persist and re-associate across restart | 14A | Tasks | T18, T19 |
| P14-15 | P2: Names survive enumeration reordering and disconnection | 14A | Tasks | T18 |
| P14-16 | P1: Open song editor without exiting presentation | 14B | Tasks | T10, T11 |
| P14-17 | P1: Save regenerates item slides and updates projection | 14B | Tasks | T8, T9 |
| P14-18 | P1: Position anchored to the projected section | 14B | Tasks | T7, T9 |
| P14-19 | P1: Clamp on shrink / missing section, never blank | 14B | Tasks | T7 |
| P14-20 | P1: Editing a non-projected song leaves projection untouched | 14B | Tasks | T8 |
| P14-21 | P1: Mirrored outputs receive regenerated slides | 14B | Tasks | T9 |
| P14-22 | P1: Blank/frozen mode preserved across regeneration | 14B | Tasks | T9 |
| P14-23 | P1: Cancel and save-failure leave projection intact | 14B | Tasks | T9, T10 |
| P14-24 | P1: Multiple named stream profiles per camera item | 14C | Tasks | T1, T2, T4 |
| P14-25 | P1: Switch active profile from the operator UI | 14C | Tasks | T5 |
| P14-26 | P1: Switching restarts the proxy and resumes playback | 14C | Tasks | T3, T5, T6 |
| P14-27 | P1: Active profile persists per item | 14C | Tasks | T1, T5 |
| P14-28 | P1: Single-profile items behave as today | 14C | Tasks | T1, T2, T3, T5 |
| P14-29 | P1: Invalid URL and switch failure leave the stream intact | 14C | Tasks | T5 |
| P14-30 | P1: Editor explains sub-stream rationale and OBS independence | 14C | Tasks | T4 |
| P14-31 | P2: Single committed SVG source, legible at 32×32 | 14D | Tasks | T22 |
| P14-32 | P2: All platform assets + both favicon surfaces regenerated | 14D | Tasks | T22 |

**Coverage:** 32 total, 32 mapped to tasks, 0 unmapped ✅ (see `tasks.md` § Requirement Coverage)

---

## Open Design Questions

Deferred to `design.md`, not blocking this spec:

| # | Question |
|---|----------|
| DQ-1 | Monitor identity key for stable naming — OS `name()`, or a composite of position + size + scale? CLAUDE.md flags monitor ordering as OS-dependent, so index is unusable |
| DQ-2 | Anchoring granularity for live edits — `section_id` alone, or `section_id` + slide-offset-within-section? `Slide` carries `section_id` but no per-slide identity |
| DQ-3 | Whether live regeneration reuses `compute_item_slides` behind a new targeted command, or generalises `load_set_for_presentation` |
| DQ-4 | Whether stream profiles extend the existing `WebViewConfig` in-place or become a sibling collection, and the migration path for existing single-URL camera items |
| DQ-5 | Whether the launch modal is a new component or a mode of the existing `OutputLaunchModal` |

---

## Success Criteria

- [ ] Starting a two-screen service takes one click plus at most one modal answer, and zero clicks once a non-ask policy is set
- [ ] The operator identifies each screen by name in the UI, with no reference to "Tela 1"/"Tela 2" indices
- [ ] A lyric typo is corrected mid-song with no black frame and no loss of position
- [ ] The camera view runs on a sub-stream while OBS continues pulling 4K, with stable (non-growing) latency across a full service
- [ ] All new strings exist in both `en-US` and `pt-BR`, guarded by the existing parity test
- [ ] Gate green: `tsc --noEmit` clean, Vitest suite passing, `cargo test` passing, `cargo clippy -D warnings` clean
