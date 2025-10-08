# Dungeons ADK - Multi-Agent D&D Session Manager

A groundbreaking multi-agent mobile application that revolutionizes D&D session management using Google ADK and Claude Code.

## 🎯 Overview

This application records 2-hour D&D sessions, extracts game events, manages player data, creates character personas, OCRs stat sheets, maintains inventories, and automatically syncs data to Google Sheets and GroupMe.

## 🏗️ Architecture

### Multi-Agent System (Google ADK)

- **Recorder Agent**: Audio capture, chunking, upload orchestration
- **Transcription Agent**: ASR, speaker diarization, time-aligned transcripts
- **Event Extraction Agent**: NLU-based event detection and tagging
- **Summarizer Agent**: Group & personal summaries, gameplay logs
- **Persona/Vision Agent**: Character avatar generation from images
- **OCR & Stat Parser Agent**: Stat sheet digitization
- **Google Sheets Agent**: Approved data synchronization
- **GroupMe Messenger Agent**: Post-session communication
- **DM Approval Agent**: Write request authorization
- **State Manager Agent**: Durable state management
- **Guardrails & Monitor Agent**: Privacy, PII scrubbing, compliance
- **MCP Server Connector Agent**: Multi-component processing orchestration

### Technology Stack

**Frontend:**
- React Native (Expo)
- SQLite for local storage
- WebSocket for real-time updates

**Backend:**
- Node.js + Express
- MongoDB (session/player data)
- Redis (task queues, caching)
- WebSocket server

**AI/ML Services:**
- Google Cloud Speech-to-Text (transcription)
- Google Cloud Vision API (OCR, persona generation)
- Anthropic Claude (NLU, summarization)
- Tesseract.js (backup OCR)

**Integrations:**
- Google Sheets API (campaign data)
- GroupMe Bot API (messaging)

## 📱 Features

### Session Recording
- 2-hour audio capture via mobile mic
- Real-time chunking and transcription
- Speaker diarization
- Event extraction during recording

### Character Management
- Photo-based persona generation
- Stat sheet OCR with confidence scores
- Inventory tracking per player/group

### Data Sync
- **Google Sheets**: "Chantilly Library Campaign"
  - Full group details
  - Paul's group inventory
  - Jonathan's group inventory
  - Daily gameplay logs (YYYY-MM-DD Gameplay - <id>)
- DM approval required for all writes

### Communication
- Group summary → GroupMe chat
- Personal DM → Individual players
- Custom event tagging

### Security & Privacy
- Mandatory consent before recording
- PII scrubbing (phones, emails, addresses)
- 30-day audio retention (opt-in for longer)
- Encrypted secrets storage
- DM approval gate

## 🚀 Setup

### Prerequisites
- Node.js 18+
- MongoDB
- Redis
- Google Cloud Project with APIs enabled
- GroupMe account & bot

### Installation

```bash
# Clone repository
git clone https://github.com/daedalus-s/dungeons-adk.git
cd dungeons-adk

# Install backend dependencies
npm install

# Install mobile app dependencies
cd mobile && npm install

# Configure environment
cp .env.example .env
# Edit .env with your credentials
```

### Google Cloud Setup

1. Create project in Google Cloud Console
2. Enable APIs:
   - Cloud Speech-to-Text API
   - Cloud Vision API
   - Google Sheets API
3. Create service account
4. Download credentials to `config/service-account.json`
5. Share target Google Sheet with service account email

### GroupMe Setup

1. Visit https://dev.groupme.com
2. Create bot → get bot_id, group_id, access token
3. Add credentials to `.env`

### Mobile App Setup

```bash
cd mobile
npx expo start
```

## 📊 Data Model

### Session
```javascript
{
  id, start_ts, end_ts,
  audio_locations[],
  transcripts[],
  event_list[],
  per_player_events{player_id: []},
  summary_sent
}
```

### Player
```javascript
{
  id, real_name, in_game_name,
  race, role_type, level, date_joined,
  persona_image_id, inventory[]
}
```

### GoogleSheetWriteRequest
```javascript
{
  id, target_sheet, payload,
  created_by, created_ts,
  approved_by_dm, approval_ts
}
```

## 🔄 Workflow

1. **Start Session** → Recorder Agent captures audio
2. **During Session** → Real-time transcription & event extraction
3. **End Session** → Processing & summarization
4. **Approval Queue** → DM reviews Google Sheets writes
5. **Post-Approval** → Sheets updated, messages sent
6. **Post-Processing** → Persist data, archive session

## 🛡️ Guardrails

- Consent screen for all participants
- PII detection & redaction
- Private event tagging
- Rate limiting on external APIs
- Audit logging for all approvals

## 🧪 Testing

```bash
# Run unit tests
npm test

# Run integration tests
npm run test:integration

# Test with sample data
npm run test:sample
```

## 📦 Deployment

### Backend
- Deploy to Cloud Run / GKE / AWS ECS
- Configure MCP servers
- Set up Redis & MongoDB clusters

### Mobile
- Build with EAS Build (Expo)
- Submit to App Store / Play Store

## 🤝 Contributing

See CONTRIBUTING.md

## 📄 License

ISC

## 🔗 Resources

- [Google ADK Docs](https://google.github.io/adk-docs/)
- [Claude Code Docs](https://docs.claude.com/en/docs/claude-code/overview)
- [GroupMe API](https://dev.groupme.com/docs)
