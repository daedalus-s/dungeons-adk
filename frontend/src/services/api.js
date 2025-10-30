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
  
  getSessionDetails: (sessionId) =>
    apiClient.get(`/sessions/${sessionId}/details`),
  
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
  
  approveRequest: (requestId, dmId, decision, comment, sendToGroupMe = true) => 
    apiClient.post(`/approvals/${requestId}`, { 
      dm_id: dmId, 
      decision, 
      comment,
      send_to_groupme: sendToGroupMe
    }),
  
  // GroupMe endpoints
  linkPlayerToGroupMe: (playerId, groupmeUserId) =>
    apiClient.post('/groupme/link', { player_id: playerId, groupme_user_id: groupmeUserId }),
  
  getGroupMeMembers: () =>
    apiClient.get('/groupme/members'),
  
  testGroupMeBot: () =>
    apiClient.post('/groupme/test'),
  
  sendTestMessage: (sessionId) =>
    apiClient.post(`/groupme/test-message/${sessionId}`),
  
  // Stats
  getStats: () => 
    apiClient.get('/stats'),
  
  // Health check
  healthCheck: () =>
    apiClient.get('/health', { baseURL: 'http://localhost:3000' }),

  // Vector Search / RAG
  queryWithRAG: (query, topK = 3, conversationHistory = []) =>
    apiClient.post('/query', { query, topK, conversationHistory }),
  
  searchSessions: (query, topK = 5, filter = {}) =>
    apiClient.post('/search/sessions', { query, topK, filter }),
  
  indexSession: (sessionId) =>
    apiClient.post(`/sessions/${sessionId}/index`),
  
  batchIndexAllSessions: () =>
    apiClient.post('/sessions/index/all'),
  
  getVectorStats: () =>
    apiClient.get('/vector/stats'),
  
  deleteSessionIndex: (sessionId) =>
    apiClient.delete(`/sessions/${sessionId}/index`)
};

export default api;