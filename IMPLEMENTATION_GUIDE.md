# 🌐 Dungeons ADK - Web Application Setup Guide

Complete guide to restructure and run your D&D session recorder as a modern web application.

---

## 🎯 Why Web Over Mobile?

✅ **No Expo SDK 54 audio bugs**  
✅ **Works on ALL devices** (desktop, laptop, tablet, phone browsers)  
✅ **Mature Web Audio API** (MediaRecorder is stable)  
✅ **Easier deployment** (single URL, no app stores)  
✅ **Better debugging** (browser DevTools)  
✅ **Instant updates** (no app store approval)

---

## 📋 Prerequisites

- Node.js 18+ installed
- MongoDB running (via Docker or locally)
- Redis running (via Docker or locally)
- Your existing backend code
- API keys configured in `.env`

---

## 🚀 Quick Setup (15 minutes)

### Step 1: Restructure Project

```powershell
# Run the restructure script
.\restructure-to-web.ps1

# Or manually:
Remove-Item -Recurse -Force mobile
mkdir -p frontend/{public,src/{components,hooks,services,styles}}
```

### Step 2: Install Frontend Dependencies

```powershell
cd frontend
npm install

# Install all dependencies
npm install react@^18.2.0 react-dom@^18.2.0 react-router-dom@^6.20.0 `
  @mui/material@^5.14.20 @mui/icons-material@^5.14.19 `
  @emotion/react@^11.11.1 @emotion/styled@^11.11.0 `
  axios@^1.6.2 zustand@^4.4.7 recharts@^2.10.3 `
  @vitejs/plugin-react@^4.2.1 vite@^5.0.8 --save
```

### Step 3: Create Frontend Files

Create these files in `frontend/` (copy from artifacts above):

**Configuration:**
- `vite.config.js`
- `index.html`
- `src/main.jsx`

**Core App:**
- `src/App.jsx`
- `src/store/sessionStore.js`
- `src/services/api.js`
- `src/hooks/useAudioRecorder.js`

**Components:**
- `src/components/SessionRecorder.jsx`
- `src/components/Dashboard.jsx`
- `src/components/ApprovalQueue.jsx`
- `src/components/PlayerList.jsx`

### Step 4: Update Backend

Replace `backend/server.js` with the updated version from artifacts (includes React serving).

### Step 5: Start Development Servers

```powershell
# Terminal 1: Start MongoDB & Redis
docker-compose up -d mongodb redis

# Terminal 2: Start Backend API
npm run dev

# Terminal 3: Start Frontend Dev Server
cd frontend
npm run dev
```

---

## 🎮 Usage

### Development Mode

1. **Open Browser**: http://localhost:5173
2. **Click "Start Recording Session"**
3. **Allow microphone** when prompted
4. **Speak your D&D gameplay**
5. **Click "Process Chunk"** every 30-60 seconds
6. **View transcripts and events** in real-time
7. **Click "End Session"** when done

### Testing Without Audio

Use the test script to simulate sessions:

```powershell
# Backend must be running
node test-complete-pipeline.js
```

---

## 🏗️ Project Structure (Updated)

```
dungeons-adk/
├── frontend/                    # React Web App
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   │   ├── SessionRecorder.jsx
│   │   │   ├── Dashboard.jsx
│   │   │   ├── ApprovalQueue.jsx
│   │   │   └── PlayerList.jsx
│   │   ├── hooks/
│   │   │   └── useAudioRecorder.js
│   │   ├── services/
│   │   │   └── api.js
│   │   ├── store/
│   │   │   └── sessionStore.js
│   │   ├── App.jsx
│   │   └── main.jsx
│   ├── index.html
│   ├── vite.config.js
│   └── package.json
│
├── backend/                     # Node.js API (unchanged)
│   ├── agents/
│   │   ├── base-agent.js
│   │   ├── transcription-agent.js
│   │   ├── event-extraction-agent.js
│   │   ├── summarizer-agent.js
│   │   ├── sheets-agent.js
│   │   ├── state-manager-agent.js
│   │   ├── guardrails-agent.js
│   │   └── orchestrator.js
│   └── server.js                # ✅ Updated to serve React
│
├── uploads/                     # Audio file storage
├── config/
│   └── service-account.json
├── .env
├── config.js
├── package.json
└── docker-compose.yml
```

---

## 🎤 How Audio Recording Works

### Web Audio API Flow

```
User clicks "Start Recording"
    ↓
Request microphone permission (browser popup)
    ↓
MediaRecorder starts capturing audio
    ↓
Audio chunks collected in memory
    ↓
User clicks "Process Chunk"
    ↓
Stop recording, create Blob
    ↓
Upload Blob to backend (/api/sessions/:id/audio)
    ↓
Backend transcribes with Google Speech-to-Text
    ↓
Extract events with Claude
    ↓
Display in UI, store in MongoDB
    ↓
Start new recording (loop continues)
```

### Audio Format

- **MIME Type**: `audio/webm;codecs=opus` (or browser default)
- **Bitrate**: 64kbps (optimized for speech)
- **Channels**: Mono preferred (smaller files)
- **Sample Rate**: 16kHz ideal for transcription

### Browser Compatibility

