import { useEffect, useRef } from "react";

/** Largest mic delay we allow (seconds). Camera-over-WebRTC latency is rarely
 *  more than a couple of seconds; this also sizes the DelayNode buffer. */
export const MAX_DELAY_SECONDS = 5;

export interface MicAudioOptions {
  /** Master on/off — when false the mic is fully released. */
  enabled: boolean;
  /** Live mute — silences the mic instantly WITHOUT releasing it (track.enabled).
   *  Kept separate from `enabled` so the operator can mute mid-service without a
   *  capture/permission round-trip. */
  muted?: boolean;
  /** Mic input device id (from enumerateDevices); omit for the default mic. */
  deviceId?: string;
  /** Output device id (the TV's HDMI) to route the mic to via AudioContext. */
  sinkId?: string;
  /** Delay applied to the mic so it lines up with the late camera image. */
  delayMs: number;
}

/**
 * Capture the computer mic and play it — delayed — on a chosen output device.
 *
 * Graph: `getUserMedia → MediaStreamAudioSourceNode → DelayNode → AudioContext`,
 * with the context routed to `sinkId` (the TV's HDMI) via `AudioContext.setSinkId`
 * so the voice exits that screen rather than the operator's default speakers.
 * The delay lip-syncs the mic to the latency-delayed camera. No-op when
 * disabled; the graph is fully torn down on disable/unmount and rebuilt when the
 * device/sink changes. The delay is adjusted live without a rebuild.
 */
export function useMicAudio({ enabled, muted = false, deviceId, sinkId, delayMs }: MicAudioOptions): void {
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const delayRef = useRef<DelayNode | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;

    const start = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: deviceId ? { deviceId: { exact: deviceId } } : true,
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        // Apply the current mute state to the freshly-captured tracks (a rebuild
        // — device/sink change — must not unmute a muted mic).
        stream.getAudioTracks().forEach((tr) => (tr.enabled = !muted));
        const ctx = new AudioContext();
        const withSink = ctx as AudioContext & {
          setSinkId?: (id: string) => Promise<void>;
        };
        if (sinkId && typeof withSink.setSinkId === "function") {
          await withSink.setSinkId(sinkId).catch((err) =>
            console.error("useMicAudio: setSinkId failed:", err),
          );
        }
        const source = ctx.createMediaStreamSource(stream);
        const delay = ctx.createDelay(MAX_DELAY_SECONDS);
        delay.delayTime.value = clampDelay(delayMs);
        source.connect(delay);
        delay.connect(ctx.destination);

        streamRef.current = stream;
        ctxRef.current = ctx;
        delayRef.current = delay;
      } catch (err) {
        console.error("useMicAudio: capture failed:", err);
      }
    };
    void start();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      delayRef.current = null;
      const ctx = ctxRef.current;
      ctxRef.current = null;
      ctx?.close().catch(() => {});
    };
    // delayMs intentionally excluded — handled by the live-adjust effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, deviceId, sinkId]);

  // Live-adjust the delay without rebuilding the graph.
  useEffect(() => {
    if (delayRef.current) delayRef.current.delayTime.value = clampDelay(delayMs);
  }, [delayMs]);

  // Live mute/unmute without rebuilding the graph or re-prompting for the mic.
  useEffect(() => {
    streamRef.current?.getAudioTracks().forEach((tr) => (tr.enabled = !muted));
  }, [muted]);
}

function clampDelay(delayMs: number): number {
  return Math.max(0, Math.min(delayMs / 1000, MAX_DELAY_SECONDS));
}
