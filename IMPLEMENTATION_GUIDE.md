# Dungeons ADK - Complete Implementation Guide

## 🎯 Groundbreaking Solution Overview

This is a **revolutionary multi-agent D&D session management system** that combines:
- **Google ADK** for agent orchestration
- **Claude Code** for intelligent NLU and summarization
- **React Native** for cross-platform mobile experience
- **Real-time processing** with chunked audio transcription
- **Approval-gated data sync** to Google Sheets
- **Automated GroupMe messaging** with group and personal summaries

### Key Innovations

1. **Multi-Agent Architecture**: 11 specialized agents working in coordinated workflows
2. **Real-time Event Extraction**: Live D&D event detection during gameplay
3. **DM Approval Gate**: All data writes require explicit DM authorization
4. **Privacy-First Design**: PII scrubbing, consent management, data retention policies
5. **MCP Server Routing**: Intelligent load balancing across processing servers
6. **Vision-Based Character Creation**: Persona and avatar generation from images
7. **OCR Stat Sheet Digitization**: Automatic character sheet parsing

## 🏗️ System Architecture

### Agent Ecosystem

```
┌─────────────────────────────────────────────────┐
│           Agent Orchestrator (ADK)              │
│  - Workflow Management                          │
│  - Inter-agent Communication                    │
│  - State Coordination                           │
└─────────────────────────────────────────────────┘
                    │
        ┌───────────┴───────────┐
        ↓                       ↓
┌──────────────┐        ┌──────────────┐
│ Audio/Trans  │        │ Intelligence │
│              │        │              │
│ • Recorder   │        │ • Event      │
│ • Transcript │        │   Extraction │
│              │        │ • Summarizer │
└──────────────┘        └──────────────┘
        ↓                       ↓
┌──────────────┐        ┌──────────────┐
│ Vision/Data  │        │ Integration  │
│              │        │              │
│ • Persona    │        │ • Sheets     │
│ • OCR        │        │ • GroupMe    │
│              │        │ • Approval   │
└──────────────┘        └──────────────┘
        ↓                       ↓
┌──────────────┐        ┌──────────────┐
│ Security     │        │ State Mgmt   │
│              │        │              │
│ • Guardrails │        │ • MongoDB    │
│ • PII Scrub  │        │ • Redis      │
└──────────────┘        └──────────────┘
```

### Data Flow

```
1. Mobile App → Start Recording
2. Audio Chunks (30s) → Upload → Transcription Agent
3. Transcript → Event Extraction Agent → NLU Events
4. Events → Summarizer Agent → Group + Personal Summaries
5. Summaries → Write Requests → DM Approval Queue
6. DM Approves → Sheets Agent → Google Sheets Update
7. Sheets Updated → GroupMe Agent → Send Messages
```

## 📦 Project Structure

```
dungeons-adk/
├── backend/
│   ├── agents/
│   │   ├── base-agent.js              # Base agent class
│   │   ├── transcription-agent.js     # ASR & diarization
│   │   ├── event-extraction-agent.js  # NLU event detection
│   │   ├── summarizer-agent.js        # Summary generation
│   │   ├── ocr-agent.js               # Stat sheet OCR
│   │   ├── persona-agent.js           # Character persona
│   │   ├── sheets-agent.js            # Google Sheets sync
│   │   ├── groupme-agent.js           # Messaging
│   │   ├── state-manager-agent.js     # State persistence
│   │   ├── guardrails-agent.js        # Security & privacy
│   │   └── orchestrator.js            # Agent coordination
│   └── server.js                      # Express API server
├── mobile/
│   ├── src/
│   │   ├── screens/
│   │   │   ├── SessionScreen.js       # Recording UI
│   │   │   ├── ApprovalQueue.js       # DM approval
│   │   │   ├── PlayerDashboard.js     # Player view
│   │   │   └── CharacterSetup.js      # Character creation
│   │   ├── stores/
│   │   │   └── sessionStore.js        # State management
│   │   ├── services/
│   │   │   └── api.js                 # API client
│   │   └── components/
│   ├── App.js
│   └── package.json
├── mcp-servers/
│   ├── transcription-server.js        # MCP transcription
│   ├── vision-server.js               # MCP vision/OCR
│   └── ocr-server.js                  # MCP OCR fallback
├── .env.example
├── package.json
└── README.md
```

## 🚀 Setup & Installation

### Prerequisites

1. **Node.js 18+**
2. **MongoDB** (local or cloud)
3. **Redis** (local or cloud)
4. **Google Cloud Project** with:
   - Cloud Speech-to-Text API
   - Cloud Vision API
   - Google Sheets API
5. **Anthropic API Key** (Claude)
6. **GroupMe Account** (bot credentials)

