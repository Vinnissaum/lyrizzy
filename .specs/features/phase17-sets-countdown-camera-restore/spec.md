# Phase 17 — Set Switching, Countdown Identity & Sizing, Restore Integrity, Camera Simplification

**Status:** RELEASED as `v1.4.0` (2026-09-04) — all 37 requirements (T1–T29) done; T30 (manual hardware verification) remains open
**Depends on:** Phase 14 (stream profiles, dual outputs), Phase 15 (free-text lyrics), Phase 16 (`v1.3.0`, focus integrity)
**Release target:** `v1.4.0` (minor — new operator-facing capability + one data-loss-class fix, no destructive schema change)

---

## Problem Statement

Five field reports from the `v1.3.0` install. One is a data-loss-class defect: a full-library restore in "replace everything" mode fails on any install that has ever presented a set, and it fails *after* deleting every media file, leaving the library pointing at files that no longer exist — and the recovery path offered at next launch is broken in exactly the same way. The failure surfaces as `[object Object]`, so the operator gets no idea what went wrong.

The other four are capability and naming gaps: the countdown set item is stuck with a name that states a duration it may not have and cannot be renamed; the countdown's message and digits are sized by hardcoded constants; multiple service sets exist in the database with full backend CRUD but no reachable UI, so the operator can only ever edit one set; and the camera feature is called "WebView" and offers six connection modes, three of which cannot work with an actual camera.

---

## Root-Cause Analysis

Every report was traced to specific lines before this spec was written. No requirement below is speculative.

