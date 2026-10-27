# LESSONS - auto-maintained by scripts/lessons.py

> Machine-owned. Do NOT hand-edit. Changes are overwritten on the next `lessons.py` write.
> Canonical state lives in `.specs/lessons.json`. Edit lessons only via the script.
> promote_threshold=2 distinct features · window_days=45 · quarantine_threshold=2

## Confirmed (load these at Plan/Checks)

Corroborated across multiple features. Safe to apply as guidance.

_none_

## Candidates (under observation - do NOT load as guidance yet)

Seen once or not yet corroborated. Tracked, not trusted.

### L-001 - Test an index-shift rule at the equality boundary, inserting exactly at the tracked index, not only below it
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `presentation-splice` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: src-tauri/src/domain/presentation.rs:127 (C33) (presentation-splice)
- last seen: 2026-10-27T00:20:39Z

### L-002 - When a shared store action gains mirror fan-out, check every existing caller for a paired action that does not fan out
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `frontend-stores` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: src/stores/countdown.ts:117, src/windows/operator/OperatorApp.tsx:350 (frontend-stores)
- last seen: 2026-10-27T00:20:39Z

### L-003 - Give every path that re-resolves a clock-time countdown target an explicit rule for a time that has already passed
- signal: `ac_gap` · recurrence: 1 feature(s) · scope: `countdown` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: AC 28 (C40) (countdown)
- last seen: 2026-10-27T00:20:39Z

### L-004 - Prove a value a parent component computes at the parent, not only in the child that receives it as a prop
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `frontend-components` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: src/components/presentation/SetItemList.tsx:84 (C17) (frontend-components)
- last seen: 2026-10-27T00:20:39Z

### L-005 - When a rule matches a set of modes, give each mode in the set its own test case
- signal: `surviving_mutant` · recurrence: 1 feature(s) · scope: `countdown` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: src-tauri/src/commands/countdown.rs:507 (C32) (countdown)
- last seen: 2026-10-27T00:20:39Z

### L-006 - A claim over every control must exercise each control in its test, not a sample of them
- signal: `spec_precision_gap` · recurrence: 1 feature(s) · scope: `frontend-components` · harmful: 0
- features: phase21-live-countdown-setlist
- evidence: C13 LiveCountdownControls.test.tsx (frontend-components)
- last seen: 2026-10-27T00:20:39Z

## Quarantined (failed when applied - ignore)

A confirmed lesson that recurred alongside failure. Kept for the maintainer to review.

_none_
