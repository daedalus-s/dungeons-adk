import express from 'express';
import { WebSocketServer } from 'ws';
import multer from 'multer';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { AgentOrchestrator } from './agents/orchestrator.js';
import { GroupMeAgent } from './agents/groupme-agent.js';
import { config } from '../config.js';
import session from 'express-session';
import MongoStore from 'connect-mongo';
import { requireAuth, requireAdmin, optionalAuth } from './middleware/auth.js';
import { setupAuthRoutes } from './auth/routes.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = config.port || 3000;

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
// Session configuration
app.use(session({
  secret: process.env.SESSION_SECRET || 'dungeons-adk-secret-change-in-production',
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: config.mongodbUri,
    touchAfter: 24 * 3600
  }),
  cookie: {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,
    secure: false,
    sameSite: 'lax'
  }
}));
// Serve uploaded audio files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

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

// Setup authentication routes
const stateManager = orchestrator.getAgent('state-manager');

// Add User schema to state manager
if (!stateManager.User) {
  const mongoose = await import('mongoose');
  const userSchema = new mongoose.default.Schema({
    id: { type: String, required: true, unique: true },
    username: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
    player_id: { type: String },
    created_at: Date,
    last_login: Date
  }, { timestamps: true });
  
  stateManager.User = mongoose.default.models.User || mongoose.default.model('User', userSchema);
}

setupAuthRoutes(app, stateManager);

// Initialize GroupMe agent
const groupmeAgent = new GroupMeAgent({
  anthropicApiKey: config.anthropicApiKey,
  groupmeAccessToken: config.groupmeAccessToken,
  groupmeBotId: config.groupmeBotId,
  groupmeGroupId: config.groupmeGroupId
});

// WebSocket server for real-time updates
const wss = new WebSocketServer({ noServer: true });

