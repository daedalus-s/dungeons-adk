# Dungeons ADK - Architecture Deep Dive

## 🎯 System Overview

Dungeons ADK is a **groundbreaking multi-agent orchestration system** that combines Google ADK's agent framework with Claude Code's intelligence to create an autonomous D&D session management platform.

### Core Innovation: Multi-Agent Coordination

Unlike traditional monolithic applications, Dungeons ADK uses **11 specialized agents** that work in coordinated workflows, each handling specific domains:

1. **Transcription Agent** - ASR, diarization, timestamping
2. **Event Extraction Agent** - NLU-based game event detection
3. **Summarizer Agent** - Group & personal summary generation
4. **OCR Agent** - Stat sheet digitization with confidence scoring
5. **Persona Agent** - Vision-based character persona creation
6. **Google Sheets Agent** - Approval-gated data synchronization
7. **GroupMe Agent** - Automated messaging with routing
8. **DM Approval Agent** - Authorization workflow
9. **State Manager Agent** - Durable persistence with MongoDB
10. **Guardrails Agent** - Privacy, PII scrubbing, compliance
11. **Orchestrator** - Central coordination and workflow management

## 🏗️ Architectural Patterns

### 1. Agent-Based Architecture (Google ADK)

```
┌─────────────────────────────────────────────┐
│          Orchestrator (Coordinator)         │
│                                             │
│  • Workflow Definition                      │
│  • Agent Lifecycle Management               │
│  • Event Bus for Inter-Agent Communication  │
│  • Error Handling & Retry Logic             │
└─────────────────────────────────────────────┘
                    ↓ ↓ ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
    [Agent 1]   [Agent 2]   [Agent 3]

Each agent:
- Extends BaseAgent class
- Implements execute() method
- Emits events via EventEmitter
- Maintains internal state
- Can call other agents via orchestrator
```

### 2. Multi-Component Processing (MCP) Servers

Separate microservices for computationally intensive tasks:

```
┌─────────────────────────────────────────────┐
│           MCP Server Registry               │
│                                             │
│  • Health Monitoring                        │
│  • Load Balancing                           │
│  • Failover & Retry                         │
│  • Service Discovery                        │
└─────────────────────────────────────────────┘
                    ↓
        ┌───────────┼───────────┐
        ↓           ↓           ↓
  [Transcription] [Vision]  [OCR]

MCP Benefits:
- Horizontal scaling
- Resource isolation
- Independent deployment
- Fault tolerance
```

### 3. Event-Driven Communication

```
Agent A                Orchestrator           Agent B
   │                        │                    │
   │──── emit('event') ────→│                    │
   │                        │                    │
   │                        │──── execute() ────→│
   │                        │                    │
   │                        │←─── result ────────│
   │                        │                    │
   │←─── broadcast ─────────│                    │
```

All agents communicate via events:
- `stateChange` - Agent state transitions
- `log` - Agent activity logging
- `error` - Error propagation
- Custom domain events (e.g., `transcriptReady`, `eventsExtracted`)

### 4. Approval-Gated Sync Pattern

```
1. Agent generates write request
2. Request stored in MongoDB (pending)
3. DM notified via mobile app
4. DM reviews in approval queue
5. DM approves/rejects with comment
6. If approved → Execute write
7. Trigger downstream actions (messaging)
```

This ensures **human-in-the-loop** for all critical data operations.

## 🔄 Data Flow Architecture

### Session Processing Pipeline

```
┌──────────────┐
│ Mobile App   │
│ (React Native)│
└──────┬───────┘
       │ 1. Start Session
       ↓
┌──────────────┐
│ Backend API  │
│ (Express)    │
└──────┬───────┘
       │ 2. Create Session Record
       ↓
┌──────────────┐
│ State Manager│
│ Agent        │
└──────┬───────┘
       │ 3. Save to MongoDB
       ↓
┌──────────────────────────────────────────────┐
│         Audio Processing Loop (30s chunks)    │
│                                               │
│  Mobile → Upload Chunk → Transcription Agent │
│           ↓                                   │
│  Transcription Agent → MCP Server             │
│           ↓                                   │
│  Transcript + Diarization ← MCP Server        │
│           ↓                                   │
│  Event Extraction Agent → Claude API          │
│           ↓                                   │
│  Structured Events ← Claude API               │
│           ↓                                   │
│  Guardrails Agent → PII Check                 │
│           ↓                                   │
│  State Manager → Store Events                 │
│           ↓                                   │
│  WebSocket → Push to Mobile (Real-time)       │
└───────────────────────────────────────────────┘
       │
       │ 4. Session Ends
       ↓
┌──────────────┐
│ Summarizer   │
│ Agent        │
└──────┬───────┘
       │ 5. Generate Summaries
       ↓
┌──────────────┐
│ Sheets Agent │
│              │
└──────┬───────┘
       │ 6. Create Write Requests
       ↓
┌──────────────┐
│ State Manager│
│              │
└──────┬───────┘
       │ 7. Store (pending)
       ↓
┌──────────────┐
│ Mobile App   │
│ (Approval UI)│
└──────┬───────┘
       │ 8. DM Reviews
       ↓
┌──────────────┐
│ DM Approval  │
│ Agent        │
└──────┬───────┘
       │ 9. Process Decision
       ↓
┌──────────────────────────────────┐
│ If Approved:                     │
│                                  │
│  Sheets Agent → Google Sheets    │
│        ↓                         │
│  GroupMe Agent → Send Messages   │
│        ↓                         │
│  State Manager → Update Session  │
└──────────────────────────────────┘
```

