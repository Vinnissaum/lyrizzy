import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WebViewRenderer } from "./WebViewRenderer";
import type { StreamSource } from "../../types";

vi.mock("../../utils/urlAllowlist", () => ({
  isUrlAllowed: () => ({ ok: true }),
}));

vi.mock("./StreamProxyRenderer", () => ({
  StreamProxyRenderer: ({ source }: { source: StreamSource }) => (
    <div data-testid="stream-proxy" data-source={JSON.stringify(source)} />
  ),
}));

describe("WebViewRenderer — basic auth injection", () => {
  it("embeds credentials in the iframe URL when both are provided", () => {
    const { container } = render(
      <WebViewRenderer
        config={{
          mode: "iframe",
          url: "http://192.168.1.10/login",
          basicAuthUser: "admin",
          basicAuthPass: "secret",
        }}
      />
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.src).toBe("http://admin:secret@192.168.1.10/login");
  });

  it("leaves the iframe URL untouched when credentials are absent", () => {
    const { container } = render(
      <WebViewRenderer config={{ mode: "iframe", url: "http://192.168.1.10/login" }} />
    );
    const iframe = container.querySelector("iframe");
    expect(iframe?.src).toBe("http://192.168.1.10/login");
  });

  it("embeds credentials in the MJPEG stream URL", () => {
    const { container } = render(
      <WebViewRenderer
        config={{
          mode: "mjpeg",
          url: "http://192.168.1.10/stream",
          basicAuthUser: "admin",
          basicAuthPass: "secret",
        }}
      />
    );
    const img = container.querySelector("img");
    expect(img?.src).toBe("http://admin:secret@192.168.1.10/stream");
  });
});

describe("WebViewRenderer — camera stream profiles", () => {
  const profiles = [
    { id: "p1", label: "Main", url: "rtsp://192.168.1.20/main", rtspTransport: "tcp" as const },
    { id: "p2", label: "Sub", url: "rtsp://192.168.1.20/sub", rtspTransport: "udp" as const },
  ];

  it("renders the active profile's URL when activeProfileId is set", () => {
    const { getByTestId } = render(
      <WebViewRenderer
        config={{
          mode: "rtsp",
          url: "rtsp://192.168.1.20/fallback",
          profiles,
          activeProfileId: "p2",
        }}
      />
    );
    const proxy = getByTestId("stream-proxy");
    const source = JSON.parse(proxy.getAttribute("data-source")!);
    expect(source).toEqual({
      kind: "rtsp",
      url: "rtsp://192.168.1.20/sub",
      transport: "udp",
    });
  });

  it("changes the rendered source when activeProfileId switches between renders", () => {
    const { getByTestId, rerender } = render(
      <WebViewRenderer
        config={{
          mode: "rtsp",
          url: "rtsp://192.168.1.20/fallback",
          profiles,
          activeProfileId: "p1",
        }}
      />
    );
    let source = JSON.parse(getByTestId("stream-proxy").getAttribute("data-source")!);
    expect(source.url).toBe("rtsp://192.168.1.20/main");

    rerender(
      <WebViewRenderer
        config={{
          mode: "rtsp",
          url: "rtsp://192.168.1.20/fallback",
          profiles,
          activeProfileId: "p2",
        }}
      />
    );
    source = JSON.parse(getByTestId("stream-proxy").getAttribute("data-source")!);
    expect(source.url).toBe("rtsp://192.168.1.20/sub");
  });
});
