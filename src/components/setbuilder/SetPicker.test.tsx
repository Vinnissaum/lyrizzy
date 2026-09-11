import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("../../stores/sets", () => ({
  useSetsStore: vi.fn(),
}));

vi.mock("../../stores/library", () => ({
  useLibraryStore: vi.fn(),
}));

vi.mock("../../api/commands", () => ({
  onSetChanged: vi.fn().mockResolvedValue(() => {}),
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key} ${JSON.stringify(params)}` : key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

vi.mock("./SetManagerDialog", () => ({
  SetManagerDialog: ({ onClose }: { onClose: () => void }) => (
    <div data-testid="set-manager-dialog">
      <button onClick={onClose}>close</button>
    </div>
  ),
}));

import { SetPicker } from "./SetPicker";
import { useSetsStore } from "../../stores/sets";
import { useLibraryStore } from "../../stores/library";
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

  it("lists every set and selects the active one", () => {
    const sets = [makeSet("s1", "Culto Manhã", 3), makeSet("s2", "Culto Noite", 5)];
    mockStores(sets, "s2");

    render(<SetPicker />);

    const select = screen.getByRole("combobox", {
      name: "sets.picker.switch",
    }) as HTMLSelectElement;
    expect(select.value).toBe("s2");
    expect(screen.getByRole("option", { name: "Culto Manhã" })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Culto Noite" })).toBeInTheDocument();
  });

  it("changing the select calls setActiveSet", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");

    render(<SetPicker />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s2" } });
    expect(setActiveSet).toHaveBeenCalledWith("s2");
  });

  it("shows no create/rename/delete controls in the closed state", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");

    render(<SetPicker />);

    expect(screen.queryByText("sets.picker.create")).not.toBeInTheDocument();
    expect(screen.queryByText("sets.picker.rename")).not.toBeInTheDocument();
    expect(screen.queryByText("sets.picker.delete")).not.toBeInTheDocument();
    expect(screen.queryByTestId("set-manager-dialog")).not.toBeInTheDocument();
  });

  it("clicking the gear opens the set manager dialog", () => {
    const sets = [makeSet("s1", "Culto Manhã"), makeSet("s2", "Culto Noite")];
    mockStores(sets, "s1");

    render(<SetPicker />);

    fireEvent.click(screen.getByRole("button", { name: "sets.manage.open" }));
    expect(screen.getByTestId("set-manager-dialog")).toBeInTheDocument();
  });

  it("renders a single disabled option holding the active set's name when sets are empty", () => {
    mockStores([], "s1");

    render(<SetPicker />);

    const select = screen.getByRole("combobox") as HTMLSelectElement;
    const options = select.querySelectorAll("option");
    expect(options.length).toBe(1);
    expect(options[0]).toBeDisabled();
    expect(options[0].textContent).not.toBe("");
    expect(options[0].textContent).not.toBe("undefined");
  });
});
