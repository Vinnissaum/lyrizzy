import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { QuickWebViewRenderer } from "./QuickWebViewRenderer";

vi.mock("../../utils/urlAllowlist", () => ({
  isUrlAllowed: () => ({ ok: true }),
}));

describe("QuickWebViewRenderer", () => {
  it("renders an iframe for the given URL", () => {
    const { container } = render(
      <QuickWebViewRenderer url="http://192.168.1.10/cam" />
    );
    const iframe = container.querySelector("iframe");
    expect(iframe).toBeTruthy();
    expect(iframe?.src).toContain("192.168.1.10");
  });

  it("wraps WebViewRenderer in iframe mode", () => {
    const { container } = render(
      <QuickWebViewRenderer url="http://example.com/stream" />
    );
    expect(container.querySelector("iframe")).not.toBeNull();
  });
});
