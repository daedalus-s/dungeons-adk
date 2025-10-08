import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import cors from 'cors';
import { AgentOrchestrator } from './agents/orchestrator.js';
import { config } from '../config.js';

const app = express();
const PORT = config.port || 3000;

// Middleware
app.use(cors());
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

// Initialize orchestrator
const orchestrator = new AgentOrchestrator({
  anthropicApiKey: config.anthropicApiKey,
  mongoUri: config.mongodbUri,
  googleCredentials: config.googleApplicationCredentials,
  sheetsId: config.googleSheetsId
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('ðŸ“± Client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('ðŸ“± Client disconnected');
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
orchestrator.on('agentStateChange', (data) => {
  console.log(`[Agent] ${data.agent}: ${data.previousState} â†’ ${data.newState}`);
  broadcast({ type: 'agent:state', data });
});

orchestrator.on('agentLog', (data) => {
  console.log(`[${data.agent}] ${data.message}`);
});

orchestrator.on('agentError', (data) => {
  console.error(`[Error] ${data.agent}:`, data.error.message);
});

// ===== ROUTES =====

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date(),
    uptime: process.uptime()
  });
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

// Create new session
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

    broadcast({ type: 'session:created', data: { sessionId } });

    res.json({ 
      sessionId, 
      session: {
        id: session.id,
        status: session.status,
        start_ts: session.start_ts
      }
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Upload audio chunk (simulated - for testing without actual audio)
// Upload audio chunk
app.post('/api/sessions/:sessionId/audio', upload.single('audio'), async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { chunkIndex } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file uploaded' });
    }

    const audioUri = req.file.path;

    console.log(`📁 Audio uploaded: ${audioUri} (${req.file.size} bytes)`);

    // Update session with audio location
    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    session.audio_locations.push(audioUri);
    await stateManager.saveSession(session);

    // Transcribe the audio
    console.log('🎙️ Starting transcription...');
    const transcriptionAgent = orchestrator.getAgent('transcription');
    
    const transcript = await transcriptionAgent.execute({
      audioUri,
      sessionId,
      chunkIndex: parseInt(chunkIndex)
    });

    console.log(`✅ Transcribed ${transcript.wordCount} words`);

    // Extract events from transcript
    const stateManager2 = orchestrator.getAgent('state-manager');
    const allPlayers = await stateManager2.getAllPlayers();
    const sessionPlayers = allPlayers.filter(p => 
      session.metadata?.players?.includes(p.id)
    );

    const eventAgent = orchestrator.getAgent('event-extraction');
    eventAgent.updatePlayers(sessionPlayers);

    const eventData = await eventAgent.execute({
      transcript,
      sessionId,
      chunkIndex: parseInt(chunkIndex)
    });

    // Save events to session
    session.event_list.push(...eventData.events);
    await stateManager2.saveSession(session);

    // Broadcast to connected clients
    broadcast({ 
      type: 'audio:transcribed', 
      data: { 
        sessionId, 
        chunkIndex, 
        transcript: transcript.text,
        events: eventData.events 
      } 
    });

    res.json({ 
      audioUri, 
      chunkIndex,
      transcript: {
        text: transcript.text,
        wordCount: transcript.wordCount,
        speakerCount: transcript.segments?.length || 0
      },
      events: eventData.events,
      eventCount: eventData.events.length
    });
  } catch (error) {
    console.error('Error processing audio:', error);
    res.status(500).json({ error: error.message });
  }
});