### Step 1: Backend Setup

```bash
# Clone repository
git clone https://github.com/daedalus-s/dungeons-adk.git
cd dungeons-adk

# Install dependencies
npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Step 2: Google Cloud Configuration

1. **Create Project**: Go to [Google Cloud Console](https://console.cloud.google.com)

2. **Enable APIs**:
   ```
   - Cloud Speech-to-Text API
   - Cloud Vision API
   - Google Sheets API
   ```

3. **Create Service Account**:
   - IAM & Admin → Service Accounts → Create
   - Grant roles: "Cloud Speech Client", "Cloud Vision User", "Sheets Editor"
   - Create JSON key → Download to `config/service-account.json`

4. **Create OAuth2 Credentials** (for mobile):
   - APIs & Services → Credentials → Create → OAuth client ID
   - Application type: Web application (for backend) or Android/iOS (for mobile)
   - Save Client ID and Client Secret

5. **Share Google Sheet**:
   - Create spreadsheet "Chantilly Library Campaign"
   - Share with service account email (from JSON key)
   - Grant "Editor" access

### Step 3: GroupMe Setup

1. **Create Bot**:
   - Visit https://dev.groupme.com
   - Sign in → Bots → Create Bot
   - Select your group
   - Copy Bot ID and Access Token

2. **Configure in .env**:
   ```env
   GROUPME_ACCESS_TOKEN=your_access_token
   GROUPME_BOT_ID=your_bot_id
   GROUPME_GROUP_ID=your_group_id
   ```

3. **Personal DM Setup** (optional):
   - Implement OAuth flow for user linking
   - Store GroupMe user ID mapping in database

### Step 4: Database Setup

**MongoDB**:
```bash
# Local install
brew install mongodb-community  # macOS
sudo apt install mongodb        # Ubuntu

# Or use MongoDB Atlas (cloud)
# Update MONGODB_URI in .env
```

**Redis**:
```bash
# Local install
brew install redis              # macOS
sudo apt install redis-server   # Ubuntu

# Start Redis
redis-server

# Or use Redis Cloud
```

### Step 5: Start Backend

```bash
# Development mode
npm run dev

# Production mode
npm start

# MCP Servers (separate terminals)
node mcp-servers/transcription-server.js
node mcp-servers/vision-server.js
node mcp-servers/ocr-server.js
```

### Step 6: Mobile App Setup

```bash
cd mobile

# Install dependencies
npm install

# Start Expo
npm start

# Run on device
npm run android  # or npm run ios
```

## 🔄 Workflow Implementation

### Session Recording Workflow

```javascript
// 1. User starts session
POST /api/sessions
{
  "players": [player_ids],
  "dm_id": "dm_1"
}

// 2. Upload audio chunks (every 30s)
POST /api/sessions/:sessionId/audio
FormData: { audio: file, chunkIndex: 0 }

// 3. Real-time transcription → event extraction
// (Happens automatically via orchestrator)

// 4. End session
POST /api/sessions/:sessionId/end
// Returns: { events, transcripts, summaries, writeRequests }

// 5. DM approves write requests
POST /api/approvals/:requestId
{
  "dm_id": "dm_1",
  "decision": "approve",
  "comment": "Looks good!"
}

// 6. Messages sent automatically after approval
```

### Character Setup Workflow

```javascript
// 1. Upload character image for persona
POST /api/players/:playerId/persona
FormData: {
  image: file,
  characterName: "Aragorn",
  userPrompt: "Noble ranger with kingly heritage"
}

// 2. OCR stat sheet
POST /api/players/:playerId/stat-sheet
FormData: { image: stat_sheet.jpg }

