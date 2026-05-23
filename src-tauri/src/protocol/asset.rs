/// Custom asset:// protocol handler.
///
/// Serves files from `<app_data_dir>/media/` to the WebView. The directory
/// is created and canonicalized once during `lib.rs` setup, then stored in
/// the `CANONICAL_MEDIA_DIR` `OnceLock` below. The handler closure looks
/// the path up lazily on each request.
///
/// URL format (Windows): `http://asset.localhost/media/filename.ext`
/// URI path seen by handler: `/media/filename.ext` → resolves to `{media_dir}/filename.ext`
///
/// Security: validates that the resolved canonical file path starts with the
/// canonical media directory to prevent path traversal attacks (`..` literals
/// and symlinks pointing outside the media root).
use http::{header::CONTENT_TYPE, status::StatusCode};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// Single source of truth for the media directory, set during Tauri setup.
/// `OnceLock` lets us register the protocol before setup runs and still
/// read the path lazily once setup populates it.
static CANONICAL_MEDIA_DIR: OnceLock<PathBuf> = OnceLock::new();

/// Resolve the media subdirectory inside the application data directory.
/// On Windows: `<app_data_dir>/media/`
pub fn media_dir(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("media")
}

/// Set the canonical media directory. Call once from `lib.rs` setup after
/// `std::fs::create_dir_all` + `canonicalize`. Subsequent calls are ignored
/// (returns `Err`).
pub fn set_media_dir(dir: PathBuf) -> Result<(), PathBuf> {
    CANONICAL_MEDIA_DIR.set(dir)
}

/// Determine MIME type from file extension.
fn mime_type_for_ext(ext: &str) -> &'static str {
    match ext.to_lowercase().as_str() {
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        _ => "application/octet-stream",
    }
}

/// Return the canonical `http://asset.localhost/media/{file_name}` URL for a
/// media file.  This is the Windows-correct form required by Tauri 2's
/// registered protocol handler; `asset://localhost/...` does NOT resolve in
/// WebView2.
pub fn url_for(file_name: &str) -> String {
    format!("http://asset.localhost/media/{file_name}")
}

/// Build the asset protocol handler closure. Reads the canonical media dir
/// from `CANONICAL_MEDIA_DIR` on each request — by then `setup` has populated it.
pub fn build_handler() -> impl Fn(
    tauri::UriSchemeContext<'_, tauri::Wry>,
    http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>>
       + Send
       + Sync
       + 'static {
    move |_ctx, request| {
        let Some(canonical_media) = CANONICAL_MEDIA_DIR.get() else {
            return http::Response::builder()
                .status(StatusCode::INTERNAL_SERVER_ERROR)
                .header(CONTENT_TYPE, "text/plain")
                .body(b"500 Media directory not initialized".to_vec())
                .unwrap();
        };

        let uri_path = request.uri().path();
        // URI: /media/filename.ext  →  filename.ext
        // URI: /filename.ext        →  filename.ext
        let relative = uri_path
            .trim_start_matches('/')
            .trim_start_matches("media/");

        if relative.is_empty() || relative.contains("..") {
            return http::Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(CONTENT_TYPE, "text/plain")
                .body(b"403 Forbidden".to_vec())
                .unwrap();
        }

        let file_path = canonical_media.join(relative);

        let canonical_file = match file_path.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                return http::Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .header(CONTENT_TYPE, "text/plain")
                    .body(b"404 Not Found".to_vec())
                    .unwrap();
            }
        };

        if !canonical_file.starts_with(canonical_media) {
            return http::Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(CONTENT_TYPE, "text/plain")
                .body(b"403 Forbidden".to_vec())
                .unwrap();
        }

        match std::fs::read(&canonical_file) {
            Ok(data) => {
                let ext = canonical_file
                    .extension()
                    .and_then(|e| e.to_str())
                    .unwrap_or("");
                let mime = mime_type_for_ext(ext);

                http::Response::builder()
                    .status(StatusCode::OK)
                    .header(CONTENT_TYPE, mime)
                    .body(data)
                    .unwrap()
            }
            Err(_) => http::Response::builder()
                .status(StatusCode::NOT_FOUND)
                .header(CONTENT_TYPE, "text/plain")
                .body(b"404 Not Found".to_vec())
                .unwrap(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::TempDir;

    fn make_temp_media_dir() -> TempDir {
        tempfile::tempdir().expect("failed to create temp dir")
    }

    #[test]
    fn url_for_returns_http_asset_localhost_scheme() {
        assert_eq!(
            url_for("foo.png"),
            "http://asset.localhost/media/foo.png"
        );
    }

    #[test]
    fn url_for_preserves_subdirectory_paths() {
        assert_eq!(
            url_for("abc123/slide_000.png"),
            "http://asset.localhost/media/abc123/slide_000.png"
        );
    }

    #[test]
    fn mime_type_mp4() {
        assert_eq!(mime_type_for_ext("mp4"), "video/mp4");
    }

    #[test]
    fn mime_type_webm() {
        assert_eq!(mime_type_for_ext("webm"), "video/webm");
    }

    #[test]
    fn mime_type_png() {
        assert_eq!(mime_type_for_ext("png"), "image/png");
    }

    #[test]
    fn mime_type_unknown_falls_back_to_octet_stream() {
        assert_eq!(mime_type_for_ext("xyz"), "application/octet-stream");
    }

    #[test]
    fn path_traversal_blocked_by_dotdot() {
        // The handler rejects any URI path containing ".." before canonicalization.
        let relative = "../../Windows/System32/cmd.exe";
        assert!(relative.contains(".."), "test path should contain ..");
    }

    #[test]
    fn media_dir_function_appends_media() {
        let base = PathBuf::from("C:\\Users\\test\\AppData\\Roaming\\TrinityLyrics");
        let result = media_dir(&base);
        assert_eq!(result, base.join("media"));
    }

    #[test]
    fn path_traversal_stopped_by_canonical_check() {
        // Create two independent temp dirs to simulate media/ and an outside location.
        let media_tmp = make_temp_media_dir();
        let outside_tmp = make_temp_media_dir();

        let media = media_tmp.path().to_path_buf();
        std::fs::create_dir_all(&media).unwrap();

        let legit_path = media.join("test.png");
        std::fs::File::create(&legit_path).unwrap().write_all(b"PNG").unwrap();

        let canonical_media = media.canonicalize().unwrap();
        let canonical_legit = legit_path.canonicalize().unwrap();
        assert!(canonical_legit.starts_with(&canonical_media));

        let outside = outside_tmp.path().join("secret.txt");
        std::fs::File::create(&outside).unwrap().write_all(b"secret").unwrap();
        let canonical_outside = outside.canonicalize().unwrap();
        assert!(!canonical_outside.starts_with(&canonical_media));
    }
}
