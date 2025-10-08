import { BaseAgent } from './base-agent.js';
import speech from '@google-cloud/speech';
import axios from 'axios';

/**
 * TranscriptionAgent - Handles ASR, speaker diarization, and timestamped transcripts
 */
export class TranscriptionAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'transcription-agent',
      name: 'Transcription Agent',
      role: 'audio-to-text',
      ...config
    });

    // Initialize Google Cloud Speech client
    this.speechClient = new speech.SpeechClient({
      keyFilename: config.googleCredentials
    });

    this.mcpServer = config.mcpTranscriptionServer;
  }

  /**
   * Main execution: transcribe audio chunk
   */
  async execute(input) {
    const { audioUri, sessionId, chunkIndex } = input;

    this.setState('running', { sessionId, chunkIndex });
    this.log('info', `Transcribing chunk ${chunkIndex} for session ${sessionId}`);

    try {
      // Check MCP server health first
      const mcpAvailable = await this.checkMCPServer();

      let transcript;
      if (mcpAvailable) {
        transcript = await this.transcribeViaMCP(audioUri);
      } else {
        // Fallback to direct Google Cloud API
        transcript = await this.transcribeViaGoogleCloud(audioUri);
      }

      // Add metadata
      const enrichedTranscript = {
        ...transcript,
        sessionId,
        chunkIndex,
        timestamp: new Date(),
        source: mcpAvailable ? 'mcp' : 'google-direct'
      };

      this.setState('completed', { transcriptLength: transcript.text.length });
      this.emit('transcriptReady', enrichedTranscript);

      return enrichedTranscript;

    } catch (error) {
      this.handleError(error, { sessionId, chunkIndex, audioUri });
      throw error;
    }
  }

  /**
   * Check MCP transcription server availability
   */
  async checkMCPServer() {
    try {
      const response = await axios.get(`${this.mcpServer}/health`, { timeout: 2000 });
      return response.status === 200;
    } catch {
      return false;
    }
  }

  /**
   * Transcribe via MCP server
   */
  async transcribeViaMCP(audioUri) {
    const response = await axios.post(`${this.mcpServer}/transcribe`, {
      audioUri,
      enableDiarization: true,
      enableTimestamps: true,
      language: 'en-US'
    }, {
      timeout: 120000 // 2 minute timeout
    });

    return response.data;
  }

  /**
   * Transcribe via Google Cloud Speech-to-Text directly
   */
  async transcribeViaGoogleCloud(audioUri) {
    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableSpeakerDiarization: true,
        diarizationSpeakerCount: 6, // Typical D&D group size
        enableWordTimeOffsets: true,
        model: 'video', // Best for multiple speakers
        useEnhanced: true
      },
      audio: {
        uri: audioUri
      }
    };

    const [operation] = await this.speechClient.longRunningRecognize(request);
    const [response] = await operation.promise();

    // Process results with speaker diarization
    return this.processDiarizedTranscript(response);
  }

  /**
   * Process diarized transcript with speaker labels and timestamps
   */
  processDiarizedTranscript(response) {
    const result = response.results[response.results.length - 1];
    const alternative = result.alternatives[0];

    const segments = [];
    let currentSpeaker = null;
    let currentSegment = {
      speaker: null,
      text: '',
      startTime: null,
      endTime: null,
      confidence: 0
    };

    // Group words by speaker
    alternative.words.forEach((wordInfo) => {
      const speakerTag = wordInfo.speakerTag || 'unknown';

      if (speakerTag !== currentSpeaker) {
        // New speaker - save previous segment
        if (currentSegment.text) {
          segments.push({ ...currentSegment });
        }

        // Start new segment
        currentSpeaker = speakerTag;
        currentSegment = {
          speaker: `Speaker ${speakerTag}`,
          text: wordInfo.word,
          startTime: this.convertTimeToSeconds(wordInfo.startTime),
          endTime: this.convertTimeToSeconds(wordInfo.endTime),
          confidence: alternative.confidence
        };
      } else {
        // Same speaker - append word
        currentSegment.text += ' ' + wordInfo.word;
        currentSegment.endTime = this.convertTimeToSeconds(wordInfo.endTime);
      }
    });

    // Add final segment
    if (currentSegment.text) {
      segments.push(currentSegment);
    }

    // Detect low-confidence speakers
    const lowConfidenceSegments = segments.filter(s => s.confidence < 0.7);
    if (lowConfidenceSegments.length > 0) {
      this.emit('lowConfidenceDiarization', {
        count: lowConfidenceSegments.length,
        segments: lowConfidenceSegments
      });
    }

    return {
      text: alternative.transcript,
      segments,
      fullTranscript: alternative.transcript,
      confidence: alternative.confidence,
      wordCount: alternative.words.length
    };
  }

  /**
   * Convert Google timestamp to seconds
   */
  convertTimeToSeconds(time) {
    return (time.seconds || 0) + (time.nanos || 0) / 1e9;
  }

  /**
   * Streaming transcription for real-time use
   */
  async streamTranscription(audioStream) {
    const request = {
      config: {
        encoding: 'LINEAR16',
        sampleRateHertz: 16000,
        languageCode: 'en-US',
        enableSpeakerDiarization: true,
        diarizationSpeakerCount: 6,
        interimResults: true
      },
      interimResults: true
    };

    const recognizeStream = this.speechClient
      .streamingRecognize(request)
      .on('error', (error) => {
        this.handleError(error);
      })
      .on('data', (data) => {
        const result = data.results[0];
        if (result.isFinal) {
          const transcript = result.alternatives[0].transcript;
          this.emit('interimTranscript', {
            text: transcript,
            isFinal: true,
            confidence: result.alternatives[0].confidence
          });
        }
      });

    audioStream.pipe(recognizeStream);
  }
}
