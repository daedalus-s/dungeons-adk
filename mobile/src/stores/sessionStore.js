import { create } from 'zustand';

export const useSessionStore = create((set) => ({
  sessionId: null,
  isRecording: false,
  isPaused: false,
  events: [],
  transcript: '',
  recordingDuration: 0,
  
  startSession: (sessionId) =>
    set({ 
      sessionId, 
      isRecording: true, 
      isPaused: false,
      events: [],
      transcript: '',
      recordingDuration: 0
    }),
  
  pauseRecording: () =>
    set({ isPaused: true }),
  
  resumeRecording: () =>
    set({ isPaused: false }),
  
  stopSession: () =>
    set({ 
      isRecording: false, 
      isPaused: false 
    }),
  
  addEvent: (event) =>
    set((state) => ({
      events: [...state.events, event]
    })),
  
  appendTranscript: (text) =>
    set((state) => ({
      transcript: state.transcript + ' ' + text
    })),
  
  incrementDuration: () =>
    set((state) => ({
      recordingDuration: state.recordingDuration + 1
    })),
  
  clearSession: () =>
    set({ 
      sessionId: null, 
      isRecording: false, 
      isPaused: false,
      events: [], 
      transcript: '',
      recordingDuration: 0
    }),
}));
