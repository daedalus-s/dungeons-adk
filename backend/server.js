import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import dotenv from 'dotenv';
import { orchestrator } from './agents/orchestrator.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// File upload configuration
const storage = multer.diskStorage({
  destination: './uploads/',
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(7)}-${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('Client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('Client disconnected');
  });
});

// Broadcast to all connected clients
const broadcast = (data) => {
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(JSON.stringify(data));
    }
  });
};

// Agent event listeners
orchestrator.on('workflowStarted', (data) => broadcast({ type: 'workflow:started', data }));
orchestrator.on('workflowCompleted', (data) => broadcast({ type: 'workflow:completed', data }));
orchestrator.on('agentStateChange', (data) => broadcast({ type: 'agent:state', data }));

// ===== API ROUTES =====

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Agent health
app.get('/api/agents/health', async (req, res) => {
  try {
    const health = await orchestrator.healthCheck();
    res.json(health);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== SESSION ROUTES =====

// Start new session
app.post('/api/sessions', async (req, res) => {
  try {
    const { players, dm_id } = req.body;
    const sessionId = `session_${Date.now()}`;

    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.saveSession({
      id: sessionId,
      start_ts: new Date(),
      status: 'recording',
      audio_locations: [],
      transcripts: [],
      event_list: [],
      per_player_events: {},
      summary_sent: false,
      metadata: { dm_id, players }
    });

    res.json({ sessionId, session });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Upload audio chunk
app.post('/api/sessions/:sessionId/audio', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { chunkIndex } = req.body;
    const audioUri = `/uploads/${req.file.filename}`;

    // Update session with audio location
    const stateManager = orchestrator.getAgent('state-manager');
    await stateManager.updateSession(sessionId, {
      $push: { audio_locations: audioUri }
    });

    // Trigger transcription
    const transcriptionAgent = orchestrator.getAgent('transcription');
    const transcript = await transcriptionAgent.execute({
      audioUri: req.file.path,
      sessionId,
      chunkIndex: parseInt(chunkIndex)
    });

    res.json({ audioUri, transcript });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// End session and process
app.post('/api/sessions/:sessionId/end', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);

    // Get players
    const players = await stateManager.getAllPlayers();

    // Process session
    const results = await orchestrator.processSession({
      sessionId,
      audioChunks: session.audio_locations.map((uri, i) => ({ uri, index: i })),
      players
    });

    // Update session
    await stateManager.updateSession(sessionId, {
      status: 'completed',
      end_ts: new Date(),
      event_list: results.events,
      transcripts: results.transcripts,
      summaries: results.summaries
    });

    res.json(results);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get session
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    res.json(session);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ===== PLAYER ROUTES =====

// Create player
app.post('/api/players', async (req, res) => {
  try {
    const playerData = {
      id: `player_${Date.now()}`,
      ...req.body,
      date_joined: new Date()
    };

    const stateManager = orchestrator.getAgent('state-manager');
    const player = await stateManager.savePlayer(playerData);

    res.json(player);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// OCR stat sheet
app.post('/api/players/:playerId/stat-sheet', upload.single('image'), async (req, res) => {
  try {
    const { playerId } = req.params;
    const imageUri = req.file.path;

    const ocrAgent = orchestrator.getAgent('ocr');
    const result = await ocrAgent.execute({ imageUri, playerId });

    // Save to player
    const stateManager = orchestrator.getAgent('state-manager');
    await stateManager.savePlayer({
      id: playerId,
      stat_sheet_data: result.parsedFields
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Generate persona
app.post('/api/players/:playerId/persona', upload.single('image'), async (req, res) => {
  try {
    const { playerId } = req.params;
    const { characterName, userPrompt } = req.body;
    const imageUri = req.file.path;

    const personaAgent = orchestrator.getAgent('persona');
    const result = await personaAgent.execute({
      imageUri,
      playerId,
      characterName,
      userPrompt
    });

    // Save to player
    const stateManager = orchestrator.getAgent('state-manager');
    await stateManager.savePlayer({
      id: playerId,
      persona_data: result.personaDescriptors,
      persona_image_id: result.avatarUri
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get player
app.get('/api/players/:playerId', async (req, res) => {
  try {
    const { playerId } = req.params;
    const stateManager = orchestrator.getAgent('state-manager');
    const player = await stateManager.getPlayer(playerId);
    res.json(player);
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// ===== APPROVAL ROUTES =====

// Get pending write requests
app.get('/api/approvals/pending', async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    const pending = await stateManager.getPendingWriteRequests();
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Approve/Reject write request
app.post('/api/approvals/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { dm_id, decision, comment } = req.body;

    const stateManager = orchestrator.getAgent('state-manager');

    const approval = {
      id: `approval_${Date.now()}`,
      request_id: requestId,
      dm_id,
      decision,
      comment,
      ts: new Date()
    };

    await stateManager.saveApproval(approval);

    // If approved, execute write
    if (decision === 'approve') {
      const writeRequest = await stateManager.WriteRequest.findOne({ id: requestId });
      const result = await orchestrator.processApprovedWrite(writeRequest, approval);
      res.json({ approval, writeResult: result });
    } else {
      res.json({ approval, message: 'Request rejected' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== GROUPME ROUTES =====

// Link player to GroupMe
app.post('/api/groupme/link', async (req, res) => {
  try {
    const { playerId, groupmeUserId } = req.body;

    const groupmeAgent = orchestrator.getAgent('groupme');
    await groupmeAgent.linkPlayerToGroupMe(playerId, groupmeUserId);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get GroupMe members
app.get('/api/groupme/members', async (req, res) => {
  try {
    const groupmeAgent = orchestrator.getAgent('groupme');
    const members = await groupmeAgent.getGroupMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== STATISTICS =====

app.get('/api/stats', async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    const stats = await stateManager.getSessionStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====

const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`WebSocket available for real-time updates`);
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

export default app;
