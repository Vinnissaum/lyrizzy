import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { WebViewRenderer } from "./WebViewRenderer";

vi.mock("../../utils/urlAllowlist", () => ({
  isUrlAllowed: () => ({ ok: true }),
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
