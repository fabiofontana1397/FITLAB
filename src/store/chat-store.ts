import { create } from 'zustand';

import { buildClientContext } from '@/lib/assistant/build-client-context';
import { supabase } from '@/lib/supabase/client';

export type ChatMessage = {
  id: string;
  role: 'user' | 'assistant';
  text: string;
};

type ChatState = {
  messages: ChatMessage[];
  isTyping: boolean;
  error: string | null;
  historyLoaded: boolean;
  loadHistory: () => Promise<void>;
  send: (text: string) => Promise<void>;
};

const WELCOME_MESSAGE: ChatMessage = {
  id: 'welcome',
  role: 'assistant',
  text: 'Ciao! Sono il tuo coach FITBRO — chiedimi di allenamento, dieta, misure o del tuo obiettivo.',
};

export const useChatStore = create<ChatState>((set, get) => ({
  messages: [WELCOME_MESSAGE],
  isTyping: false,
  error: null,
  historyLoaded: false,

  loadHistory: async () => {
    if (get().historyLoaded) return;
    const { data, error } = await supabase.from('chat_messages').select('id, role, content, created_at').order('created_at');
    if (error || !data || data.length === 0) {
      set({ historyLoaded: true });
      return;
    }
    // The synthetic welcome message is never itself persisted to
    // chat_messages, so real history simply replaces it here.
    set({
      messages: data.map((row) => ({ id: row.id, role: row.role as 'user' | 'assistant', text: row.content })),
      historyLoaded: true,
    });
  },

  send: async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;

    const userMessage: ChatMessage = { id: `u-${Date.now()}`, role: 'user', text: trimmed };
    set((state) => ({ messages: [...state.messages, userMessage], isTyping: true, error: null }));

    try {
      const clientContext = buildClientContext();
      const { data, error } = await supabase.functions.invoke('chat', { body: { message: trimmed, clientContext } });
      if (error) throw error;

      const assistantMessage: ChatMessage = { id: data.id, role: 'assistant', text: data.text };
      set((state) => ({ messages: [...state.messages, assistantMessage], isTyping: false }));
    } catch (err) {
      console.warn('chat send failed', err);
      set({ isTyping: false, error: 'Non sono riuscito a rispondere. Riprova tra poco.' });
    }
  },
}));
