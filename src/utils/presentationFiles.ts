/**
 * Extensions offered by the "import presentation" file pickers (P20-08).
 *
 * Mirrors the backend allow-list (`presentation_mime` in
 * `src-tauri/src/commands/media.rs`): every format here is opened by
 * LibreOffice and rasterised to slides. `ppsx`/`pps` are PowerPoint's
 * slide-show variants of `pptx`/`ppt`.
 */
export const PRESENTATION_EXTENSIONS = ["pptx", "ppsx", "ppt", "pps", "odp", "pdf"];
