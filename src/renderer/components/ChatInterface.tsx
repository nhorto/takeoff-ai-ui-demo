import { useState } from 'react';
import MessageList from './MessageList';
import ThinkingPanel from './ThinkingPanel';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string;
  toolUses?: Array<{ name: string; status: 'executing' | 'complete' | 'error' }>;
}

interface Props {
  messages: Message[];
  isProcessing: boolean;
  onSendMessage?: (message: string) => void;
}

export default function ChatInterface({ messages, isProcessing, onSendMessage }: Props) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!input.trim() || !onSendMessage) {
      return;
    }

    onSendMessage(input.trim());
    setInput('');
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Messages area */}
      <div className="flex-1 overflow-auto p-4">
        {messages.length === 0 && !isProcessing ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-5xl mb-4">🏗️</div>
              <p className="text-lg">Upload a PDF to begin takeoff</p>
            </div>
          </div>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>

      {/* Thinking indicator */}
      {isProcessing && <ThinkingPanel />}

      {/* Chat input */}
      {isProcessing && (
        <div className="border-t border-gray-700 p-4 bg-gray-800">
          <form onSubmit={handleSubmit} className="flex gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Type your response to Claude..."
              className="flex-1 px-4 py-2 bg-gray-900 border border-gray-600 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={!isProcessing}
            />
            <button
              type="submit"
              disabled={!input.trim() || !isProcessing}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-medium rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              Send
            </button>
          </form>
          <p className="text-xs text-gray-500 mt-2">
            Respond to Claude's questions or provide additional instructions
          </p>
        </div>
      )}
    </div>
  );
}
