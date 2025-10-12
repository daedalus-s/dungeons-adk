import axios from 'axios';

// UPDATE THIS with your computer's IP address
// Find it with: ipconfig (look for IPv4 Address)
const API_BASE_URL = 'http://192.168.200.2:3000/api';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60000,
  headers: {
    'Content-Type': 'application/json',
  },
});

export const api = {
  createSession: (players, dmId) => 
    apiClient.post('/sessions', { players, dm_id: dmId }),
  
  getSession: (sessionId) => 
    apiClient.get(`/sessions/${sessionId}`),
  
  uploadAudio: (sessionId, audioFile, chunkIndex) => {
    const formData = new FormData();
    formData.append('audio', {
      uri: audioFile.uri,
      type: 'audio/wav',
      name: `chunk_${chunkIndex}.wav`
    });
    formData.append('chunkIndex', chunkIndex.toString());
    
    return apiClient.post(`/sessions/${sessionId}/audio`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
  
  endSession: (sessionId) => 
    apiClient.post(`/sessions/${sessionId}/end`),
  
  createPlayer: (playerData) => 
    apiClient.post('/players', playerData),
  
  getAllPlayers: () => 
    apiClient.get('/players'),
  
  getPendingApprovals: () => 
    apiClient.get('/approvals/pending'),
  
  approveRequest: (requestId, dmId, decision, comment) => 
    apiClient.post(`/approvals/${requestId}`, { dm_id: dmId, decision, comment }),
  
  getStats: () => 
    apiClient.get('/stats'),
};

export default api;
