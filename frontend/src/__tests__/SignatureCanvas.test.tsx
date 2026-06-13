import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SignatureCanvas } from "../components/SignatureCanvas";

describe("SignatureCanvas", () => {
  it("renders the signature label and optional hint", () => {
    render(<SignatureCanvas onExport={() => {}} />);
    expect(screen.getByText("Signature")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
  });

  it("renders a canvas element", () => {
    const { container } = render(<SignatureCanvas onExport={() => {}} />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });

  it("hides the Undo/Clear buttons until something is drawn", () => {
    render(<SignatureCanvas onExport={() => {}} />);
    expect(screen.queryByText(/Undo/)).toBeNull();
    expect(screen.queryByText("Clear")).toBeNull();
  });

  it("clears and reports an empty export when the reset token advances", () => {
    const onExport = vi.fn();
    const { rerender } = render(
      <SignatureCanvas onExport={onExport} resetToken={0} />,
    );
    onExport.mockClear();
    rerender(<SignatureCanvas onExport={onExport} resetToken={1} />);
    expect(onExport).toHaveBeenCalledWith(null);
  });
});
