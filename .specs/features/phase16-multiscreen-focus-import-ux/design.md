# Phase 16 — Design

**Spec:** `spec.md` (P16-01..P16-28)
**Scope class:** Large — five independent surfaces across Rust and TypeScript, one new component, one new pure decision module. Design is warranted because 16A changes a window-management invariant and 16E introduces a new gate in front of an existing destructive command.

---

## Architectural Position

Four of the five changes are contained; one touches an invariant.

| Group | Layer | Invariant impact |
|-------|-------|------------------|
| 16A | Rust — window lifecycle | **Changes an invariant.** "Presentation windows are topmost only on single-monitor setups" becomes "presentation windows are topmost whenever they are fullscreen". Detailed below |
| 16B | i18n resources only | None — no code paths change |
| 16C | React presentational component | None — no store or command semantics change |
| 16D | Rust pure parser | None — widens accepted input, rejects nothing it accepted before |
| 16E | React + a new pure predicate | **Adds a gate**, does not change `exit_presentation` itself. The Rust command stays exactly as destructive as it is today; the frontend stops calling it blindly |

The `AppState.presentation`-is-source-of-truth invariant is untouched: 16E only decides *whether and for which output* to invoke an existing command. No slide logic moves to the frontend (16D stays in `slide_splitter`'s sibling parser, in Rust).

---

## 16A — Presentation windows stay on top

### The invariant change

Today:

```
pin_on_top = (monitor_count == 1)
```

The rationale in the code is real but partial: on one monitor the presentation must sit above the operator window. What was missed is that on *two* monitors the presentation must sit above **everything the shell can activate** — Explorer, a browser, a notification-driven window. Windows' Alt+Tab activates a window and raises it within its z-band; a non-topmost fullscreen window has no defence against that.

New rule:

```
pin_on_top = !windowed_fallback
```

Read as: **if this window is going fullscreen, it is topmost.** The single exception is the deliberate windowed fallback (`OutputId::Two` resolving to no free monitor), which is the one case where a topmost window could trap the operator on their own screen — the existing safety reasoning at `window.rs:302-310` is preserved verbatim, now as the *only* carve-out.

`should_pin_on_top` currently takes `monitor_count`. Its input changes to the same pair `use_windowed_fallback` already takes, so the two predicates stay adjacent and jointly readable:

```rust
pub(crate) fn should_pin_on_top(output: OutputId, target_idx: Option<usize>) -> bool {
    !use_windowed_fallback(output, target_idx)
}
```

The call site moves below `target_idx` resolution (it currently sits at `window.rs:399`, just above it — a one-line reorder).

### Why the flag alone is not enough

A topmost window can still be demoted: Windows drops the topmost band for a fullscreen window in several situations (another app calling `SetForegroundWindow`, a full-screen exclusive app, display-mode changes). The flag is set once, at build time, and never re-asserted — `lib.rs:116` sees every `Focused(false)` and only logs it.

So 16A adds a second, cheap defence: **on focus loss, re-assert the pin.** That is exactly the moment another window took the foreground, which is exactly when the demotion would have happened.

```
WindowEvent::Focused(false)
        │
        ├─ label == "operator"        → log only (unchanged)
        └─ label is a presentation    → log + window.set_always_on_top(true)
```

The decision is a pure predicate so it is unit-testable without a live `AppHandle` (the handler itself is not):

```rust
pub(crate) fn should_reassert_on_top(label: &str) -> bool {
    OutputId::ALL.iter().any(|o| o.window_label() == label)
}
```

This is deliberately keyed on the label rather than on presentation *state*: a window that exists at all is one the operator opened to project on, and re-asserting on an already-topmost window is a no-op.

**Windowed-fallback interaction.** The fallback window is never pinned at build time, but `should_reassert_on_top` would pin it on focus loss — re-introducing exactly the trap P16-02 avoids. The handler therefore only re-asserts when the window reports itself fullscreen (`window.is_fullscreen()`), which is false for the fallback window and true for every real projection. That keeps the carve-out honest without threading extra state through the event handler.

**Failure handling:** `set_always_on_top` returns `Result`. A failure is logged at `warn` and swallowed, matching how `set_position` / `set_fullscreen` failures are already handled at `window.rs:452-471` — a window-management hiccup must never panic the app mid-service.

### Test strategy

`Focused(false)` cannot be synthesised in a unit test without a running WebView, so coverage is split: the predicates (`should_pin_on_top`, `should_reassert_on_top`) get exhaustive unit tests; the wiring is verified on real hardware (per the CLAUDE.md gotcha "Monitor index ordering is OS-dependent — always test on real hardware with two monitors"). The existing `should_pin_on_top_*` tests are rewritten against the new signature rather than deleted, so the single-monitor case stays pinned and provably so.

---

## 16B — "Tela preta"

Pure resource edit — three values per locale:

| Key | pt-BR | en-US |
|-----|-------|-------|
| `builder.blank` | Tela preta | Black screen |
| `builder.add.blank` | Tela preta | Black screen |
| `presentation.blankSlide` | Tela preta | Black screen |

`builder.add.blank` was "Branco" (one word, to fit the add-item button row). "Tela preta" is 10 characters against the existing row's longest entry "Apresentação" (12), so the button row does not reflow.

Keys are **not** renamed — only values. `src/tests/i18n/key-completeness.test.ts` compares key sets across locales and stays green by construction. `SongEditor`'s "Deixe uma linha em branco entre as estrofes" is a different sense of the phrase and is explicitly left alone (P16-08).

---

## 16C — Simultânea placement and colour

### Current vs. target

```
NOW, mirror OFF:   [Tela 1][Tela 2] ·································· [⧉ Simultânea]
NOW, mirror ON:    ·········································revealed··· [⧉ Simultânea]
                   ^ tabs unmounted, button alone at the far right

TARGET, mirror OFF: [Tela 1][Tela 2] [⧉ Simultânea]
TARGET, mirror ON:  [Tela 1][Tela 2] [⧉ Simultânea]
                     ^ both marked mirrored   ^ amber
```

Three edits to `OutputSwitcher.tsx`, no logic change:

1. **Unconditional tabs.** Drop the `!mirrorEnabled &&` guard so `OUTPUTS.map` always renders. The tabs keep their click handler — clicking while mirroring re-points the mirror master, which `engageMirror(focusedOutput)` already treats as meaningful (P16-12).
2. **Adjacency.** Remove `ml-auto`. The bar is already `flex items-center gap-2`, so the button lands one gap after the last tab.
3. **Distinct ON colour.** Mirror-ON uses the `warning` token family (`--app-warning: #F5A524`), which is defined for both themes and passes `check-theme-tokens.ps1` (the script bans raw `bg-blue-*`/`bg-white`-style classes, not semantic ones).

### Tab state while mirroring

With mirror ON, "focused" no longer means "the only screen being driven", so `aria-current` would be misleading. Instead:

| State | `aria-current` | `data-mirrored` | Style |
|-------|----------------|-----------------|-------|
| mirror OFF, focused | `true` | absent | `bg-primary` (unchanged) |
| mirror OFF, unfocused | `false` | absent | `bg-surface-2` (unchanged) |
| mirror ON (both tabs) | `false` | `"true"` | amber-tinted border + `bg-surface-2`, so the tabs read as "driven by the amber control" without competing with it |

`data-mirrored` is the hook the tests assert on (P16-09) and the visual cue tying the tabs to the amber button.

### Accessibility

`aria-pressed={mirrorEnabled}` on the toggle is retained — it is what actually announces the mode to a screen reader, and colour alone must not carry that meaning.

---

## 16D — Holyrics root shape

`parse` gains one branch before the loop. The normalisation is chosen so **the existing code path is byte-for-byte unchanged** for arrays:

```
raw: serde_json::Value
   │
   ├─ Value::Array(a)  → a          (unchanged; empty → EmptyArray)
   ├─ Value::Object(_) → vec![raw]  (NEW — single-song export)
   └─ anything else    → UnexpectedShape
```

Implementation shape:

```rust
let items: Vec<serde_json::Value> = match raw {
    serde_json::Value::Array(a) => {
        if a.is_empty() { return Err(HolyricsError::EmptyArray); }
        a
    }
    obj @ serde_json::Value::Object(_) => vec![obj],
    other => return Err(HolyricsError::UnexpectedShape(format!(
        "JSON root is {}, expected an array of songs or a single song object",
        json_type_name(&other)
    ))),
};
```

Notes:

- The single-object branch cannot produce an empty list, so `EmptyArray` stays exclusively an array-root outcome (P16-16).
- Taking `raw` by value avoids the `item.clone()` the current loop performs per item — a small, incidental win, not the point of the change.
- The error message now names both accepted shapes (P16-15). `HolyricsError::UnexpectedShape`'s `Display` impl at `holyrics_parser.rs:28-31` says "esperado um array de músicas" and is updated to match: "esperado um array de músicas ou uma única música".
- A malformed *object* root (right type, wrong fields) still fails per-item as `UnexpectedShape("item 0: …")`, reusing the existing message path.

No change to `commands/import.rs` — it consumes `Vec<ParsedHolyricsSong>` and is indifferent to how the vector was produced. The import review UI already handles a one-song list (it is what a one-song array yields today).

---

## 16E — Informed stop with independent screens

### Where the gate belongs

Stop has two entry points that must not diverge (P16-24):

```
OperatorPresentationLayout.handleStop()  ─┐
                                          ├─→ [ gate ] ─→ exitPresentation(...)
OperatorApp.handleExit()  (Esc + rebind) ─┘
```

The overlay branch stays *in front* of the gate (P16-25) — clearing an overlay is not stopping, so it must never raise the chooser:

```
handleExit / handleStop
   │
   ├─ overlay active?  ──yes──→ clearOverlay + fanOutToMirror   (unchanged, returns)
   │
   └─ needsStopChoice(multiScreen, mirror, presenting)?
         ├─ false ──→ exitPresentation(focused) + fanOutToMirror  (unchanged)
         └─ true  ──→ open StopPresentationModal
                          ├─ pick screen  → exitPresentation(chosen)
                          ├─ Parar todas  → exitPresentation(o) for each presenting o
                          └─ Cancel / Esc → nothing
```

### The predicate

New in `utils/outputDispatch.ts`, beside the existing pure helpers (`targetsForFocused`, `mirrorTargets`, `resolveLaunchPlan`), which is where this file's tested decision logic already lives:

```ts
export function needsStopChoice(
  multiScreenEnabled: boolean,
  mirrorEnabled: boolean,
  presentingOutputs: ReadonlySet<OutputId>,
): boolean {
  return multiScreenEnabled && !mirrorEnabled && presentingOutputs.size > 1;
}
```

Each clause maps to a spec line: multi-screen off → nothing to choose between; mirror on → Stop legitimately means "both", which is already what `fanOutToMirror` does; one output presenting → no ambiguity (P16-17, P16-18).

### Sharing state between the two entry points

`presentingOutputs` lives in `OperatorApp` (`useState` + a ref, `OperatorApp.tsx:101-123`) and is already passed down to `OperatorPresentationLayout` as a prop. The keyboard handler reads it through `presentingOutputsRef` to avoid a stale closure — the same pattern the existing handler uses for `focusedOutput`.

To keep one decision path rather than two, the gate and the modal are owned by `OperatorApp`:

- `OperatorApp` holds `stopChoiceOpen: boolean` and renders `<StopPresentationModal>` when set.
- It exposes `requestStop()` — overlay check, then gate, then either stop or open the modal.
- `handleExit` (Esc / rebindable action) calls `requestStop()`.
- `OperatorPresentationLayout` receives `onRequestStop` and its `handleStop` calls it, keeping its own local concern (`setEditingSongId(null)`) alongside.

This keeps the modal at the window root — where `MultiScreenLaunchModal` already sits — rather than nested inside the presentation layout.

### The modal

New `src/components/presentation/StopPresentationModal.tsx`, modelled on `MultiScreenLaunchModal.tsx`'s shell (fixed overlay, `bg-surface rounded-xl`, header with an `X`, Esc → cancel). It is a **pure question component**: it touches no store and issues no command, exactly like `MultiScreenLaunchModal` (that file's own doc comment states the rule). The caller decides.

