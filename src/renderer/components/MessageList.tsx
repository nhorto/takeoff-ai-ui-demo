import { useEffect, useRef } from 'react';
import ToolStatus from './ToolStatus';

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
}

export default function MessageList({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`flex ${
            message.role === 'user' ? 'justify-end' : 'justify-start'
          }`}
        >
          <div
            className={`max-w-[80%] rounded-lg p-4 ${
              message.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-100'
            }`}
          >
            {/* Message content */}
            <div className="prose prose-invert max-w-none">
              <div className="whitespace-pre-wrap break-words">
                {message.content}
              </div>
            </div>

            {/* Tool execution status */}
            {message.toolUses && message.toolUses.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-700">
                <ToolStatus toolUses={message.toolUses} />
              </div>
            )}

            {/* Thinking content */}
            {message.thinking && (
              <details className="mt-3 pt-3 border-t border-gray-700">
                <summary className="text-sm text-gray-400 cursor-pointer hover:text-gray-300">
                  🤔 Extended thinking
                </summary>
                <div className="mt-2 text-sm text-gray-400 whitespace-pre-wrap">
                  {message.thinking}
                </div>
              </details>
            )}

            {/* Timestamp */}
            <div className="mt-2 text-xs text-gray-400">
              {message.timestamp.toLocaleTimeString()}
            </div>
          </div>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
