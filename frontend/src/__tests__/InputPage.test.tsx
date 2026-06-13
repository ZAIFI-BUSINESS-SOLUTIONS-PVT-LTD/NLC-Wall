import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { InputPage } from "../pages/InputPage";

function mockFetchOk(body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: true,
    json: async () => body,
  });
}

function mockFetchError(status: number, body: unknown) {
  return vi.fn().mockResolvedValue({
    ok: false,
    status,
    json: async () => body,
  });
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("InputPage", () => {
  it("renders the event header and submit button", () => {
    vi.stubGlobal("fetch", mockFetchOk({}));
    render(<InputPage />);
    expect(screen.getByText("Live Sign Wall")).toBeInTheDocument();
    expect(screen.getByText("NLC Neyveli Book Fair")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Submit to Wall/ })).toBeInTheDocument();
  });

  it("disables submit until a name is entered", async () => {
    vi.stubGlobal("fetch", mockFetchOk({}));
    const user = userEvent.setup();
    render(<InputPage />);
    const button = screen.getByRole("button", { name: /Submit to Wall/ });
    expect(button).toBeDisabled();

    await user.type(screen.getByPlaceholderText("Your name, a message, anything…"), "Rishi");
    expect(button).toBeEnabled();
  });

  it("posts the name and shows the success ceremony overlay", async () => {
    const fetchMock = mockFetchOk({ id: "abc", timestamp: 123 });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InputPage />);

    await user.type(screen.getByPlaceholderText("Your name, a message, anything…"), "Rishi");
    await user.click(screen.getByRole("button", { name: /Submit to Wall/ }));

    expect(fetchMock).toHaveBeenCalledWith(
      "/submit",
      expect.objectContaining({ method: "POST" }),
    );
    // The submitted name should be in the POST body.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Rishi");

    expect(await screen.findByText("You're on the wall!")).toBeInTheDocument();
    expect(screen.getByText("Rishi")).toBeInTheDocument();
    expect(screen.getByText(/Look at the display wall/)).toBeInTheDocument();
  });

  it("surfaces the server error detail on a rejected submission", async () => {
    vi.stubGlobal(
      "fetch",
      mockFetchError(400, { detail: "Name contains prohibited content." }),
    );
    const user = userEvent.setup();
    render(<InputPage />);

    await user.type(screen.getByPlaceholderText("Your name, a message, anything…"), "rude");
    await user.click(screen.getByRole("button", { name: /Submit to Wall/ }));

    expect(
      await screen.findByText("Name contains prohibited content."),
    ).toBeInTheDocument();
    // Form is still shown (not the success overlay).
    expect(screen.queryByText("You're on the wall!")).toBeNull();
  });

  it("trims whitespace from the name before sending", async () => {
    const fetchMock = mockFetchOk({ id: "abc", timestamp: 1 });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<InputPage />);

    await user.type(screen.getByPlaceholderText("Your name, a message, anything…"), "  Spaced  ");
    await user.click(screen.getByRole("button", { name: /Submit to Wall/ }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.name).toBe("Spaced");
  });
});
