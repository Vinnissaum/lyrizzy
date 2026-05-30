import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnouncementRenderer } from "./AnnouncementRenderer";

describe("AnnouncementRenderer", () => {
  it("renders the given text", () => {
    render(<AnnouncementRenderer text="Pais, levem as crianças" />);
    expect(screen.getByText("Pais, levem as crianças")).toBeInTheDocument();
  });

  it("renders on a black background with centered layout (default settings)", () => {
    const { container } = render(<AnnouncementRenderer text="Aviso" />);
    const wrapper = container.firstChild as HTMLElement;
    // Default announcement preset is preto-branco → black background.
    expect(wrapper.style.backgroundColor).toBe("rgb(0, 0, 0)");
    const inner = wrapper.firstChild as HTMLElement;
    expect(inner.className).toContain("flex");
    expect(inner.className).toContain("items-center");
    expect(inner.className).toContain("justify-center");
  });

  it("renders white text on the paragraph element (default settings)", () => {
    render(<AnnouncementRenderer text="Test message" />);
    const p = screen.getByText("Test message");
    expect(p.style.color).toBe("rgb(255, 255, 255)");
  });
});
