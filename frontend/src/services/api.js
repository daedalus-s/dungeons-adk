import axios from 'axios';

// API base URL - use environment variable or default to localhost
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  // Session endpoints
  createSession: (players, dmId) => 
    apiClient.post('/sessions', { players, dm_id: dmId }),
  
  getSession: (sessionId) => 
    apiClient.get(`/sessions/${sessionId}`),
  
  getAllSessions: () => 
    apiClient.get('/sessions'),
  
  uploadAudio: (sessionId, formData) => 
    apiClient.post(`/sessions/${sessionId}/audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minutes for large uploads
    }),
  
  processTranscript: (sessionId, text) =>
    apiClient.post(`/sessions/${sessionId}/transcript`, { text }),
  
  endSession: (sessionId) => 
    apiClient.post(`/sessions/${sessionId}/end`),
  
  // Player endpoints
  createPlayer: (playerData) => 
    apiClient.post('/players', playerData),
  
  getPlayer: (playerId) =>
    apiClient.get(`/players/${playerId}`),
  
  getAllPlayers: () => 
    apiClient.get('/players'),
  
  // Approval endpoints
  getPendingApprovals: () => 
    apiClient.get('/approvals/pending'),
  
  approveRequest: (requestId, dmId, decision, comment) => 
    apiClient.post(`/approvals/${requestId}`, { 
      dm_id: dmId, 
      decision, 
      comment 
    }),
  
  // Stats
  getStats: () => 
    apiClient.get('/stats'),
  
  // Health check
  healthCheck: () =>
    apiClient.get('/health', { baseURL: 'http://localhost:3000' })
};

export default api;