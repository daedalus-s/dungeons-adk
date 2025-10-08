# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

### Development
```bash
npm run dev            # Start backend with hot reload (nodemon)
npm start              # Start backend server (production)
npm run agents         # Start agent orchestrator standalone
npm run mobile         # Start mobile app (Expo)
```

### Testing & Quality
```bash
npm test               # Run Jest tests
npm run lint           # Run ESLint
```

## Architecture Overview

### Multi-Agent System (Google ADK)
This is a **multi-agent orchestration system** using Google ADK patterns. Agents are coordinated through `backend/agents/orchestrator.js`, not called directly.

**11 Specialized Agents:**
- `TranscriptionAgent` - Audio → text via Google Speech-to-Text or MCP servers
- `EventExtractionAgent` - NLU-based D&D event detection (combat, loot, dialogue, etc.)
- `SummarizerAgent` - Group & personal summaries for GroupMe/Sheets
- `OCRAgent` - Stat sheet digitization with confidence scoring
- `PersonaAgent` - Character persona generation from images via Vision API
- `GoogleSheetsAgent` - Writes to "Chantilly Library Campaign" sheet (approval-gated)
- `GroupMeAgent` - Posts summaries to group chat + DMs players
- `StateManagerAgent` - MongoDB persistence layer
- `GuardrailsAgent` - PII scrubbing, consent validation, rate limiting
- `DM Approval Agent` - Human-in-the-loop authorization for writes
- `Orchestrator` - Coordinates workflows, executes agents in sequence/parallel

**Key Pattern:** All agents extend `BaseAgent` (backend/agents/base-agent.js), which provides:
- EventEmitter for inter-agent communication
- `execute(input)` method (override in subclasses)
- `callClaude()` / `streamClaude()` helpers
- State management (`idle`, `running`, `failed`, etc.)

### Workflows
Defined in `orchestrator.js` via `defineWorkflows()`. Three main workflows:
1. **session-processing**: transcription → event extraction → summarization → sheets/groupme (parallel)
2. **character-setup**: persona + OCR (parallel) → sheets
3. **realtime-transcription**: streaming pipeline for live sessions

### MCP Servers
External microservices for heavy computation (transcription, vision, OCR). Agents fall back to direct Google API if MCP unavailable.

### Approval-Gated Sync
All Google Sheets writes require DM approval:
1. Agent creates `GoogleSheetWriteRequest` (stored in MongoDB as `pending`)
2. DM reviews in mobile app's `ApprovalQueue.js`
3. On approval → `GoogleSheetsAgent` executes write, `GroupMeAgent` sends messages

### Data Models (MongoDB)
- **sessions**: `{id, start_ts, end_ts, audio_locations[], transcripts[], event_list[], per_player_events{}}`
- **players**: `{id, real_name, in_game_name, race, role_type, level, persona_image_id, inventory[]}`
- **write_requests**: `{id, target_sheet, payload, created_by, approved_by_dm, approval_ts}`

### Tech Stack
- **Backend**: Node.js (ESM), Express, MongoDB, Redis
- **Mobile**: React Native (Expo), SQLite, WebSocket
- **AI**: Google Cloud Speech-to-Text, Vision API, Anthropic Claude (Sonnet 4.5)
- **Integrations**: Google Sheets API, GroupMe Bot API

## Development Guidelines

### Agent Development
- All agents **must** extend `BaseAgent` and implement `async execute(input)`
- Use `this.setState(newState)` to track agent lifecycle
- Emit events via `this.emit('log', {...})` for observability
- Claude API calls: use `this.callClaude(messages, options)` (API key auto-configured)
- Error handling: use `this.handleError(error, context)` to propagate failures

### Orchestrator Integration
- **Never** call agents directly—always use `orchestrator.executeAgent(name, input)` or `orchestrator.executeWorkflow(workflowName, input)`
- Add new agents to `initializeAgents()` in orchestrator
- Define workflows in `defineWorkflows()` with parallel/sequential steps
- Workflows support `requiresApproval: true` for approval-gated steps

### Real-time Features
- **WebSocket** used for live session updates (transcripts, events) to mobile app
- Audio processed in 30-second chunks (`AUDIO_CHUNK_INTERVAL_SECONDS`)
- Use `streaming: true` in workflow steps for real-time processing

### Security & Privacy
- **PII redaction** is mandatory—`GuardrailsAgent` runs regex patterns for phone, email, SSN, addresses
- **Consent required** before recording (enforced in mobile app)
- **DM approval** required for all Google Sheets writes
- **Secrets**: Use `.env` for credentials (never commit `.env`)

### Google Sheets Integration
Target sheet: **"Chantilly Library Campaign"**
- Tabs: Full group, Paul's inventory, Jonathan's inventory, Daily gameplay logs (format: `YYYY-MM-DD Gameplay - <id>`)
- Service account must have edit access (share sheet with service account email)

### Testing
- No test files exist yet—add tests in `__tests__/` or `*.test.js` files
- Use Jest for unit/integration tests
- Test agent workflows via `orchestrator.executeWorkflow()`

### Configuration
- Environment variables in `.env` (see `.env.example`)
- Google Cloud: service account JSON at path specified in `GOOGLE_APPLICATION_CREDENTIALS`
- MCP servers: optional external servers for transcription/vision/OCR (fallback to direct API)

## Code Patterns

### Adding a New Agent
```javascript
// 1. Create agent in backend/agents/
import { BaseAgent } from './base-agent.js';

export class MyAgent extends BaseAgent {
  constructor(config) {
    super({ id: 'my-agent', name: 'My Agent', role: 'custom', ...config });
  }

  async execute(input) {
    this.setState('running');
    try {
      // Agent logic here
      const result = await this.callClaude([...]);
      this.setState('completed');
      return result;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}

// 2. Register in orchestrator.js initializeAgents()
this.agents.set('my-agent', new MyAgent(config));

// 3. Add to workflow in defineWorkflows()
{ agent: 'my-agent', parallel: false }
```

### Parallel Agent Execution
```javascript
// In workflow definition
{
  parallel: true,
  agents: [
    { agent: 'persona' },
    { agent: 'ocr' }
  ]
}
```

### Streaming Claude Responses
```javascript
const stream = await this.streamClaude(messages);
stream.on('text', (text) => {
  this.emit('streamChunk', { text });
});
```

## Session Processing Flow
1. Mobile app uploads audio chunks (30s each)
2. `TranscriptionAgent` → Google Speech-to-Text (with diarization)
3. `EventExtractionAgent` → Claude extracts D&D events (combat, loot, dialogue, etc.)
4. `GuardrailsAgent` → PII scrubbing + validation
5. `StateManagerAgent` → Store events/transcripts in MongoDB
6. **Session ends** → `SummarizerAgent` generates group + per-player summaries
7. `GoogleSheetsAgent` → Creates write request (stored as `pending`)
8. DM reviews in `ApprovalQueue.js` → approves/rejects
9. If approved → `GoogleSheetsAgent` executes write, `GroupMeAgent` sends messages

## Important Notes
- **Model**: Claude API calls default to `claude-sonnet-4-5-20250929` (configured in `BaseAgent`)
- **Audio retention**: 30 days default (opt-in for longer via consent)
- **Rate limiting**: Enforced by `GuardrailsAgent` via Redis
- **Observability**: All agents emit `log`, `error`, `stateChange` events—monitor via orchestrator listeners
