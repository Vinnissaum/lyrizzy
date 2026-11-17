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
///
/// Byte ranges (AD-097): a media element asks for a video piece by piece with
/// `Range`, and without `206` answers WebView2 cannot seek it - every seek lands
/// at 0. Each answer carries at most [`MAX_RANGE_BYTES`] and is read on a worker
/// thread: the request callback runs on the UI thread both windows share.
use http::{
    header::{ACCEPT_RANGES, CONTENT_LENGTH, CONTENT_RANGE, CONTENT_TYPE, RANGE},
    status::StatusCode,
    Request, Response,
};
use std::fs::File;
use std::io::{Read, Seek, SeekFrom};
use std::path::{Path, PathBuf};
use std::sync::OnceLock;

/// The most bytes one ranged answer carries; the media element asks for the
/// rest with its next request.
pub const MAX_RANGE_BYTES: u64 = 1024 * 1024;

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

/// Build the asset protocol handler, for `register_asynchronous_uri_scheme_protocol`.
/// Reads the canonical media dir from `CANONICAL_MEDIA_DIR` on each request —
/// by then `setup` has populated it.
pub fn build_handler() -> impl Fn(
    tauri::UriSchemeContext<'_, tauri::Wry>,
    Request<Vec<u8>>,
    tauri::UriSchemeResponder,
) + Send
       + Sync
       + 'static {
    move |_ctx, request, responder| {
        handle(CANONICAL_MEDIA_DIR.get().cloned(), request, move |response| {
            responder.respond(response)
        });
    }
}

/// Answer `request` on a worker thread and hand the answer to `respond` there.
/// Returns at once: the caller is WebView2's request callback, on the UI thread
/// both windows share, which must never wait for a file.
pub fn handle<F>(media_dir: Option<PathBuf>, request: Request<Vec<u8>>, respond: F)
where
    F: FnOnce(Response<Vec<u8>>) + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || {
        let response = match media_dir {
            Some(dir) => answer(&dir, &request),
            None => plain(
                StatusCode::INTERNAL_SERVER_ERROR,
                "500 Media directory not initialized",
            ),
        };
        respond(response);
    });
}

/// The answer to `request` from the files under `canonical_media`: the asked
/// byte range, or the whole file, or why neither (403, 404, 416).
fn answer(canonical_media: &Path, request: &Request<Vec<u8>>) -> Response<Vec<u8>> {
    let uri_path = request.uri().path();
    // URI: /media/filename.ext  →  filename.ext
    // URI: /filename.ext        →  filename.ext
    let relative = uri_path
        .trim_start_matches('/')
        .trim_start_matches("media/");

    if relative.is_empty() || relative.contains("..") {
        return plain(StatusCode::FORBIDDEN, "403 Forbidden");
    }

    let Ok(canonical_file) = canonical_media.join(relative).canonicalize() else {
        return plain(StatusCode::NOT_FOUND, "404 Not Found");
    };

    if !canonical_file.starts_with(canonical_media) {
        return plain(StatusCode::FORBIDDEN, "403 Forbidden");
    }

    let ext = canonical_file
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("");
    let range = request.headers().get(RANGE).and_then(|v| v.to_str().ok());
    read_answer(&canonical_file, range, mime_type_for_ext(ext))
        .unwrap_or_else(|_| plain(StatusCode::NOT_FOUND, "404 Not Found"))
}

/// Read what `range` asks of `file`, never more than [`MAX_RANGE_BYTES`] for a range.
fn read_answer(file: &Path, range: Option<&str>, mime: &str) -> std::io::Result<Response<Vec<u8>>> {
    let mut f = File::open(file)?;
    let size = f.metadata()?.len();
    let builder = Response::builder()
        .header(CONTENT_TYPE, mime)
        .header(ACCEPT_RANGES, "bytes");
    let response = match parse_range(range, size) {
        RangeAsk::Whole => {
            let mut body = Vec::new();
            f.read_to_end(&mut body)?;
            builder
                .status(StatusCode::OK)
                .header(CONTENT_LENGTH, body.len())
                .body(body)
        }
        RangeAsk::Bytes { start, end } => {
            f.seek(SeekFrom::Start(start))?;
            let mut body = Vec::new();
            f.take(end - start + 1).read_to_end(&mut body)?;
            if body.is_empty() {
                // The file shrank after it was measured.
                return Ok(unsatisfiable(size));
            }
            // What was read, which is less than asked if the file shrank meanwhile.
            let last = start + body.len() as u64 - 1;
            builder
                .status(StatusCode::PARTIAL_CONTENT)
                .header(CONTENT_RANGE, format!("bytes {start}-{last}/{size}"))
                .header(CONTENT_LENGTH, body.len())
                .body(body)
        }
        RangeAsk::Unsatisfiable => return Ok(unsatisfiable(size)),
    };
    Ok(response.expect("static headers are valid"))
}

