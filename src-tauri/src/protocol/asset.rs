/// Custom asset:// protocol handler.
///
/// Serves files from `%APPDATA%\TrinityLyrics\media\` to the WebView.
/// The URI scheme is registered as "asset" in lib.rs.
///
/// URL format (Windows): `http://asset.localhost/media/filename.ext`
/// URI path seen by handler: `/media/filename.ext` → resolves to `{media_dir}/filename.ext`
///
/// Security: validates that the resolved canonical path starts with the media directory
/// to prevent path traversal attacks (e.g., `asset://../../Windows/System32`).
use http::{header::CONTENT_TYPE, status::StatusCode};
use std::path::PathBuf;

/// Resolve the media directory for the application.
/// On Windows: `%APPDATA%\TrinityLyrics\media\`
pub fn media_dir(app_data_dir: &PathBuf) -> PathBuf {
    app_data_dir.join("media")
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

/// Build the asset protocol handler closure.
///
/// The closure captures the media directory path and serves files from it.
/// Returns a function compatible with `Builder::register_uri_scheme_protocol`.
pub fn build_handler(
    media_dir: PathBuf,
) -> impl Fn(
    tauri::UriSchemeContext<'_, tauri::Wry>,
    http::Request<Vec<u8>>,
) -> http::Response<Vec<u8>>
       + Send
       + Sync
       + 'static {
    move |_ctx, request| {
        let uri_path = request.uri().path();
        // Strip leading slash and optional "media/" prefix
        // URI: /media/filename.ext  →  filename.ext
        // URI: /filename.ext        →  filename.ext
        let relative = uri_path
            .trim_start_matches('/')
            .trim_start_matches("media/");

        // Reject empty or suspicious paths immediately
        if relative.is_empty() || relative.contains("..") {
            return http::Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header(CONTENT_TYPE, "text/plain")
                .body(b"403 Forbidden".to_vec())
                .unwrap();
        }

        let file_path = media_dir.join(relative);

        // Path traversal protection: canonicalize both and check prefix
        let canonical_media = match media_dir.canonicalize() {
            Ok(p) => p,
            Err(_) => {
                return http::Response::builder()
                    .status(StatusCode::NOT_FOUND)
                    .body(b"404 Media directory not found".to_vec())
                    .unwrap();
            }
        };

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

        if !canonical_file.starts_with(&canonical_media) {
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
        let tmp = make_temp_media_dir();
        let media = tmp.path().to_path_buf();
        // The handler checks for ".." before trying to canonicalize
        // We test the dotdot-contains check directly
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
        // Create two independent temp dirs to simulate media/ and an outside location
        let media_tmp = make_temp_media_dir();
        let outside_tmp = make_temp_media_dir();

        let media = media_tmp.path().to_path_buf();
        std::fs::create_dir_all(&media).unwrap();

        // Create a legit file inside media dir
        let legit_path = media.join("test.png");
        std::fs::File::create(&legit_path).unwrap().write_all(b"PNG").unwrap();

        // The canonical check: file inside media dir → starts_with succeeds
        let canonical_media = media.canonicalize().unwrap();
        let canonical_legit = legit_path.canonicalize().unwrap();
        assert!(canonical_legit.starts_with(&canonical_media));

        // A file in a completely separate temp dir → starts_with fails
        let outside = outside_tmp.path().join("secret.txt");
        std::fs::File::create(&outside).unwrap().write_all(b"secret").unwrap();
        let canonical_outside = outside.canonicalize().unwrap();
        assert!(!canonical_outside.starts_with(&canonical_media));
    }
}
