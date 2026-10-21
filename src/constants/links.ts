/**
 * Public URLs linked from the app, kept in one place so the sidebar and Settings never drift apart.
 */
export const COMMUNITY_URL = "https://discord.gg/nVcEJQzNs3";
export const FEEDBACK_BOARD_URL = "https://ask.oprimo.dev/recta";
export const APP_STORE_URL = "https://apps.apple.com/app/id6813993673";
export const GOOGLE_PLAY_URL = "https://play.google.com/store/apps/details?id=app.recta.mobile";
export const SUPPORT_EMAIL = "apps@oprimo.dev";

/** The oprimo.dev app family, listed in the landing footer like on the other product sites. */
export const OTHER_APPS = [
  { name: "PrimoEngine", href: "https://engine.oprimo.dev", blurbKey: "blurbEngine" },
  { name: "PrimoDock", href: "https://dock.oprimo.dev", blurbKey: "blurbDock" },
  { name: "PrimoRec", href: "https://rec.oprimo.dev", blurbKey: "blurbRec" },
  { name: "Notchy", href: "https://github.com/lucianodiisouza/notchy-desktop-macos", blurbKey: "blurbNotchy" },
  { name: "CameraMan", href: "https://github.com/lucianodiisouza/camera-man-macos", blurbKey: "blurbCameraMan" },
  { name: "DailyNotch", href: "https://github.com/lucianodiisouza/daily-notch-tracker", blurbKey: "blurbDailyNotch" },
] as const;
