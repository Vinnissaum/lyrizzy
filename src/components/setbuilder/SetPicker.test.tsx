import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("../../stores/sets", () => ({
  useSetsStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  createSet: vi.fn(),
  updateSet: vi.fn(),
  deleteSet: vi.fn(),
  getSetPlayCount: vi.fn(),
  onSetChanged: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { SetPicker } from "./SetPicker";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
import { createSet, deleteSet, getSetPlayCount, updateSet } from "../../api/commands";
import type { ServiceSet } from "../../types";

const makeSet = (id: string, name: string, itemCount = 0): ServiceSet => ({
  id,
  name,
  createdAt: 0,
  updatedAt: 0,
  items: Array.from({ length: itemCount }, (_, i) => ({ id: `${id}-item-${i}` } as any)),
});

const refresh = vi.fn().mockResolvedValue(undefined);
const setActiveSet = vi.fn().mockResolvedValue(undefined);

const mockStores = (sets: ServiceSet[], activeSetId: string | null) => {
  vi.mocked(useSetsStore).mockReturnValue({
    sets,
    isLoading: false,
    refresh,
  } as ReturnType<typeof useSetsStore>);
  vi.mocked(useLibraryStore).mockReturnValue({
    activeSetId,
    setActiveSet,
  } as ReturnType<typeof useLibraryStore>);
};

describe("SetPicker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
    setActiveSet.mockResolvedValue(undefined);
  });

  it("lists sets with counts and marks the active one", () => {
    const sets = [makeSet("s1", "Culto Manhã", 3), makeSet("s2", "Culto Noite", 5)];
    mockStores(sets, "s2");

    render(<SetPicker />);

    expect(screen.getByTestId("set-picker-active-name")).toHaveTextContent("Culto Noite");
    expect(screen.getByRole("button", { name: /Culto Manhã/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Culto Noite/ })).toBeInTheDocument();

    const activeButton = screen.getByRole("button", { name: /Culto Noite/ });
    expect(activeButton).toHaveAttribute("aria-current", "true");
    const otherButton = screen.getByRole("button", { name: /Culto Manhã/ });
    expect(otherButton).toHaveAttribute("aria-current", "false");
  });

  it("selecting a set calls setActiveSet", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s2");

    render(<SetPicker />);

    fireEvent.click(screen.getByRole("button", { name: /Culto Manhã/ }));
    expect(setActiveSet).toHaveBeenCalledWith("s1");
  });

  it("does not call setActiveSet when clicking the already-active set", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s2");

    render(<SetPicker />);

    fireEvent.click(screen.getByRole("button", { name: /Culto Noite/ }));
    expect(setActiveSet).not.toHaveBeenCalled();
  });

  it("create makes the new set active", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");
    vi.mocked(createSet).mockResolvedValue(makeSet("s3", "Novo Culto"));

    render(<SetPicker />);

    fireEvent.click(screen.getByText("sets.picker.create"));
    fireEvent.change(screen.getByPlaceholderText("sets.namePlaceholder"), {
      target: { value: "Novo Culto" },
    });
    fireEvent.submit(screen.getByPlaceholderText("sets.namePlaceholder").closest("form")!);

    await waitFor(() => {
      expect(createSet).toHaveBeenCalledWith({ name: "Novo Culto" });
    });
    expect(refresh).toHaveBeenCalled();
    expect(setActiveSet).toHaveBeenCalledWith("s3");
  });

  it("rename calls updateSet", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");
    vi.mocked(updateSet).mockResolvedValue(makeSet("s1", "Culto da Manhã"));

    render(<SetPicker />);

    const renameButtons = screen.getAllByText("sets.picker.rename");
    fireEvent.click(renameButtons[0]);

    const input = screen.getByDisplayValue("Culto Manhã");
    fireEvent.change(input, { target: { value: "Culto da Manhã" } });
    fireEvent.submit(input.closest("form")!);

    await waitFor(() => {
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ id: "s1", name: "Culto da Manhã" })
      );
    });
  });

  it("delete confirmation shows the play count and calls deleteSet", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");
    vi.mocked(getSetPlayCount).mockResolvedValue(7);
    vi.mocked(deleteSet).mockResolvedValue(undefined);

    render(<SetPicker />);

    const deleteButtons = screen.getAllByText("sets.picker.delete");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(getSetPlayCount).toHaveBeenCalledWith("s1");
    });

    await waitFor(() => {
      expect(
        screen.getByText(/sets\.picker\.deleteWithPlays.*"count":7/)
      ).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("sets.delete.confirm"));

    await waitFor(() => {
      expect(deleteSet).toHaveBeenCalledWith("s1");
    });
    expect(refresh).toHaveBeenCalled();
  });

  it("disables delete when only one set exists", () => {
    const sets = [makeSet("s1", "Único Culto")];
    mockStores(sets, "s1");

    render(<SetPicker />);

    const deleteButton = screen.getByText("sets.picker.delete");
    expect(deleteButton).toBeDisabled();

    fireEvent.click(deleteButton);
    expect(getSetPlayCount).not.toHaveBeenCalled();
  });

  it("disabled prop hides every mutating control", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");

    render(<SetPicker disabled />);

    expect(screen.queryByText("sets.picker.create")).not.toBeInTheDocument();
    expect(screen.queryByText("sets.picker.rename")).not.toBeInTheDocument();
    expect(screen.queryByText("sets.picker.delete")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Culto Noite/ }));
    expect(setActiveSet).not.toHaveBeenCalled();
  });
});