```
Props:
  presentingOutputs: ReadonlySet<OutputId>
  onStopOne: (output: OutputId) => void
  onStopAll: () => void
  onCancel: () => void
```

Screen names come from `outputScreenName(monitors, monitorNames, outputMonitorIndex[o], fallback)` — the same helper `OutputSwitcher` uses — so a screen the operator renamed in Settings is named the same way here (P16-20).

Copy (`presentation.stopChoice.*`), pt-BR:

| Key | Text |
|-----|------|
| `title` | Parar apresentação |
| `situation` | Você está apresentando em {{count}} telas com controle individual. |
| `warning` | Ao parar, o controle desta tela é perdido e não poderá ser retomado — só apresentando tudo novamente. |
| `question` | Qual tela deve parar? |
| `stopOne` | Parar {{screen}} |
| `stopAll` | Parar todas |
| `cancel` | Cancelar |

The warning is rendered in the `warning` token family with an alert icon, consistent with `RestoreInProgressDialog.tsx`'s treatment of an irreversible action (P16-19).

Buttons are generated by iterating `presentingOutputs` (not the static `OUTPUTS`), so a future third output needs no change here.

---

## Component Inventory

| Component | Status | Reason |
|-----------|--------|--------|
| `commands/window.rs::should_pin_on_top` | Modified (signature) | 16A |
| `commands/window.rs::should_reassert_on_top` | **New** (pure) | P16-04 |
| `lib.rs` `Focused(false)` arm | Modified | P16-03 |
| `services/holyrics_parser.rs::parse` | Modified | 16D |
| `i18n/locales/*.json` | Modified | 16B, 16E copy |
| `OutputSwitcher.tsx` | Modified | 16C |
| `utils/outputDispatch.ts::needsStopChoice` | **New** (pure) | P16-17 |
| `StopPresentationModal.tsx` | **New** | 16E |
| `OperatorApp.tsx` | Modified | Gate owner, modal host |
| `OperatorPresentationLayout.tsx` | Modified | Delegates stop to the gate |

