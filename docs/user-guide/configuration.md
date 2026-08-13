# Configuration

All of Lyrizzy's preferences live in the **Settings** screen (gear icon). Changes
save automatically and apply immediately — including live on the presentation
screen, so you can tweak font size or position while content is showing.

Settings are organized into tabs:

- [General](#general) — language, theme, and which monitor each screen uses
- [Projection](#projection) — how song lyrics look on the screen
- [Announcement](#announcement) — how on-screen announcements (avisos) look
- [Shortcuts](#shortcuts) — keyboard shortcuts
- [Reports](#reports) — CCLI usage report
- [About](#about) — version and update check

---

## General

### Language
Switch the interface between **Português (Brasil)** and **English**. Takes effect
immediately.

### Theme
The look of the **operator** window (not the audience screen):

- **Light** — bright UI
- **Dark** — dark UI (default)
- **Black** — fully black UI, useful in a darkened booth

### Presentation monitor
Chooses which physical display the presentation window opens on.

- **— Auto —** picks the first extended monitor automatically, never the main
  screen you operate on.
- Or pick a specific monitor by name and resolution (the main screen is tagged).

The detected-screen count and a **Detect again** button sit above the pickers:
the list refreshes on its own while Settings is open, so displays connected after
launch appear without restarting Lyrizzy.

If you run two projection screens, a second picker (**Screen 2 monitor**) appears
here once you enable multi-output. See [Multiple Screens](screens.md) for the
full walkthrough. Use the manual picker if auto-detection lands on the wrong
display — this is the reliable fallback on Linux/Wayland.

---

## Projection

Controls how **song lyrics** are rendered on the presentation screen. These are
global defaults; individual songs can override some of them.

| Setting | What it does |
| --- | --- |
| **Song text size** | Overall lyric size — Small, Medium, Large, Huge, Giant. |
| **Font** | Default, Serif, or Monospace. |
| **Line spacing** | Tight, Normal, Relaxed, or Loose. |
| **Bold level** | Normal, Medium, Semibold, or Bold. |
| **Theme (default background)** | Black background (white text) or White background (black text). |
| **Screen position** | Where text sits on screen — a 3×3 grid (top-left … center … bottom-right). |
| **Margin** | Empty space around the text — None, Small, Medium, Large, Max. |
| **Repetitions** | How repeated sections are shown: **Repeat slides** (duplicate them) or **Show (Nx)** (annotate with a repeat count). |
| **Title slide (title + author)** | Show an opening slide with the song title and author. |
| **Author in parentheses** | Render the author in parentheses on the title slide. |
| **Black slide after each song** | Automatically insert a blackout slide after the last slide of every song, so the screen goes black between songs. |
| **Second screen (multi-output)** | Turn on a second independent projection screen. When enabled, the per-screen **camera + microphone audio** controls appear below it. See [Multiple Screens](screens.md) and [Camera & Audio](camera.md). |

---

## Announcement

On-screen **announcements** (avisos) are short text messages you can push to the
audience screen independently of songs. This tab styles them with the same
controls as Projection:

- **Font**, **Song text size**, **Line spacing**, **Bold level**
- **Theme (default background)** — black or white background
- **Screen position** — the same 3×3 grid
- **Warning margin** — empty space around the announcement text

These settings are separate from the song settings, so an announcement can look
different from your lyrics.

---

## Shortcuts

Lists the keyboard shortcuts that drive the presentation (next/previous slide,
blackout, stop, etc.) and lets you rebind them. Handy when you operate with a
keyboard or a presentation remote.

---

## Reports

Generates a **CCLI usage report** — a list of songs presented over a period,
which churches use for copyright reporting. Pick a date range and export.

---

## About

Shows the installed version and lets you **check for updates**. If an update is
available, Lyrizzy can download and install it (see
[`docs/release.md`](../release.md) for how the updater is configured).

---

**Next:** [Multiple Screens →](screens.md)
