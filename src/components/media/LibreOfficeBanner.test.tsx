import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import { LibreOfficeBanner } from "./LibreOfficeBanner";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";

describe("LibreOfficeBanner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders nothing when LibreOffice is available", async () => {
    vi.mocked(invoke).mockResolvedValue(true);
    render(<LibreOfficeBanner />);
    await waitFor(() =>
      expect(vi.mocked(invoke)).toHaveBeenCalledWith("check_libreoffice")
    );
    expect(screen.queryByTestId("libreoffice-banner")).not.toBeInTheDocument();
  });

  it("shows banner when LibreOffice is missing", async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    render(<LibreOfficeBanner />);
    await waitFor(() =>
      expect(screen.getByTestId("libreoffice-banner")).toBeInTheDocument()
    );
  });

  it("dismisses the banner on button click", async () => {
    vi.mocked(invoke).mockResolvedValue(false);
    render(<LibreOfficeBanner />);
    await waitFor(() => screen.getByTestId("libreoffice-banner"));
    fireEvent.click(screen.getByTestId("libreoffice-banner-dismiss"));
    expect(screen.queryByTestId("libreoffice-banner")).not.toBeInTheDocument();
  });

  it("renders nothing when check_libreoffice rejects", async () => {
    vi.mocked(invoke).mockRejectedValue(new Error("tauri error"));
    render(<LibreOfficeBanner />);
    await new Promise((r) => setTimeout(r, 0));
    expect(screen.queryByTestId("libreoffice-banner")).not.toBeInTheDocument();
  });
});