## Reuse

Nothing here introduces a new pattern. Each new piece has a precedent in the codebase it copies:

| New thing | Reuses |
|-----------|--------|
| `StopPresentationModal` | `MultiScreenLaunchModal` (shell, Esc handling, pure-question contract) |
| Irreversible-action styling | `RestoreInProgressDialog` (warning token + icon) |
| `needsStopChoice` | `resolveLaunchPlan` (pure decision fn in `outputDispatch.ts`, unit-tested) |
| `should_reassert_on_top` | `should_close_presentation_on_destroy` (label predicate in `window.rs`) |
| Screen naming in the modal | `outputScreenName` via `OutputSwitcher`'s `labelFor` |

## Risks

| Risk | Mitigation |
|------|-----------|
| Topmost presentation windows make the app hard to escape on a single monitor | Unchanged from today — single-monitor was *already* pinned. The operator's existing exits (Esc, the rebindable action) still work, and `should_close_presentation_on_destroy` still tears the windows down with the operator window |
| Re-asserting on focus loss pins the windowed fallback and traps the operator | Guarded by `window.is_fullscreen()`; the fallback window is not fullscreen by construction |
| A focus-loss storm causes repeated `set_always_on_top` calls | The call is a cheap `SetWindowPos` and idempotent; `Focused(false)` fires on transitions, not continuously |
| 16A cannot be unit-tested end to end | Predicates fully covered; wiring verified on two-monitor hardware per the project's standing gotcha |
| The stop modal appears where the operator expects instant Stop | Strictly narrower than today's silent behaviour: it only triggers in the ambiguous case (P16-17), and Cancel is always available |

## Verification Beyond Unit Tests

16A and 16E are the two that need eyes on real hardware:

1. **P16-01/03** — present on two monitors, open Explorer, Alt+Tab to it: both projections stay in front. Repeat after switching virtual desktops.
2. **P16-02** — enable multi-screen with a single display, launch output Two: the fallback window remains a normal, reachable window.
3. **P16-17/21** — two monitors, mirror OFF, both presenting: Stop raises the modal; stopping Tela 2 leaves Tela 1 live and controllable.
4. **P16-18** — same setup with mirror ON: Stop ends both with no prompt.
