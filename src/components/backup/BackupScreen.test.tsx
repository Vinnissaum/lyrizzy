import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportCard } from "./BackupScreen";
import type { ImportPlan, ArchiveInspection } from "../../api/commands";

const tStub = (key: string | string[]) => {
  // formatCommandError resolves a [code, fallback] key array.
  if (Array.isArray(key)) return key[0];
  // A typeable confirm word so the destructive replace path can be driven.
  return key === "backup.import.confirmWord" ? "SUBSTITUIR" : key;
};

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: tStub,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("@tauri-apps/plugin-dialog", () => ({
  open: vi.fn().mockResolvedValue("/tmp/in.tlz"),
  save: vi.fn(),
}));

const selectivePlan: ImportPlan = {
  kind: "songs",
  schemaVersion: 2,
  counts: { songs: 1, sections: 1, sets: 0, setItems: 0, media: 0, settings: 0 },
  items: [
    { artifactType: "song", id: "s1", title: "X", conflict: null, defaultAction: "overwrite" },
  ],
};

const libraryPlan: ImportPlan = {
  kind: "library",
  schemaVersion: 2,
  counts: { songs: 5, sections: 0, sets: 0, setItems: 0, media: 0, settings: 0 },
  items: [],
};

const libraryInspection: ArchiveInspection = {
  schemaVersion: 2,
  exportedAt: 0,
  appVersion: "1.0.0",
  counts: { songs: 5, sections: 0, sets: 0, setItems: 0, media: 0, settings: 0 },
};

const planArtifactImport = vi.fn();
const inspectArchive = vi.fn();
vi.mock("../../api/commands", () => ({
  planArtifactImport: (...args: unknown[]) => planArtifactImport(...args),
  inspectArchive: (...args: unknown[]) => inspectArchive(...args),
  importArtifact: vi.fn().mockResolvedValue({}),
  restoreLibrary: vi.fn().mockResolvedValue({}),
  onBackupProgress: vi.fn().mockResolvedValue(() => {}),
  exportLibrary: vi.fn(),
  normalizeError: (err: unknown) =>
    err && typeof err === "object" && "code" in err
      ? err
      : { code: "legacy", params: { message: String(err) } },
}));

const restoreLibrary = vi.mocked(
  (await import("../../api/commands")).restoreLibrary,
);

describe("ImportCard (unified)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the conflict-review modal for a selective (non-library) plan", async () => {
    planArtifactImport.mockResolvedValueOnce(selectivePlan);
    render(<ImportCard />);

    fireEvent.click(screen.getByTestId("cta-import"));

    await waitFor(() =>
      expect(screen.getByTestId("artifact-import-confirm")).toBeInTheDocument()
    );
    // Never falls through to the destructive restore UI for a selective file.
    expect(screen.queryByText("backup.import.restoreButton")).not.toBeInTheDocument();
    expect(inspectArchive).not.toHaveBeenCalled();
  });

  it("shows the Replace/Merge restore UI for a full-library plan", async () => {
    planArtifactImport.mockResolvedValueOnce(libraryPlan);
    inspectArchive.mockResolvedValueOnce(libraryInspection);
    render(<ImportCard />);

    fireEvent.click(screen.getByTestId("cta-import"));

    await waitFor(() =>
      expect(screen.getByText("backup.import.restoreButton")).toBeInTheDocument()
    );
    // The selective conflict-review modal must NOT be shown for a library file.
    expect(screen.queryByTestId("artifact-import-confirm")).not.toBeInTheDocument();
    expect(inspectArchive).toHaveBeenCalledWith("/tmp/in.tlz");
  });

  it("names the failure instead of rendering [object Object] when a restore fails", async () => {
    planArtifactImport.mockResolvedValueOnce(libraryPlan);
    inspectArchive.mockResolvedValueOnce(libraryInspection);
    restoreLibrary.mockRejectedValueOnce({
      code: "backup.restore_failed",
      params: { detail: "FOREIGN KEY constraint failed" },
    });
    render(<ImportCard />);

    fireEvent.click(screen.getByTestId("cta-import"));
    await waitFor(() =>
      expect(screen.getByText("backup.import.restoreButton")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("SUBSTITUIR"), {
      target: { value: "SUBSTITUIR" },
    });
    fireEvent.click(screen.getByText("backup.import.restoreButton"));

    await waitFor(() =>
      expect(screen.getByText("error.backup.restore_failed")).toBeInTheDocument()
    );
    expect(screen.queryByText("[object Object]")).not.toBeInTheDocument();
  });

  it("states that the presentation ledger was cleared after a replace restore", async () => {
    planArtifactImport.mockResolvedValueOnce(libraryPlan);
    inspectArchive.mockResolvedValueOnce(libraryInspection);
    restoreLibrary.mockResolvedValueOnce({
      songsImported: 1, songsSkipped: 0, songsOverwritten: 0, songsCopied: 0,
      sectionsImported: 0, setsImported: 0, setsSkipped: 0, setsOverwritten: 0,
      setsCopied: 0, setItemsImported: 0, mediaImported: 0, mediaSkipped: 0,
      mediaOverwritten: 0, mediaCopied: 0, mediaFailed: 0, settingsImported: 0,
    });
    render(<ImportCard />);

    fireEvent.click(screen.getByTestId("cta-import"));
    await waitFor(() =>
      expect(screen.getByText("backup.import.restoreButton")).toBeInTheDocument()
    );
    fireEvent.change(screen.getByPlaceholderText("SUBSTITUIR"), {
      target: { value: "SUBSTITUIR" },
    });
    fireEvent.click(screen.getByText("backup.import.restoreButton"));

    await waitFor(() =>
      expect(screen.getByText("backup.import.ledgerCleared")).toBeInTheDocument()
    );
  });
});
