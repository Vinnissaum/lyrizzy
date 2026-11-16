import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Film, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import { usePresentationStore } from "../../stores/presentation";
import { useVideoStore } from "../../stores/video";
import { SKIP_MS, videoControlState, videoTimes } from "../../utils/videoControls";
import type { VideoAction } from "../../types";

const BUTTON =
  "px-3 py-1 text-xs bg-surface-2 hover:bg-border rounded-lg font-medium transition-colors inline-flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-surface-2";

/**
 * Mid-presentation controls for the video set item on the focused output's
 * wall (P23). They show what the wall reports and send it commands; nothing is
 * saved to the item (AD-094). The host decides when to mount it
 * (`videoOnWall`).
 */
export const VideoControls: React.FC = () => {
  const { t } = useTranslation();
  const focusedOutput = usePresentationStore((s) => s.focusedOutput);
  const frozen = usePresentationStore((s) => s.state?.mode === "frozen");
  const report = useVideoStore((s) => s.reports[focusedOutput]);
  // Where the operator is dragging the bar to, then - once released - where
  // the wall was asked to go, until it reports from there.
  const [target, setTarget] = useState<{ ms: number; sent: boolean } | null>(null);

  const reportedPosition = report?.positionMs;
  useEffect(() => {
    // A report after the seek was sent is the wall's answer.
    setTarget((current) => (current?.sent ? null : current));
  }, [reportedPosition]);

  if (!report || report.itemId === null) return null;
  const itemId = report.itemId;

  const can = videoControlState(report, frozen);
  const send = (action: VideoAction) => useVideoStore.getState().send(focusedOutput, itemId, action);
  const failed = report.status === "failed";
  const paused = report.status === "paused";
  const shownMs = target ? target.ms : report.positionMs;
  const times = videoTimes(shownMs, report.durationMs);

  const commitSeek = () => {
    if (!target || target.sent) return;
    send({ kind: "seek", positionMs: target.ms });
    setTarget({ ms: target.ms, sent: true });
  };

  return (
    <div
      data-testid="video-controls"
      role="group"
      aria-label={t("presentation.liveVideo.label")}
      className="px-3 py-1.5 border-b border-border flex items-center gap-2 flex-wrap shrink-0"
    >
      <span className="inline-flex items-center gap-1 text-xs text-muted">
        <Film size={14} aria-hidden="true" />
        {t("presentation.liveVideo.label")}
      </span>
      {failed ? (
        <span role="alert" className="text-xs text-warning">
          {t("presentation.liveVideo.failed")}
        </span>
      ) : (
        <>
          <span data-testid="video-elapsed" className="text-sm font-semibold tabular-nums">
            {times.elapsed} / {times.total}
          </span>
          <input
            type="range"
            aria-label={t("presentation.liveVideo.position")}
            aria-valuetext={`${times.elapsed} / ${times.total}`}
            min={0}
            max={report.durationMs ?? 0}
            step={100}
            value={Math.min(shownMs, report.durationMs ?? 0)}
            disabled={!can.seek}
            onChange={(e) => setTarget({ ms: Number(e.target.value), sent: false })}
            onPointerUp={commitSeek}
            onKeyUp={commitSeek}
            onBlur={commitSeek}
            className="flex-1 min-w-[8rem] max-w-md accent-primary disabled:opacity-50"
          />
          <span data-testid="video-remaining" className="text-sm tabular-nums text-muted">
            {times.remaining}
          </span>
        </>
      )}
      {paused ? (
        <button
          type="button"
          className={BUTTON}
          disabled={!can.pauseResume}
          onClick={() => send({ kind: "resume" })}
        >
          <Play size={12} className="fill-current" aria-hidden="true" />
          {t("presentation.liveVideo.resume")}
        </button>
      ) : (
        <button
          type="button"
          className={BUTTON}
          disabled={!can.pauseResume}
          onClick={() => send({ kind: "pause" })}
        >
          <Pause size={12} aria-hidden="true" />
          {t("presentation.liveVideo.pause")}
        </button>
      )}
      <button
        type="button"
        className={BUTTON}
        disabled={!can.restart}
        onClick={() => send({ kind: "restart" })}
      >
        <RotateCcw size={12} aria-hidden="true" />
        {t("presentation.liveVideo.restart")}
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.skip}
        onClick={() => send({ kind: "skip", deltaMs: -SKIP_MS })}
      >
        {t("presentation.liveVideo.back10")}
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.skip}
        onClick={() => send({ kind: "skip", deltaMs: SKIP_MS })}
      >
        {t("presentation.liveVideo.forward10")}
      </button>
      <button
        type="button"
        className={BUTTON}
        disabled={!can.mute}
        aria-pressed={report.muted}
        onClick={() => send({ kind: "mute", muted: !report.muted })}
      >
        {report.muted ? (
          <>
            <Volume2 size={12} aria-hidden="true" />
            {t("presentation.liveVideo.unmute")}
          </>
        ) : (
          <>
            <VolumeX size={12} aria-hidden="true" />
            {t("presentation.liveVideo.mute")}
          </>
        )}
      </button>
    </div>
  );
};
