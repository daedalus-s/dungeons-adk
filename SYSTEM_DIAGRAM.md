# Dungeons ADK - System Diagrams

## 🏗️ High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                       MOBILE APP (React Native)                  │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐           │
│  │   Session    │  │   Player     │  │   Approval   │           │
│  │   Screen     │  │  Dashboard   │  │    Queue     │           │
│  └──────────────┘  └──────────────┘  └──────────────┘           │
│                                                                   │
│  [Recording] [Events] [Persona] [OCR] [Inventory] [Approvals]   │
└────────────────────────────┬──────────────────────────────────────┘
                             │ REST API + WebSocket
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                     BACKEND API (Node.js/Express)                │
│                                                                   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │              Agent Orchestrator (Google ADK)               │ │
│  │                                                            │ │
│  │  Workflow Management • Event Bus • Error Handling         │ │
│  └────────────────────────────────────────────────────────────┘ │
│                             ↓                                     │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │Transcript│ │  Event   │ │Summarizer│ │   OCR    │           │
│  │  Agent   │ │Extraction│ │  Agent   │ │  Agent   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │ Persona  │ │  Sheets  │ │ GroupMe  │ │Guardrails│           │
│  │  Agent   │ │  Agent   │ │  Agent   │ │  Agent   │           │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘           │
│                                                                   │
│  ┌──────────────────┐ ┌──────────────────┐                      │
│  │  State Manager   │ │  DM Approval     │                      │
│  │     Agent        │ │     Agent        │                      │
│  └──────────────────┘ └──────────────────┘                      │
└────────────────────────────┬──────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│     MCP      │     │     MCP      │     │     MCP      │
│Transcription │     │   Vision     │     │     OCR      │
│   Server     │     │   Server     │     │   Server     │
│              │     │              │     │              │
│ (Port 4001)  │     │ (Port 4002)  │     │ (Port 4003)  │
└──────────────┘     └──────────────┘     └──────────────┘
        │                    │                    │
        └────────────────────┼────────────────────┘
                             ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATA LAYER                                    │
│                                                                   │
│  ┌──────────────┐                    ┌──────────────┐           │
│  │   MongoDB    │                    │    Redis     │           │
│  │              │                    │              │           │
│  │ • Sessions   │                    │ • Job Queue  │           │
│  │ • Players    │                    │ • Cache      │           │
│  │ • Approvals  │                    │ • Rate Limit │           │
│  │ • Events     │                    │ • Real-time  │           │
│  └──────────────┘                    └──────────────┘           │
└─────────────────────────────────────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        ↓                    ↓                    ↓
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   Google     │     │   Claude     │     │   GroupMe    │
│   Cloud      │     │     API      │     │     API      │
│              │     │              │     │              │
│ • Speech API │     │ • Sonnet 4.5 │     │ • Bot API    │
│ • Vision API │     │ • NLU        │     │ • Messages   │
│ • Sheets API │     │ • Summary    │     │ • DMs        │
└──────────────┘     └──────────────┘     └──────────────┘
```

## 🔄 Session Processing Flow

```
START
  │
  ↓
┌─────────────────┐
│  User starts    │
│  session in app │
└────────┬────────┘
         │
         ↓
┌─────────────────┐
│  Create session │
│  record in DB   │
└────────┬────────┘
         │
         ↓
