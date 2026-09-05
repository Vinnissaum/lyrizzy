import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { WebViewSetItemEditor } from "./WebViewSetItemEditor";
import { updateSetItem } from "../../api/commands";
import i18n from "../../i18n";
import type { SetItem } from "../../types";

const t = i18n.t.bind(i18n);

vi.mock("../../api/commands", () => ({
  updateSetItem: vi.fn().mockResolvedValue({}),
}));

function makeItem(overrides: Partial<SetItem> = {}): SetItem {
  return {
    id: "item-1",
    setId: "set-1",
    itemType: "web_view",
    sortOrder: 0,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("WebViewSetItemEditor", () => {
  it("offers exactly three mode radios", () => {
    const item = makeItem({
      webviewConfig: { mode: "iframe", url: "https://example.com" },
    });
    render(<WebViewSetItemEditor item={item} />);
    const radios = screen.getAllByRole("radio", { name: /.*/ }).filter(
      (el) => el.getAttribute("name") === `webview-mode-${item.id}`
    );
    expect(radios).toHaveLength(3);
  });

  it("does not render the stream profile section on iframe mode", () => {
    const item = makeItem({
      webviewConfig: { mode: "iframe", url: "https://example.com" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.queryByText(t("webview.editor.profiles.label"))).not.toBeInTheDocument();
  });

  it("renders the stream profile section on rtsp mode", () => {
    const item = makeItem({
      webviewConfig: { mode: "rtsp", url: "rtsp://192.168.15.50/1" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.getByText(t("webview.editor.profiles.label"))).toBeInTheDocument();
  });

  it("renders the stream profile section on mjpeg mode", () => {
    const item = makeItem({
      webviewConfig: { mode: "mjpeg", url: "http://192.168.1.10/stream" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.getByText(t("webview.editor.profiles.label"))).toBeInTheDocument();
  });

  it("shows the unsupported-mode banner for a legacy rtmp item", () => {
    const item = makeItem({
      webviewConfig: { mode: "rtmp" as never, url: "rtmp://192.168.100.138/live/stream0" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.getByText(t("webview.editor.unsupportedMode"))).toBeInTheDocument();
  });

  it("shows the unsupported-mode banner for a legacy srt item", () => {
    const item = makeItem({
      webviewConfig: { mode: "srt" as never, url: "" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.getByText(t("webview.editor.unsupportedMode"))).toBeInTheDocument();
  });

  it("shows the unsupported-mode banner for a legacy multicast item", () => {
    const item = makeItem({
      webviewConfig: { mode: "multicast" as never, url: "" },
    });
    render(<WebViewSetItemEditor item={item} />);
    expect(screen.getByText(t("webview.editor.unsupportedMode"))).toBeInTheDocument();
  });

  it("switching a legacy item to rtsp and saving persists a supported config with no legacy keys", async () => {
    const item = makeItem({
      webviewConfig: { mode: "rtmp" as never, url: "rtmp://192.168.100.138/live/stream0" },
    });
    render(<WebViewSetItemEditor item={item} />);

    // Banner is present before switching.
    expect(screen.getByText(t("webview.editor.unsupportedMode"))).toBeInTheDocument();

    const rtspRadio = screen
      .getAllByRole("radio")
      .find(
        (el) =>
          el.getAttribute("name") === `webview-mode-${item.id}` &&
          el.getAttribute("value") === "rtsp"
      ) as HTMLInputElement;
    fireEvent.click(rtspRadio);

    // Banner clears as soon as the operator picks a supported mode.
    expect(screen.queryByText(t("webview.editor.unsupportedMode"))).not.toBeInTheDocument();

    const urlInput = screen.getByPlaceholderText("rtsp://192.168.15.50/1");
    fireEvent.change(urlInput, { target: { value: "rtsp://192.168.15.60/1" } });
    fireEvent.blur(urlInput);

    await waitFor(() => expect(updateSetItem).toHaveBeenCalled());

    const call = (updateSetItem as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(call.id).toBe(item.id);
    expect(call.webviewConfig.mode).toBe("rtsp");
    expect(call.webviewConfig.url).toBe("rtsp://192.168.15.60/1");
    expect(call.webviewConfig).not.toHaveProperty("srtConfig");
    expect(call.webviewConfig).not.toHaveProperty("multicastConfig");
  });
});
