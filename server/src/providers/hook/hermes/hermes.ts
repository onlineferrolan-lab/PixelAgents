import type { AgentEvent, HookProvider } from '../../../../../core/src/provider.js';
import type { TeamProvider } from '../../../../../core/src/teamProvider.js';

function str(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function obj(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null
    ? (value as Record<string, unknown>)
    : {};
}

const hermesTeamProvider: TeamProvider = {
  providerId: 'hermes',

  teammateSpawnTools: new Set<string>(),
  withinTurnSubagentTools: new Set(['delegate_task']),

  isTeammateSpawnCall: () => false,

  extractTeammateNameFromEvent(event) {
    const extra = obj(event.extra);
    return str(extra.child_role) || undefined;
  },

  discoverTeammates: () => [],
  getTeamMetadataForSession: () => null,
  extractTeamMetadataFromRecord: () => null,
  getTeamMembers: () => null,
};

export function normalizeHookEvent(
  raw: Record<string, unknown>,
): { sessionId: string; event: AgentEvent } | null {

  const eventName = str(raw.hook_event_name);
  const extra = obj(raw.extra);

  const sessionId =
    str(raw.session_id) ||
    str(extra.parent_session_id) ||
    str(extra.child_session_id);

  if (!eventName || !sessionId) return null;

  // Pixel Agents espera estos campos también en el evento original.
  raw.session_id = sessionId;
  raw.hook_event_name = eventName;

  switch (eventName) {

    case 'on_session_start':
      return {
        sessionId,
        event: {
          kind: 'sessionStart',
          source: 'hermes',
          cwd: str(raw.cwd) || undefined,
        },
      };

    case 'pre_tool_call': {
      const toolName = str(raw.tool_name) || 'unknown';
      const toolInput = obj(raw.tool_input);

      return {
        sessionId,
        event: {
          kind: 'toolStart',
          toolId:
            str(extra.tool_call_id) ||
            `hermes-tool-${Date.now()}`,
          toolName,
          input: toolInput,
        },
      };
    }

    case 'post_tool_call':
      return {
        sessionId,
        event: {
          kind: 'toolEnd',
          toolId: 'current',
        },
      };

    case 'post_llm_call':
    case 'on_session_end':
      return {
        sessionId,
        event: {
          kind: 'turnEnd',
        },
      };

    case 'on_session_finalize':
      return {
        sessionId,
        event: {
          kind: 'sessionEnd',
          reason: str(extra.reason) || 'finalized',
        },
      };

    case 'subagent_start':
      return {
        sessionId,
        event: {
          kind: 'subagentStart',
          parentToolId: 'current',
          toolId:
            str(extra.child_subagent_id) ||
            str(extra.child_session_id) ||
            `hermes-sub-${Date.now()}`,
          toolName: str(extra.child_role) || 'subagent',
          input: extra,
        },
      };

    case 'subagent_stop':
      return {
        sessionId,
        event: {
          kind: 'subagentEnd',
          parentToolId: 'current',
          toolId:
            str(extra.child_subagent_id) ||
            str(extra.child_session_id) ||
            'current',
        },
      };

    default:
      return null;
  }
}

function formatToolStatus(toolName: string, input?: unknown): string {
  const data = obj(input);

  switch (toolName) {
    case 'delegate_task':
      return `Delegando: ${str(data.goal).slice(0, 80)}`;

    case 'terminal':
      return `Terminal: ${str(data.command).slice(0, 80)}`;

    case 'read_file':
      return `Leyendo ${str(data.path) || str(data.file_path)}`;

    case 'web_search':
      return `Buscando: ${str(data.query).slice(0, 80)}`;

    default:
      return `Usando ${toolName}`;
  }
}

export const hermesProvider: HookProvider = {
  kind: 'hook',
  id: 'hermes',
  displayName: 'HERMES',
  protocolVersion: 1,

  normalizeHookEvent,

  async installHooks(): Promise<void> {},
  async uninstallHooks(): Promise<void> {},
  async areHooksInstalled(): Promise<boolean> {
    return false;
  },

  consentDisclosure() {
    return {
      headline: 'Conectar HERMES',
      disclosure:
        'Pixel Agents recibirá eventos locales de actividad de HERMES para mostrar el estado de los agentes.',
    };
  },

  formatToolStatus,

  permissionExemptTools: new Set([
    'read_file',
    'web_search',
    'session_search',
  ]),

  subagentToolNames: new Set(['delegate_task']),

  readingTools: new Set([
    'read_file',
    'web_search',
    'session_search',
  ]),

  team: hermesTeamProvider,
};
