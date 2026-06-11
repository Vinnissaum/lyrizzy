# External Apps

Lyrizzy relies on a few small external programs for specific features. They are
**not** part of the core app — install only the ones for the features you use.
If one is missing, the related feature is disabled and Lyrizzy shows a banner
telling you so; the rest of the app keeps working.

| App | Needed for | Required? |
| --- | --- | --- |
| [**LibreOffice**](#libreoffice--powerpoint--pdf-slides) | Importing PowerPoint (`.pptx`) and PDF slides | Only if you import slides |
| [**FFmpeg**](#ffmpeg--video-thumbnails--metadata) | Video thumbnails and metadata on import | Only if you use video |
| [**MediaMTX**](#mediamtx--live-camera) | Live camera over RTMP / RTSP / SRT / multicast | Only for those camera modes |
| [**GStreamer**](#gstreamer-linux-only) | Playing H.264 video on Linux | Linux + video only |

> **How Lyrizzy finds each app:** it checks, in order, (1) a copy bundled with the
> installer, (2) an environment-variable override, then (3) your system `PATH`
> and the usual install folders. So in most cases **installing the app normally is
> enough** — no configuration needed. The environment-variable override is only
> for unusual setups (a portable install, a non-standard folder, etc.).

---

## LibreOffice — PowerPoint / PDF slides

Lyrizzy converts presentation files (`.pptx`, `.pdf`, and similar) into image
slides so they can be projected. It does this by running **LibreOffice** in the
background. Without LibreOffice, slide import is unavailable.

### Install

- **Windows / macOS:** download from
  [libreoffice.org/download](https://www.libreoffice.org/download/). The default
  install is detected automatically (you don't need to add it to `PATH`).
- **Debian / Ubuntu:** `sudo apt install libreoffice`
- Other Linux: install via your package manager (the `soffice` or `libreoffice`
  command).

### How it's detected

Lyrizzy looks for it in this order:

1. A bundled copy shipped inside the app (if your installer included one).
2. The `SOFFICE_PATH` environment variable (point it at the `soffice` /
   `soffice.exe` executable).
3. `soffice`, then `libreoffice`, on your `PATH`.
4. Default install folders — e.g. `C:\Program Files\LibreOffice\program\soffice.exe`
   on Windows, `/Applications/LibreOffice.app` on macOS, `/opt/libreoffice` and
   common locations on Linux.

You only need `SOFFICE_PATH` if you installed LibreOffice somewhere unusual.

---

## FFmpeg — video thumbnails & metadata

When you import a video, Lyrizzy uses **FFmpeg** to generate a thumbnail and read
the video's metadata (duration, dimensions). If FFmpeg is missing, the video still
imports and plays — it just won't have a generated thumbnail.

### Install

- **Windows / macOS:** download from [ffmpeg.org](https://ffmpeg.org/download.html)
  and make sure `ffmpeg` is on your `PATH`.
- **Debian / Ubuntu:** `sudo apt install ffmpeg`

### Environment overrides

| Tool | Used for | Override |
| --- | --- | --- |
| `ffmpeg` | video thumbnail generation | `FFMPEG_PATH` |
| `ffprobe` | video metadata on import | `FFPROBE_PATH` |

### Supported video formats

- **MP4 (H.264)** and **WebM** play natively in the presentation window.
- **MKV** and **AVI** are **rejected at import** on all platforms — re-encode them
  to MP4 or WebM first (e.g. with [HandBrake](https://handbrake.fr/)).

---

## MediaMTX — live camera

To show a live **camera** over **RTMP, RTSP, SRT, or UDP/multicast**, Lyrizzy uses
**MediaMTX**. These streaming formats can't play directly in the presentation
window, so MediaMTX runs in the background and converts the camera feed to WebRTC
(which the window *can* play). It starts and stops automatically — you don't
interact with it directly.

> MediaMTX is **not** needed for the **Iframe** or **MJPEG** camera modes, which
> play directly. See [Camera & Audio](camera.md) for which mode to use.

### Install

Download a release for your platform from
[github.com/bluenviron/mediamtx/releases](https://github.com/bluenviron/mediamtx/releases),
then either:

- put the `mediamtx` (or `mediamtx.exe`) executable on your `PATH`, or
- set the `MEDIAMTX_PATH` environment variable to the executable (a folder
  containing it is also accepted).

If MediaMTX isn't found, RTMP/RTSP/SRT/multicast cameras show an error banner:
*"MediaMTX not found. Install it and set MEDIAMTX_PATH or add it to PATH."*

### How it's detected

1. A bundled copy shipped inside the app (if your installer included one).
2. The `MEDIAMTX_PATH` environment variable.
3. `mediamtx` on your `PATH`.

---

## GStreamer (Linux only)

On Linux the presentation window uses the WebKitGTK engine, which plays video
through **GStreamer**. H.264 MP4 only plays if the right plugins are installed.

```bash
sudo apt install -y \
  gstreamer1.0-libav gstreamer1.0-plugins-good gstreamer1.0-plugins-bad
```

Without these, an H.264 video shows as a black box (no error). On Linux, prefer
**WebM** background media for portability. This does not affect Windows, where
video plays natively.

---

## Setting an environment variable

Most users never need this — install the app normally and Lyrizzy finds it. If you
do need an override:

- **Windows:** Settings → *Edit the system environment variables* → **Environment
  Variables** → add e.g. `MEDIAMTX_PATH` = `C:\tools\mediamtx\mediamtx.exe`.
  Restart Lyrizzy afterwards.
- **Linux / macOS:** export it before launching, e.g.
  `SOFFICE_PATH=/opt/libreoffice/program/soffice` (add it to your shell profile to
  make it permanent).

---

**Next:** [Camera & Audio →](camera.md)