| # | Report | Root cause | Evidence |
|---|--------|-----------|----------|
| RC-1 | The counter has a fixed name of "Counter 10 min" | `CountdownConfig` has no name field, so both label sites synthesize one from the duration. `itemSummary` renders `builder.countdownSummary` with `durLabel`, whose fallback is the **literal string `"10min"`** whenever `durationMs` is 0 — so an unconfigured countdown claims to be 10 minutes regardless. `itemLabel` builds `Cronômetro — MM:SS` from a hardcoded Portuguese string that never passes through i18n. | `SetBuilder.tsx:449-455`, `itemMeta.tsx:60-70`, `domain/countdown.rs:63-80` |
| RC-2 | No control over message / digit size | Both sizes are literals in the renderer: message `clamp(0.75rem, 3cqmin, 2rem)`, digits `clamp(2rem, 30cqmin, 18rem)`. There is no setting and no per-item field; the 1:10 proportion between them is an artifact of those two constants. | `CountdownRenderer.tsx:34,42,58` |
| RC-3 | **Restore fails in "replace everything" mode, works in "mix" mode** | `wipe_db` deletes `set_items → sets → songs → media → settings` and never touches `song_plays`, whose `song_id` and `set_id` FKs carry **no `ON DELETE` clause** (⇒ `NO ACTION`), while sqlx enables `PRAGMA foreign_keys = ON` by default. `DELETE FROM sets` therefore raises `FOREIGN KEY constraint failed` on any install that has ever presented a set — `record_set_start` writes one `song_plays` row per song per set per calendar day at every presentation start. Merge mode never calls `wipe_db`, which is exactly why it works. Existing tests pass because they restore into freshly-migrated databases with an empty play ledger. | `archive.rs:289-302` (`wipe_db`), `migrations/005_phase3.sql:19-24` (FKs with no `ON DELETE`), `sqlx-sqlite-0.8.6/src/options/mod.rs:185` (`foreign_keys` default ON), `commands/presentation.rs:621` (ledger writer). Reproduced against the real schema shape: `DELETE FROM sets` → `IntegrityError: FOREIGN KEY constraint failed` |
| RC-4 | "I got an error without any message" | `setError(String(err))` stringifies an `ErrorPayload` **object** (`{code, params}`) to `[object Object]`. `formatError` is never called on this path, and `ERROR_MESSAGES` contains no `backup.*` entries at all, so even a correct lookup would print the raw code. | `BackupScreen.tsx:180,196,213`, `RestoreInProgressDialog.tsx:23`, `i18n/error-codes.ts:3-33` |
| RC-5 | The failed restore takes the media library with it | `import()` writes `.restore_in_progress`, **deletes every file in the media directory**, and only then calls `wipe_db`. When RC-3 fires, the DB is intact but every media row points at a deleted file, and the flag file stays on disk. At next launch the app offers `abort_restore` as the way out — which calls the same broken `wipe_db` and fails identically, leaving no working recovery path inside the app. | `archive.rs:256-273`, `commands/backup.rs:98-121` |
| RC-6 | Sets exist on the backend but not in the UI | The backend has complete CRUD (`create_set`, `update_set`, `delete_set`, `list_sets`, `get_set`) and `SetList.tsx` is fully written, but it renders only for `currentView === "sets"` and **no navigation control ever sets that view** — the sidebar has exactly five buttons (home, library, media, backup, settings). Home is hard-pinned to `fixedSetId`, resolved once via `get_or_create_default_set()`, which returns whichever set was updated most recently. | `OperatorApp.tsx:495-552` (nav), `:599-603` (unreachable views), `library.ts:96-102` (`loadFixedSet`), `set.rs:602-631` |
| RC-7 | Latent: deleting a set will fail the same way as RC-3 | `delete_set` runs a bare `DELETE FROM sets WHERE id = ?`, which `song_plays.set_id` blocks for any set that has been presented. Harmless today only because its single caller lives in unreachable UI — it becomes a live failure the moment the picker ships. | `set.rs:233-252`, `migrations/005_phase3.sql:22` |
| RC-8 | "WebView" is the wrong name for a camera feature | The operator-facing vocabulary is `builder.add.webView` = "WebView" on the add button, `itemLabel` returning `"Web"`/`"Câmera"` by mode, and a `webview.*` i18n namespace, while the feature's purpose is projecting a live camera. | `en-US.json:149`, `itemMeta.tsx:72-76`, `SetBuilder.tsx:859` |
| RC-9 | Three of the six modes are not camera protocols | **RTMP** maps to `Source::Pull`, i.e. MediaMTX connects *as a client* to an RTMP **server** — but cameras *push* RTMP to a server rather than hosting one, and the generated config disables every MediaMTX server except WebRTC, so there is nothing for a pushing camera to publish to. **SRT** is first-mile contribution gear (encoders, broadcast bridges). **UDP/MPEG-TS multicast** is IPTV/broadcast distribution. **RTSP** is the protocol ONVIF actually mandates, and **MJPEG-over-HTTP** is the common fallback on older cameras. | `mediamtx.rs:71-90` (`Source`), `:96-100` (all servers but WebRTC disabled), `domain/set.rs` (`WebViewMode`); external: ONVIF Streaming Specification, Wowza RTP/RTSP FAQ |
| RC-10 | Stream profiles are offered where they do nothing | `StreamProfileEditor` renders unconditionally for **every** mode, but `resolveActiveSource` is consulted only in the `rtmp` and `rtsp` branches of `buildStreamSource`. `iframe` and `mjpeg` render `config.url` directly and `srt`/`multicast` read their own config objects, so on four of six modes the profile UI is inert — including the iframe mode the operator explicitly wants it removed from. | `WebViewSetItemEditor.tsx:483-490`, `WebViewRenderer.tsx:20-41,45` |
| RC-12 | Found at design time (DD-1) | `OperatorApp.tsx:267` silently re-arms a scheduled countdown at launch from `findUpcomingScheduledCountdown`, whose `UpcomingScheduledCountdown` interface carries neither `position` nor `backgroundMediaId` — so the same countdown armed at launch takes over centred with no background, while armed from the configuration modal it honours both. | `runtime/scheduledCountdown.ts:3-14`, `OperatorApp.tsx:263-274` vs `CountdownScheduleModal.tsx:132-141` |
| RC-11 | Incidental, found while tracing RC-2 | The operator's live preview builds its takeover countdown config with `position: "center"` hardcoded, while the presentation window mirrors the real `countdown.position` — so during a takeover the preview disagrees with the wall. Same two code paths the sizing work has to touch. | `LivePreview.tsx:84-89` vs `PresentationApp.tsx:225-231` |