### Character Setup Pipeline

```
┌──────────────┐
│ Mobile App   │
└──────┬───────┘
       │ 1. Upload Character Image
       ↓
┌──────────────┐
│ Persona Agent│
└──────┬───────┘
       │ 2. Vision API Analysis
       ↓
┌──────────────────────────────────┐
│ Google Cloud Vision              │
│  • Label Detection               │
│  • Face Detection                │
│  • Color Analysis                │
│  • Object Localization           │
└──────┬───────────────────────────┘
       │ 3. Image Analysis Results
       ↓
┌──────────────┐
│ Persona Agent│
└──────┬───────┘
       │ 4. Claude Persona Generation
       ↓
┌──────────────────────────────────┐
│ Claude API                       │
│  • Physical Appearance           │
│  • Personality Traits            │
│  • Background Hints              │
│  • Avatar Prompt                 │
└──────┬───────────────────────────┘
       │ 5. Persona Descriptors
       ↓
┌──────────────┐
│ State Manager│
│              │
└──────┬───────┘
       │ 6. Save to Player Record
       ↓
┌──────────────┐
│ Mobile App   │
│ (Display)    │
└──────────────┘
```

## 🧠 Agent Intelligence Breakdown

### Transcription Agent

**Technology**: Google Cloud Speech-to-Text
**Key Features**:
- Speaker diarization (6 speakers max)
- Word-level timestamps
- Confidence scoring
- Low-confidence flagging
- MCP failover to backup servers

**Algorithm**:
```
1. Receive audio chunk
2. Check MCP server availability
3. If available → Route to MCP
4. If unavailable → Direct Google API
5. Process with diarization enabled
6. Group words by speaker
7. Create timestamped segments
8. Flag low-confidence (<0.7)
9. Return structured transcript
```

### Event Extraction Agent

**Technology**: Claude API (Sonnet 4.5)
**Key Features**:
- Multi-event type detection (11 types)
- Entity extraction (players, items, NPCs)
- Personal event tagging
- Inventory inference

**Prompt Engineering**:
```
System: "You are analyzing D&D gameplay."

Context:
- Known players: [list]
- Event types: [combat, loot, dialogue...]

Task:
- Extract structured events
- Tag personal vs. group
- Identify entities
- Extract metadata (damage, gold, items)

Output: JSON with confidence scores
```

### Summarizer Agent

**Technology**: Claude API (Sonnet 4.5)
**Key Features**:
- Group summary with TL;DR
- Per-player personalized summaries
- Google Sheets row generation
- Engaging narrative style

**Summary Types**:

1. **Group Summary**:
   - TL;DR hook
   - Key events (3-5 bullets)
   - Top loot
   - Major decisions
   - Memorable moments

2. **Personal Summary**:
   - Player-specific accomplishments
   - Items acquired
   - Stat changes (XP, HP)
   - Personal highlights

3. **Sheets Data**:
   - Structured rows for gameplay log
   - Inventory updates
   - Player progression

### OCR Agent

**Technology**: Google Cloud Vision + Tesseract.js + Claude
**Key Features**:
- Primary: Google Vision OCR
- Fallback: Tesseract.js
- Enhancement: Claude parsing
- Confidence scoring
- Field validation

**Process**:
```
1. OCR with Google Vision
2. Parse fields with regex patterns
3. Validate (e.g., ability scores 3-20)
4. If confidence < 0.7 → Claude enhancement
5. Calculate derived stats (modifiers)
6. Return with confidence scores
7. Flag for manual review if needed
```

### Guardrails Agent

**Technology**: Regex + Claude validation
**Key Features**:
- PII detection (phone, email, SSN, address)
- Automatic redaction
- Profanity context analysis
- Rate limiting
- Consent validation
- Audit logging

**PII Patterns**:
```javascript
{
  phone: /\b\d{3}[-.]?\d{3}[-.]?\d{4}\b/g,
  email: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
  creditCard: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
  address: /\b\d+\s+[A-Za-z\s]+(?:Street|St|Avenue|Ave|...)\b/gi
}
```

## 💾 Data Architecture

### MongoDB Schema Design

**Collections**:

