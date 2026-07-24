# About Panel — Open Source & Contribute Validation

**Date**: 2026-07-24
**Spec**: `.specs/features/about-open-source/spec.md`
**Diff range**: `903984d..bbc908f` (3 feature commits: c87166c, d6a1593, bbc908f)
**Verifier**: standalone fresh-eyes pass (sub-agent spawning not authorized this session; skill's standalone fallback used)

---

## Task Completion

| Task | Status  | Notes                                              |
| ---- | ------- | -------------------------------------------------- |
| T1   | ✅ Done | i18n keys + non-empty locale test                  |
| T2   | ✅ Done | `openExternalUrl` wrapper behind commands.ts       |
| T3   | ✅ Done | Blurb + contribute link; icon changed to ExternalLink (lucide dropped brand icons) |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion | Result |
| --------- | -------------------- | ----------------------- | ------ |
| ABOUT-01 WHEN panel renders THEN show open-source blurb | localized blurb text present | `AboutPanel.test.tsx:118` — `expect(screen.getByText("about.openSource")).toBeInTheDocument()` | ✅ PASS |
| ABOUT-02 WHEN panel renders THEN show contribute control | localized contribute link present | `AboutPanel.test.tsx:125` — `expect(screen.getByRole("link", { name: /about\.contribute/ })).toBeInTheDocument()` | ✅ PASS |
| ABOUT-03 WHEN activated THEN open exact repo URL | `https://github.com/Vinnissaum/lyrizzy` | `AboutPanel.test.tsx:134` — `expect(openExternalUrl).toHaveBeenCalledWith("https://github.com/Vinnissaum/lyrizzy")` | ✅ PASS |
| ABOUT-04 WHEN opener rejects THEN panel functional, no error UI | blurb still present AND no `.text-danger` | `AboutPanel.test.tsx:145-147` — `getByText("about.openSource")` present + `expect(container.querySelector(".text-danger")).toBeNull()` | ✅ PASS |
| ABOUT-05 both locales define keys non-empty | non-empty `about.openSource` + `about.contribute` in en/pt | `locales.test.ts:54-58` — `expect(enObj.about[key]).toBeTruthy()` / `expect(ptObj.about[key]).toBeTruthy()` | ✅ PASS |
| ABOUT-06 en/pt about key parity | identical key sets both directions | `locales.test.ts:24-35` — `expect(problems).toEqual([])` | ✅ PASS |

**Status**: ✅ All ACs covered; asserted values match spec-defined outcomes; no spec-precision gaps.

---

## Discrimination Sensor

Scratch state: mutation applied to working tree, scoped test run, restored via `git checkout`.

| # | File:line | Mutation | Killed? |
| - | --------- | -------- | ------- |
| M1 | `AboutPanel.tsx` (REPO_URL) | `.../lyrizzy` → `.../WRONG` | ✅ Killed (ABOUT-03) |
| M2 | `AboutPanel.tsx` (blurb) | `t("about.openSource")` → `t("about.version")` | ✅ Killed (ABOUT-01) |
| M3 | `AboutPanel.tsx:90` (catch) | `.catch(() => {})` → `.catch(() => setCheckState({ error }))` | ✅ Killed (ABOUT-04) |
| M4 | `en-US.json` (contribute) | value → `""` | ✅ Killed (ABOUT-05) |

**Note on M3:** the first attempt used a non-global `perl` substitution on `.catch(() => {})`, which matched the pre-existing `getAppVersion().catch` on line 17 instead of the new opener catch — a false "SURVIVED" from a mis-targeted mutation, not a weak test. Re-run with an anchored (`openExternalUrl(REPO_URL).catch`) mutation confirmed the as-committed test kills it. A tentative act-flush test change was made and then reverted as unnecessary (the committed test already discriminates).

**Sensor depth**: lightweight (4 targeted behavior-level mutations)
**Result**: 4/4 killed — PASS ✅

---

## Code Quality

| Principle | Status |
| --------- | ------ |
| Minimum code | ✅ (thin wrapper; additive JSX block) |
| Surgical changes | ✅ (only feature files touched per commit) |
| No scope creep | ✅ |
| Matches patterns | ✅ (button/link styling mirrors existing update button; commands.ts wrapper idiom) |
| Spec-anchored outcome check | ✅ |
| Per-layer Coverage Expectation met | ✅ (component: all ACs + edge case; i18n: parity + non-empty) |
| Every test maps to a spec requirement | ✅ |
| Documented guidelines followed | ✅ `CLAUDE.md` (IPC boundary via commands.ts; `npx vitest` / `tsc --noEmit`) |

---

## Edge Cases

- [x] Opener rejects → panel functional, no error UI (ABOUT-04, M3 killed)
- [x] Missing key in one locale → parity test fails (ABOUT-06)

---

## Gate Check

- **Gate command**: `npx tsc --noEmit && npx vitest run`
- **Result**: tsc exit 0; 480 passed, 0 failed, 0 skipped (64 test files)
- **Test count before feature**: 476
- **Test count after feature**: 480
- **Delta**: +4 (ABOUT-01..04) plus 1 i18n assertion within existing file; AboutPanel 8 → 12
- **Failures**: none

---

## Requirement Traceability Update

| Requirement | Previous | New |
| ----------- | -------- | --- |
| ABOUT-01 | Pending | ✅ Verified |
| ABOUT-02 | Pending | ✅ Verified |
| ABOUT-03 | Pending | ✅ Verified |
| ABOUT-04 | Pending | ✅ Verified |
| ABOUT-05 | Pending | ✅ Verified |
| ABOUT-06 | Pending | ✅ Verified |

---

## Summary

**Overall**: ✅ Ready

**Spec-anchored check**: 6/6 ACs matched spec outcome; 0 spec-precision gaps
**Sensor**: 4/4 mutations killed
**Gate**: 480 passed, 0 failed

**What works**: About panel shows a localized open-source blurb and a "Contribute on GitHub" link that opens `https://github.com/Vinnissaum/lyrizzy` in the system browser via the opener plugin (wrapped behind commands.ts); failures are swallowed; both locales localized with parity enforced.

**Issues found**: none.

**Next steps**: Manual hardware check — click the link in a running build to confirm the system browser opens (per spec Success Criteria; not automatable in unit tests).