// 3. Review and confirm parsed data
// (Mobile app shows preview with confidence scores)
```

## 🛡️ Security & Privacy

### Guardrails Implementation

1. **PII Detection & Redaction**:
   - Phone numbers, emails, addresses automatically redacted
   - Regex + Claude validation

2. **Consent Management**:
   - In-app consent screen before recording
   - All participants must opt-in

3. **Data Retention**:
   - Raw audio: 30 days (default)
   - Transcripts: Permanent (unless opted out)
   - Export option for archival

4. **Rate Limiting**:
   - GroupMe: 50 messages/hour
   - Sheets: 100 writes/hour
   - API: 1000 calls/hour

5. **Encryption**:
   - At-rest: MongoDB encryption
   - In-transit: TLS/SSL
   - Secrets: Environment variables + key vault

## 📊 Google Sheets Structure

### Sheet: "Chantilly Library Campaign"

**Tab: "Full group details"**
```
| Player real name | Player in-game name | Race  | Role type | Player level | Date joined |
|-----------------|---------------------|-------|-----------|--------------|-------------|
| John Doe        | Aragorn            | Human | Ranger    | 5            | 2024-01-15  |
```

**Tab: "Paul's group inventory"**
```
| Purchaser | Bought item    | Amount | Cost | Weight | Total Cost | Remaining | Notes        |
|-----------|----------------|--------|------|--------|------------|-----------|--------------|
| Aragorn   | Healing Potion | 3      | 50   | 0.5    | 150        | 2         | Used 1 in... |
```

**Tab: "2025-10-07 Gameplay - abc123"** (auto-created)
```
| Group | Quantity | Item     | Gold Value | Total Value | Distributed To | Sold To | Lesson Learns | Player | Character | Group         |
|-------|----------|----------|------------|-------------|----------------|---------|---------------|--------|-----------|---------------|
| Paul  | 5        | Gold Ore | 100        | 500         | Party          |         | Mining quest  | 1      | Aragorn   | Paul's group  |
```

## 🧪 Testing

### Unit Tests

```bash
npm test
```

### Integration Tests

```bash
# Test full workflow with sample data
npm run test:integration
```

### Manual Testing Checklist

- [ ] Start session and record audio
- [ ] Verify real-time transcription
- [ ] Check event extraction accuracy
- [ ] Review generated summaries
- [ ] Test DM approval flow
- [ ] Confirm Sheets write
- [ ] Verify GroupMe messages sent
- [ ] Test OCR with sample stat sheet
- [ ] Test persona generation
- [ ] Check PII redaction

## 🚢 Deployment

### Backend Deployment (Cloud Run / AWS ECS)

```bash
# Build Docker image
docker build -t dungeons-adk-backend .

# Push to registry
docker push gcr.io/your-project/dungeons-adk-backend

# Deploy to Cloud Run
gcloud run deploy dungeons-adk \
  --image gcr.io/your-project/dungeons-adk-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

### Mobile Deployment (Expo)

```bash
cd mobile

# Build for Android
eas build --platform android

# Build for iOS
eas build --platform ios

# Submit to stores
eas submit --platform all
```

### MCP Servers Deployment

Deploy each MCP server as a separate service:

```bash
# Transcription server
gcloud run deploy mcp-transcription \
  --image gcr.io/your-project/mcp-transcription \
  --cpu 2 \
  --memory 4Gi

# Vision server
gcloud run deploy mcp-vision \
  --image gcr.io/your-project/mcp-vision \
  --cpu 2 \
  --memory 4Gi
```

## 🎮 Usage Examples

### For Players

1. **Join Session**: Open app → Session tab
2. **Start Recording**: Tap "Start Session"
3. **See Live Events**: Real-time event timeline
4. **End Session**: Tap "Stop" after gameplay
5. **Wait for Summary**: DM approves → Receive GroupMe DM

### For DMs

1. **Monitor Session**: Watch real-time events
2. **Review Approvals**: Approvals tab → See pending writes
3. **Approve/Reject**: Review data → Approve for Sheets update
4. **Messages Auto-Send**: After approval, summaries sent

## 🔧 Troubleshooting

### Common Issues

**Transcription Slow**:
- Check MCP server health: `GET /health`
- Increase server resources
- Enable parallel processing

**Sheets Write Fails**:
- Verify service account has Editor access
- Check sheet ID in .env
- Review approval status

**GroupMe Messages Not Sending**:
- Verify bot token is valid
- Check rate limits
- Ensure user linking is complete

## 📈 Performance Optimization

1. **Audio Chunking**: 30s chunks for faster processing
2. **Parallel Agent Execution**: Run agents concurrently
3. **Redis Caching**: Cache frequent queries
4. **CDN for Avatars**: Store generated images in CDN
5. **Database Indexing**: Index session_id, player_id

## 🌟 Advanced Features

### Custom Event Types

Add new event types in `event-extraction-agent.js`:

```javascript
this.eventTypes = [
  ...existing,
  'critical_hit',
  'natural_20',
  'character_development'
];
```

### Multi-Language Support

Update transcription config:

```javascript
languageCode: 'es-US' // Spanish
languageCode: 'fr-FR' // French
```

### Custom Summarization

Modify prompts in `summarizer-agent.js` for different summary styles.

## 📚 API Reference

See full API documentation: [API_DOCS.md](./API_DOCS.md)

## 🤝 Contributing

1. Fork repository
2. Create feature branch
3. Add tests
4. Submit PR

## 📄 License

ISC License

## 🆘 Support

- GitHub Issues: https://github.com/daedalus-s/dungeons-adk/issues
- Documentation: https://docs.dungeons-adk.com
- Discord: https://discord.gg/dungeons-adk
