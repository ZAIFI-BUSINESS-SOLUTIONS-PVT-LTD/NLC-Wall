import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { NameInput } from "../components/NameInput";

describe("NameInput", () => {
  it("renders the label, optional hint and placeholder", () => {
    render(<NameInput value="" onChange={() => {}} />);
    expect(screen.getByText("Type Anything")).toBeInTheDocument();
    expect(screen.getByText("Optional")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText("Your name, a message, anything…"),
    ).toBeInTheDocument();
  });

  it("shows the controlled value", () => {
    render(<NameInput value="Rishi" onChange={() => {}} />);
    expect(screen.getByDisplayValue("Rishi")).toBeInTheDocument();
  });

  it("calls onChange when the user types", () => {
    const onChange = vi.fn();
    render(<NameInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByPlaceholderText("Your name, a message, anything…"), {
      target: { value: "A" },
    });
    expect(onChange).toHaveBeenCalledWith("A");
  });

  it("caps input at 60 characters", () => {
    render(<NameInput value="" onChange={() => {}} />);
    const input = screen.getByPlaceholderText("Your name, a message, anything…");
    expect(input).toHaveAttribute("maxLength", "60");
  });

  it("can be disabled", () => {
    render(<NameInput value="" onChange={() => {}} disabled />);
    expect(screen.getByPlaceholderText("Your name, a message, anything…")).toBeDisabled();
  });
});
