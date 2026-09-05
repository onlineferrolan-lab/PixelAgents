import { TRANSPORT_STATE_CONNECTED } from '../../../core/src/constants.js';
import type { ClientMessage, ServerMessage } from '../../../core/src/messages.js';
import type { MessageTransport, TransportState } from './types.js';

/**
 * In-memory transport for static demo builds (VITE_DEMO=1).
 *
 * There is no Pixel Agents server behind a static deploy, so instead of a
 * WebSocket that retries forever (and parks a "Connecting…" badge over the
 * office), this reports itself as permanently connected and simply relays the
 * synthetic messages `browserMock` / `demoMode` inject as `window` 'message'
 * events. Outbound messages are dropped — nothing is listening.
 *
 * Only constructed when `isDemoMode` is true, so it is tree-shaken out of the
 * VS Code and standalone-server builds.
 */
export class DemoTransport implements MessageTransport {
  private handlers: Array<(msg: ServerMessage) => void> = [];
  readonly state: TransportState = TRANSPORT_STATE_CONNECTED;
  readonly ready: Promise<void> = Promise.resolve();
  private disposed = false;

  constructor() {
    window.addEventListener('message', (e: MessageEvent) => {
      const data = e.data as unknown;
      if (
        data &&
        typeof data === 'object' &&
        typeof (data as { type?: unknown }).type === 'string'
      ) {
        this.deliver(data as ServerMessage);
      }
    });
  }

  /** Outbound messages have no destination in a static demo. */
  send(message: ClientMessage): void {
    void message;
  }

  onMessage(handler: (message: ServerMessage) => void): () => void {
    this.handlers.push(handler);
    return () => {
      this.handlers = this.handlers.filter((h) => h !== handler);
    };
  }

  deliver(message: ServerMessage): void {
    if (this.disposed) return;
    for (const handler of this.handlers) handler(message);
  }

  /** State never changes, so there is nothing to notify. */
  onStateChange(handler: (state: TransportState) => void): () => void {
    void handler;
    return () => {};
  }

  dispose(): void {
    this.disposed = true;
    this.handlers = [];
  }
}