---

## Goals

- [ ] A "replace everything" restore succeeds on a library with presentation history, and any failure names its cause in the operator's language without destroying media first
- [ ] The operator names their own countdown items and sizes the message and digits independently, with today's rendering as the 100% baseline
- [ ] Every service set in the database is reachable, switchable and editable from Home, with the choice surviving a restart
- [ ] The camera feature is named for what it does and offers only modes that can actually carry a camera
- [ ] Shipped as `v1.4.0` through the existing tag-push pipeline

## Out of Scope

| Item | Reason |
|------|--------|
| Renaming the `web_view` item type, the `webviewConfig` field or the `webview.*` command names | Persisted in `set_items.item_type` rows and the IPC contract; churn with zero operator-visible gain. **User-facing labels only.** |
| Including `song_plays` in the backup archive | Real gap (a Replace restore drops the CCLI ledger) but a separate data-model decision; logged as a follow-up, not fixed here |
| Restoring from an unzipped backup *folder* | The picker takes a `.tlz` archive; folder restore is a new feature, not a fix |
| Set duplication, templates, per-set service dates in the picker | Not requested; the picker covers switch / create / rename / delete |
| Presenting more than one set, or queueing sets | Not requested; one set is live at a time as today |
| Per-countdown font family or colour | Only size control was requested |
| Camera resolution / transcoding control | Already analysed and rejected in D-56 (F-1..F-8): MediaMTX remuxes, does not transcode |
| Keeping RTMP/SRT/Multicast behind an "advanced" disclosure | Rejected by the operator (GA-4); dead code and dead tests are the cost |

---

## User Stories

### 17A — Countdown identity

#### P1: Name my own countdown ⭐ MVP

**User Story**: As the operator, I want to name a countdown item myself so the set reads "Pré-culto" instead of a duration that is not even the duration it has.