┌────────────────────────────────────────┐
│         AUDIO PROCESSING LOOP           │
│              (Every 30s)                │
│                                         │
│  1. Capture audio chunk                │
│  2. Upload to backend                  │
│  3. Route to Transcription Agent       │
│  4. MCP Server → Google Speech API     │
│  5. Return transcript + diarization    │
│  6. Event Extraction Agent → Claude    │
│  7. Extract structured events          │
│  8. Guardrails Agent → PII check       │
│  9. Store events in MongoDB            │
│ 10. Push to mobile via WebSocket       │
│                                         │
│  [Repeat for 2 hours or until stop]    │
└────────────────┬───────────────────────┘
                 │
                 ↓
         ┌───────────────┐
         │  User stops   │
         │   session     │
         └───────┬───────┘
                 │
                 ↓
         ┌───────────────┐
         │  Summarizer   │
         │     Agent     │
         │               │
         │ • Group sum   │
         │ • Player sums │
         │ • Sheets data │
         └───────┬───────┘
                 │
                 ↓
         ┌───────────────┐
         │ Google Sheets │
         │     Agent     │
         │               │
         │ Create write  │
         │   requests    │
         └───────┬───────┘
                 │
                 ↓
         ┌───────────────┐
         │ Store pending │
         │  in MongoDB   │
         └───────┬───────┘
                 │
                 ↓
         ┌───────────────┐
         │  Notify DM    │
         │  via mobile   │
         └───────┬───────┘
                 │
          ┌──────┴──────┐
          │             │
          ↓             ↓
    ┌─────────┐   ┌─────────┐
    │ APPROVE │   │ REJECT  │
    └────┬────┘   └────┬────┘
         │             │
         ↓             ↓
  ┌─────────────┐  ┌──────────────┐
  │ Write to    │  │ Log rejection│
  │Google Sheets│  │ Archive req  │
  └──────┬──────┘  └──────────────┘
         │
         ↓
  ┌─────────────┐
  │  GroupMe    │
  │   Agent     │
  │             │
  │ • Group msg │
  │ • Player DMs│
  └──────┬──────┘
         │
         ↓
  ┌─────────────┐
  │  Mark       │
  │ summary_sent│
  └──────┬──────┘
         │
         ↓
       END
```

## 🎭 Character Setup Flow

```
START
  │
  ↓
┌─────────────────────┐
│  User uploads       │
│  character image    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Persona Agent     │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Google Vision API  │
│                     │
│  • Label detection  │
│  • Face analysis    │
│  • Color extraction │
│  • Object detection │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│   Claude API        │
│                     │
│  Generate persona:  │
│  • Appearance       │
│  • Personality      │
│  • Background       │
│  • Quirks           │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  MCP Vision Server  │
│  (if available)     │
│                     │
│  Generate avatar    │
│  from prompt        │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Save to MongoDB    │
│                     │
│  player.persona_data│
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Display in app     │
│                     │
│  • Avatar           │
│  • Description      │
│  • Traits           │
└─────────────────────┘
           │
           ↓
         END


PARALLEL FLOW: OCR
─────────────────────

START
  │
  ↓
┌─────────────────────┐
│  User uploads       │
│  stat sheet photo   │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│     OCR Agent       │
└──────────┬──────────┘
           │
     ┌─────┴─────┐
     ↓           ↓
┌─────────┐ ┌─────────┐
│ Google  │ │Tesseract│
│ Vision  │ │  (fallb)│
└────┬────┘ └────┬────┘
     └─────┬─────┘
           ↓
┌─────────────────────┐
│  Parse with regex   │
│                     │
│  • Character name   │
│  • Class, level     │
│  • Ability scores   │
│  • AC, HP, speed    │
│  • Skills           │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Validate fields    │
│                     │
│  • Scores: 3-20     │
│  • Level: 1-20      │
│  • Confidence check │
└──────────┬──────────┘
           │
      ┌────┴────┐
      │ Conf    │
      │ < 0.7?  │
      └────┬────┘
           │
      YES  │  NO
           ↓  └──────────┐
┌─────────────────────┐  │
│   Claude API        │  │
│                     │  │
│  Enhance parsing    │  │
│  with AI inference  │  │
└──────────┬──────────┘  │
           │             │
           └─────┬───────┘
                 ↓
┌─────────────────────┐
│  Return parsed      │
│  data + confidence  │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Display preview    │
│  in mobile app      │
│                     │
│  User confirms/     │
│  edits if needed    │
└──────────┬──────────┘
           │
           ↓
