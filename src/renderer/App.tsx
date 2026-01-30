import { useState, useEffect } from 'react';
import ApiKeySetup from './components/ApiKeySetup';
import Settings from './components/Settings';
import { useAgentStore } from './stores/agent-store';
import './styles/app.css';

export default function App() {
  const [apiKey, setApiKey] = useState('');
  const [apiKeySet, setApiKeySet] = useState(false);
  const [isCheckingApiKey, setIsCheckingApiKey] = useState(true);
  const [input, setInput] = useState('');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const { messages, isProcessing, error, attachedPdf, waitingForUserResponse, attachPdf, sendMessage, sendResponse } = useAgentStore();

  // Check if API key is already set on mount
  useEffect(() => {
    checkApiKey();
  }, []);

  async function checkApiKey() {
    try {
      const storedKey = await window.electronAPI.getApiKey();
      if (storedKey && storedKey.length > 0) {
        setApiKey(storedKey);
        setApiKeySet(true);
      }
    } catch (error) {
      console.error('Failed to check API key:', error);
    } finally {
      setIsCheckingApiKey(false);
    }
  }

  async function handleApiKeySubmit(key: string) {
    try {
      console.log('Attempting to save API key...');
      const result = await window.electronAPI.setApiKey(key);
      console.log('Save result:', result);
      setApiKey(key);
      setApiKeySet(true);
    } catch (error) {
      console.error('Failed to save API key:', error);
      alert(`Failed to save API key: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async function handleFileSelect() {
    const filePath = await window.electronAPI.selectPdfFile();
    if (filePath) {
      const fileName = filePath.split('/').pop() || 'document.pdf';
      attachPdf(fileName, filePath);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim()) {
      return;
    }

    // If waiting for user response, send response instead of new message
    if (waitingForUserResponse) {
      await sendResponse(input.trim());
    } else {
      await sendMessage(input.trim());
    }

    setInput('');
  }

  // Show loading state while checking API key
  if (isCheckingApiKey) {
    return (
      <div className="h-screen flex items-center justify-center bg-gray-900">
        <div className="text-center">
          <div className="animate-pulse text-2xl text-gray-400">
            Loading TakeoffAI...
          </div>
        </div>
      </div>
    );
  }

  // Show API key setup if not configured
  if (!apiKeySet) {
    return <ApiKeySetup onSubmit={handleApiKeySubmit} />;
  }

  // Main chat interface
  return (
    <div className="h-screen flex flex-col bg-gray-900">
      {/* Header */}
      <header className="bg-gray-800 border-b border-gray-700 px-6 py-4 flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-2xl font-bold text-white">TakeoffAI</h1>
          <p className="text-sm text-gray-400">Construction Quantity Takeoff Assistant</p>
        </div>
        <div className="flex items-center gap-4">
          <button
            onClick={handleFileSelect}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition flex items-center gap-2"
          >
            <span>📎</span>
            <span>Attach PDF</span>
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="p-2 text-gray-400 hover:text-white transition"
            title="Settings"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
          <button
            onClick={() => setApiKeySet(false)}
            className="text-sm text-gray-400 hover:text-white transition"
          >
            Change API Key
          </button>
        </div>
      </header>

      {/* Messages area */}
      <div className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-4 py-6">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-gray-500">
              <div className="text-center">
                <div className="text-6xl mb-4">🏗️</div>
                <h2 className="text-2xl font-semibold mb-2 text-white">Welcome to TakeoffAI</h2>
                <p className="text-lg mb-6">Upload a construction PDF and ask me anything</p>
                <div className="text-left max-w-md mx-auto space-y-2 text-sm">
                  <p className="text-gray-400">Try asking:</p>
                  <p className="text-gray-300">• "Do a quantity takeoff for Division 5500"</p>
                  <p className="text-gray-300">• "Count all the stairs and generate a CSV"</p>
                  <p className="text-gray-300">• "Review this drawing for code compliance"</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-3xl px-6 py-4 rounded-lg ${
                      msg.role === 'user'
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-800 text-gray-100'
                    }`}
                  >
                    {/* Show attachments for user messages */}
                    {msg.attachments && msg.attachments.length > 0 && (
                      <div className="mb-2 pb-2 border-b border-blue-500">
                        {msg.attachments.map((att, idx) => (
                          <div key={idx} className="flex items-center gap-2 text-sm opacity-90">
                            <span>📄</span>
                            <span>{att.name}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Message content */}
                    <div className="whitespace-pre-wrap">{msg.content}</div>

                    {/* Tool execution indicators */}
                    {msg.toolUses && msg.toolUses.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-700 text-sm text-gray-400">
                        {msg.toolUses.map((tool, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span>{tool.status === 'executing' ? '⏳' : tool.status === 'complete' ? '✅' : '❌'}</span>
                            <span>{tool.name}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Processing indicator */}
          {isProcessing && !waitingForUserResponse && (
            <div className="flex justify-start mt-6">
              <div className="bg-gray-800 px-6 py-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="animate-pulse">💭</div>
                  <span className="text-gray-400">Claude is thinking...</span>
                </div>
              </div>
            </div>
          )}

          {/* Waiting for response indicator */}
          {waitingForUserResponse && (
            <div className="flex justify-start mt-6">
              <div className="bg-blue-900/30 border border-blue-700 px-6 py-4 rounded-lg">
                <div className="flex items-center gap-3">
                  <div>❓</div>
                  <span className="text-blue-300">Waiting for your response...</span>
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <div className="mt-4 p-4 bg-red-900/20 border border-red-700 rounded-lg">
              <div className="flex items-start">
                <div className="flex-shrink-0 text-red-500 text-xl mr-3">⚠️</div>
                <div>
                  <h3 className="text-red-400 font-semibold">Error</h3>
                  <p className="text-red-300 text-sm mt-1">{error}</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Chat input */}
      <div className="border-t border-gray-700 bg-gray-800 flex-shrink-0">
        <div className="max-w-4xl mx-auto px-4 py-4">
          {/* Attached PDF indicator */}
          {attachedPdf && (
            <div className="mb-3 px-4 py-2 bg-gray-700 rounded-lg flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-gray-300">
                <span>📄</span>
                <span>{attachedPdf.name}</span>
              </div>
              <button
                onClick={() => attachPdf('', '')}
                className="text-gray-400 hover:text-white"
              >
                ✕
              </button>
            </div>
          )}

          {/* Input form */}
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={
                waitingForUserResponse
                  ? "Type your response to Claude..."
                  : messages.length > 0 && !isProcessing
                  ? "Ask a follow-up question..."
                  : attachedPdf
                  ? "Ask me anything about this PDF..."
                  : "Attach a PDF first, then ask me anything..."
              }
              className="flex-1 px-4 py-3 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isProcessing && !waitingForUserResponse}
              autoFocus={waitingForUserResponse}
            />
            <button
              type="submit"
              disabled={!input.trim() || (isProcessing && !waitingForUserResponse)}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {waitingForUserResponse ? 'Reply' : 'Send'}
            </button>
          </form>
        </div>
      </div>

      {/* Settings Modal */}
      <Settings isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
    </div>
  );
}
