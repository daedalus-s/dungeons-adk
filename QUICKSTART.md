# Dungeons ADK - Quick Start Guide

## 🚀 5-Minute Setup

### Option 1: Docker (Recommended)

```bash
# 1. Clone repository
git clone https://github.com/daedalus-s/dungeons-adk.git
cd dungeons-adk

# 2. Configure environment
cp .env.example .env
# Edit .env with your API keys

# 3. Start all services
docker-compose up -d

# 4. Verify services
curl http://localhost:3000/health
curl http://localhost:4001/health  # MCP Transcription
curl http://localhost:4002/health  # MCP Vision
curl http://localhost:4003/health  # MCP OCR

# 5. Start mobile app
cd mobile && npm install && npm start
```

### Option 2: Local Development

```bash
# 1. Install dependencies
npm install

# 2. Start MongoDB and Redis
brew services start mongodb-community
brew services start redis

# 3. Configure .env
cp .env.example .env
# Add your API keys

# 4. Start backend
npm run dev

# 5. Start MCP servers (separate terminals)
node mcp-servers/transcription-server.js
node mcp-servers/vision-server.js
node mcp-servers/ocr-server.js

# 6. Start mobile app
cd mobile && npm install && npm start
```

## 🔑 Required API Keys

### 1. Google Cloud (Free Trial Available)

1. Go to https://console.cloud.google.com
2. Create new project
3. Enable APIs:
   - Cloud Speech-to-Text API
   - Cloud Vision API
   - Google Sheets API
4. Create Service Account → Download JSON key
5. Add to .env:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json
   ```

### 2. Anthropic Claude (Free Tier Available)

1. Go to https://console.anthropic.com
2. Create API key
3. Add to .env:
   ```env
   ANTHROPIC_API_KEY=sk-ant-...
   ```

### 3. GroupMe (Free)

1. Go to https://dev.groupme.com
2. Create bot in your group
3. Add to .env:
   ```env
   GROUPME_ACCESS_TOKEN=...
   GROUPME_BOT_ID=...
   GROUPME_GROUP_ID=...
   ```

### 4. Google Sheets Setup

1. Create spreadsheet: "Chantilly Library Campaign"
2. Create tabs:
   - Full group details
   - Paul's group inventory
   - Jonathan's group inventory
3. Share with service account email (from JSON key)
4. Copy spreadsheet ID from URL:
   ```
   https://docs.google.com/spreadsheets/d/[THIS_IS_THE_ID]/edit
   ```
5. Add to .env:
   ```env
   GOOGLE_SHEETS_ID=...
   ```

## 📱 Mobile App Setup

### iOS

```bash
cd mobile
npm install
npx expo start --ios
```

### Android

```bash
cd mobile
npm install
npx expo start --android
```

### Web (Testing)

```bash
cd mobile
npm install
npm run web
```

## 🎮 First Session

1. **Open Mobile App** → Session tab
2. **Tap "Start Session"** → Grant mic permissions
3. **Play D&D!** → App records and processes automatically
4. **Tap "Stop Session"** → Processing begins
5. **DM Reviews** → Approvals tab → Approve data writes
6. **Messages Sent!** → GroupMe receives summaries

## 🧪 Test with Sample Data

```bash
# Run integration tests
npm run test:integration

# This will:
# 1. Create test session
# 2. Upload sample audio
# 3. Generate events and summaries
# 4. Create write requests
# 5. Simulate DM approval
# 6. Verify Sheets update (mock)
# 7. Send test GroupMe message
```

## 🔍 Verify Installation

### Check Backend

```bash
# Health check
curl http://localhost:3000/health

# Get stats
curl http://localhost:3000/api/stats

# Agent health
curl http://localhost:3000/api/agents/health
```

### Check MCP Servers

```bash
# Transcription server
curl http://localhost:4001/health

# Vision server
curl http://localhost:4002/health

# OCR server
curl http://localhost:4003/health
```

### Check Database

```bash
# MongoDB
mongosh "mongodb://admin:password123@localhost:27017"
use dungeons-adk
show collections

# Redis
redis-cli
KEYS *
```

## 🐛 Troubleshooting

### Issue: "Cannot connect to MongoDB"

```bash
# Check if MongoDB is running
brew services list | grep mongodb

# Start MongoDB
brew services start mongodb-community

# Or with Docker
docker-compose up -d mongodb
```

### Issue: "Google Cloud authentication failed"

```bash
# Verify credentials file exists
ls -la config/service-account.json

# Test authentication
node -e "const {GoogleAuth} = require('google-auth-library'); const auth = new GoogleAuth({keyFile: './config/service-account.json'}); auth.getClient().then(() => console.log('✓ Auth works'))"
```

### Issue: "Anthropic API error"

```bash
# Test API key
curl https://api.anthropic.com/v1/messages \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" \
  -d '{"model":"claude-sonnet-4-5-20250929","max_tokens":100,"messages":[{"role":"user","content":"Hello"}]}'
```

### Issue: "GroupMe messages not sending"

```bash
# Test bot
curl -X POST https://api.groupme.com/v3/bots/post \
  -H "Content-Type: application/json" \
  -d '{"bot_id":"YOUR_BOT_ID","text":"Test message"}'
```

## 📊 Sample .env File

```env
# Google Cloud
GOOGLE_CLOUD_PROJECT_ID=your-project-id
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json
GOOGLE_SHEETS_ID=1AbC...XyZ

# Anthropic Claude
ANTHROPIC_API_KEY=sk-ant-api03-...

# GroupMe
GROUPME_ACCESS_TOKEN=abc123...
GROUPME_BOT_ID=123456...
GROUPME_GROUP_ID=789012...

# Database
MONGODB_URI=mongodb://admin:password123@localhost:27017/dungeons-adk?authSource=admin
REDIS_HOST=localhost
REDIS_PORT=6379

# Server
PORT=3000
NODE_ENV=development

# MCP Servers
MCP_TRANSCRIPTION_SERVER=http://localhost:4001
MCP_VISION_SERVER=http://localhost:4002
MCP_OCR_SERVER=http://localhost:4003

# Security
JWT_SECRET=your-random-secret-key-here
ENCRYPTION_KEY=another-random-key-here
```

## 🎯 Next Steps

1. ✅ **Set up all services** (above)
2. 📱 **Configure mobile app** with backend URL
3. 👥 **Add players** to database
4. 🎲 **Run first session** with test data
5. ✍️ **Customize** event types and summaries
6. 🚀 **Deploy** to production

## 📚 Additional Resources

- [Full Implementation Guide](./IMPLEMENTATION_GUIDE.md)
- [API Documentation](./API_DOCS.md)
- [Architecture Deep Dive](./ARCHITECTURE.md)
- [Contributing Guide](./CONTRIBUTING.md)

## 🆘 Need Help?

- 📖 Documentation: https://docs.dungeons-adk.com
- 💬 Discord: https://discord.gg/dungeons-adk
- 🐛 Issues: https://github.com/daedalus-s/dungeons-adk/issues
