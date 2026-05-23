/**
 * Returns the canonical `http://asset.localhost/media/{fileName}` URL for a
 * media file.  This is the Windows-correct form required by Tauri 2's
 * registered protocol handler; `asset://localhost/...` does NOT resolve in
 * WebView2.
 */
export function mediaUrl(fileName: string): string {
  return `http://asset.localhost/media/${fileName}`;
}