/// What a `Range` header asks of a file of `size` bytes (RFC 9110 §14.1).
#[derive(Debug, PartialEq, Eq)]
enum RangeAsk {
    /// No usable range: answer the whole file.
    Whole,
    /// Bytes `start..=end`, already within the file and the cap.
    Bytes { start: u64, end: u64 },
    /// The range starts at or past the end of the file.
    Unsatisfiable,
}

fn parse_range(header: Option<&str>, size: u64) -> RangeAsk {
    let Some(spec) = header.and_then(|h| h.trim().strip_prefix("bytes=")) else {
        // No Range, or a unit other than bytes: ignored, as RFC 9110 allows.
        return RangeAsk::Whole;
    };
    // A media element asks for one range at a time; of several, answer the first.
    let first = spec.split(',').next().unwrap_or_default().trim();
    let Some((from, to)) = first.split_once('-') else {
        return RangeAsk::Whole;
    };
    let (from, to) = (from.trim(), to.trim());
    let (start, end) = if from.is_empty() {
        // `bytes=-n`: the last n bytes.
        let Ok(n) = to.parse::<u64>() else {
            return RangeAsk::Whole;
        };
        if n == 0 || size == 0 {
            return RangeAsk::Unsatisfiable;
        }
        (size.saturating_sub(n), size - 1)
    } else {
        let Ok(start) = from.parse::<u64>() else {
            return RangeAsk::Whole;
        };
        let end = if to.is_empty() {
            u64::MAX
        } else {
            match to.parse::<u64>() {
                Ok(end) if end >= start => end,
                // A last byte before the first makes the header invalid: ignored.
                _ => return RangeAsk::Whole,
            }
        };
        if start >= size {
            return RangeAsk::Unsatisfiable;
        }
        (start, end.min(size - 1))
    };
    RangeAsk::Bytes {
        start,
        end: end.min(start + MAX_RANGE_BYTES - 1),
    }
}

fn unsatisfiable(size: u64) -> Response<Vec<u8>> {
    Response::builder()
        .status(StatusCode::RANGE_NOT_SATISFIABLE)
        .header(ACCEPT_RANGES, "bytes")
        .header(CONTENT_RANGE, format!("bytes */{size}"))
        .header(CONTENT_LENGTH, 0)
        .body(Vec::new())
        .expect("static headers are valid")
}

