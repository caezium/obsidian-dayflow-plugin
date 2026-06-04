import { Platform } from 'obsidian';

/**
 * Dayflow's chunks.sqlite lives at a macOS path. The plugin manifest
 * already says `isDesktopOnly: true`, but plugins can still be reached
 * on mobile in some configurations — guard at runtime so we no-op
 * cleanly instead of crashing with a "fs is undefined" error.
 */
export function isMobile(): boolean {
  return Platform.isMobile;
}

export function isDesktopMac(): boolean {
  return Platform.isDesktop && Platform.isMacOS;
}
