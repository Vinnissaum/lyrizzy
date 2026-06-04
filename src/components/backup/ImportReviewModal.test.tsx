import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ImportReviewModal } from "./ImportReviewModal";
import type { ImportPlan } from "../../api/commands";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

const plan: ImportPlan = {
  kind: "set",
  schemaVersion: 2,
  counts: { songs: 2, sections: 4, sets: 1, setItems: 3, media: 1, settings: 0 },
  items: [
    {
      artifactType: "song",
      id: "s1",
      title: "Conflicting Song",
      conflict: "sameId",
      defaultAction: "skip",
    },
    {
      artifactType: "song",
      id: "s2",
      title: "New Song",
      conflict: null,
      defaultAction: "overwrite",
    },
    {
      artifactType: "media",
      id: "m1",
      title: "bg.png",
      conflict: "sameId",
      defaultAction: "skip",
    },
  ],
};

describe("ImportReviewModal", () => {
  it("emits one resolution per item, reflecting a toggled conflict", () => {
    const onConfirm = vi.fn();
    render(
      <ImportReviewModal plan={plan} onConfirm={onConfirm} onCancel={vi.fn()} />
    );

    // Two conflict items render a <select>; the no-conflict item does not.
    const selects = screen.getAllByRole("combobox");
    expect(selects).toHaveLength(2);

    // Change the first conflict (s1) from skip → overwrite.
    fireEvent.change(selects[0], { target: { value: "overwrite" } });

    fireEvent.click(screen.getByTestId("artifact-import-confirm"));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm.mock.calls[0][0]).toEqual([
      { id: "s1", action: "overwrite" },
      { id: "s2", action: "overwrite" },
      { id: "m1", action: "skip" },
    ]);
  });

  it("calls onCancel without side effects", () => {
    const onCancel = vi.fn();
    const onConfirm = vi.fn();
    render(
      <ImportReviewModal plan={plan} onConfirm={onConfirm} onCancel={onCancel} />
    );
    fireEvent.click(screen.getByText("artifact.review.cancel"));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
