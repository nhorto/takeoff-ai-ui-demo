import { create } from 'zustand';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  thinking?: string;
  toolUses?: Array<{ name: string; status: 'executing' | 'complete' | 'error' }>;
  attachments?: Array<{ type: 'pdf'; name: string; path: string }>;
}

interface TakeoffResult {
  csvPath?: string;
  summaryPath?: string;
  stats: {
    iterations: number;
    totalTokens: number;
    estimatedCost: number;
  };
}

interface AgentStore {
  // State
  messages: Message[];
  isProcessing: boolean;
  results: TakeoffResult | null;
  error: string | null;
  attachedPdf: { name: string; path: string } | null;
  waitingForUserResponse: boolean;

  // Actions
  attachPdf: (name: string, path: string) => void;
  sendMessage: (userMessage: string) => Promise<void>;
  sendResponse: (response: string) => Promise<void>;
  addMessage: (message: Message) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

export const useAgentStore = create<AgentStore>((set, get) => ({
  // Initial state
  messages: [],
  isProcessing: false,
  results: null,
  error: null,
  attachedPdf: null,
  waitingForUserResponse: false,

  // Attach a PDF (doesn't start processing)
  attachPdf: (name: string, path: string) => {
    console.log(`📎 Attached PDF: ${name}`);
    set({ attachedPdf: { name, path }, error: null });
  },

  // Send a user message and start the agent
  sendMessage: async (userMessage: string) => {
    const { attachedPdf } = get();

    console.log(`💬 User message: ${userMessage}`);

    // Add user message to chat
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
      attachments: attachedPdf ? [{ type: 'pdf', name: attachedPdf.name, path: attachedPdf.path }] : undefined
    };

    get().addMessage(userMsg);

    set({ isProcessing: true, error: null });

    try {
      // Load system prompt from knowledge base
      const systemPrompt = await window.electronAPI.loadKnowledgeBase();

      // Set up listener for agent updates
      window.electronAPI.onAgentUpdate((update) => {
        console.log('📨 Agent update:', update);

        if (update.type === 'assistant_message') {
          get().addMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: update.content,
            timestamp: new Date(),
            thinking: update.thinking
          });
        } else if (update.type === 'tool_execution') {
          // Update last message with tool execution status
          const messages = get().messages;
          if (messages.length > 0) {
            const lastMessage = messages[messages.length - 1];
            lastMessage.toolUses = update.tools;
            set({ messages: [...messages] });
          }
        }
      });

      // Set up listener for agent questions
      window.electronAPI.onAgentQuestion((questionData) => {
        console.log('❓ Agent question:', questionData);

        // Add question as assistant message
        get().addMessage({
          id: Date.now().toString(),
          role: 'assistant',
          content: questionData.context
            ? `${questionData.context}\n\n${questionData.question}`
            : questionData.question,
          timestamp: new Date()
        });

        // Set waiting for response flag
        set({ waitingForUserResponse: true });
      });

      // Start the agent with PDF context if attached
      const result = await window.electronAPI.startTakeoff({
        pdfPath: attachedPdf?.path || '',
        systemPrompt,
        userMessage
      });

      if (result.success) {
        console.log('✅ Agent completed successfully');

        // Add final result message if there is one
        if (result.result) {
          get().addMessage({
            id: Date.now().toString(),
            role: 'assistant',
            content: result.result,
            timestamp: new Date()
          });
        }

        set({
          isProcessing: false,
          results: {
            stats: result.stats
          }
        });
      } else {
        throw new Error(result.error || 'Agent failed');
      }

    } catch (error) {
      console.error('❌ Agent failed:', error);

      set({
        isProcessing: false,
        error: error instanceof Error ? error.message : String(error)
      });

    } finally {
      // Clean up listeners
      window.electronAPI.removeAgentUpdateListener();
      window.electronAPI.removeAgentQuestionListener();
    }
  },

  // Send a response to Claude's question
  sendResponse: async (response: string) => {
    console.log(`💬 User response: ${response}`);

    // Add user response to chat
    get().addMessage({
      id: Date.now().toString(),
      role: 'user',
      content: response,
      timestamp: new Date()
    });

    // Send response to agent
    await window.electronAPI.sendUserResponse(response);

    // Clear waiting flag
    set({ waitingForUserResponse: false });
  },

  // Add a message to the chat
  addMessage: (message) => {
    set(state => ({
      messages: [...state.messages, message]
    }));
  },

  // Set error state
  setError: (error) => {
    set({ error, isProcessing: false });
  },

  // Reset state
  reset: () => {
    set({
      messages: [],
      isProcessing: false,
      results: null,
      error: null,
      attachedPdf: null,
      waitingForUserResponse: false
    });
  }
}));