┌─────────────────────┐
│  Save to MongoDB    │
│                     │
│  player.stat_data   │
└─────────────────────┘
           │
           ↓
         END
```

## 🔐 Security & Privacy Flow

```
┌─────────────────────────────────────────────────┐
│            GUARDRAILS AGENT                     │
│                                                 │
│  Input: transcript/events/summaries             │
└────────────────────┬────────────────────────────┘
                     │
          ┌──────────┴──────────┐
          ↓                     ↓
    ┌─────────────┐       ┌─────────────┐
    │ PII Check   │       │ Profanity   │
    │             │       │   Check     │
    │ Regex:      │       │             │
    │ • Phone     │       │ • Keyword   │
    │ • Email     │       │ • Claude    │
    │ • Address   │       │   context   │
    │ • SSN       │       └──────┬──────┘
    │ • CC #      │              │
    └──────┬──────┘              │
           │                     │
      ┌────┴────┐                │
      │ Found?  │                │
      └────┬────┘                │
           │ YES                 │
           ↓                     │
    ┌─────────────┐              │
    │   REDACT    │              │
    │             │              │
    │ [PHONE_     │              │
    │  REDACTED]  │              │
    └──────┬──────┘              │
           │                     │
           └─────────┬───────────┘
                     ↓
              ┌─────────────┐
              │ Rate Limit  │
              │   Check     │
              │             │
              │ • Action    │
              │ • Window    │
              │ • Count     │
              └──────┬──────┘
                     │
                ┌────┴────┐
                │Exceeded?│
                └────┬────┘
                     │
              NO     │     YES
                     ↓     └────→ [BLOCK]
              ┌─────────────┐
              │  Consent    │
              │  Validation │
              │             │
              │ All players │
              │ consented?  │
              └──────┬──────┘
                     │
                ┌────┴────┐
                │  Valid? │
                └────┬────┘
                     │
              YES    │     NO
                     ↓     └────→ [BLOCK]
              ┌─────────────┐
              │   PASS      │
              │             │
              │ • Redacted  │
              │ • Approved  │
              │ • Logged    │
              └─────────────┘
```

## 📊 Data Storage Schema

```
MongoDB Collections:

┌─────────────────────────────────────────────┐
│              SESSIONS                       │
├─────────────────────────────────────────────┤
│ id: string (PK)                             │
│ start_ts: Date                              │
│ end_ts: Date                                │
│ status: enum                                │
│ audio_locations: [string]                   │
│ transcripts: [Object]                       │
│ event_list: [Object]                        │
│ per_player_events: {player_id: [Object]}    │
│ summaries: Object                           │
│ summary_sent: boolean                       │
└─────────────────────────────────────────────┘
         │ 1
         │ references
         ↓ *
┌─────────────────────────────────────────────┐
│              PLAYERS                        │
├─────────────────────────────────────────────┤
│ id: string (PK)                             │
│ real_name: string                           │
│ in_game_name: string                        │
│ race: string                                │
│ role_type: string                           │
│ level: number                               │
│ date_joined: Date                           │
│ persona_image_id: string                    │
│ persona_data: Object                        │
│ stat_sheet_data: Object                     │
│ inventory: [Object]                         │
│ group: enum ['Paul', 'Jonathan']            │
│ groupme_user_id: string                     │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│         WRITE_REQUESTS                      │
├─────────────────────────────────────────────┤
│ id: string (PK)                             │
│ target_sheet: string                        │
│ payload: Object                             │
│ created_by: string (FK → sessions.id)       │
│ created_ts: Date                            │
│ approved_by_dm: string                      │
│ approval_ts: Date                           │
│ status: enum ['pending','approved','reject']│
│ rejection_reason: string                    │
└─────────────────────────────────────────────┘
         │ 1
         │ references
         ↓ 1
