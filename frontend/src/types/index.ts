export interface Signature {
  id: string;
  name: string;
  signature: string | null;
  timestamp: number; // unix ms
}

export type DisplayTheme = "sky" | "space";

export type WSEvent =
  | { event: "init"; data: Signature[] }
  | { event: "new_signature"; data: Signature }
  | { event: "clear" }
  | { event: "display_theme"; theme: DisplayTheme };
