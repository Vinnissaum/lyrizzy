import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AnnouncementRenderer } from "./AnnouncementRenderer";

describe("AnnouncementRenderer", () => {
  it("renders the given text", () => {
    render(<AnnouncementRenderer text="Pais, levem as crianças" />);
    expect(screen.getByText("Pais, levem as crianças")).toBeInTheDocument();
  });

  it("renders on a black background with centered layout", () => {
    const { container } = render(<AnnouncementRenderer text="Aviso" />);
    const wrapper = container.firstChild as HTMLElement;
    expect(wrapper.className).toContain("bg-black");
    expect(wrapper.className).toContain("flex");
    expect(wrapper.className).toContain("items-center");
    expect(wrapper.className).toContain("justify-center");
  });

  it("renders white text on the paragraph element", () => {
    render(<AnnouncementRenderer text="Test message" />);
    const p = screen.getByText("Test message");
    expect(p.className).toContain("text-white");
  });
});
