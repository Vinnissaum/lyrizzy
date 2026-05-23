import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

import { OverlayActionBar } from "./OverlayActionBar";

const defaultProps = {
  showApresentarButton: true,
  onApresentar: vi.fn(),
  onOferta: vi.fn(),
  onCamera: vi.fn(),
  onAviso: vi.fn(),
  onPdf: vi.fn(),
  onClearOverlay: vi.fn(),
  isOverlayActive: false,
  isImportingPresentation: false,
};

describe("OverlayActionBar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders Apresentar button when showApresentarButton is true", () => {
    render(<OverlayActionBar {...defaultProps} showApresentarButton={true} />);
    expect(screen.getByTestId("apresentar-button")).toBeInTheDocument();
  });

  it("does NOT render Apresentar button when showApresentarButton is false", () => {
    render(<OverlayActionBar {...defaultProps} showApresentarButton={false} />);
    expect(screen.queryByTestId("apresentar-button")).not.toBeInTheDocument();
  });

  it("renders Clear Overlay button when isOverlayActive is true", () => {
    render(<OverlayActionBar {...defaultProps} isOverlayActive={true} />);
    expect(screen.getByText("home.overlay.closeOverlay", { exact: false })).toBeInTheDocument();
  });

  it("does NOT render Clear Overlay button when isOverlayActive is false", () => {
    render(<OverlayActionBar {...defaultProps} isOverlayActive={false} />);
    expect(screen.queryByText("home.overlay.closeOverlay", { exact: false })).not.toBeInTheDocument();
  });

  it("calls onApresentar when Apresentar button is clicked", () => {
    const onApresentar = vi.fn();
    render(<OverlayActionBar {...defaultProps} onApresentar={onApresentar} />);
    fireEvent.click(screen.getByTestId("apresentar-button"));
    expect(onApresentar).toHaveBeenCalledTimes(1);
  });

  it("calls onClearOverlay when Clear Overlay button is clicked", () => {
    const onClearOverlay = vi.fn();
    render(<OverlayActionBar {...defaultProps} isOverlayActive={true} onClearOverlay={onClearOverlay} />);
    fireEvent.click(screen.getByText("home.overlay.closeOverlay", { exact: false }));
    expect(onClearOverlay).toHaveBeenCalledTimes(1);
  });

  it("calls onOferta when Oferta button is clicked", () => {
    const onOferta = vi.fn();
    render(<OverlayActionBar {...defaultProps} onOferta={onOferta} />);
    fireEvent.click(screen.getByText("home.overlay.oferta", { exact: false }));
    expect(onOferta).toHaveBeenCalledTimes(1);
  });

  it("calls onCamera when Camera button is clicked", () => {
    const onCamera = vi.fn();
    render(<OverlayActionBar {...defaultProps} onCamera={onCamera} />);
    fireEvent.click(screen.getByText("home.overlay.camera", { exact: false }));
    expect(onCamera).toHaveBeenCalledTimes(1);
  });

  it("calls onAviso when Aviso button is clicked", () => {
    const onAviso = vi.fn();
    render(<OverlayActionBar {...defaultProps} onAviso={onAviso} />);
    fireEvent.click(screen.getByText("home.overlay.aviso", { exact: false }));
    expect(onAviso).toHaveBeenCalledTimes(1);
  });

  it("calls onPdf when PDF button is clicked", () => {
    const onPdf = vi.fn();
    render(<OverlayActionBar {...defaultProps} onPdf={onPdf} />);
    fireEvent.click(screen.getByText("home.overlay.pdf", { exact: false }));
    expect(onPdf).toHaveBeenCalledTimes(1);
  });

  it("disables PDF button and shows importing text when isImportingPresentation is true", () => {
    render(<OverlayActionBar {...defaultProps} isImportingPresentation={true} />);
    const pdfBtn = screen.getByText("media.slideshow.importing", { exact: false }).closest("button")!;
    expect(pdfBtn).toBeDisabled();
  });

  it("shows pdfTooltip title on the PDF button", () => {
    render(<OverlayActionBar {...defaultProps} />);
    const pdfBtn = screen.getByTitle("home.overlay.pdfTooltip");
    expect(pdfBtn).toBeInTheDocument();
  });
});
