import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { ArtifactImportCard } from "./BackupScreen";
import type { ImportPlan } from "../../api/commands";

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

const planArtifactImport = vi.fn();
vi.mock("../../api/commands", () => ({
  planArtifactImport: (...args: unknown[]) => planArtifactImport(...args),
  importArtifact: vi.fn().mockResolvedValue({}),
  onBackupProgress: vi.fn().mockResolvedValue(() => {}),
  // unused-by-this-test exports referenced by the module:
  exportLibrary: vi.fn(),
  inspectArchive: vi.fn(),
  restoreLibrary: vi.fn(),
}));

describe("ArtifactImportCard", () => {
  beforeEach(() => vi.clearAllMocks());

  it("opens the review modal for a selective (non-library) plan", async () => {
    planArtifactImport.mockResolvedValueOnce(selectivePlan);
    render(<ArtifactImportCard onLibraryFile={vi.fn()} />);

    fireEvent.click(screen.getByTestId("cta-import-artifact"));

    await waitFor(() =>
      expect(screen.getByTestId("artifact-import-confirm")).toBeInTheDocument()
    );
  });

  it("routes a library plan to the restore flow instead of the modal", async () => {
    planArtifactImport.mockResolvedValueOnce(libraryPlan);
    const onLibraryFile = vi.fn();
    render(<ArtifactImportCard onLibraryFile={onLibraryFile} />);

    fireEvent.click(screen.getByTestId("cta-import-artifact"));

    await waitFor(() => expect(onLibraryFile).toHaveBeenCalledWith("/tmp/in.tlz"));
    expect(screen.queryByTestId("artifact-import-confirm")).not.toBeInTheDocument();
  });
});
