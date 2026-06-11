# Lyrizzy

Church lyrics presentation app — manage a song library, build service sets, and
drive one or two projection screens (lyrics, announcements, media, countdowns,
and live camera). Built with Tauri, React, and TypeScript.

---

## User Guide

If you operate Lyrizzy during a service, start here. The guide is split into
short pages so you can jump straight to what you need:

| Page | What it covers |
| --- | --- |
| [**Getting Started**](docs/user-guide/getting-started.md) | First launch, where your data lives, and the one-time setup. |
| [**Configuration**](docs/user-guide/configuration.md) | Every setting in the **Settings** screen — language, theme, song appearance, announcements, and shortcuts. |
| [**Multiple Screens**](docs/user-guide/screens.md) | Running one or two projection screens (Tela 1 / Tela 2), choosing monitors, mirroring (Simultânea), and per-screen sets. |
| [**External Apps**](docs/user-guide/external-apps.md) | The helper programs Lyrizzy needs — **LibreOffice** (PowerPoint/PDF import), **FFmpeg** (video), **MediaMTX** (camera), and GStreamer on Linux. |
| [**Camera & Audio**](docs/user-guide/camera.md) | Showing a live camera (RTMP / RTSP / SRT / MJPEG / multicast / web page) and routing microphone and camera audio per screen. |

---

## Quick reference

- **Two screens?** Turn on **Second screen (multi-output)** in
  *Settings → Projection*, then pick the monitor for each screen in
  *Settings → General*. See [Multiple Screens](docs/user-guide/screens.md).
- **Importing PowerPoint/PDF slides?** Install **LibreOffice**. See
  [External Apps](docs/user-guide/external-apps.md).
- **Showing a camera?** Install **MediaMTX** (only needed for RTMP/RTSP/SRT/
  multicast cameras). See [Camera & Audio](docs/user-guide/camera.md).

---

## For developers / installers

- [`docs/installation.md`](docs/installation.md) — building installers and deploying to the service machine
- [`docs/linux-compat.md`](docs/linux-compat.md) — Linux build/runtime prerequisites and codec notes
- [`docs/release.md`](docs/release.md) — signing, GitHub Releases, and the auto-updater
- [`docs/TDD-v2.md`](docs/TDD-v2.md) — architecture and design

### Recommended IDE setup

- [VS Code](https://code.visualstudio.com/) + [Tauri](https://marketplace.visualstudio.com/items?itemName=tauri-apps.tauri-vscode) + [rust-analyzer](https://marketplace.visualstudio.com/items?itemName=rust-lang.rust-analyzer)
