import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StreamProfileEditor } from "./StreamProfileEditor";
import type { RtspTransport, StreamProfile, WebViewMode } from "../../types";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

function Harness({
  mode = "rtsp" as WebViewMode,
  initialProfiles = [] as StreamProfile[],
  fallbackUrl = "rtsp://192.168.1.10/1",
  fallbackRtspTransport = "udp" as RtspTransport,
}) {
  const [profiles, setProfiles] = React.useState<StreamProfile[]>(initialProfiles);
  return (
    <StreamProfileEditor
      itemId="item-1"
      mode={mode}
      profiles={profiles}
      fallbackUrl={fallbackUrl}
      fallbackRtspTransport={fallbackRtspTransport}
      onChange={setProfiles}
    />
  );
}

describe("StreamProfileEditor", () => {
  it("adds a profile pre-filled from the fallback url when the first is added", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("webview.editor.profiles.add"));
    const urlInputs = screen.getAllByDisplayValue("rtsp://192.168.1.10/1");
    expect(urlInputs).toHaveLength(1);
  });

  it("adding two profiles renders two profile blocks, removing one leaves one", () => {
    render(<Harness />);
    fireEvent.click(screen.getByText("webview.editor.profiles.add"));
    fireEvent.click(screen.getByText("webview.editor.profiles.add"));

    let removeButtons = screen.getAllByText("webview.editor.profiles.remove");
    expect(removeButtons).toHaveLength(2);

    fireEvent.click(removeButtons[0]);
    removeButtons = screen.getAllByText("webview.editor.profiles.remove");
    expect(removeButtons).toHaveLength(1);
  });

  it("renders the rtsp transport control per profile only in rtsp mode", () => {
    const profiles: StreamProfile[] = [
      { id: "p1", label: "Main", url: "rtsp://cam/1", rtspTransport: "udp" },
    ];
    const { rerender } = render(<Harness mode="rtsp" initialProfiles={profiles} />);
    expect(screen.getByText("webview.editor.rtsp.transport")).toBeTruthy();

    rerender(<Harness mode="rtmp" initialProfiles={profiles} />);
    expect(screen.queryByText("webview.editor.rtsp.transport")).toBeNull();
  });

  it("renders help text explaining profiles are independent of OBS/YouTube's feed", () => {
    render(<Harness />);
    expect(screen.getByText("webview.editor.profiles.hint")).toBeTruthy();
  });

  it("editing a profile's label and url updates it via onChange", () => {
    const onChange = vi.fn();
    const profiles: StreamProfile[] = [{ id: "p1", label: "", url: "", rtspTransport: "udp" }];
    render(
      <StreamProfileEditor
        itemId="item-1"
        mode="rtsp"
        profiles={profiles}
        fallbackUrl=""
        fallbackRtspTransport="udp"
        onChange={onChange}
      />
    );

    fireEvent.change(screen.getByPlaceholderText("webview.editor.profiles.labelPlaceholder"), {
      target: { value: "Main (4K)" },
    });
    expect(onChange).toHaveBeenCalledWith([{ id: "p1", label: "Main (4K)", url: "", rtspTransport: "udp" }]);
  });
});
