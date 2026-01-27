// IPC channel constants
// Centralizes all IPC channel names to prevent typos and improve maintainability

export const IPC_CHANNELS = {
  // Takeoff session
  START_TAKEOFF: 'start-takeoff',
  AGENT_UPDATE: 'agent-update',

  // API key management
  GET_API_KEY: 'get-api-key',
  SET_API_KEY: 'set-api-key',

  // Knowledge base
  LOAD_KNOWLEDGE_BASE: 'load-knowledge-base',

  // File operations
  SELECT_PDF_FILE: 'select-pdf-file',
  OPEN_OUTPUT_FILE: 'open-output-file',
  GET_OUTPUTS_DIRECTORY: 'get-outputs-directory',

  // App info
  GET_APP_VERSION: 'get-app-version',
  GET_APP_PATH: 'get-app-path'
} as const;
