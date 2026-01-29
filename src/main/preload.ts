// Preload script - Secure bridge between main and renderer processes
import { contextBridge, ipcRenderer } from 'electron';

console.log('🔌 Preload script executing...');

// Expose protected methods that allow the renderer process to use
// ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Takeoff session management
  startTakeoff: (params: { pdfPath: string; systemPrompt: string; userMessage: string }) =>
    ipcRenderer.invoke('start-takeoff', params),
  continueConversation: (params: { userMessage: string }) =>
    ipcRenderer.invoke('continue-conversation', params),
  newSession: () => ipcRenderer.invoke('new-session'),

  // API key management
  getApiKey: () => ipcRenderer.invoke('get-api-key'),
  setApiKey: (key: string) => ipcRenderer.invoke('set-api-key', key),

  // Knowledge base
  loadKnowledgeBase: () => ipcRenderer.invoke('load-knowledge-base'),

  // Agent updates (streaming)
  onAgentUpdate: (callback: (update: any) => void) => {
    ipcRenderer.on('agent-update', (_event, update) => callback(update));
  },

  removeAgentUpdateListener: () => {
    ipcRenderer.removeAllListeners('agent-update');
  },

  // Agent questions (when Claude asks the user something)
  onAgentQuestion: (callback: (question: { question: string; context: string }) => void) => {
    ipcRenderer.on('agent-question', (_event, question) => callback(question));
  },

  removeAgentQuestionListener: () => {
    ipcRenderer.removeAllListeners('agent-question');
  },

  sendUserResponse: (response: string) => ipcRenderer.invoke('send-user-response', response),

  // File operations
  selectPdfFile: () => ipcRenderer.invoke('select-pdf-file'),
  openOutputFile: (filePath: string) => ipcRenderer.invoke('open-output-file', filePath),
  getOutputsDirectory: () => ipcRenderer.invoke('get-outputs-directory'),
  openOutputsFolder: () => ipcRenderer.invoke('open-outputs-folder'),

  // App info
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  getAppPath: () => ipcRenderer.invoke('get-app-path'),

  // Settings
  getOutputDirectory: () => ipcRenderer.invoke('get-output-directory'),
  setOutputDirectory: (directory: string) => ipcRenderer.invoke('set-output-directory', directory),
  browseOutputDirectory: () => ipcRenderer.invoke('browse-output-directory'),
  getDefaultOutputDirectory: () => ipcRenderer.invoke('get-default-output-directory'),
  getImageSettings: () => ipcRenderer.invoke('get-image-settings'),
  setImageSettings: (settings: { maxImageDimension: number; renderDpi: number }) =>
    ipcRenderer.invoke('set-image-settings', settings),
  openSessionImages: () => ipcRenderer.invoke('open-session-images'),
  getSessionDir: () => ipcRenderer.invoke('get-session-dir')
});

console.log('✅ Preload script: electronAPI exposed to window');

// TypeScript declaration for window.electronAPI
declare global {
  interface Window {
    electronAPI: {
      startTakeoff: (params: { pdfPath: string; systemPrompt: string; userMessage: string }) => Promise<any>;
      continueConversation: (params: { userMessage: string }) => Promise<any>;
      newSession: () => Promise<{ sessionId: string; sessionDir: string }>;
      getApiKey: () => Promise<string>;
      setApiKey: (key: string) => Promise<boolean>;
      loadKnowledgeBase: () => Promise<string>;
      onAgentUpdate: (callback: (update: any) => void) => void;
      removeAgentUpdateListener: () => void;
      onAgentQuestion: (callback: (question: { question: string; context: string }) => void) => void;
      removeAgentQuestionListener: () => void;
      sendUserResponse: (response: string) => Promise<boolean>;
      selectPdfFile: () => Promise<string | null>;
      openOutputFile: (filePath: string) => Promise<void>;
      getOutputsDirectory: () => Promise<string>;
      openOutputsFolder: () => Promise<string>;
      getAppVersion: () => Promise<string>;
      getAppPath: () => Promise<string>;
      // Settings
      getOutputDirectory: () => Promise<string>;
      setOutputDirectory: (directory: string) => Promise<boolean>;
      browseOutputDirectory: () => Promise<string | null>;
      getDefaultOutputDirectory: () => Promise<string>;
      getImageSettings: () => Promise<{ maxImageDimension: number; renderDpi: number }>;
      setImageSettings: (settings: { maxImageDimension: number; renderDpi: number }) => Promise<boolean>;
      openSessionImages: () => Promise<string>;
      getSessionDir: () => Promise<string | null>;
    };
  }
}
