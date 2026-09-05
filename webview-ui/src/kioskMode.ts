/**
 * Kiosk mode — the office on an always-on wall display, nothing else.
 *
 * Enabled per-URL with `?kiosk=1`, so the same build still serves the normal
 * interactive views (VS Code panel, standalone browser). Nobody is standing at
 * a wall screen with a mouse, so every control and first-run prompt is dead
 * weight there and is hidden: toolbars, zoom buttons, the version notice, the
 * intro bubble, the migration notice and the hooks tooltip. What stays is what
 * a passer-by actually reads — the office, the agent labels, and the connection
 * badge (a screen showing a stale office with no warning is worse than useless).
 *
 * Read once at module load: a wall display never changes its URL mid-session.
 */
function readKioskFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const value = new URLSearchParams(window.location.search).get('kiosk');
    return value === '1' || value === 'true';
  } catch {
    return false;
  }
}

export const isKioskMode = readKioskFlag();