1. **sessions**
   - Primary key: `id` (string)
   - Indexes: `start_ts`, `status`, `created_by`
   - Embedded: `transcripts[]`, `event_list[]`

2. **players**
   - Primary key: `id` (string)
   - Indexes: `real_name`, `in_game_name`, `group`
   - References: `persona_image_id`, `stat_sheet_data`

3. **write_requests**
   - Primary key: `id` (string)
   - Indexes: `status`, `created_ts`, `approved_by_dm`
   - References: `created_by` (session_id)

4. **approvals**
   - Primary key: `id` (string)
   - Indexes: `request_id`, `dm_id`, `ts`

5. **event_queue**
   - Primary key: `id` (string)
   - Indexes: `status`, `scheduled_at`, `retry_count`
   - For async processing and retries

### Redis Usage

**Key Patterns**:
- `job:{jobId}` - MCP job status
- `session:{sessionId}:events` - Real-time events
- `rate_limit:{action}:{window}` - Rate limiting
- `cache:player:{playerId}` - Player data cache

**TTL Strategy**:
- Jobs: 1 hour
- Events: 24 hours
- Rate limits: 1 hour
- Cache: 15 minutes

## 🔐 Security Architecture

### Layers of Security

1. **Authentication** (TODO)
   - JWT tokens
   - OAuth2 for Google services
   - GroupMe user linking

2. **Authorization**
   - Role-based access (Player, DM, Admin)
   - DM approval for all writes

3. **Data Protection**
   - PII redaction
   - Encryption at rest (MongoDB)
   - TLS in transit
   - Secrets in environment variables

4. **Privacy Compliance**
   - Consent before recording
   - 30-day retention default
   - Export/delete on request
   - Audit logs

5. **Rate Limiting**
   - Per-action limits
   - Per-user quotas
   - API throttling

## 📊 Performance Optimizations

### 1. Chunked Audio Processing
- 30-second chunks
- Parallel transcription
- Real-time event extraction

### 2. Parallel Agent Execution
```javascript
// Sequential
await agent1.execute();
await agent2.execute();
await agent3.execute();

// Parallel (3x faster)
await Promise.all([
  agent1.execute(),
  agent2.execute(),
  agent3.execute()
]);
```

### 3. MCP Server Load Balancing
```javascript
// Pick least-loaded server
const server = mcpServers
  .filter(s => s.healthy)
  .sort((a, b) => a.load - b.load)[0];
```

### 4. Caching Strategy
- Player data: 15 min cache
- Session data: No cache (real-time)
- Transcripts: Cache after processing

### 5. Database Indexing
```javascript
// Critical indexes
sessions: ['id', 'status', 'start_ts']
players: ['id', 'in_game_name', 'group']
write_requests: ['status', 'created_ts']
```

## 🚀 Scalability Considerations

### Horizontal Scaling

1. **Backend API**: Stateless, scale with load balancer
2. **MCP Servers**: Auto-scaling based on queue depth
3. **MongoDB**: Sharded by `session_id`
4. **Redis**: Cluster mode for high availability

### Vertical Scaling

- Transcription: CPU-intensive (2+ cores)
- Vision/OCR: GPU-accelerated (optional)
- Database: Memory-optimized (4GB+ RAM)

### Future Enhancements

1. **Real-time Streaming**:
   - WebSocket for live transcription
   - Server-sent events for updates

2. **Distributed Agents**:
   - Agent mesh across multiple servers
   - Kubernetes-based orchestration

3. **ML Model Optimization**:
   - Fine-tuned event extraction model
   - Custom OCR for D&D sheets

4. **Multi-tenant Support**:
   - Campaign isolation
   - Shared infrastructure

## 🎯 Design Principles

1. **Agent Autonomy**: Each agent is self-contained and stateless
2. **Event-Driven**: Loose coupling via events
3. **Fail-Safe**: Graceful degradation with fallbacks
4. **Human-in-Loop**: DM approval for critical operations
5. **Privacy-First**: PII protection by default
6. **Observable**: Comprehensive logging and monitoring

## 📈 Metrics & Monitoring

### Key Metrics

- Session processing time
- Transcription accuracy (confidence scores)
- Event extraction precision
- Agent execution latency
- MCP server health
- API response times
- Error rates by agent

### Observability Stack

- **Logging**: Winston (structured logs)
- **Metrics**: Prometheus
- **Tracing**: OpenTelemetry
- **Dashboards**: Grafana

## 🔮 Future Architecture

### Phase 2: Advanced Features

1. **Voice Commands**: "Hey DM, roll initiative"
2. **AR Integration**: Character visualization
3. **Blockchain**: Immutable session ledger
4. **Multi-Model**: GPT-4 + Claude hybrid
5. **Federated Learning**: Improve models across campaigns

This architecture represents a **paradigm shift** in D&D session management—from manual note-taking to fully autonomous, AI-powered orchestration.
