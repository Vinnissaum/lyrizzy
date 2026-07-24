import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, opts?: Record<string, unknown>) =>
      opts ? `${key} ${Object.values(opts).join(" ")}` : key,
  }),
}));

vi.mock("../../api/commands", () => ({
  getAppVersion: vi.fn(),
  checkForUpdates: vi.fn(),
  openExternalUrl: vi.fn(),
}));

vi.mock("../system/UpdateDialog", () => ({
  UpdateDialog: ({ update }: { update: { version: string } }) => (
    <div data-testid="update-dialog">{update.version}</div>
  ),
}));

import { AboutPanel } from "./AboutPanel";
import { getAppVersion, checkForUpdates, openExternalUrl } from "../../api/commands";
import type { UpdateCheckResult } from "../../types";

describe("AboutPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAppVersion).mockResolvedValue("1.2.3");
  });

  it("renders the product name and the version from getAppVersion()", async () => {
    render(<AboutPanel />);
    expect(screen.getByText("Lyrizzy")).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByText("about.version 1.2.3")).toBeInTheDocument(),
    );
  });

  it("renders an intrinsically-sized bordered button, not a full-width text link", async () => {
    render(<AboutPanel />);
    await waitFor(() => expect(getAppVersion).toHaveBeenCalled());
    const button = screen.getByRole("button");
    expect(button.className).toContain("px-4 py-2");
    expect(button.className).toContain("rounded-lg");
    expect(button.className).toContain("font-medium");
    expect(button.className).toContain("border");
    expect(button.className).not.toContain("w-full");
    expect(button.className).not.toContain("text-muted");
  });

  it("disables the button and shows the checking label while a check is in flight", async () => {
    let resolveCheck: (v: UpdateCheckResult) => void = () => {};
    vi.mocked(checkForUpdates).mockReturnValue(
      new Promise((resolve) => { resolveCheck = resolve; }),
    );

    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      expect(screen.getByRole("button")).toBeDisabled();
      expect(screen.getByText("updates.checking")).toBeInTheDocument();
    });

    resolveCheck({ status: "upToDate" });
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("re-enables the button with the default label once the check settles", async () => {
    vi.mocked(checkForUpdates).mockResolvedValue({ status: "upToDate" });
    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByText("updates.checkManual")).toBeInTheDocument(),
    );
    expect(screen.getByRole("button")).not.toBeDisabled();
  });

  it("renders upToDate as inline text within the panel", async () => {
    vi.mocked(checkForUpdates).mockResolvedValue({ status: "upToDate" });
    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByText("updates.upToDate")).toBeInTheDocument(),
    );
  });

  it("renders no fixed-positioned floating toast for the upToDate result", async () => {
    vi.mocked(checkForUpdates).mockResolvedValue({ status: "upToDate" });
    const { container } = render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() =>
      expect(screen.getByText("updates.upToDate")).toBeInTheDocument(),
    );
    expect(container.querySelector(".fixed")).toBeNull();
  });

  it("renders an inline error message with the error code and the text-danger token on rejection", async () => {
    vi.mocked(checkForUpdates).mockRejectedValue({
      code: "update.check_failed",
      params: {},
    });
    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() => {
      const error = screen.getByText(/update\.check_failed/);
      expect(error).toBeInTheDocument();
      expect(error.className).toContain("text-danger");
    });
  });

  it("renders the open-source blurb (ABOUT-01)", async () => {
    render(<AboutPanel />);
    await waitFor(() => expect(getAppVersion).toHaveBeenCalled());
    expect(screen.getByText("about.openSource")).toBeInTheDocument();
  });

  it("renders a contribute link labeled from about.contribute (ABOUT-02)", async () => {
    render(<AboutPanel />);
    await waitFor(() => expect(getAppVersion).toHaveBeenCalled());
    expect(
      screen.getByRole("link", { name: /about\.contribute/ }),
    ).toBeInTheDocument();
  });

  it("opens the exact repository URL in the system browser when contribute is activated (ABOUT-03)", async () => {
    vi.mocked(openExternalUrl).mockResolvedValue();
    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("link", { name: /about\.contribute/ }));
    await waitFor(() =>
      expect(openExternalUrl).toHaveBeenCalledWith(
        "https://github.com/Vinnissaum/lyrizzy",
      ),
    );
  });

  it("keeps the panel functional with no error UI when opening the URL rejects (ABOUT-04)", async () => {
    vi.mocked(openExternalUrl).mockRejectedValue(new Error("boom"));
    const { container } = render(<AboutPanel />);
    fireEvent.click(screen.getByRole("link", { name: /about\.contribute/ }));
    await waitFor(() => expect(openExternalUrl).toHaveBeenCalled());
    expect(screen.getByText("about.openSource")).toBeInTheDocument();
    expect(container.querySelector(".text-danger")).toBeNull();
  });

  it("opens UpdateDialog with the returned info when an update is available", async () => {
    vi.mocked(checkForUpdates).mockResolvedValue({
      status: "updateAvailable",
      info: { version: "9.9.9", currentVersion: "1.2.3" },
    });
    render(<AboutPanel />);
    fireEvent.click(screen.getByRole("button"));

    await waitFor(() =>
      expect(screen.getByTestId("update-dialog")).toHaveTextContent("9.9.9"),
    );
  });
});
