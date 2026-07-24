import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent, act } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(" ")}` : key,
  }),
}));

vi.mock("../../api/commands", () => ({
  applyUpdateAndRestart: vi.fn(),
  onUpdateProgress: vi.fn(),
}));

import { UpdateDialog } from "./UpdateDialog";
import { applyUpdateAndRestart, onUpdateProgress } from "../../api/commands";
import type { UpdateInfo, UpdateProgress } from "../../types";

const update: UpdateInfo = { version: "2.0.0", currentVersion: "1.0.0" };

describe("UpdateDialog", () => {
  let progressCb: ((p: UpdateProgress) => void) | null;
  let unlistenSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    progressCb = null;
    unlistenSpy = vi.fn();
    vi.mocked(onUpdateProgress).mockImplementation((cb) => {
      progressCb = cb;
      return Promise.resolve(unlistenSpy);
    });
  });

  const clickApply = () => {
    fireEvent.click(screen.getByRole("button", { name: "updates.applyButton" }));
  };

  it("does not subscribe to progress until apply is clicked", () => {
    render(<UpdateDialog update={update} onClose={() => {}} />);
    expect(onUpdateProgress).not.toHaveBeenCalled();
  });

  it("unsubscribes from progress on unmount (no listener leak)", async () => {
    vi.mocked(applyUpdateAndRestart).mockReturnValue(new Promise(() => {}));
    const { unmount } = render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();
    await waitFor(() => expect(onUpdateProgress).toHaveBeenCalledTimes(1));

    unmount();
    await waitFor(() => expect(unlistenSpy).toHaveBeenCalledTimes(1));
  });

  it("renders a determinate progress bar and integer percent when total is known", async () => {
    vi.mocked(applyUpdateAndRestart).mockReturnValue(new Promise(() => {}));
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => { progressCb!({ downloaded: 5, total: 10 }); });

    await waitFor(() =>
      expect(screen.getByText("updates.downloading 50")).toBeInTheDocument(),
    );
  });

  it("renders an indeterminate bar and no NaN when total is null", async () => {
    vi.mocked(applyUpdateAndRestart).mockReturnValue(new Promise(() => {}));
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => { progressCb!({ downloaded: 5, total: null }); });

    await waitFor(() =>
      expect(screen.getByText("updates.downloadingUnknown")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/NaN/)).toBeNull();
  });

  it("switches to the installing phase once the download completes", async () => {
    vi.mocked(applyUpdateAndRestart).mockReturnValue(new Promise(() => {}));
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();
    await waitFor(() => expect(progressCb).not.toBeNull());

    act(() => { progressCb!({ downloaded: 10, total: 10 }); });

    await waitFor(() =>
      expect(screen.getByTestId("installing-status")).toBeInTheDocument(),
    );
    expect(screen.queryByText(/updates\.downloading /)).toBeNull();
  });

  it("shows the dedicated signature-invalid message on that error code", async () => {
    vi.mocked(applyUpdateAndRestart).mockRejectedValue({
      code: "update.signature_invalid",
      params: {},
    });
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();

    await waitFor(() =>
      expect(screen.getByText("updates.signatureInvalid")).toBeInTheDocument(),
    );
  });

  it("shows the dedicated already-in-progress message on that error code", async () => {
    vi.mocked(applyUpdateAndRestart).mockRejectedValue({
      code: "update.already_in_progress",
      params: {},
    });
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();

    await waitFor(() =>
      expect(screen.getByText("updates.alreadyInProgress")).toBeInTheDocument(),
    );
  });

  it("shows a generic apply-failed message with the detail for any other error code", async () => {
    vi.mocked(applyUpdateAndRestart).mockRejectedValue({
      code: "update.download_failed",
      params: {},
    });
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();

    await waitFor(() =>
      expect(
        screen.getByText("updates.applyFailed update.download_failed"),
      ).toBeInTheDocument(),
    );
  });

  it("re-enables both the apply and close buttons after any failure", async () => {
    vi.mocked(applyUpdateAndRestart).mockRejectedValue({
      code: "update.download_failed",
      params: {},
    });
    render(<UpdateDialog update={update} onClose={() => {}} />);
    clickApply();

    await waitFor(() =>
      expect(screen.getByRole("button", { name: "updates.applyButton" })).not.toBeDisabled(),
    );
    expect(screen.getByTestId("dialog-close")).not.toBeDisabled();
  });
});
