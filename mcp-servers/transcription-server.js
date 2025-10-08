import express from 'express';
import speech from '@google-cloud/speech';
import { createClient } from 'redis';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.MCP_TRANSCRIPTION_PORT || 4001;

app.use(express.json());

// Initialize Google Cloud Speech client
const speechClient = new speech.SpeechClient({
  keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS
});

// Redis for task queue
const redis = createClient({
  url: process.env.REDIS_URL || 'redis://localhost:6379'
});

await redis.connect();

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'transcription-server',
    capabilities: ['transcription', 'diarization', 'streaming'],
    load: getServerLoad()
  });
});

// Transcribe endpoint
app.post('/transcribe', async (req, res) => {
  const { audioUri, enableDiarization, enableTimestamps, language } = req.body;

  try {
    const jobId = `trans_${Date.now()}`;

    // Queue job in Redis
    await redis.hSet(`job:${jobId}`, {
      status: 'pending',
      audioUri,
      enableDiarization,
      enableTimestamps,
      language: language || 'en-US',
      createdAt: new Date().toISOString()
    });

    // Start transcription in background
    processTranscription(jobId, audioUri, {
      enableDiarization,
      enableTimestamps,
      language
    });

    res.json({
      jobId,
      status: 'processing',
      estimatedTime: '30-60 seconds'
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get transcription job status
app.get('/transcribe/:jobId', async (req, res) => {
  const { jobId } = req.params;

  try {
    const job = await redis.hGetAll(`job:${jobId}`);

    if (!job || Object.keys(job).length === 0) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status === 'completed') {
      const result = JSON.parse(job.result);
      res.json(result);
    } else {
      res.json({
        jobId,
        status: job.status,
        createdAt: job.createdAt
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Process transcription asynchronously
async function processTranscription(jobId, audioUri, options) {
  try {
    await redis.hSet(`job:${jobId}`, 'status', 'processing');

    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: options.language || 'en-US',
        enableSpeakerDiarization: options.enableDiarization || false,
        diarizationSpeakerCount: 6,
        enableWordTimeOffsets: options.enableTimestamps || false,
        model: 'video',
        useEnhanced: true
      },
      audio: {
        uri: audioUri
      }
    };

    const [operation] = await speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();

    // Process results
    const result = processTranscriptResponse(response);

    // Store result
    await redis.hSet(`job:${jobId}`, {
      status: 'completed',
      result: JSON.stringify(result),
      completedAt: new Date().toISOString()
    });

    // Set expiry (1 hour)
    await redis.expire(`job:${jobId}`, 3600);

  } catch (error) {
    console.error('Transcription error:', error);
    await redis.hSet(`job:${jobId}`, {
      status: 'failed',
      error: error.message
    });
  }
}

function processTranscriptResponse(response) {
  const result = response.results[response.results.length - 1];
  const alternative = result.alternatives[0];

  const segments = [];
  let currentSpeaker = null;
  let currentSegment = null;

  if (alternative.words) {
    alternative.words.forEach((wordInfo) => {
      const speakerTag = wordInfo.speakerTag || 'unknown';

      if (speakerTag !== currentSpeaker) {
        if (currentSegment) {
          segments.push(currentSegment);
        }

        currentSpeaker = speakerTag;
        currentSegment = {
          speaker: `Speaker ${speakerTag}`,
          text: wordInfo.word,
          startTime: convertTimeToSeconds(wordInfo.startTime),
          endTime: convertTimeToSeconds(wordInfo.endTime),
          confidence: alternative.confidence
        };
      } else {
        currentSegment.text += ' ' + wordInfo.word;
        currentSegment.endTime = convertTimeToSeconds(wordInfo.endTime);
      }
    });

    if (currentSegment) {
      segments.push(currentSegment);
    }
  }

  return {
    text: alternative.transcript,
    segments,
    confidence: alternative.confidence,
    wordCount: alternative.words?.length || 0
  };
}

function convertTimeToSeconds(time) {
  return (time?.seconds || 0) + (time?.nanos || 0) / 1e9;
}

function getServerLoad() {
  // Simple load calculation
  const used = process.memoryUsage();
  return {
    memory: Math.round((used.heapUsed / used.heapTotal) * 100),
    uptime: process.uptime()
  };
}

app.listen(PORT, () => {
  console.log(`MCP Transcription Server running on port ${PORT}`);
});