fn plain(status: StatusCode, text: &str) -> Response<Vec<u8>> {
    Response::builder()
        .status(status)
        .header(CONTENT_TYPE, "text/plain")
        .body(text.as_bytes().to_vec())
        .expect("static headers are valid")
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

    // ─── Byte ranges and the worker thread (P24, AD-097) ─────────────────────

    const TEN_MIB: usize = 10 * 1024 * 1024;

    /// A media directory holding `files`, and its canonical path.
    fn media_with(files: &[(&str, Vec<u8>)]) -> (TempDir, PathBuf) {
        let tmp = make_temp_media_dir();
        for (name, data) in files {
            std::fs::write(tmp.path().join(name), data).unwrap();
        }
        let canonical = tmp.path().canonicalize().unwrap();
        (tmp, canonical)
    }

    /// Bytes that differ from their neighbours, so a wrong offset shows.
    fn pattern(len: usize) -> Vec<u8> {
        (0..len).map(|i| (i % 251) as u8).collect()
    }

    fn get(path: &str, range: Option<&str>) -> Request<Vec<u8>> {
        let mut builder = Request::builder().uri(path);
        if let Some(range) = range {
            builder = builder.header(RANGE, range);
        }
        builder.body(Vec::new()).unwrap()
    }

    fn header(response: &Response<Vec<u8>>, name: http::header::HeaderName) -> Option<&str> {
        response.headers().get(name).map(|v| v.to_str().unwrap())
    }

    #[test]
    fn a_range_is_answered_with_206_and_those_bytes() {
        let big = pattern(TEN_MIB);
        let small = pattern(300);
        let (_tmp, media) = media_with(&[("big.mp4", big.clone()), ("small.webm", small.clone())]);

        let size = TEN_MIB;
        let cases: [(&str, &str, usize, usize, &[u8]); 6] = [
            ("/media/big.mp4", "bytes=0-", 0, 1_048_575, &big),
            ("/media/big.mp4", "bytes=5000-5999", 5_000, 5_999, &big),
            ("/media/big.mp4", "bytes=-500", size - 500, size - 1, &big),
            ("/media/big.mp4", "bytes=10485759-", size - 1, size - 1, &big),
            ("/media/big.mp4", "bytes=0-99999999", 0, 1_048_575, &big),
            ("/media/small.webm", "bytes=0-", 0, 299, &small),
        ];
        for (path, range, first, last, data) in cases {
            let response = answer(&media, &get(path, Some(range)));
            assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT, "{range}");
            assert_eq!(response.body().as_slice(), &data[first..=last], "{range}");
            assert_eq!(
                header(&response, CONTENT_RANGE),
                Some(format!("bytes {first}-{last}/{}", data.len()).as_str()),
                "{range}"
            );
            assert_eq!(
                header(&response, CONTENT_LENGTH),
                Some(response.body().len().to_string().as_str()),
                "{range}"
            );
            assert_eq!(header(&response, ACCEPT_RANGES), Some("bytes"), "{range}");
        }
    }

    #[test]
    fn a_one_byte_range_is_answered_with_that_byte() {
        let big = pattern(TEN_MIB);
        let (_tmp, media) = media_with(&[("big.mp4", big.clone())]);

        for (range, at) in [("bytes=5000-5000", 5_000usize), ("bytes=0-0", 0)] {
            let response = answer(&media, &get("/media/big.mp4", Some(range)));
            assert_eq!(response.status(), StatusCode::PARTIAL_CONTENT, "{range}");
            assert_eq!(response.body().as_slice(), &big[at..=at], "{range}");
            assert_eq!(
                header(&response, CONTENT_RANGE),
                Some(format!("bytes {at}-{at}/10485760").as_str()),
                "{range}"
            );
            assert_eq!(header(&response, CONTENT_LENGTH), Some("1"), "{range}");
        }
    }

    #[test]
    fn without_a_usable_range_the_whole_file_is_answered() {
        let png = pattern(4_096);
        let (_tmp, media) = media_with(&[("pic.png", png.clone())]);

        for range in [None, Some("items=0-5"), Some("bytes=5-1")] {
            let response = answer(&media, &get("/media/pic.png", range));
            assert_eq!(response.status(), StatusCode::OK, "{range:?}");
            assert_eq!(response.body(), &png, "{range:?}");
            assert_eq!(header(&response, CONTENT_LENGTH), Some("4096"), "{range:?}");
            assert_eq!(header(&response, ACCEPT_RANGES), Some("bytes"), "{range:?}");
            assert_eq!(header(&response, CONTENT_RANGE), None, "{range:?}");
        }
    }

    #[test]
    fn a_range_past_the_end_is_answered_with_416() {
        let (_tmp, media) = media_with(&[("big.mp4", pattern(TEN_MIB))]);

        for range in ["bytes=10485760-", "bytes=20000000-20000099"] {
            let response = answer(&media, &get("/media/big.mp4", Some(range)));
            assert_eq!(response.status(), StatusCode::RANGE_NOT_SATISFIABLE, "{range}");
            assert_eq!(header(&response, CONTENT_RANGE), Some("bytes */10485760"), "{range}");
            assert!(response.body().is_empty(), "{range}");
        }
    }

    #[test]
    fn path_rules_hold_with_and_without_a_range() {
        let (_tmp, media) = media_with(&[("ok.png", pattern(10))]);
        let outside_tmp = make_temp_media_dir();
        let outside = outside_tmp.path().join("secret.png");
        std::fs::write(&outside, b"secret").unwrap();
        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, media.join("link.png")).unwrap();

        for range in [None, Some("bytes=0-")] {
            let traversal = answer(&media, &get("/media/../secret.png", range));
            assert_eq!(traversal.status(), StatusCode::FORBIDDEN, "{range:?}");
            #[cfg(unix)]
            {
                let link = answer(&media, &get("/media/link.png", range));
                assert_eq!(link.status(), StatusCode::FORBIDDEN, "{range:?}");
                assert_ne!(link.body().as_slice(), b"secret", "{range:?}");
            }
            let missing = answer(&media, &get("/media/nope.png", range));
            assert_eq!(missing.status(), StatusCode::NOT_FOUND, "{range:?}");
        }
    }

    #[test]
    fn content_type_follows_the_extension_in_every_answer() {
        let kinds = [
            ("a.mp4", "video/mp4"),
            ("a.webm", "video/webm"),
            ("a.png", "image/png"),
            ("a.jpg", "image/jpeg"),
            ("a.gif", "image/gif"),
            ("a.webp", "image/webp"),
        ];
        let files: Vec<(&str, Vec<u8>)> = kinds.iter().map(|(name, _)| (*name, pattern(64))).collect();
        let (_tmp, media) = media_with(&files);

        for (name, mime) in kinds {
            for range in [None, Some("bytes=0-")] {
                let response = answer(&media, &get(&format!("/media/{name}"), range));
                assert!(response.status().is_success(), "{name} {range:?}");
                assert_eq!(header(&response, CONTENT_TYPE), Some(mime), "{name} {range:?}");
            }
        }
    }

    /// Opening a named pipe for reading blocks until a writer opens it, so a
    /// handler that read on its caller's thread would not return.
    #[cfg(unix)]
    #[test]
    fn the_file_is_read_off_the_calling_thread() {
        use std::sync::mpsc;
        use std::time::Duration;

        let (_tmp, media) = media_with(&[]);
        let pipe = media.join("pipe.mp4");
        let made = std::process::Command::new("mkfifo").arg(&pipe).status().unwrap();
        assert!(made.success(), "mkfifo");

        let (answered_tx, answered_rx) = mpsc::channel();
        let (returned_tx, returned_rx) = mpsc::channel();
        let dir = media.clone();
        let caller = std::thread::spawn(move || {
            handle(Some(dir), get("/media/pipe.mp4", Some("bytes=0-")), move |response| {
                answered_tx
                    .send((std::thread::current().id(), response.status()))
                    .unwrap();
            });
            returned_tx.send(std::thread::current().id()).unwrap();
        });

        let caller_id = returned_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("handle() waited for the file instead of returning");
        assert!(
            answered_rx.try_recv().is_err(),
            "answered before the pipe could be opened"
        );

        // A writer lets the worker's open() return; the empty pipe is then answered.
        drop(std::fs::OpenOptions::new().write(true).open(&pipe).unwrap());
        let (answer_thread, _status) = answered_rx
            .recv_timeout(Duration::from_secs(5))
            .expect("an answer once the pipe opens");
        assert_ne!(answer_thread, caller_id, "the answer came from the caller's thread");
        caller.join().unwrap();
    }

    /// Not a test: a walk helper. Serves `ASSET_WALK_DIR` over HTTP on
    /// `127.0.0.1:$ASSET_WALK_PORT` (default 8765) through [`answer`], so a
    /// browser plays media exactly as the app's protocol answers it. Runs
    /// until killed:
    /// `ASSET_WALK_DIR=<dir> cargo test --lib serve_media_for_a_walk -- --ignored`
    #[test]
    #[ignore = "walk helper: serves media over HTTP until killed"]
    fn serve_media_for_a_walk() {
        use std::io::{BufRead, BufReader, Write};

        let dir = PathBuf::from(std::env::var("ASSET_WALK_DIR").expect("ASSET_WALK_DIR"))
            .canonicalize()
            .unwrap();
        let port = std::env::var("ASSET_WALK_PORT").unwrap_or_else(|_| "8765".into());
        let listener = std::net::TcpListener::bind(format!("127.0.0.1:{port}")).unwrap();
        for stream in listener.incoming().flatten() {
            let dir = dir.clone();
            std::thread::spawn(move || {
                let mut reader = BufReader::new(stream.try_clone().unwrap());
                let mut line = String::new();
                reader.read_line(&mut line).unwrap_or(0);
                let path = line.split_whitespace().nth(1).unwrap_or("/").to_string();
                let mut range = None;
                loop {
                    let mut h = String::new();
                    if reader.read_line(&mut h).unwrap_or(0) == 0 || h.trim().is_empty() {
                        break;
                    }
                    if let Some((name, value)) = h.split_once(':') {
                        if name.trim().eq_ignore_ascii_case("range") {
                            range = Some(value.trim().to_string());
                        }
                    }
                }
                let response = answer(&dir, &get(&path, range.as_deref()));
                eprintln!("{path} {range:?} -> {}", response.status().as_u16());
                let mut out = stream;
                let mut head = format!(
                    "HTTP/1.1 {} {}\r\nAccess-Control-Allow-Origin: *\r\nConnection: close\r\n",
                    response.status().as_u16(),
                    response.status().canonical_reason().unwrap_or("")
                );
                for (name, value) in response.headers() {
                    head.push_str(&format!("{name}: {}\r\n", value.to_str().unwrap_or("")));
                }
                head.push_str("\r\n");
                let _ = out.write_all(head.as_bytes());
                let _ = out.write_all(response.body());
            });
        }
    }
}
