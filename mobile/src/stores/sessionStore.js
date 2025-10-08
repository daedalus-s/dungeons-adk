import { create } from 'zustand';

export const useSessionStore = create((set) => ({
  sessionId: null,
  isRecording: false,
  events: [],
  summaries: null,

  startSession: (sessionId) =>
    set({ sessionId, isRecording: true, events: [] }),

  stopSession: (results) =>
    set({ isRecording: false, summaries: results.summaries }),

  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, { ...event, id: Date.now() }]
    })),

  clearSession: () =>
    set({ sessionId: null, isRecording: false, events: [], summaries: null }),
}));
