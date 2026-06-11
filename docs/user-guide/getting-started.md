# Getting Started

Lyrizzy is the app you run on the computer that drives the projector or TV during
a service. This page covers the first launch and the one-time setup.

> Looking for installation/build instructions? See
> [`docs/installation.md`](../installation.md). This page assumes the app is
> already installed.

---

## 1. Launch the app

When Lyrizzy opens you get the **operator window** — the full control panel with
your song library, service sets, and the presentation controls. This window
always stays on the computer you operate from; the audience never sees it.

The screen the audience sees (lyrics, media, camera, etc.) is a **separate
presentation window** that opens on the projector/TV when you start presenting.

## 2. Connect your screens

For a live service you normally have **two displays**:

- the **operator** screen (your laptop or desk monitor), and
- the **presentation** screen (the projector or TV).

Set your operating system's display arrangement to **Extend** (not Mirror /
Duplicate), and make the operator's screen the **primary** display. Full
instructions — including running *two* projection screens — are in
[Multiple Screens](screens.md).

You can also run Lyrizzy on a single screen; the presentation window then opens
on top of the operator window.

## 3. Install the helper apps you need

Some features call out to small external programs. Install only the ones you use:

| If you want to… | Install |
| --- | --- |
| Import PowerPoint (`.pptx`) or PDF slides | **LibreOffice** |
| Use video backgrounds / video media | **FFmpeg** (+ GStreamer on Linux) |
| Show a live camera over RTMP / RTSP / SRT / multicast | **MediaMTX** |

See [External Apps](external-apps.md) for download links and per-platform setup.
If a required app is missing, Lyrizzy shows a banner telling you so — it won't
crash.

## 4. Set your preferences

Open **Settings** (gear icon) and set, at minimum:

- **Language** and **Theme** (General tab)
- **Song appearance** — font, size, position, background (Projection tab)
- **Second screen** if you run two projection screens (Projection tab)

Every option is explained in [Configuration](configuration.md). Settings are
saved automatically and remembered the next time you open the app.

## 5. Where your data lives

Your songs, service sets, imported media, and settings are stored per-user on the
machine:

| OS | Folder |
| --- | --- |
| Windows | `%APPDATA%\com.igreja-trindade.trinity-lyrics\` |
| Linux | `~/.local/share/com.igreja-trindade.trinity-lyrics/` |
| macOS | `~/Library/Application Support/com.igreja-trindade.trinity-lyrics/` |

Back up this folder to preserve everything. Lyrizzy also has a built-in
**Backup** screen for exporting and restoring your library.

---

**Next:** [Configuration →](configuration.md)
