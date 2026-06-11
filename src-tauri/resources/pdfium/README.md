# pdfium (Windows)

PDF/PPT slide import rasterizes pages with **pdfium** (see
`src/services/libreoffice.rs`). The Windows build bundles `pdfium.dll` from this
folder into the app's resource directory, where `bind_pdfium` finds it at
runtime.

## What's here

`pdfium.dll` (Windows x64) is **committed to the repo** so any clone can build
the Windows installer without a separate download step. The Windows bundle
config (`src-tauri/tauri.windows.conf.json`) maps it to `<resource_dir>/pdfium.dll`,
where `bind_pdfium` loads it at runtime.

## Updating it

Download the latest Windows x64 build from
[bblanchon/pdfium-binaries](https://github.com/bblanchon/pdfium-binaries/releases)
(asset `pdfium-win-x64.tgz`), extract it, and replace this file with `bin/pdfium.dll`:

    src-tauri/resources/pdfium/pdfium.dll

It must stay an **x64** DLL to match the app target. `tauri build` for Windows
fails if it is missing — intentional: the app can't convert presentations
without it.

> Other platforms: Linux/macOS use a system pdfium or the `PDFIUM_LIB_DIR`
> env var in dev (see the `pdfium-slide-conversion` project note). Only the
> Windows release is wired to bundle the library.
