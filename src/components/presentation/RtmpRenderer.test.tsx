import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { RtmpRenderer } from "./RtmpRenderer";

vi.mock("../../api/commands", () => ({
  startRtmpProxy: vi.fn(() => Promise.resolve({ whepUrl: "http://127.0.0.1:8889/cam/whep" })),
}));

vi.mock("../../utils/whep", () => ({
  connectWhep: vi.fn(() => Promise.resolve({ close: vi.fn() } as unknown as RTCPeerConnection)),
}));

import { startRtmpProxy } from "../../api/commands";
import { connectWhep } from "../../utils/whep";

describe("RtmpRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the MediaMTX proxy and connects WHEP to the returned URL", async () => {
    const { container } = render(<RtmpRenderer url="rtmp://192.168.100.138/live/stream0" />);

    expect(container.querySelector("video")).not.toBeNull();

    await waitFor(() => expect(startRtmpProxy).toHaveBeenCalledWith("rtmp://192.168.100.138/live/stream0"));
    await waitFor(() =>
      expect(connectWhep).toHaveBeenCalledWith(
        expect.any(HTMLVideoElement),
        "http://127.0.0.1:8889/cam/whep",
        expect.any(AbortSignal),
      )
    );
  });
});
