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
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { SetManagerDialog } from "./SetManagerDialog";
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

describe("SetManagerDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    refresh.mockResolvedValue(undefined);
    setActiveSet.mockResolvedValue(undefined);
  });

  it("lists every set with its item count", () => {
    const sets = [makeSet("s1", "Culto Manhã", 3), makeSet("s2", "Culto Noite", 5)];
    mockStores(sets, "s1");

    render(<SetManagerDialog onClose={vi.fn()} />);

    expect(screen.getByText("sets.manage.title")).toBeInTheDocument();
    expect(screen.getByText("Culto Manhã")).toBeInTheDocument();
    expect(screen.getByText("Culto Noite")).toBeInTheDocument();
    expect(screen.getByText('sets.item {"count":3}')).toBeInTheDocument();
    expect(screen.getByText('sets.item {"count":5}')).toBeInTheDocument();
  });

  it("create makes the new set active", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");
    vi.mocked(createSet).mockResolvedValue(makeSet("s3", "Novo Culto"));

    render(<SetManagerDialog onClose={vi.fn()} />);

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

    render(<SetManagerDialog onClose={vi.fn()} />);

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

  it("delete shows the play count then calls deleteSet", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s2");
    vi.mocked(getSetPlayCount).mockResolvedValue(7);
    vi.mocked(deleteSet).mockResolvedValue(undefined);

    render(<SetManagerDialog onClose={vi.fn()} />);

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

  it("deleting the active set calls setActiveSet with the successor", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite"), makeSet("s3", "Culto Tarde")];
    mockStores(sets, "s2");
    vi.mocked(getSetPlayCount).mockResolvedValue(0);
    vi.mocked(deleteSet).mockResolvedValue(undefined);

    render(<SetManagerDialog onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByText("sets.picker.delete");
    fireEvent.click(deleteButtons[1]); // s2 - active

    await waitFor(() => {
      expect(getSetPlayCount).toHaveBeenCalledWith("s2");
    });

    fireEvent.click(screen.getByText("sets.delete.confirm"));

    await waitFor(() => {
      expect(deleteSet).toHaveBeenCalledWith("s2");
    });
    expect(setActiveSet).toHaveBeenCalledWith("s3");
  });

  it("deleting a non-active set does not call setActiveSet", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite"), makeSet("s3", "Culto Tarde")];
    mockStores(sets, "s2");
    vi.mocked(getSetPlayCount).mockResolvedValue(0);
    vi.mocked(deleteSet).mockResolvedValue(undefined);

    render(<SetManagerDialog onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByText("sets.picker.delete");
    fireEvent.click(deleteButtons[0]); // s1 - not active

    await waitFor(() => {
      expect(getSetPlayCount).toHaveBeenCalledWith("s1");
    });

    fireEvent.click(screen.getByText("sets.delete.confirm"));

    await waitFor(() => {
      expect(deleteSet).toHaveBeenCalledWith("s1");
    });
    expect(setActiveSet).not.toHaveBeenCalled();
  });

  it("a failed deleteSet leaves the dialog open and never calls setActiveSet", async () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");
    vi.mocked(getSetPlayCount).mockResolvedValue(0);
    vi.mocked(deleteSet).mockRejectedValue(new Error("boom"));

    render(<SetManagerDialog onClose={vi.fn()} />);

    const deleteButtons = screen.getAllByText("sets.picker.delete");
    fireEvent.click(deleteButtons[0]);

    await waitFor(() => {
      expect(getSetPlayCount).toHaveBeenCalledWith("s1");
    });

    fireEvent.click(screen.getByText("sets.delete.confirm"));

    await waitFor(() => {
      expect(deleteSet).toHaveBeenCalledWith("s1");
    });
    expect(setActiveSet).not.toHaveBeenCalled();
    expect(refresh).not.toHaveBeenCalled();
    // Dialog is still shown (confirm dialog message still present)
    expect(screen.getByText("sets.delete.confirm")).toBeInTheDocument();
  });

  it("disables delete when only one set exists", () => {
    const sets = [makeSet("s1", "Único Culto")];
    mockStores(sets, "s1");

    render(<SetManagerDialog onClose={vi.fn()} />);

    const deleteButton = screen.getByText("sets.picker.delete");
    expect(deleteButton).toBeDisabled();

    fireEvent.click(deleteButton);
    expect(getSetPlayCount).not.toHaveBeenCalled();
  });

  it("Escape closes the dialog", () => {
    const sets = [makeSet("s1", "Culto Manhã")];
    mockStores(sets, "s1");
    const onClose = vi.fn();

    render(<SetManagerDialog onClose={onClose} />);

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });

  it("backdrop click closes the dialog", () => {
    const sets = [makeSet("s1", "Culto Manhã")];
    mockStores(sets, "s1");
    const onClose = vi.fn();

    render(<SetManagerDialog onClose={onClose} />);

    fireEvent.click(screen.getByTestId("set-manager-backdrop"));
    expect(onClose).toHaveBeenCalled();
  });

  it("the X button closes the dialog", () => {
    const sets = [makeSet("s1", "Culto Manhã")];
    mockStores(sets, "s1");
    const onClose = vi.fn();

    render(<SetManagerDialog onClose={onClose} />);

    fireEvent.click(screen.getByLabelText("sets.manage.close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("a sets refresh mid-rename does not clear the typed value", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");

    const { rerender } = render(<SetManagerDialog onClose={vi.fn()} />);

    const renameButtons = screen.getAllByText("sets.picker.rename");
    fireEvent.click(renameButtons[0]);

    const input = screen.getByDisplayValue("Culto Manhã");
    fireEvent.change(input, { target: { value: "Culto da Manhã Editando" } });

    // Simulate a store refresh that returns the same (unchanged) set list.
    mockStores(sets, "s1");
    rerender(<SetManagerDialog onClose={vi.fn()} />);

    expect(screen.getByDisplayValue("Culto da Manhã Editando")).toBeInTheDocument();
  });
});
