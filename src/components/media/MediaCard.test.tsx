import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { MediaCard } from "./MediaCard";
import type { Media } from "../../types";

vi.mock("@tauri-apps/api/core", () => ({ invoke: vi.fn() }));

const baseMedia: Media = {
  id: "m1",
  fileName: "clip.mp4",
  displayName: "Clip",
  kind: "video",
  mimeType: "video/mp4",
  byteSize: 1024,
  createdAt: 0,
  updatedAt: 0,
};

describe("MediaCard", () => {
  it("renders displayName", () => {
    render(<MediaCard media={baseMedia} onClick={vi.fn()} />);
    expect(screen.getByText("Clip")).toBeInTheDocument();
  });

  it("shows thumb-pending label for video with no thumbnail", () => {
    render(<MediaCard media={baseMedia} onClick={vi.fn()} />);
    expect(screen.getByText(/thumb pend/i)).toBeInTheDocument();
  });

  it("does not show thumb-pending label for image with no thumbnail", () => {
    const imageMedia: Media = {
      ...baseMedia,
      id: "m2",
      kind: "image",
    };
    render(<MediaCard media={imageMedia} onClick={vi.fn()} />);
    expect(screen.queryByText(/thumb pend/i)).not.toBeInTheDocument();
  });

  it("does not show thumb-pending label when video has a thumbnail", () => {
    const mediaWithThumb: Media = { ...baseMedia, thumbnailFile: "thumb.jpg" };
    render(<MediaCard media={mediaWithThumb} onClick={vi.fn()} />);
    expect(screen.queryByText(/thumb pend/i)).not.toBeInTheDocument();
  });

  it("calls onClick when clicked", () => {
    const handleClick = vi.fn();
    render(<MediaCard media={baseMedia} onClick={handleClick} />);
    fireEvent.click(screen.getByTestId("media-card-m1"));
    expect(handleClick).toHaveBeenCalledWith(baseMedia);
  });
});
