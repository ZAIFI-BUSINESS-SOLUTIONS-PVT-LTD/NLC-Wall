export interface Signature {
  id: string;
  name: string;
  signature: string | null;
  timestamp: number; // unix ms
  is_chief_guest: boolean;
}

export interface ChiefGuestConfig {
  enabled: boolean;
  retention_mode: "forever" | "until_datetime";
  retention_until: number | null; // unix ms
}

export interface PledgeConfig {
  tamil: string;
  hindi: string;
  english: string;
  duration_seconds: number; // per-language display time on the rotating panel
}

export type DisplayTheme = "sky" | "space" | "aurora" | "ocean" | "neon" | "forest" | "sunset";

export type WSEvent =
  | { event: "init"; data: Signature[] }
  | { event: "new_signature"; data: Signature }
  | { event: "remove_signature"; id: string }
  | { event: "update_signature"; data: Signature }
  | { event: "clear" }
  | { event: "clear_chief_guests" }
  | { event: "display_theme"; theme: DisplayTheme }
  | { event: "pledge_config"; config: PledgeConfig }
  | { event: "cg_config"; config: ChiefGuestConfig };