┌─────────────────────────────────────────────┐
│            APPROVALS                        │
├─────────────────────────────────────────────┤
│ id: string (PK)                             │
│ request_id: string (FK → write_requests.id) │
│ dm_id: string                               │
│ decision: enum ['approve', 'reject']        │
│ comment: string                             │
│ ts: Date                                    │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           EVENT_QUEUE                       │
├─────────────────────────────────────────────┤
│ id: string (PK)                             │
│ event_type: string                          │
│ payload: Object                             │
│ status: enum                                │
│ retry_count: number                         │
│ max_retries: number                         │
│ error_message: string                       │
│ scheduled_at: Date                          │
│ processed_at: Date                          │
└─────────────────────────────────────────────┘


Redis Key Patterns:

┌─────────────────────────────────────────────┐
│  job:{jobId}                                │
│  → MCP job status & result                  │
│  → TTL: 1 hour                              │
├─────────────────────────────────────────────┤
│  session:{sessionId}:events                 │
│  → Real-time event stream                   │
│  → TTL: 24 hours                            │
├─────────────────────────────────────────────┤
│  rate_limit:{action}:{window}               │
│  → Rate limiting counter                    │
│  → TTL: 1 hour                              │
├─────────────────────────────────────────────┤
│  cache:player:{playerId}                    │
│  → Player data cache                        │
│  → TTL: 15 minutes                          │
└─────────────────────────────────────────────┘
```

## 🚀 Deployment Architecture

```
┌──────────────────────────────────────────────────────────┐
│                    CLOUD INFRASTRUCTURE                   │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │              Load Balancer (HTTPS)                  │  │
│  └────────────────────┬───────────────────────────────┘  │
│                       │                                   │
│       ┌───────────────┼───────────────┐                  │
│       ↓               ↓               ↓                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐              │
│  │Backend  │    │Backend  │    │Backend  │              │
│  │Instance │    │Instance │    │Instance │              │
│  │   #1    │    │   #2    │    │   #3    │              │
│  └─────────┘    └─────────┘    └─────────┘              │
│       │               │               │                  │
│       └───────────────┼───────────────┘                  │
│                       │                                   │
│       ┌───────────────┼────────────────────┐             │
│       ↓               ↓                    ↓             │
│  ┌─────────┐    ┌─────────┐         ┌─────────┐         │
│  │   MCP   │    │   MCP   │         │   MCP   │         │
│  │Transc.  │    │ Vision  │         │   OCR   │         │
│  └─────────┘    └─────────┘         └─────────┘         │
│  (Auto-scale)   (Auto-scale)        (Auto-scale)        │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │         Managed Services                            │  │
│  │                                                     │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐ │  │
│  │  │ MongoDB  │  │  Redis   │  │  Cloud Storage   │ │  │
│  │  │  Atlas   │  │  Cloud   │  │  (Audio/Images)  │ │  │
│  │  └──────────┘  └──────────┘  └──────────────────┘ │  │
│  └────────────────────────────────────────────────────┘  │
│                                                           │
│  ┌────────────────────────────────────────────────────┐  │
│  │         External APIs                               │  │
│  │                                                     │  │
│  │  [Google Cloud] [Anthropic] [GroupMe] [Sheets]    │  │
│  └────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│                    MOBILE APPS                            │
│                                                           │
│     iOS App Store              Google Play Store         │
│    ┌─────────────┐            ┌─────────────┐            │
│    │   Dungeons  │            │   Dungeons  │            │
│    │     ADK     │            │     ADK     │            │
│    │   (React    │            │   (React    │            │
│    │   Native)   │            │   Native)   │            │
│    └─────────────┘            └─────────────┘            │
└──────────────────────────────────────────────────────────┘
```

---

**Legend**:
- `→` Data flow
- `↓` Process flow
- `[Component]` External service
- `{Data}` Storage/state
- `(Property)` Configuration
