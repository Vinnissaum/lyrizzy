import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { StreamProxyRenderer } from "./StreamProxyRenderer";
import type { StreamSource } from "../../types";

vi.mock("../../api/commands", () => ({
  startStreamProxy: vi.fn(() => Promise.resolve({ whepUrl: "http://127.0.0.1:8889/cam/whep" })),
}));

vi.mock("../../utils/whep", () => ({
  connectWhep: vi.fn(() => Promise.resolve({ close: vi.fn() } as unknown as RTCPeerConnection)),
}));

import { startStreamProxy } from "../../api/commands";
import { connectWhep } from "../../utils/whep";

describe("StreamProxyRenderer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts the MediaMTX proxy and connects WHEP to the returned URL", async () => {
    const source: StreamSource = { kind: "rtmp", url: "rtmp://192.168.100.138/live/stream0" };
    const { container } = render(<StreamProxyRenderer source={source} />);

    expect(container.querySelector("video")).not.toBeNull();

    await waitFor(() => expect(startStreamProxy).toHaveBeenCalledWith(source));
    await waitFor(() =>
      expect(connectWhep).toHaveBeenCalledWith(
        expect.any(HTMLVideoElement),
        "http://127.0.0.1:8889/cam/whep",
        expect.any(AbortSignal),
      )
    );
  });

  it("forwards an SRT source unchanged to the proxy", async () => {
    const source: StreamSource = {
      kind: "srt",
      config: { host: "192.168.100.138", port: 9000, mode: "listener", encrypted: false },
    };
    render(<StreamProxyRenderer source={source} />);
    await waitFor(() => expect(startStreamProxy).toHaveBeenCalledWith(source));
  });
});
