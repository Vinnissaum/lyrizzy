import React, { useRef, useEffect, useState } from "react";
import { emitVideoReport, onVideoCommand } from "../../api/commands";
import { clampPosition, skipTarget } from "../../utils/videoControls";
import { useLayerActive } from "./TransitionStage";
import { useOutputId } from "./outputContext";
import type { MediaItemOptions, OutputId, VideoCommand, VideoReport, VideoStatus } from "../../types";

interface Props {
  assetUrl: string;
  kind: "image" | "video";
  options?: MediaItemOptions;
  onEnded?: () => void;
  frozen?: boolean;
  /**
   * The video set item this renders (P23). With it the video reports its
   * playback to the operator and obeys the operator's commands; without it -
   * an overlay, a preview - it just plays.
   */
  itemId?: string;
}

/** How often a playing video reports its position. */
const REPORT_EVERY_MS = 250;

/** `video_report` events that mean "report now". */
const REPORT_EVENTS = [
  "loadedmetadata",
  "durationchange",
  "play",
  "playing",
  "pause",
  "seeked",
  "volumechange",
  "ended",
  "error",
] as const;

/**
 * Which video speaks for each wall. When one video replaces another, the old
 * one is still mounted while it fades out; only the newest may report, so the
 * old one's "no video here" never lands after the new one's first report.
 */
const reporterOf = new Map<OutputId, symbol>();

export const MediaSlideRenderer: React.FC<Props> = ({
  assetUrl,
  kind,
  options,
  onEnded,
  frozen,
  itemId,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const output = useOutputId();
  // False once this item is fading out behind the one that replaced it.
  const active = useLayerActive();
  const loop = options?.loop ?? false;
  const savedMute = options?.mute ?? false;
  const autoAdvanceOnEnd = options?.autoAdvanceOnEnd ?? true;

  // Run-only state the operator sets (AD-094): never written to the item.
  const [muteOverride, setMuteOverride] = useState<boolean | null>(null);
  const userPaused = useRef(false);
  const failed = useRef(false);
  // Read by handlers registered once.
  const frozenRef = useRef(!!frozen);
  frozenRef.current = !!frozen;
  const activeRef = useRef(active);
  activeRef.current = active;

  const reports = kind === "video" && !!itemId;
  const token = useRef(Symbol("video"));

  const report = () => {
    const video = videoRef.current;
    if (!reports || !video || reporterOf.get(output) !== token.current) return;
    const duration = video.duration;
    let status: VideoStatus;
    if (failed.current) status = "failed";
    else if (video.ended) status = "ended";
    else if (video.readyState < 1) status = "loading";
    else status = video.paused ? "paused" : "playing";
    const payload: VideoReport = {
      output,
      itemId: itemId!,
      status,
      positionMs: Math.round(video.currentTime * 1000),
      durationMs: Number.isFinite(duration) && duration > 0 ? Math.round(duration * 1000) : null,
      muted: video.muted,
    };
    emitVideoReport(payload).catch(() => {});
  };

  /** Tell the operator this wall no longer shows the video. Idempotent. */
  const withdraw = () => {
    if (reporterOf.get(output) !== token.current) return;
    reporterOf.delete(output);
    emitVideoReport({
      output,
      itemId: null,
      status: "loading",
      positionMs: 0,
      durationMs: null,
      muted: false,
    }).catch(() => {});
  };

  // Play only while this is what the wall shows, the output is not frozen and
  // the operator has not paused it.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;
    if (frozen || !active) {
      video.pause();
    } else if (!userPaused.current && !video.ended) {
      video.play().catch(() => {});
    }
  }, [frozen, active]);

  // Speak for this wall while shown; fall silent the moment it is replaced.
  useEffect(() => {
    if (!reports) return;
    if (!active) {
      withdraw();
      return;
    }
    reporterOf.set(output, token.current);
    report();
    const video = videoRef.current;
    const onEvent = () => report();
    const onError = () => {
      failed.current = true;
      report();
    };
    for (const name of REPORT_EVENTS) video?.addEventListener(name, name === "error" ? onError : onEvent);
    const timer = setInterval(() => {
      if (videoRef.current && !videoRef.current.paused) report();
    }, REPORT_EVERY_MS);
    return () => {
      clearInterval(timer);
      for (const name of REPORT_EVENTS) video?.removeEventListener(name, name === "error" ? onError : onEvent);
      withdraw();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, active, output, itemId]);

  // Obey the operator, for this output and this item only.
  useEffect(() => {
    if (!reports) return;
    const apply = (command: VideoCommand) => {
      const video = videoRef.current;
      if (!video || command.itemId !== itemId || !activeRef.current) return;
      const action = command.action;
      if (action.kind === "mute") {
        video.muted = action.muted;
        setMuteOverride(action.muted);
        report();
        return;
      }
      // A frozen output holds its video; a failed one has nothing to drive.
      if (frozenRef.current || failed.current) return;
      const durationMs =
        Number.isFinite(video.duration) && video.duration > 0 ? video.duration * 1000 : null;
      switch (action.kind) {
        case "pause":
          userPaused.current = true;
          video.pause();
          break;
        case "resume":
          userPaused.current = false;
          video.play().catch(() => {});
          break;
        case "restart":
          userPaused.current = false;
          video.currentTime = 0;
          video.play().catch(() => {});
          break;
        case "seek":
          video.currentTime = clampPosition(action.positionMs, durationMs) / 1000;
          break;
        case "skip":
          video.currentTime = skipTarget(video.currentTime * 1000, action.deltaMs, durationMs) / 1000;
          break;
      }
      report();
    };
    const unlisten = onVideoCommand(output, apply);
    return () => {
      unlisten.then((u) => u());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reports, output, itemId]);

  const handleEnded = () => {
    if (!loop && autoAdvanceOnEnd && onEnded) {
      onEnded();
    }
  };

  if (kind === "video") {
    return (
      <div className="h-screen bg-black overflow-hidden">
        <video
          ref={videoRef}
          key={assetUrl}
          src={assetUrl}
          className="w-full h-full object-contain"
          autoPlay={active && !frozen}
          playsInline
          loop={loop}
          muted={muteOverride ?? savedMute}
          onEnded={handleEnded}
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-black flex items-center justify-center overflow-hidden">
      <img
        key={assetUrl}
        src={assetUrl}
        className="w-full h-full object-contain"
        alt=""
      />
    </div>
  );
};