**Why P1**: The name is wrong on screen at every service (RC-1's `"10min"` literal is shown for any countdown whose duration is unset).

**Acceptance Criteria**:

1. WHEN a countdown item has no name THEN the system SHALL label it with the localized default ("Cronômetro" / "Countdown") and SHALL NOT append any duration, time or `"10min"` literal
2. WHEN the operator types a name in the countdown configuration modal THEN the system SHALL persist it on `CountdownConfig.name` and SHALL use it in the set builder, the operator item list, the strophes-grid header and the launch modal
3. WHEN the operator clears the name THEN the system SHALL fall back to the localized default
4. WHEN a countdown config saved before this phase is loaded THEN the system SHALL deserialize it with `name = None` and SHALL NOT fail
5. WHEN any countdown label is rendered THEN the system SHALL source it from i18n in both locales — no hardcoded Portuguese

**Independent Test**: Add a countdown with no duration set → reads "Cronômetro", not "Contagem — 10min". Rename it to "Pré-culto" → every surface shows "Pré-culto". Clear it → back to "Cronômetro".

---

### 17B — Countdown sizing

#### P1: Size the message and the digits independently ⭐ MVP

**User Story**: As the operator, I want separate size controls for the countdown message and the digits, because the current proportion is right for some services and wrong for others.

**Why P1**: Explicitly requested; today both sizes are compile-time constants (RC-2).

**Acceptance Criteria**:

1. WHEN the countdown configuration modal is open THEN the system SHALL offer two independent size controls — message and digits — each expressed as a percentage with 100% as the default
2. WHEN both scales are 100% THEN the rendered output SHALL be identical to the current `clamp(0.75rem, 3cqmin, 2rem)` / `clamp(2rem, 30cqmin, 18rem)` rendering
3. WHEN a scale is set to N% THEN the system SHALL multiply **all three terms** of that element's clamp by N/100, so the container-relative behaviour and the small-preview scaling survive
4. WHEN a scale is outside 50–300% (hand-edited config, future format) THEN the system SHALL clamp it into range rather than reject the config
5. WHEN a countdown config saved before this phase is loaded THEN both scales SHALL default to 100%
6. WHEN the countdown runs as a **takeover** THEN the wall and the operator live preview SHALL both honour the item's scales — mirrored through `CountdownState` the same way `position` and `background_media_id` already are
7. WHEN a countdown takeover is previewed THEN the live preview SHALL use the mirrored `position` instead of hardcoded `center` (RC-11)
8. WHEN a scheduled countdown is re-armed silently at launch THEN it SHALL carry the same appearance as one armed from the configuration modal — position, background and both scales (RC-12)

**Independent Test**: Set message 150% / digits 80% on one countdown and leave a second at 100%. Project each: the first shows a large message over small digits, the second is pixel-identical to `v1.3.0`. Arm the first as a scheduled takeover over a live song — the wall and the preview agree, in size and in position.

---

### 17C — Restore integrity

#### P1: "Replace everything" restore actually works ⭐ MVP

**User Story**: As the operator restoring a backup onto a working install, I want "replace everything" to complete, so I am not forced into "mix" mode and left with duplicates.

**Why P1**: Data-loss class. Today it fails on every install that has presented a set, and fails after the media directory is already gone (RC-3, RC-5).

**Acceptance Criteria**:

1. WHEN a Replace restore runs on a library whose `song_plays` ledger is non-empty THEN the wipe SHALL succeed — `song_plays` SHALL be deleted first, ahead of `set_items`/`sets`/`songs`
2. WHEN the wipe runs THEN it SHALL cover every table the restore repopulates, in FK-safe order, and SHALL leave no orphan rows that block a subsequent restore
3. WHEN a Replace restore is requested THEN the system SHALL complete the database wipe **before** deleting any media file, so a failing wipe leaves the library and its files consistent
4. WHEN any stage of a Replace restore fails THEN the system SHALL NOT leave a `.restore_in_progress` flag behind for a failure that changed nothing on disk
5. WHEN `abort_restore` runs on a library with presentation history THEN it SHALL succeed (same wipe path as AC-1)
6. WHEN a restore or abort fails THEN the operator SHALL see a localized message naming the failure and its detail — never `[object Object]`, never a bare error code
7. WHEN a `backup.*` error code is raised THEN it SHALL have an entry in **both** locales, guarded by the existing locale-parity test

**Independent Test**: Seed a library, present a set (writing `song_plays`), export a `.tlz`, then restore it with "replace everything" → completes, and the summary counts match the manifest. Force a failure (e.g. a corrupt archive) → media files and songs are still present, no flag file, and the message says what happened.

---

### 17D — Sets on Home

#### P1: Switch between sets from Home ⭐ MVP

**User Story**: As the operator, I want to pick which service set Home is editing, because I keep more than one (Sunday, prayer meeting, rehearsal) and today I can only ever reach the most recently updated one.

**Why P1**: The capability exists in the database and is unreachable (RC-6).

**Acceptance Criteria**:

1. WHEN Home is shown THEN the system SHALL display a set picker in its header, naming the active set and listing every set with its item count
2. WHEN the operator picks another set THEN Home SHALL edit that set — add, reorder, edit, remove items exactly as it does today — with no reload and no loss of the other set's contents
3. WHEN a set is selected THEN the choice SHALL be persisted and SHALL still be active after an app restart
4. WHEN the persisted set no longer exists (deleted, or replaced by a restore) THEN the system SHALL fall back to the most-recently-updated set, creating the default set only when none exists
5. WHEN "Apresentar" is pressed THEN it SHALL present the **selected** set
6. WHEN the app is presenting THEN the picker SHALL be disabled, consistent with the existing nav lock
7. WHEN the picker's create action is used THEN the system SHALL create a named set and make it active
8. WHEN the picker's rename action is used THEN `update_set` SHALL persist the new name and every surface SHALL reflect it without a restart
9. WHEN the picker's delete action is used THEN the system SHALL confirm first, naming the set, and SHALL make another set active afterwards
10. WHEN a set that has been presented is deleted THEN the deletion SHALL succeed — its `song_plays` rows SHALL be removed with it in one transaction — and the confirmation SHALL state how many presentation records go with it (RC-7)
11. WHEN the sets picker ships THEN the unreachable `sets` / `set-builder` views SHALL be removed and their back-navigation targets repointed to Home, leaving exactly one way to manage sets

**Independent Test**: Create "Ensaio" from the picker, add two songs, switch to "Culto Dominical" → its own items are intact; switch back → "Ensaio" still has its two. Restart the app → "Ensaio" is still active. Present it, stop, then delete it → confirmation names it and its play records, deletion succeeds, another set becomes active.

---

### 17E — Camera

#### P1: The feature is called Camera and offers only camera protocols ⭐ MVP

**User Story**: As the operator, I want this feature named for what it does — projecting the camera live — and stripped to the connection types a camera actually speaks, so setting one up is not an exercise in elimination.

**Why P1**: Requested directly; three modes cannot work with a camera as built (RC-9).

**Acceptance Criteria**:

1. WHEN the operator adds or views this item type THEN every label SHALL read as a camera feature ("Câmera" / "Camera") instead of "WebView", in both locales
2. WHEN the mode is chosen THEN exactly three SHALL be offered: **RTSP** (camera standard), **MJPEG** (older cameras), and **Página web / Web page** (the iframe mode)
3. WHEN the item type is persisted THEN the wire and DB identifiers (`web_view`, `webviewConfig`) SHALL be unchanged — this is a labelling and UI change only
4. WHEN RTMP, SRT and multicast are removed THEN their editor blocks, `MediaMTX` source variants, `StreamSource` kinds, config structs and i18n keys SHALL be removed with them, leaving no dead branches
5. WHEN a set item saved with a removed mode is loaded THEN the system SHALL deserialize it without error into an explicit unsupported state, SHALL flag it in the builder as needing reconfiguration, and SHALL NOT silently project a blank screen
6. WHEN such an item is reconfigured to a supported mode and saved THEN it SHALL behave as a normal camera item

#### P1: Stream profiles only where they work ⭐ MVP

**User Story**: As the operator, I like the web-page mode but do not want profile configuration on it.

**Acceptance Criteria**:

1. WHEN the mode is **Página web** THEN the profile editor SHALL NOT be shown
2. WHEN the mode is **RTSP** or **MJPEG** THEN the profile editor SHALL be shown and the selected profile's URL SHALL actually be used at render time — closing RC-10 for MJPEG
3. WHEN an item saved earlier carries profiles on a mode that no longer offers them THEN the item SHALL keep working on its own `url`, and the orphaned profiles SHALL be dropped on its next save
4. WHEN a camera item has fewer than two profiles THEN the mid-presentation profile switcher SHALL stay hidden, as today

**Independent Test**: Create a Página web item → no profile section. Switch it to RTSP → profiles appear; define "Main" and "Sub", present, switch mid-presentation → the feed follows the selected profile. Repeat on MJPEG → the image follows the profile URL too. Open a `v1.3.0` item saved as SRT → the builder flags it for reconfiguration rather than failing to load the set.

---

### 17F — Release

#### P2: Ship as v1.4.0

**Acceptance Criteria**:

1. WHEN the release is prepared THEN `scripts/bump-version.mjs` SHALL write `1.4.0` to all five version sources and touch no dependency pin
2. WHEN the `v1.4.0` tag is pushed THEN the existing pipeline SHALL produce a signed draft release with a two-platform `latest.json`

---

## Edge Cases

- WHEN a countdown name is whitespace-only THEN the system SHALL treat it as empty and use the default label
- WHEN a countdown name is very long THEN every label surface SHALL truncate rather than reflow the list
- WHEN digits are scaled to 300% at a long `HH:MM:SS` format THEN the digits SHALL stay within the projection surface (the clamp upper bound scales with them, and the container query keeps the small preview proportional)
- WHEN a restore archive is valid but the media directory is missing THEN the restore SHALL recreate it rather than fail on the flag write
- WHEN a Replace restore succeeds THEN the CCLI ledger SHALL be empty afterwards (it is wiped and not carried in the archive) and this SHALL be stated in the restore summary, not discovered later
- WHEN the operator opens the set picker with exactly one set THEN create/rename SHALL still be available and delete SHALL be refused with a reason (a library always has at least one set)
- WHEN two sets share a name THEN both SHALL remain distinguishable in the picker (item count and, where present, service date)
- WHEN a restore replaces the library while a set is selected THEN the active-set fallback (P17 17D AC-4) SHALL resolve to a set that exists
- WHEN a camera item's mode is unsupported and it is reached during a presentation THEN the projector SHALL show the standard camera-error surface, not an indefinite blank

---

## Requirement Traceability

| ID | Requirement | Group | Story | Status |
|----|-------------|-------|-------|--------|
| P17-01 | `CountdownConfig.name: Option<String>`, serde default, legacy JSON round-trips | 17A | P1 Name | **Done** |
| P17-02 | Countdown label = name, else localized default; no duration suffix anywhere | 17A | P1 Name | **Done** |
| P17-03 | `builder.countdownSummary` and its `"10min"` literal removed | 17A | P1 Name | **Done** |
| P17-04 | `itemMeta.itemLabel` countdown branch localized (no hardcoded pt-BR) | 17A | P1 Name | **Done** |
| P17-05 | Name field in the countdown configuration modal, persisted, empty → default | 17A | P1 Name | **Done** |
| P17-06 | `messageScale` / `digitsScale` on `CountdownConfig`, percent, default 100, clamped 50–300 | 17B | P1 Size | **Done** |
| P17-07 | Renderer multiplies all three clamp terms by the scale; 100% is byte-identical to `v1.3.0` | 17B | P1 Size | **Done** |
| P17-08 | Two size controls in the configuration modal with a reset to 100% | 17B | P1 Size | **Done** |
| P17-09 | Scales mirrored into `CountdownState` for the takeover path (wall + live preview) | 17B | P1 Size | **Done** |
| P17-10 | Live preview takeover honours the mirrored `position` instead of hardcoded `center` | 17B | P1 Size | **Done** |
| P17-11 | `wipe_db` deletes `song_plays` first; full FK-safe coverage of repopulated tables | 17C | P1 Restore | **Done** |
| P17-12 | Regression test: Replace restore over a library with a non-empty play ledger | 17C | P1 Restore | **Done** |
| P17-13 | DB wipe completes before any media file is deleted | 17C | P1 Restore | **Done** |
| P17-14 | No `.restore_in_progress` flag left behind by a failure that changed nothing | 17C | P1 Restore | **Done** |
| P17-15 | `abort_restore` succeeds on a library with presentation history | 17C | P1 Restore | **Done** |
| P17-16 | Backup/restore errors formatted through the shared error formatter — no `[object Object]` | 17C | P1 Restore | **Done** |
| P17-17 | `backup.*` error codes present in both locales, parity-guarded | 17C | P1 Restore | **Done** |
| P17-18 | Restore summary states that the presentation/CCLI ledger was cleared | 17C | P1 Restore | **Done** |
| P17-19 | Set picker in the Home header: active set + list with item counts | 17D | P1 Sets | **Done** |
| P17-20 | Selecting a set repoints the Home builder with no reload | 17D | P1 Sets | **Done** |
| P17-21 | Active set persisted in settings and restored at launch | 17D | P1 Sets | **Done** |
| P17-22 | Missing/deleted active set falls back to most-recently-updated, else creates the default | 17D | P1 Sets | **Done** |
| P17-23 | "Apresentar" presents the selected set | 17D | P1 Sets | **Done** |
| P17-24 | Picker disabled while presenting, consistent with the nav lock | 17D | P1 Sets | **Done** |
| P17-25 | Create / rename from the picker, live across surfaces | 17D | P1 Sets | **Done** |
| P17-26 | Delete with confirmation; `song_plays` for that set removed in the same transaction; count stated in the confirmation | 17D | P1 Sets | **Done** |
| P17-27 | Unreachable `sets` / `set-builder` views removed, back-navigation repointed to Home | 17D | P1 Sets | **Done** |
| P17-28 | "WebView" → "Câmera"/"Camera" across every operator-facing label, both locales | 17E | P1 Camera | **Done** |
| P17-29 | Mode set reduced to `rtsp` / `mjpeg` / `iframe` (Página web) | 17E | P1 Camera | **Done** |
| P17-30 | Wire and DB identifiers (`web_view`, `webviewConfig`) unchanged | 17E | P1 Camera | **Done** |
| P17-31 | RTMP/SRT/multicast editor blocks, MediaMTX sources, `StreamSource` kinds, configs and i18n removed | 17E | P1 Camera | **Done** |
| P17-32 | Legacy removed-mode items deserialize into an explicit unsupported state, flagged for reconfiguration | 17E | P1 Camera | **Done** |
| P17-33 | Profile editor hidden for Página web | 17E | P1 Profiles | **Done** |
| P17-34 | Profile selection honoured at render time for MJPEG as well as RTSP | 17E | P1 Profiles | **Done** |
| P17-35 | Orphaned profiles on a non-profile mode are inert and dropped on next save | 17E | P1 Profiles | **Done** |
| P17-36 | Version bumped to `1.4.0` across all five sources; `v1.4.0` tag pushed | 17F | P2 Release | **Done** |
| P17-37 | Launch-time silent re-arm carries the full countdown appearance (position, background, both scales) | 17B | P1 Size | **Done** |

**Coverage:** 37 requirements, all mapped to tasks T1–T30.

**Implemented:** 37 of 37. Groups 17A–17F all done; released as `v1.3.1`/`v1.3.2` (17C slice) and now `v1.4.0` (the remainder: 17A, 17B, 17D, 17E, 17F).
**Partial:** none.
**Not started:** none. T30 (manual verification on production hardware) remains open — see the task itself; it cannot be gated in CI.

**Note on P17-15:** `abort_restore` is fixed by construction — it calls the same `wipe_db` that T3 repaired — but no test exercises `abort_restore` itself (`commands/backup.rs` has no co-located tests). Treat it as fixed-but-unverified until the T30 manual pass.

---

## User Decisions

| # | Gray area | Decision | Date |
|---|-----------|----------|------|
| GA-1 | Countdown item name: fixed default, operator-editable, or derived from the message | **Operator-editable per item**, defaulting to the localized "Cronômetro" | 2026-09-04 |
| GA-2 | Countdown sizing scope: per item, global setting, or global default + override | **Per item**, in the countdown configuration modal; today's rendering is 100% | 2026-09-04 |
| GA-3 | Set switching: Home picker, a Sets screen, or both | **Home picker only** — the unreachable Sets screen is removed rather than revived | 2026-09-04 |
| GA-4 | Camera modes to keep | **RTSP + MJPEG + Página web**; RTMP, SRT and multicast removed outright rather than hidden | 2026-09-04 |

---

## Success Criteria

- [ ] A "replace everything" restore of a real backup onto the production install completes, with media intact and counts matching the manifest
- [ ] No backup/restore failure can present itself as `[object Object]` or as a bare error code
- [ ] The operator can keep three named sets, switch between them from Home in one click, and find the same one selected after a restart
- [ ] A countdown item carries the operator's own name, and message/digit sizes are adjustable with 100% reproducing `v1.3.0` exactly
- [ ] Configuring a camera presents three modes, all of which can carry a real camera stream
- [ ] Gate green: `cargo test`, `npx vitest run`, `npx tsc --noEmit`, `cargo clippy -D warnings`, locale-parity test
- [ ] Released as `v1.4.0` through the tag-push pipeline

---

## Follow-ups (not this phase)

- `song_plays` is not included in the backup archive, so a Replace restore silently drops the CCLI ledger. Decide whether the ledger belongs in the archive (needs a manifest schema bump) or is explicitly install-local.
- `tags` / `song_tags` are likewise unexported; `wipe_db` leaves orphan `tags` rows behind.
- `.specs/codebase/CONCERNS.md` still describes Phase 0 state and is stale enough to mislead.
