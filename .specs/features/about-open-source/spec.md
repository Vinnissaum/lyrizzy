# About Panel — Open Source & Contribute Specification

## Problem Statement

Lyrizzy is an open-source project, but nothing in the app tells users so or points
them to the repository. Contributors who might file issues, suggest features, or
send pull requests have no in-app path to the source. The Settings → About panel
already shows the product name, version, and update check — it is the natural home
for an "open source / contribute" call to action.

## Goals

- [ ] Users learn, from within the app, that Lyrizzy is open source.
- [ ] Users can reach the GitHub repository (`https://github.com/Vinnissaum/lyrizzy`)
      in one click, opening in their default system browser.
- [ ] The message and button are fully localized (en-US and pt-BR).

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature                                        | Reason                                                             |
| ---------------------------------------------- | ------------------------------------------------------------------ |
| Making the repository URL user-configurable    | There is one canonical repo; a constant is sufficient.             |
| In-app issue reporting / PR flow               | The button hands off to GitHub; no in-app GitHub integration.      |
| Copy-to-clipboard fallback for the URL         | User selected "open system browser"; failure is handled silently.  |
| License text / contributors list / changelog   | Separate concern; this feature is a single contribute CTA.         |
| Adding a new top-level Settings tab            | Content lives inside the existing About panel.                     |

---

## Assumptions & Open Questions

Every ambiguity is resolved or recorded here — nothing is left silently unclear.

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Presentation format | Blurb sentence + a distinct "Contribute on GitHub" link-button below the update controls, separated by a divider | User-selected in discovery | y |
| Link activation | Open `https://github.com/Vinnissaum/lyrizzy` in the default system browser | User-selected in discovery | y |
| Open mechanism | `@tauri-apps/plugin-opener` `openUrl`, wrapped behind `src/api/commands.ts` (e.g. `openExternalUrl`) rather than called raw in the component | Matches the IPC-boundary rule in CLAUDE.md and keeps the component unit-testable via a mock | n |
| Repository URL | Hardcoded constant `https://github.com/Vinnissaum/lyrizzy` | Single canonical repo; no need for configurability | n |
| Failure behavior | If `openUrl` rejects, swallow the error — the panel stays functional, no crash, no visible error toast | User declined the copy-fallback option; a failed browser hand-off is non-critical | n |
| Button affordance | Reuse the existing bordered-button style, add an external/GitHub icon to signal it leaves the app | Visual consistency with the "Check for updates" button already in the panel | n |
| i18n keys | Add under the existing `about` namespace: `about.openSource` (blurb) and `about.contribute` (button label) | Consistent with the existing `about.version` key | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: See that Lyrizzy is open source and contribute ⭐ MVP

**User Story**: As a Lyrizzy user, I want the About panel to tell me the project is
open source and give me a one-click path to the repository, so that I can view the
source and contribute.

**Why P1**: This is the entire feature — a vertical slice delivering the message and
the working link.

**Acceptance Criteria**:

1. WHEN the About panel renders THEN the system SHALL display a localized blurb
   stating that Lyrizzy is open source and that contributions are welcome.
2. WHEN the About panel renders THEN the system SHALL display a localized button
   (labeled to contribute on GitHub) positioned below the existing update controls.
3. WHEN the user activates the contribute button THEN the system SHALL call the
   opener wrapper with exactly `https://github.com/Vinnissaum/lyrizzy`.
4. WHEN the opener call rejects THEN the system SHALL leave the panel rendered and
   functional (no thrown error, no crash) and SHALL NOT display an error message.

**Independent Test**: Render `AboutPanel`, assert the blurb text and the contribute
button are present; click the button and assert the opener wrapper was called with
the exact repo URL; make the wrapper reject and assert the panel still renders.

---

### P2: Localized in Portuguese

**User Story**: As a pt-BR user, I want the open-source message and button in
Portuguese, so that the About panel reads naturally in my language.

**Why P2**: The app ships bilingual; English-only copy would be a regression in the
pt-BR experience. Separated from P1 because P1 is demonstrable in a single locale.

**Acceptance Criteria**:

1. WHEN the locale files are loaded THEN both `en-US` and `pt-BR` SHALL define the
   `about.openSource` and `about.contribute` keys with non-empty values.
2. WHEN the `en-US` and `pt-BR` `about` namespaces are compared THEN they SHALL have
   the identical set of keys (no missing or extra key in either locale).

**Independent Test**: The existing `locales.test.ts` key-parity check passes with the
new keys present in both files.

---

## Edge Cases

- WHEN `openUrl` throws or rejects (browser unavailable, plugin error) THEN the
  system SHALL catch it and keep the panel functional (per P1-04).
- WHEN a translation key is missing in one locale THEN the locale parity test SHALL
  fail (per P2-02), catching the gap before ship.

---

## Requirement Traceability

| Requirement ID | Story                        | Phase | Status  |
| -------------- | ---------------------------- | ----- | ------- |
| ABOUT-01       | P1: blurb renders            | Execute | ✅ Verified |
| ABOUT-02       | P1: contribute button renders| Execute | ✅ Verified |
| ABOUT-03       | P1: opens exact repo URL     | Execute | ✅ Verified |
| ABOUT-04       | P1: reject handled gracefully| Execute | ✅ Verified |
| ABOUT-05       | P2: both locales define keys | Execute | ✅ Verified |
| ABOUT-06       | P2: locale key parity        | Execute | ✅ Verified |

**ID format:** `ABOUT-[NUMBER]`

**Status values:** Pending → Implementing → Verified

**Coverage:** 6 total, 0 mapped to tasks (Tasks phase skipped — Medium scope, steps
inline in Execute), 6 to be verified.

---

## Success Criteria

- [ ] Opening Settings → About shows the open-source blurb and a contribute button.
- [ ] Clicking the button opens `https://github.com/Vinnissaum/lyrizzy` in the
      default browser on real hardware.
- [ ] Both locales render the content in their language; locale parity test passes.
- [ ] All AboutPanel tests (existing + new) pass; no regression to the update-check UI.
