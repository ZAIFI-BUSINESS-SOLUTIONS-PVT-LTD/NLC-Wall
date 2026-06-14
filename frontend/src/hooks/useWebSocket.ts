import { useEffect, useRef, useCallback } from "react";
import { WSEvent } from "../types";

type Handler = (event: WSEvent) => void;

export function useWebSocket(onMessage: Handler): void {
  const wsRef = useRef<WebSocket | null>(null);
  const handlerRef = useRef<Handler>(onMessage);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const unmounted = useRef(false);
  const attempt = useRef(0);

  handlerRef.current = onMessage;

  const connect = useCallback(() => {
    if (unmounted.current) return;

    const protocol = window.location.protocol === "https:" ? "wss" : "ws";
    const url = `${protocol}://${window.location.host}/ws`;
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      attempt.current = 0;
    };

    ws.onmessage = (ev) => {
      try {
        const parsed = JSON.parse(ev.data) as WSEvent;
        handlerRef.current(parsed);
      } catch {
        // ignore malformed frames
      }
    };

    ws.onclose = () => {
      if (!unmounted.current) {
        // Exponential backoff: 2s, 4s, 8s, 16s … capped at 30s, plus jitter
        const delay = Math.min(30000, 2000 * Math.pow(2, attempt.current)) + Math.random() * 1000;
        attempt.current += 1;
        reconnectTimer.current = setTimeout(connect, delay);
      }
    };

    ws.onerror = () => {
      ws.close();
    };
  }, []);

  useEffect(() => {
    unmounted.current = false;
    connect();
    return () => {
      unmounted.current = true;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}