wss.on('connection', (ws) => {
  console.log('📱 Client connected');

  ws.on('message', (message) => {
    console.log('Received:', message.toString());
  });

  ws.on('close', () => {
    console.log('📱 Client disconnected');
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
  console.log(`[Agent] ${data.agent}: ${data.previousState} → ${data.newState}`);
  broadcast({ type: 'agent:state', data });
});

orchestrator.on('agentLog', (data) => {
  console.log(`[${data.agent}] ${data.message}`);
});

orchestrator.on('agentError', (data) => {
  console.error(`[Error] ${data.agent}:`, data.error.message);
});

// ===== API ROUTES =====

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
app.post('/api/sessions', requireAuth, async (req, res) => {
  try {
    const { player_ids } = req.body;
    const sessionId = `session_${Date.now()}`;

    // Verify user has access
    if (req.user.role !== 'admin') {
      if (!req.user.player_id || !player_ids.includes(req.user.player_id)) {
        return res.status(403).json({ error: 'You must be a participant to create this session' });
      }
    }

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
      metadata: { 
        dm_id: req.user.id,
        created_by: req.user.username, 
        player_ids: player_ids
      }
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

    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    session.audio_locations.push(audioUri);
    await stateManager.saveSession(session);

    console.log('🎙️ Starting transcription...');
    const transcriptionAgent = orchestrator.getAgent('transcription');
    
    const transcript = await transcriptionAgent.execute({
      audioUri,
      sessionId,
      chunkIndex: parseInt(chunkIndex)
    });

    console.log(`✅ Transcribed ${transcript.wordCount} words`);

    const allPlayers = await stateManager.getAllPlayers();
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

    session.event_list.push(...eventData.events);
    await stateManager.saveSession(session);

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

// Process transcript text
app.post('/api/sessions/:sessionId/transcript', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { text } = req.body;

    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }

    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    
    const allPlayers = await stateManager.getAllPlayers();
    const sessionPlayers = allPlayers.filter(p => 
      session.metadata?.players?.includes(p.id)
    );

    const eventAgent = orchestrator.getAgent('event-extraction');
    eventAgent.updatePlayers(sessionPlayers);

    const eventData = await orchestrator.executeAgent('event-extraction', {
      transcript: text,
      sessionId,
      chunkIndex: 0
    });

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

    const allPlayers = await stateManager.getAllPlayers();
    const sessionPlayers = allPlayers.filter(p => 
      session.metadata?.players?.includes(p.id)
    );

    console.log(`Generating summaries for session ${sessionId}...`);
    const summaries = await orchestrator.executeAgent('summarizer', {
      sessionId,
      events: session.event_list || [],
      players: sessionPlayers
    });

    await stateManager.updateSession(sessionId, {
      status: 'completed',
      end_ts: new Date(),
      summaries: summaries
    });

    console.log('✅ Summaries generated');

    const sheetsAgent = orchestrator.getAgent('sheets');
    if (sheetsAgent && summaries.sheetsData && summaries.sheetsData.rows?.length > 0) {
      console.log('📊 Creating write request for Google Sheets...');
      
      const writeRequest = await sheetsAgent.createWriteRequest(
        summaries.sheetsData.sheetName,
        summaries.sheetsData,
        sessionId
      );
      
      await stateManager.saveWriteRequest(writeRequest);
      console.log('✅ Write request created (pending DM approval)');
      
      broadcast({ type: 'write:request:created', data: { requestId: writeRequest.id } });
    } else {
      if (!sheetsAgent) {
        console.log('⚠️  Sheets agent not configured - skipping write request');
      } else if (!summaries.sheetsData) {
        console.log('⚠️  No sheets data generated - skipping write request');
      } else if (!summaries.sheetsData.rows || summaries.sheetsData.rows.length === 0) {
        console.log('⚠️  Sheets data has no rows - skipping write request');
      }
    }

    const vectorAgent = orchestrator.getAgent('vector-search');
    if (vectorAgent) {
      try {
        const session = await stateManager.getSession(sessionId);
        await vectorAgent.execute({
          operation: 'index-session',
          sessionId: session.id,
          summary: summaries,
          metadata: {
            date: session.start_ts,
            players: session.metadata?.player_ids || [],
            eventCount: eventData.events.length,
            username: req.user.username, // Add username for filtering
            created_by: req.user.username
          }
        });
        console.log('✅ Session indexed for semantic search');
      } catch (error) {
        console.log('⚠️  Failed to index session:', error.message);
      }
    }

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

// Get session details with summaries
app.get('/api/sessions/:sessionId/details', async (req, res) => {
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
      events: session.event_list || [],
      summaries: session.summaries || null
    });
  } catch (error) {
    res.status(404).json({ error: error.message });
  }
});

// Get all sessions
app.get('/api/sessions', requireAuth, async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    
    let query = {};
    if (req.user.role !== 'admin') {
      query = { 'metadata.player_ids': req.user.player_id };
    }
    
    const sessions = await stateManager.Session.find(query)
      .sort({ start_ts: -1 })
      .limit(50);
    
    res.json(sessions.map(s => ({
      id: s.id,
      status: s.status,
      start_ts: s.start_ts,
      end_ts: s.end_ts,
      event_count: s.event_list?.length || 0,
      has_summaries: !!s.summaries
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== PLAYER ROUTES =====

app.post('/api/players', requireAdmin, async (req, res) => {
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
      group: p.group,
      groupme_user_id: p.groupme_user_id
    })));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ===== APPROVAL ROUTES WITH GROUPME =====

app.get('/api/approvals/pending', requireAdmin, async (req, res) => {
  try {
    const stateManager = orchestrator.getAgent('state-manager');
    const pending = await stateManager.getPendingWriteRequests();
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/approvals/:requestId', async (req, res) => {
  try {
    const { requestId } = req.params;
    const { dm_id, decision, comment, send_to_groupme } = req.body;

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

    let result = { approval };

    if (decision === 'approve') {
      const writeRequest = await stateManager.WriteRequest.findOne({ id: requestId });
      
      // Execute sheets write
      const sheetsAgent = orchestrator.getAgent('sheets');
      if (sheetsAgent) {
        const writeResult = await sheetsAgent.execute({ writeRequest, approval });
        result.writeResult = writeResult;
        
        // Send GroupMe messages if requested
        if (send_to_groupme) {
          try {
            const session = await stateManager.getSession(writeRequest.created_by);
            
            if (session.summaries) {
              console.log('📨 Sending summaries to GroupMe...');
              
              const groupmeResult = await groupmeAgent.execute({
                sessionId: writeRequest.created_by,
                groupSummary: session.summaries.groupSummary,
                playerSummaries: session.summaries.playerSummaries,
                appDeepLink: `https://dungeons-adk.app/session/${writeRequest.created_by}`
              });
              
              result.groupmeResult = groupmeResult;
              
              // Update session to mark summaries as sent
              await stateManager.updateSession(writeRequest.created_by, {
                summary_sent: true
              });
              
              console.log('✅ GroupMe messages sent!');
              console.log(`   Group: ${groupmeResult.groupMessage ? 'sent' : 'failed'}`);
              console.log(`   Personal: ${groupmeResult.personalMessages.filter(m => m.status === 'delivered').length}/${groupmeResult.personalMessages.length} delivered`);
            }
          } catch (error) {
            console.error('GroupMe send failed:', error);
            result.groupmeError = error.message;
          }
        }
        
        broadcast({ 
          type: 'approval:executed', 
          data: { 
            requestId, 
            writeResult: result.writeResult,
            groupmeSent: !!result.groupmeResult 
          } 
        });
      }
    }

    res.json(result);
  } catch (error) {
    console.error('Error processing approval:', error);
    res.status(500).json({ error: error.message });
  }
});

// ===== GROUPME ROUTES =====

app.post('/api/groupme/link', async (req, res) => {
  try {
    const { player_id, groupme_user_id } = req.body;
    
    const result = await groupmeAgent.linkPlayerToGroupMe(player_id, groupme_user_id);
    
    // Update player record
    const stateManager = orchestrator.getAgent('state-manager');
    await stateManager.Player.findOneAndUpdate(
      { id: player_id },
      { groupme_user_id }
    );
    
    res.json({ success: true, linked: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/groupme/members', async (req, res) => {
  try {
    const members = await groupmeAgent.getGroupMembers();
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/groupme/test', async (req, res) => {
  try {
    const result = await groupmeAgent.testBotConnection();
    res.json({ success: result });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/groupme/test-message/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const stateManager = orchestrator.getAgent('state-manager');
    const session = await stateManager.getSession(sessionId);
    
    if (!session.summaries) {
      return res.status(400).json({ error: 'Session has no summaries' });
    }
    
    const result = await groupmeAgent.execute({
      sessionId,
      groupSummary: session.summaries.groupSummary,
      playerSummaries: session.summaries.playerSummaries,
      appDeepLink: `https://dungeons-adk.app/session/${sessionId}`
    });
    
    res.json(result);
  } catch (error) {
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
// ===== VECTOR SEARCH / RAG ROUTES =====

// Query sessions with natural language (RAG)
app.post('/api/query', requireAuth, async (req, res) => {
  try {
    const { query, topK = 3, conversationHistory = [] } = req.body;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Query text is required' });
    }

    const vectorAgent = orchestrator.getAgent('vector-search');
    
    if (!vectorAgent) {
      return res.status(503).json({ 
        error: 'Vector search is not configured.' 
      });
    }

    // Filter by username for non-admin users
    const filter = req.user.role !== 'admin' 
      ? { username: req.user.username }
      : {};

    const result = await vectorAgent.execute({
      operation: 'query',
      query,
      topK,
      conversationHistory,
      filter
    });

    res.json(result);
  } catch (error) {
    console.error('Query failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Search sessions by semantic similarity (no generation)
app.post('/api/search/sessions', async (req, res) => {
  try {
    const { query, topK = 5, filter = {} } = req.body;

    if (!query) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const vectorAgent = orchestrator.getAgent('vector-search');
    
    if (!vectorAgent) {
      return res.status(503).json({ 
        error: 'Vector search not configured' 
      });
    }

    const result = await vectorAgent.execute({
      operation: 'search',
      query,
      topK,
      filter
    });

    res.json(result);
  } catch (error) {
    console.error('Search failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Index a specific session manually
app.post('/api/sessions/:sessionId/index', async (req, res) => {
  try {
    const { sessionId } = req.params;

    const vectorAgent = orchestrator.getAgent('vector-search');
    const stateManager = orchestrator.getAgent('state-manager');

    if (!vectorAgent) {
      return res.status(503).json({ error: 'Vector search not configured' });
    }

    // Get session with summaries
    const session = await stateManager.getSession(sessionId);

    if (!session.summaries) {
      return res.status(400).json({ 
        error: 'Session has no summaries. End the session first to generate summaries.' 
      });
    }

    // Index the session
    const result = await vectorAgent.execute({
      operation: 'index-session',
      sessionId: session.id,
      summary: session.summaries,
      metadata: {
        date: session.start_ts,
        players: session.metadata?.players || [],
        eventCount: session.event_list?.length || 0
      }
    });

    res.json(result);
  } catch (error) {
    console.error('Indexing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch index all completed sessions
app.post('/api/sessions/index/all', async (req, res) => {
  try {
    const vectorAgent = orchestrator.getAgent('vector-search');
    const stateManager = orchestrator.getAgent('state-manager');

    if (!vectorAgent) {
      return res.status(503).json({ error: 'Vector search not configured' });
    }

    // Get all completed sessions with summaries
    const sessions = await stateManager.Session.find({
      status: 'completed',
      summaries: { $exists: true, $ne: null }
    }).limit(100);

    console.log(`📚 Batch indexing ${sessions.length} sessions...`);

    const sessionsToIndex = sessions.map(session => ({
      sessionId: session.id,
      summary: session.summaries,
      metadata: {
        date: session.start_ts,
        players: session.metadata?.players || [],
        eventCount: session.event_list?.length || 0
      }
    }));

    const result = await vectorAgent.batchIndexSessions(sessionsToIndex);

    res.json(result);
  } catch (error) {
    console.error('Batch indexing failed:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get vector database stats
app.get('/api/vector/stats', async (req, res) => {
  try {
    const vectorAgent = orchestrator.getAgent('vector-search');

    if (!vectorAgent) {
      return res.status(503).json({ error: 'Vector search not configured' });
    }

    const stats = await vectorAgent.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Failed to get stats:', error);
    res.status(500).json({ error: error.message });
  }
});

// Delete session from vector database
app.delete('/api/sessions/:sessionId/index', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const vectorAgent = orchestrator.getAgent('vector-search');

    if (!vectorAgent) {
      return res.status(503).json({ error: 'Vector search not configured' });
    }

    const result = await vectorAgent.execute({
      operation: 'delete-session',
      sessionId
    });

    res.json(result);
  } catch (error) {
    console.error('Delete failed:', error);
    res.status(500).json({ error: error.message });
  }
});
// ===== SERVE REACT APP IN PRODUCTION =====

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));
  
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
  });
}

// ===== START SERVER =====

const server = app.listen(PORT, () => {
  console.log(`\n🚀 Dungeons ADK Server`);
  console.log(`📡 API: http://localhost:${PORT}`);
  console.log(`🔌 WebSocket: ws://localhost:${PORT}`);
  console.log(`📊 Health: http://localhost:${PORT}/health`);
  console.log(`📨 GroupMe: ${config.groupmeBotId ? 'Configured' : 'Not configured'}`);
  console.log(`\n✨ Ready to process D&D sessions!\n`);
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