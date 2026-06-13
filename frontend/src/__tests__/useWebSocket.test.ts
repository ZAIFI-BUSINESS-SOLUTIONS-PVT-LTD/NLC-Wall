import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useWebSocket } from "../hooks/useWebSocket";

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  url: string;
  onopen: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  closed = false;

  constructor(url: string) {
    this.url = url;
    MockWebSocket.instances.push(this);
  }
  send() {}
  close() {
    this.closed = true;
  }
}

beforeEach(() => {
  MockWebSocket.instances = [];
  vi.stubGlobal("WebSocket", MockWebSocket as unknown as typeof WebSocket);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("useWebSocket", () => {
  it("opens a connection to the /ws endpoint", () => {
    renderHook(() => useWebSocket(() => {}));
    expect(MockWebSocket.instances).toHaveLength(1);
    expect(MockWebSocket.instances[0].url).toMatch(/\/ws$/);
    expect(MockWebSocket.instances[0].url).toMatch(/^wss?:\/\//);
  });

  it("parses incoming frames and forwards them to the handler", () => {
    const handler = vi.fn();
    renderHook(() => useWebSocket(handler));
    const ws = MockWebSocket.instances[0];
    ws.onmessage?.({ data: JSON.stringify({ event: "clear" }) });
    expect(handler).toHaveBeenCalledWith({ event: "clear" });
  });

  it("ignores malformed frames without throwing", () => {
    const handler = vi.fn();
    renderHook(() => useWebSocket(handler));
    const ws = MockWebSocket.instances[0];
    expect(() => ws.onmessage?.({ data: "{not json" })).not.toThrow();
    expect(handler).not.toHaveBeenCalled();
  });

  it("forwards a new_signature frame with its payload", () => {
    const handler = vi.fn();
    renderHook(() => useWebSocket(handler));
    const ws = MockWebSocket.instances[0];
    const payload = { event: "new_signature", data: { id: "1", name: "X" } };
    ws.onmessage?.({ data: JSON.stringify(payload) });
    expect(handler).toHaveBeenCalledWith(payload);
  });

  it("reconnects after the socket closes", () => {
    vi.useFakeTimers();
    renderHook(() => useWebSocket(() => {}));
    expect(MockWebSocket.instances).toHaveLength(1);
    // Simulate a drop.
    MockWebSocket.instances[0].onclose?.();
    // Backoff is at most 30s + 1s jitter; flush past it.
    vi.advanceTimersByTime(31_000);
    expect(MockWebSocket.instances.length).toBeGreaterThanOrEqual(2);
  });

  it("closes the socket and stops reconnecting on unmount", () => {
    vi.useFakeTimers();
    const { unmount } = renderHook(() => useWebSocket(() => {}));
    const ws = MockWebSocket.instances[0];
    unmount();
    expect(ws.closed).toBe(true);
    // A close firing after unmount must not schedule a new connection.
    ws.onclose?.();
    vi.advanceTimersByTime(60_000);
    expect(MockWebSocket.instances).toHaveLength(1);
  });

  it("closes the socket on error", () => {
    renderHook(() => useWebSocket(() => {}));
    const ws = MockWebSocket.instances[0];
    ws.onerror?.();
    expect(ws.closed).toBe(true);
  });
});
