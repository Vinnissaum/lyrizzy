# Camera & Audio

Lyrizzy can show a **live camera** (or any web page) on a projection screen, and
route the camera's audio and a microphone to the right output. A common setup is
**lyrics on Tela 1** and the **camera on Tela 2**.

- [Adding a camera to a set](#adding-a-camera-to-a-set)
- [Camera modes](#camera-modes)
- [Mode-specific options](#mode-specific-options)
- [Iframe crop / zoom](#iframe-crop--zoom)
- [Per-screen camera & microphone audio](#per-screen-camera--microphone-audio)
- [Muting the mic live](#muting-the-mic-live)

---

## Adding a camera to a set

A camera is a kind of **set item** (alongside songs, media, countdowns, etc.).
In the set builder, add a **Web view / camera** item, then open its editor to pick
a **mode** and enter the connection details. The item shows a live preview while
you configure it.

---

## Camera modes

Choose the mode that matches how your camera (or encoder, e.g. OBS) provides the
stream:

| Mode | Use it for | Needs MediaMTX? |
| --- | --- | --- |
| **Iframe (URL)** | A web page — e.g. a camera's built-in web viewer, or any site. | No |
| **MJPEG (camera)** | An MJPEG stream (common on IP cameras). | No |
| **RTMP (camera)** | An RTMP/RTMPS stream from a camera or encoder. | **Yes** |
| **RTSP (camera)** | An RTSP/RTSPS stream from an IP camera. | **Yes** |
| **SRT (camera)** | An SRT stream (low-latency, network-friendly). | **Yes** |
| **Multicast (camera)** | A UDP/MPEG-TS multicast stream on the local network. | **Yes** |

Modes marked **Yes** are converted to a playable format by **MediaMTX** in the
background — install it first (see [External Apps](external-apps.md#mediamtx--live-camera)).
Iframe and MJPEG play directly and need nothing extra.

> **Not sure which to pick?** If your camera has a web page that shows the video,
> **Iframe** is the simplest. Otherwise use the protocol your camera documents
> (RTSP is the most common for IP cameras).

---

## Mode-specific options

### Iframe / MJPEG / RTMP / RTSP (URL-based)
Enter the **URL**. Examples:

- Iframe: `https://example.com`
- RTMP: `rtmp://192.168.100.138/live/stream0`
- RTSP: `rtsp://192.168.15.50/1`
- MJPEG: `http://192.168.1.10/stream`

**Basic authentication (optional):** for Iframe and MJPEG sources behind a
username/password, fill in both **Username** and **Password**.

> Plain `http://` iframe pages may be blocked by the browser engine; prefer
> `https://` where possible. Lyrizzy warns you when an iframe URL is `http://`.

### RTSP — Transport
Pick how the RTSP stream is carried: **UDP** (matches OBS's `rtsp_transport=udp`),
**TCP**, or **Automatic** (let the server choose). UDP is a good default; switch to
TCP if the picture is unstable.

### SRT
SRT needs a bit more detail:

- **Server** and **Port** — the camera/encoder address.
- **Mode:**
  - **Listener (camera waits)** — the camera waits for connections and Lyrizzy
    connects to it.
  - **Caller (camera pushes)** — the camera pushes the stream and Lyrizzy opens an
    SRT server on the given port to receive it.
- **Stream ID** *(optional)* — required by some encoders.
- **Encrypted** + **Passphrase** — turn on encryption and set the passphrase if
  your stream uses it.
- **Latency (ms)** and **Overhead bandwidth (%)** — advanced tuning; leave default
  unless your encoder specifies values.

### Multicast
Enter the **Multicast IP** and **Port** of the UDP/MPEG-TS stream on your local
network (e.g. IP `239.x.x.x`).

---

## Iframe crop / zoom

For **Iframe** mode only, you can **crop and zoom** the page so a region (for
example the camera's `<video>` area on its web page) fills the whole screen:

- **Zoom** — magnification (1 = no zoom).
- **Horizontal offset** / **Vertical offset** — pan the page left/right and
  up/down (percentages; negative moves up/left).
- **Reset** — return to no crop.

This is a *visual* crop only — the whole page still loads behind the scenes. Use it
to hide a camera page's menus/borders and show just the video.

---

## Per-screen camera & microphone audio

When **Second screen (multi-output)** is enabled (*Settings → Projection*), a
**camera + microphone audio** panel appears with separate controls for **Tela 1**
and **Tela 2**. This lets you, for example, play the room microphone *and* the
camera's own audio out of the TV that shows the camera.

For each screen you can set:

| Control | What it does |
| --- | --- |
| **Play microphone on this screen** | Sends the computer's microphone audio to this screen's output. Off by default; remembered per screen. |
| **Camera audio** | Un-mutes the camera stream's own audio on this screen (camera streams start muted). |
| **Microphone delay (ms)** | Delays the mic to line it up with the camera image, which usually arrives slightly late. Increase until voice and lips match. |
| **Microphone (input)** | Which microphone device to use. |
| **Audio output (TV/HDMI)** | Which output device the mic + camera audio plays through — usually the TV's HDMI output. |

Click **Allow microphone** once to grant microphone access — this is required
before device names appear in the dropdowns. If the system can't choose an output
device, Lyrizzy shows a note (some platforms only support the system default
output).

> **Typical camera-on-TV setup:** on **Tela 2**, turn on **Play microphone on this
> screen**, set the **Audio output** to the TV's HDMI, enable **Camera audio** if
> the camera carries sound, and nudge **Microphone delay** up until the audio
> matches the picture.

---

## Muting the mic live

While a microphone is active on a screen, the operator gets a live **mic strip**
showing that screen's mic. You can **mute** it instantly there without turning the
mic feature off — handy for cutting audio between segments and bringing it back
without re-configuring anything.

---

**Back to:** [User Guide index](../../README.md#user-guide)
