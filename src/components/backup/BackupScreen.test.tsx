import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ImportCard } from "./BackupScreen";
import type { ImportPlan, ArchiveInspection } from "../../api/commands";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
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
}));

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
});
