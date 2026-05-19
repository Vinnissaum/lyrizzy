import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { FfmpegBanner } from "./FfmpegBanner";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("FfmpegBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when ffprobe is available", async () => {
    vi.mocked(invoke).mockResolvedValue(true);
    render(<FfmpegBanner />);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("check_ffprobe")
    );
    expect(screen.queryByTestId("ffmpeg-banner")).not.toBeInTheDocument();
  });

  it("shows banner when ffprobe is missing", async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    render(<FfmpegBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("ffmpeg-banner")).toBeInTheDocument()
    );
    expect(screen.getByText("ffmpeg não encontrado")).toBeInTheDocument();
  });

  it("dismisses the banner on button click", async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    render(<FfmpegBanner />);
    await waitFor(() => screen.getByTestId("ffmpeg-banner"));
    fireEvent.click(screen.getByTestId("ffmpeg-banner-dismiss"));
    expect(screen.queryByTestId("ffmpeg-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when check_ffprobe rejects", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("tauri error"));
    render(<FfmpegBanner />);
    // wait a tick for the promise to settle
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("ffmpeg-banner")).not.toBeInTheDocument();
  });
});