| Browser | Recording | Transcription | Notes |
|---------|-----------|---------------|-------|
| Chrome  | ✅        | ✅            | Best support |
| Edge    | ✅        | ✅            | Chromium-based |
| Firefox | ✅        | ✅            | Good support |
| Safari  | ⚠️        | ✅            | Limited WebM support |
| Mobile Chrome | ✅  | ✅            | Works great |
| Mobile Safari | ⚠️  | ✅            | Use .mp4 fallback |

---

## 🔧 Configuration

### Environment Variables

Create `frontend/.env.local`:

```env
VITE_API_URL=http://localhost:3000/api
```

Backend `.env` (already exists):

```env
PORT=3000
MONGODB_URI=mongodb://admin:password123@localhost:27017/dungeons-adk?authSource=admin
REDIS_HOST=localhost
REDIS_PORT=6379
ANTHROPIC_API_KEY=your_key_here
GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json
GOOGLE_SHEETS_ID=your_sheet_id_here
NODE_ENV=development
```

---

## 📦 Production Build

### Build Frontend

```powershell
cd frontend
npm run build
# Creates: frontend/dist/
```

### Deploy Single Server

```powershell
# Set environment
$env:NODE_ENV="production"

# Start backend (serves React + API)
npm start

# Access at http://localhost:3000
```

### Deploy Separately

**Frontend** (Vercel/Netlify):
```powershell
# In frontend/
npm run build
# Deploy dist/ folder

# Set environment variable:
VITE_API_URL=https://your-backend.com/api
```

**Backend** (Railway/Render):
```powershell
# Deploy entire backend folder
# Set environment variables in platform dashboard
```

---

## 🐛 Troubleshooting

### Issue: Microphone Permission Denied

**Solution**: 
- Check browser permissions in Settings → Privacy → Microphone
- Ensure HTTPS in production (required for getUserMedia)
- Try different browser

### Issue: CORS Errors

**Solution**: Backend already has `cors()` middleware enabled. If deploying separately:

```javascript
// backend/server.js
app.use(cors({
  origin: 'https://your-frontend-domain.com',
  credentials: true
}));
```

### Issue: Audio Not Uploading

**Solution**: Check file size limits:

```javascript
// backend/server.js
const upload = multer({
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});
```

### Issue: "Cannot find module" Errors

**Solution**:
```powershell
# Backend
npm install

# Frontend
cd frontend
npm install
```

---

## 🧪 Testing

### Test Backend Only

```powershell
node test-complete-pipeline.js
```

### Test Audio Recording (Browser)

1. Open http://localhost:5173
2. Open DevTools (F12) → Console
3. Click "Start Recording"
4. Check console for:
   - `Recording started: { mimeType: '...', state: 'recording' }`
   - Microphone access granted
5. Speak into mic
6. Click "Process Chunk"
7. Check console for:
   - `Recording stopped: { size: '...KB', type: '...' }`
   - Upload success message

### Test Full Workflow

```powershell
# 1. Create test player
curl -X POST http://localhost:3000/api/players `
  -H "Content-Type: application/json" `
  -d '{"real_name":"Test","in_game_name":"Aragorn","race":"Human","role_type":"Ranger","level":5,"group":"Paul"}'

# 2. Use web UI to record and process

# 3. Check dashboard for results
# Open: http://localhost:5173/dashboard
```

---

## 📊 Performance

### File Sizes (2-hour session)

- **16kHz mono @ 64kbps**: ~56 MB total
- **Per chunk (30s)**: ~960 KB
- **Upload time (30s chunk)**: ~1-2 seconds

### Processing Times

- **Transcription**: ~2-3 seconds per 30s chunk
- **Event extraction**: ~1-2 seconds
- **Total per chunk**: ~3-5 seconds
- **End session summary**: ~5-10 seconds

---

## 🎯 Next Steps

1. ✅ **Test locally** - Record a short test session
2. ✅ **Add players** - Use Players tab to create characters
3. ✅ **Test approvals** - End a session, check Approvals tab
4. ✅ **Configure Sheets** - Set up Google Sheets integration
5. ✅ **Deploy** - Build and deploy to production

---

## 📚 Additional Resources

- **Vite Docs**: https://vitejs.dev
- **React Router**: https://reactrouter.com
- **MUI Components**: https://mui.com
- **Web Audio API**: https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder

---

## 🎉 Benefits Over Mobile

| Feature | Mobile (Expo) | Web App |
|---------|---------------|---------|
| Audio Recording | ❌ Broken in SDK 54 | ✅ Stable |
| Cross-Platform | 📱 iOS/Android only | 💻📱 All devices |
| Deployment | 📦 App stores | 🌐 Instant URL |
| Updates | ⏳ Store approval | ⚡ Immediate |
| Development | 🐛 Complex setup | 🚀 Simple |
| Debugging | 😓 Limited tools | 🔧 Full DevTools |

---

## 💡 Tips

**For Best Audio Quality:**
- Use external microphone
- Quiet environment
- Speak clearly towards mic
- Process chunks every 30-60 seconds

**For Long Sessions:**
- Keep browser tab active
- Disable power saving mode
- Monitor storage space
- Use wired connection (not Wi-Fi)

**For Multiple Players:**
- Use single microphone in center of table
- Or use conference mic with 360° pickup
- Ensure everyone speaks clearly

---

**Questions?** Check the troubleshooting section or open an issue on GitHub!

🎲 **Happy Gaming!** ✨