// Process transcript text (for testing)
app.post('/api/sessions/:sessionId/transcript', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    
    // Get players
    const allPlayers = await stateManager.getAllPlayers();
    const sessionPlayers = allPlayers.filter(p => 
      session.metadata?.players?.includes(p.id)
    );

    // Update event extraction agent with players
    const eventAgent = orchestrator.getAgent('event-extraction');
    eventAgent.updatePlayers(sessionPlayers);

    // Extract events
    const eventData = await orchestrator.executeAgent('event-extraction', {
      transcript: text,
      sessionId,
      chunkIndex: 0
    });

    // Update session
    session.event_list.push(...eventData.events);
    await stateManager.saveSession(session);

    broadcast({ 
      type: 'events:extracted', 
      data: { sessionId, events: eventData.events } 
    });

    res.json({
      sessionId,
      events: eventData.events,
      eventCount: eventData.events.length
    });
  } catch (error) {
    console.error('Error processing transcript:', error);
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
    const allPlayers = await stateManager.getAllPlayers();
    const sessionPlayers = allPlayers.filter(p => 
      session.metadata?.players?.includes(p.id)
    );

    // Generate summaries
    console.log(`Generating summaries for session ${sessionId}...`);
    const summaries = await orchestrator.executeAgent('summarizer', {
      sessionId,
      events: session.event_list || [],
      players: sessionPlayers
    });

    // Update session
    await stateManager.updateSession(sessionId, {
      status: 'completed',
      end_ts: new Date(),
      summaries: summaries
    });

    broadcast({ type: 'session:completed', data: { sessionId } });

    res.json({
      sessionId,
      status: 'completed',
      events: session.event_list,
      summaries
    });
  } catch (error) {
    console.error('Error ending session:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get session
app.get('/api/sessions/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    
    res.json({
      id: session.id,
      status: session.status,
      start_ts: session.start_ts,
      end_ts: session.end_ts,
      event_count: session.event_list?.length || 0,
      has_summaries: !!session.summaries
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get all sessions
app.get('/api/sessions', async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    const sessions = await stateManager.Session.find()
      .sort({ start_ts: -1 })
      .limit(50);
    
    res.json(sessions.map(s => ({
      id: s.id,
      status: s.status,
      start_ts: s.start_ts,
      end_ts: s.end_ts,
      event_count: s.event_list?.length || 0
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
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

    res.json({
      id: player.id,
      real_name: player.real_name,
      in_game_name: player.in_game_name,
      race: player.race,
      role_type: player.role_type,
      level: player.level
    });
  } catch (error) {
    console.error('Error creating player:', error);
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

// Get all players
app.get('/api/players', async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    const players = await stateManager.getAllPlayers();
    res.json(players.map(p => ({
      id: p.id,
      real_name: p.real_name,
      in_game_name: p.in_game_name,
      race: p.race,
      role_type: p.role_type,
      level: p.level,
      group: p.group
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
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
      
      // Execute the write via sheets agent
      const sheetsAgent = orchestrator.getAgent('sheets');
      if (sheetsAgent) {
        const result = await sheetsAgent.execute({ writeRequest, approval });
        broadcast({ type: 'approval:executed', data: { requestId, result } });
        res.json({ approval, writeResult: result });
      } else {
        res.json({ approval, message: 'Approved (sheets agent not configured)' });
      }
    } else {
      res.json({ approval, message: 'Request rejected' });
    }
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({ error: error.message });
  }
});

// Create write request manually (for testing)
app.post('/api/write-requests', async (req, res) => {
  try {
    const { target_sheet, payload, session_id } = req.body;

    const sheetsAgent = orchestrator.getAgent('sheets');
    const writeRequest = await sheetsAgent.createWriteRequest(
      target_sheet,
      payload,
      session_id
    );

    const stateManager = orchestrator.getAgent('state-manager');
    await stateManager.saveWriteRequest(writeRequest);

    broadcast({ type: 'writeRequest:created', data: writeRequest });

    res.json(writeRequest);
  } catch (error) {
    console.error('Error creating write request:', error);
    res.status(500).json({ error: error.message });
  }
});
// ===== STATISTICS =====

app.get('/api/stats', async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    
    const totalSessions = await stateManager.Session.countDocuments();
    const completedSessions = await stateManager.Session.countDocuments({ status: 'completed' });
    const totalPlayers = await stateManager.Player.countDocuments();
    const totalEvents = await stateManager.Session.aggregate([
      { $project: { eventCount: { $size: { $ifNull: ['$event_list', []] } } } },
      { $group: { _id: null, total: { $sum: '$eventCount' } } }
    ]);

    res.json({
      totalSessions,
      completedSessions,
      totalPlayers,
      totalEvents: totalEvents[0]?.total || 0
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== START SERVER =====

const server = app.listen(PORT, () => {
  console.log(`\nðŸš€ Dungeons ADK Server`);
  console.log(`ðŸ“¡ API: http://localhost:${PORT}`);
  console.log(`ðŸ”Œ WebSocket: ws://localhost:${PORT}`);
  console.log(`ðŸ“Š Health: http://localhost:${PORT}/health`);
  console.log(`\nâœ¨ Ready to process D&D sessions!\n`);
});

// WebSocket upgrade
server.on('upgrade', (request, socket, head) => {
  wss.handleUpgrade(request, socket, head, (ws) => {
    wss.emit('connection', ws, request);
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

export default app;
