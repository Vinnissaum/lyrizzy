# Multiple Screens

Lyrizzy can drive **one or two** projection screens, plus your operator screen.
This page explains the display setup, choosing monitors, the two-screen workflow,
and mirroring.

- [One screen (default)](#one-screen-default)
- [Connecting your displays](#connecting-your-displays)
- [Choosing which monitor each screen uses](#choosing-which-monitor-each-screen-uses)
- [Two screens (multi-output)](#two-screens-multi-output)
- [Simultânea — mirroring both screens](#simultânea--mirroring-both-screens)
- [Troubleshooting](#troubleshooting)

---

## One screen (default)

Out of the box, Lyrizzy uses your operator screen plus a single presentation
screen (the projector/TV). When you start presenting, a fullscreen window opens
on the presentation display. Nothing extra to configure beyond picking the right
monitor.

If you only have **one** physical display, the presentation window opens on top of
the operator window (pinned on top) so you can still test and operate.

---

## Connecting your displays

For a live service you want the operator UI on one screen and the audience content
on another:

1. Connect both displays to the computer.
2. In your OS display settings, set the arrangement to **Extend**
   (**not** Mirror / Duplicate).
   - Windows: press `Win + P` → **Extend**.
   - Mirroring would show the operator UI to the audience — the opposite of what
     you want.
3. Make the **operator's** screen the **primary** display. Lyrizzy auto-targets the
   first *non-primary* monitor for the presentation, so this makes the projector
   the presentation target.

For **two** projection screens (e.g. a main projector and a side TV), connect all
three displays (operator + two outputs) and keep the operator screen primary.

---

## Choosing which monitor each screen uses

Open **Settings → General → Presentation monitor**.

- **— Auto —** (default) picks the first extended monitor automatically. It never
  targets the **main screen** (the one the operator window is on — on a laptop,
  usually the built-in panel), and with two outputs enabled it places them on two
  *different* monitors so they never collide.
- Or choose a specific monitor from the list (shown by name and resolution). The
  main screen is tagged as such in the list.

The section shows how many screens are currently detected. Lyrizzy re-detects
while Settings is open, so a TV connected — or woken — after launch shows up on
its own within a few seconds; **Detect again** forces an immediate re-scan.

If a screen you had chosen is no longer connected, the picker says so and falls
back to Auto until you pick again.

When multi-output is on you get two pickers: **Screen 1 monitor** and **Screen 2
monitor**. Set each to the correct physical display.

> **Tip:** auto-detection depends on the OS, desktop, and GPU driver, and monitor
> ordering can vary. If a screen opens on the wrong display, set it explicitly
> here. This is the reliable fallback, especially on Linux/Wayland.

---

## Two screens (multi-output)

To run two independent projection screens:

1. Go to **Settings → Projection** and turn on **Second screen (multi-output)**.
2. Go to **Settings → General** and set the **Screen 1 monitor** and **Screen 2
   monitor** to the correct displays.

Once enabled, the operator gains a screen switcher above the presentation
controls with two tabs: **Tela 1** (Screen 1) and **Tela 2** (Screen 2).

- Click **Tela 1** or **Tela 2** to choose which screen your controls drive right
  now. The 3-pane operator view (Set · Strophes · Live) follows the focused
  screen.
- Each screen can run a **different service set** at the same time — for example,
  lyrics on the main projector (Tela 1) and a live camera on a side TV (Tela 2).
- You'll be prompted to choose a set for each screen the first time you present on
  it.

A common setup is **Tela 1 = lyrics** and **Tela 2 = the camera feed** (see
[Camera & Audio](camera.md)).

---

## Simultânea — mirroring both screens

When you want **both** projection screens to show the **same** thing, turn on
**Simultânea** (the mirror toggle next to the Tela 1 / Tela 2 tabs).

- Engaging Simultânea copies the currently focused screen's content onto the
  other screen and presents on **all** screens.
- While mirror is on, the per-screen tabs are hidden — you drive a single set and
  both screens render it identically.
- Turn it off to go back to driving each screen independently.

Use Simultânea when, say, the same lyrics should appear on the main projector and
a foyer TV at once.

---

## Troubleshooting

| Problem | Fix |
| --- | --- |
| A display you just connected isn't in the list | Open *Settings → General* — it re-detects every few seconds; **Detect again** forces a re-scan. |
| Only some of your displays are listed | The OS must see them as separate **extended** displays; duplicated/mirrored screens count as one. |
| Presentation opens on the wrong screen | Set the monitor explicitly in *Settings → General* instead of Auto. |
| Both screens show the operator UI | Your displays are set to **Mirror**; switch the OS to **Extend**. |
| Second screen tabs don't appear | Enable **Second screen (multi-output)** in *Settings → Projection*. |
| Presentation window opens over the operator | You only have one physical display connected — that's expected single-screen behavior. |

> **Note:** the dual-monitor presentation window **cannot** be validated under WSL
> / Remote–WSL — it runs over a virtual display bridge. Always test on the real
> machine with real monitors. See [`docs/installation.md §0`](../installation.md).

---

**Next:** [External Apps →](external-apps.md)
