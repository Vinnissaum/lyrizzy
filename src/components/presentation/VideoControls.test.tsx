import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VideoControls } from "./VideoControls";
import { usePresentationStore } from "../../stores/presentation";
import { useVideoStore } from "../../stores/video";
import { useSettingsStore } from "../../stores/settings";
import type { OutputId, PresentationState, VideoReport } from "../../types";

// P23 S4: the operator's video strip. The real strip, stores and event
// wrappers; Tauri's event bus is stubbed so the commands it sends can be read.

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));
vi.mock("@tauri-apps/api/event", () => ({
  emit: vi.fn(() => Promise.resolve()),
  listen: vi.fn(() => Promise.resolve(() => {})),
}));

import { emit } from "@tauri-apps/api/event";

const report = (over: Partial<VideoReport> = {}): VideoReport => ({
  output: "one",
  itemId: "vid-1",
  status: "playing",
  positionMs: 65_000,
  durationMs: 200_000,
  muted: false,
  ...over,
});

const live = (mode: PresentationState["mode"] = "live"): PresentationState => ({
  mode,
  currentItemIndex: 0,
  currentSlideIndex: 0,
  itemSlideCounts: [1],
  set: {
    id: "set-1",
    name: "Culto",
    createdAt: 0,
    updatedAt: 0,
    items: [{ id: "vid-1", setId: "set-1", itemType: "media", mediaId: "m", mediaKind: "video", sortOrder: 0 }],
  },
});

function wall(r: VideoReport | null, output: OutputId = "one") {
  act(() => {
    useVideoStore.setState((s) => ({ reports: { ...s.reports, [output]: r } }));
  });
}

function show(r: VideoReport | null = report(), mode: PresentationState["mode"] = "live") {
  usePresentationStore.setState({ state: live(mode), focusedOutput: "one" });
  useVideoStore.setState({ reports: { one: r, two: null } });
  return render(<VideoControls />);
}

const sent = () => vi.mocked(emit).mock.calls.filter(([e]) => e === "video_command").map(([, p]) => p);
const button = (name: string | RegExp) => screen.getByRole("button", { name });
const bar = () => screen.getByRole("slider", { name: "Posição do vídeo" });

