import { create } from 'zustand';

export const useSessionStore = create((set) => ({
  sessionId: null,
  events: [],
  transcript: '',
  
  setSession: (sessionId) => set({ 
    sessionId, 
    events: [], 
    transcript: '' 
  }),
  
  addEvent: (event) => set((state) => ({
    events: [...state.events, event]
  })),
  
  appendTranscript: (text) => set((state) => ({
    transcript: state.transcript + ' ' + text
  })),
  
  clearSession: () => set({ 
    sessionId: null, 
    events: [], 
    transcript: '' 
  }),
}));