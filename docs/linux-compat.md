# Linux Cross-Platform Compatibility

Trinity Lyrics v2 is a Tauri 2.x app. The same codebase targets Windows, macOS, and
Linux, but the WebView engine and external tooling differ per platform. This document
lists the Linux-specific risks and what has been done about them.

> **The single biggest difference:** on Windows the WebView is **WebView2 (Chromium)**;
> on Linux it is **WebKitGTK**. They do **not** share the same media codecs.

## 1. Build prerequisites (Linux)

Tauri does not pull these in via Cargo — install them with the system package manager.

**Debian / Ubuntu**
```bash
sudo apt install -y \
  libwebkit2gtk-4.1-dev build-essential curl wget file \
  libxdo-dev libssl-dev libayatana-appindicator3-dev librsvg2-dev libgtk-3-dev
```

**Runtime tools** (resolved from `PATH`, overridable via env vars):
```bash
sudo apt install -y libreoffice ffmpeg \
  gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
```

| Tool | Used for | Env override |
| --- | --- | --- |
| `libreoffice` / `soffice` | PPTX/PDF → PNG slide conversion | `SOFFICE_PATH` |
| `ffprobe` | video metadata on import | `FFPROBE_PATH` |
| `ffmpeg` | video thumbnail generation | `FFMPEG_PATH` |

## 2. Video / background codecs (highest risk)

`MediaSlideRenderer.tsx` and `SongBackground.tsx` play video in an HTML `<video>` element.

- **Windows (WebView2):** H.264 MP4 and WebM play natively.
- **Linux (WebKitGTK):** playback goes through **GStreamer**. H.264 MP4 only plays if
  `gstreamer1.0-libav` (and the good/bad plugin sets) are installed. Without them the
  video silently shows black.

**Recommendation:** on Linux, install the GStreamer plugins above, and **prefer WebM
(VP8/VP9)** background media for portability. Importing MKV/AVI is already rejected at
import time on all platforms.

## 3. LibreOffice binary resolution — fixed

`src-tauri/src/services/libreoffice.rs` previously only looked for `soffice.exe`
(bundled) and `soffice` on `PATH`. It now:
- uses the extension-less `soffice` name for the bundled binary on non-Windows
  (`BUNDLED_SOFFICE_BIN`), and
- falls back to probing **`libreoffice`** on `PATH` after `soffice`, since Debian/Ubuntu
  often ship only `libreoffice`.

`SOFFICE_PATH` still overrides everything.

## 4. Database & file paths — OK

`src-tauri/src/db/mod.rs` resolves the data dir via `app_data_dir()`, which is already
platform-correct (`~/.local/share/TrinityLyrics/` on Linux). The doc comment was
corrected to reflect all three platforms. No code change needed.

## 5. asset:// protocol — verify on hardware

`src-tauri/src/protocol/asset.rs` serves media via the Tauri-normalized
`http://asset.localhost/media/...` scheme. Tauri/Wry abstracts this across WebView2 and
WebKitGTK, but it has not been exercised on Linux. **Verify** images and videos load in
the presentation window on a real Linux session. Path-traversal validation is
platform-independent and already in place.

> **Note:** WSL/WSLg cannot validate the dual-monitor presentation window — it runs
> over a Wayland→RDP bridge with virtual displays. See `docs/installation.md §0`.

## 6. Monitor ordering — test on real dual-monitor hardware

`src-tauri/src/commands/window.rs` picks the secondary monitor by comparing positions
against the primary. `available_monitors()` ordering and primary detection vary across
X11 vs Wayland, desktop environment, and GPU driver. **Always test on real two-monitor
hardware**; if auto-detection lands on the wrong screen, the operator can re-trigger
`enter_presentation` or we add an explicit monitor picker.

## 7. Bundling

`tauri.conf.json` uses `"targets": "all"` and includes `.png` icons, so `deb`/`AppImage`
(and `rpm` where tooling is present) are produced automatically by `tauri build` on Linux.

## Quick verification checklist

- [ ] `cargo test --manifest-path src-tauri/Cargo.toml` passes on Linux
- [ ] App launches via `npm run tauri dev`
- [ ] Import a PPTX with only `libreoffice` (not `soffice`) on `PATH` → slides generated
- [ ] Play a WebM background in the presentation window → renders
- [ ] Play an H.264 MP4 with GStreamer plugins installed → renders (else documented gap)
- [ ] Open the presentation window on a second monitor → correct screen
- [ ] Images/videos load via asset:// in the presentation window