describe("VideoControls (P23)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({ mirrorEnabled: false });
  });

  it("shows time, bar and every control for a playing video", () => {
    show();

    expect(screen.getByRole("group", { name: "Vídeo" })).toBeInTheDocument();
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("01:05 / 03:20");
    expect(screen.getByTestId("video-remaining")).toHaveTextContent("−02:15");
    expect(bar()).toHaveValue("65000");
    expect(bar()).toHaveAttribute("max", "200000");
    expect(Number(bar().getAttribute("value") ?? (bar() as HTMLInputElement).value) / 200_000).toBe(0.325);
    for (const name of ["Pausar", "Reiniciar", "−10 s", "+10 s", "Silenciar"]) {
      expect(button(name)).toBeEnabled();
    }
    expect(bar()).toBeEnabled();
    expect(screen.queryByRole("button", { name: "Retomar" })).not.toBeInTheDocument();
  });

  it("the strip follows the focused output and goes when the wall withdraws", () => {
    show(report({ positionMs: 10_000 }));
    wall(report({ output: "two", positionMs: 90_000 }), "two");
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("00:10 / 03:20");

    act(() => usePresentationStore.setState({ focusedOutput: "two" }));
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("01:30 / 03:20");

    wall(report({ output: "two", itemId: null }), "two");
    expect(screen.queryByTestId("video-controls")).not.toBeInTheDocument();
  });

  it("Pausar sends pause and Retomar sends resume", () => {
    show();

    fireEvent.click(button("Pausar"));
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "pause" } }]);

    wall(report({ status: "paused" }));
    expect(screen.queryByRole("button", { name: "Pausar" })).not.toBeInTheDocument();
    fireEvent.click(button("Retomar"));
    expect(sent()[1]).toEqual({ output: "one", itemId: "vid-1", action: { kind: "resume" } });
  });

  it("Reiniciar sends restart", () => {
    show(report({ status: "paused" }));
    fireEvent.click(button("Reiniciar"));
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "restart" } }]);
  });

  it("the skip buttons send ten seconds either way", () => {
    show();
    fireEvent.click(button("−10 s"));
    fireEvent.click(button("+10 s"));
    expect(sent()).toEqual([
      { output: "one", itemId: "vid-1", action: { kind: "skip", deltaMs: -10_000 } },
      { output: "one", itemId: "vid-1", action: { kind: "skip", deltaMs: 10_000 } },
    ]);
  });

  it("clicking the bar seeks to that fraction", () => {
    show();
    // A click on a range input: `input` with the clicked value, then `change`
    // when the button comes up.
    fireEvent.input(bar(), { target: { value: "50000" } });
    fireEvent.change(bar());
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "seek", positionMs: 50_000 } }]);

    // The pointer coming up as well sends nothing more.
    fireEvent.pointerUp(bar());
    expect(sent()).toHaveLength(1);
  });

  it("dragging the bar seeks on release only", () => {
    show();
    fireEvent.input(bar(), { target: { value: "30000" } });
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("00:30 / 03:20");
    fireEvent.input(bar(), { target: { value: "40000" } });
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("00:40 / 03:20");
    // The wall keeps playing meanwhile; the strip keeps the dragged-to time.
    wall(report({ positionMs: 66_000 }));
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("00:40 / 03:20");
    expect(sent()).toEqual([]);

    fireEvent.pointerUp(bar());
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "seek", positionMs: 40_000 } }]);
    // Other release signals for the same drag send nothing more.
    fireEvent.change(bar());
    fireEvent.blur(bar());
    expect(sent()).toHaveLength(1);

    // The wall answers from there; the strip follows the wall again.
    wall(report({ positionMs: 40_000 }));
    wall(report({ positionMs: 41_000 }));
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("00:41 / 03:20");
  });

  it("Silenciar and Ativar som send the mute command", () => {
    show();
    fireEvent.click(button("Silenciar"));
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "mute", muted: true } }]);

    wall(report({ muted: true }));
    fireEvent.click(button("Ativar som"));
    expect(sent()[1]).toEqual({ output: "one", itemId: "vid-1", action: { kind: "mute", muted: false } });
  });

  it("controls reach both outputs while Simultânea is on", () => {
    useSettingsStore.setState({ mirrorEnabled: true });
    show();
    fireEvent.click(button("Pausar"));
    expect(sent()).toEqual([
      { output: "one", itemId: "vid-1", action: { kind: "pause" } },
      { output: "two", itemId: "vid-1", action: { kind: "pause" } },
    ]);

    vi.mocked(emit).mockClear();
    act(() => useSettingsStore.setState({ mirrorEnabled: false }));
    fireEvent.click(button("Silenciar"));
    expect(sent()).toEqual([{ output: "one", itemId: "vid-1", action: { kind: "mute", muted: true } }]);
  });

  it("a frozen output disables the playback controls", () => {
    show(report({ status: "paused" }), "frozen");
    for (const name of ["Retomar", "Reiniciar", "−10 s", "+10 s"]) {
      expect(button(name)).toBeDisabled();
    }
    expect(bar()).toBeDisabled();
    expect(button("Silenciar")).toBeEnabled();
  });

  it("an unknown duration shows dashes and disables seeking", () => {
    show(report({ durationMs: null, status: "loading" }));
    expect(screen.getByTestId("video-elapsed")).toHaveTextContent("01:05 / --:--");
    expect(screen.getByTestId("video-remaining")).toHaveTextContent("--:--");
    expect(bar()).toBeDisabled();
    expect(button("−10 s")).toBeDisabled();
    expect(button("+10 s")).toBeDisabled();
    expect(button("Pausar")).toBeEnabled();
    expect(button("Reiniciar")).toBeEnabled();
  });

  it("a failed video shows the error and disables every control", () => {
    show(report({ status: "failed" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Não foi possível reproduzir o vídeo");
    for (const b of screen.getAllByRole("button")) expect(b).toBeDisabled();
    expect(screen.queryByRole("slider")).not.toBeInTheDocument();
  });

  it("an ended video keeps Reiniciar only", () => {
    show(report({ status: "ended", positionMs: 200_000 }));
    expect(screen.getByTestId("video-remaining")).toHaveTextContent("−00:00");
    expect(button("Reiniciar")).toBeEnabled();
    expect(button("Pausar")).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Retomar" })).not.toBeInTheDocument();
  });
});
