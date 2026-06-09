//! Windows-only: auto-grant the microphone permission for presentation WebView2
//! instances so the per-screen mic feature works on an unattended church PC.
//!
//! By default WebView2 shows its own "Allow microphone?" prompt, and if the user
//! clicks Block it never re-prompts (the mic is permanently dead). We instead
//! register a `PermissionRequested` handler that explicitly Allows the mic, which
//! also suppresses the prompt entirely (Spike C0,
//! `.claude/plans/dual-output-spike-c0-webview2-audio.md`).
//!
//! ⚠️ UNVERIFIED ON THIS PLATFORM: the body is `#[cfg(windows)]`, so it is not
//! compiled by the Linux dev/CI gate. Confirm it compiles and behaves on the
//! first Windows build. The `webview2-com`/`windows` crate versions in Cargo.toml
//! must match what Tauri 2 pulls transitively, or the `with_webview` COM types
//! will be incompatible. The exact handler/constant paths below follow the
//! webview2-com convention (cf. its `WebResourceRequested` example) but may need
//! small adjustments for the resolved crate version.

/// Register a one-time handler that auto-allows the microphone for this window.
/// No-op on non-Windows platforms.
#[cfg(windows)]
pub fn auto_grant_microphone<R: tauri::Runtime>(window: &tauri::WebviewWindow<R>) {
    use webview2_com::Microsoft::Web::WebView2::Win32::{
        COREWEBVIEW2_PERMISSION_KIND_MICROPHONE, COREWEBVIEW2_PERMISSION_STATE_ALLOW,
    };
    use webview2_com::PermissionRequestedEventHandler;

    let result = window.with_webview(|webview| unsafe {
        let core = match webview.controller().CoreWebView2() {
            Ok(c) => c,
            Err(e) => {
                tracing::warn!(error = %e, "auto_grant_microphone: no CoreWebView2");
                return;
            }
        };

        let handler = PermissionRequestedEventHandler::create(Box::new(move |_sender, args| {
            if let Some(args) = args {
                let mut kind = COREWEBVIEW2_PERMISSION_KIND_MICROPHONE;
                // `PermissionKind` writes the requested kind into `kind`.
                if args.PermissionKind(&mut kind).is_ok()
                    && kind == COREWEBVIEW2_PERMISSION_KIND_MICROPHONE
                {
                    let _ = args.SetState(COREWEBVIEW2_PERMISSION_STATE_ALLOW);
                }
            }
            Ok(())
        }));

        let mut token = Default::default();
        if let Err(e) = core.add_PermissionRequested(&handler, &mut token) {
            tracing::warn!(error = %e, "auto_grant_microphone: add_PermissionRequested failed");
        } else {
            tracing::info!("auto_grant_microphone: microphone permission handler registered");
        }
    });
    if let Err(e) = result {
        tracing::warn!(error = %e, "auto_grant_microphone: with_webview failed");
    }
}

/// No-op on non-Windows platforms (mic permission is handled by the OS prompt).
#[cfg(not(windows))]
pub fn auto_grant_microphone<R: tauri::Runtime>(_window: &tauri::WebviewWindow<R>) {}
