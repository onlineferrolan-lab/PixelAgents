/**
 * Demo mode — renders the office in a plain static build, with no Pixel Agents
 * server behind it.
 *
 * Enabled at build time only, via `VITE_DEMO=1` (see vercel.json). When the flag
 * is absent, `isDemoMode` is a compile-time `false` and every branch guarded by
 * it — including the dynamic `browserMock` import — is tree-shaken away, so
 * VS Code and standalone-server builds are unchanged.
 *
 * What it does: reuses `browserMock` to load the sprite/layout assets from the
 * static bundle, then dispatches a handful of synthetic `agentCreated` /
 * `agentStatus` / `agentToolStart` messages so the office is populated with
 * characters instead of sitting empty waiting for a WebSocket.
 */

export const isDemoMode = import.meta.env.VITE_DEMO === '1';

/** True in Vite dev OR in a build made with VITE_DEMO=1. */
export const useBrowserAssets = import.meta.env.DEV || isDemoMode;

interface DemoAgent {
  id: number;
  folderName: string;
  palette: number;
  hueShift: number;
  /** Tool label shown above the character, or null to leave it idle. */
  tool: string | null;
  /** 'active' | 'waiting' | 'idle' */
  status: string;
}

const DEMO_VERSION = '1.4.1';
// VersionIndicator compares toMajorMinor(currentVersion) against lastSeenVersion
// verbatim, so this is the major.minor of DEMO_VERSION. Kept as a literal rather
// than computed: a `.split().join()` call survives tree-shaking as a dead
// expression in non-demo builds, and those must stay byte-identical to upstream.
const DEMO_VERSION_SEEN = '1.4';

const DEMO_AGENTS: DemoAgent[] = [
  { id: 1, folderName: 'ferrolan-web', palette: 0, hueShift: 0, tool: 'Edit', status: 'active' },
  { id: 2, folderName: 'catalogo-erp', palette: 1, hueShift: 40, tool: 'Grep', status: 'active' },
  { id: 3, folderName: 'hermes-bridge', palette: 2, hueShift: 90, tool: 'Bash', status: 'active' },
  { id: 4, folderName: 'seo-audit', palette: 3, hueShift: 160, tool: 'Read', status: 'active' },
  { id: 5, folderName: 'pixel-agents', palette: 4, hueShift: 220, tool: null, status: 'waiting' },
];

function dispatch(data: unknown): void {
  window.dispatchEvent(new MessageEvent('message', { data }));
}

/**
 * Populate the office with demo characters. Call after `dispatchMockMessages()`
 * so the layout (and its seats) already exist.
 */
export function dispatchDemoAgents(): void {
  if (!isDemoMode) return;

  // browserMock's settingsLoaded advertises an older lastSeenVersion, which pops
  // the "what's new" toast over the demo. Re-send it with the versions aligned.
  dispatch({
    type: 'settingsLoaded',
    soundEnabled: false,
    extensionVersion: DEMO_VERSION,
    lastSeenVersion: DEMO_VERSION_SEEN,
    alwaysShowLabels: true,
  });

  for (const agent of DEMO_AGENTS) {
    dispatch({
      type: 'agentCreated',
      id: agent.id,
      folderName: agent.folderName,
      palette: agent.palette,
      hueShift: agent.hueShift,
    });
  }

  // Give the seats a frame to settle before animating anyone.
  setTimeout(() => {
    for (const agent of DEMO_AGENTS) {
      dispatch({ type: 'agentStatus', id: agent.id, status: agent.status });
      if (agent.tool) {
        dispatch({
          type: 'agentToolStart',
          id: agent.id,
          toolId: `demo-${agent.id}`,
          toolName: agent.tool,
          status: agent.tool,
        });
      }
    }
    dispatch({ type: 'agentSelected', id: DEMO_AGENTS[0].id });
  }, 600);

  console.log(`[Demo] ${DEMO_AGENTS.length} demo agents dispatched`);
}
