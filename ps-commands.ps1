@'
import { BaseAgent } from './base-agent.js';
import speech from '@google-cloud/speech';
import fs from 'fs';

export class TranscriptionAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'transcription-agent',
      name: 'Transcription Agent',
      role: 'audio-to-text',
      ...config
    });

    this.speechClient = new speech.SpeechClient({
      keyFilename: config.googleCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS
    });

    console.log('✅ Transcription Agent: Authenticated');
  }

  async execute(input) {
    const { audioUri, sessionId, chunkIndex } = input;

    this.setState('running', { sessionId, chunkIndex });
    this.log('info', `Transcribing chunk ${chunkIndex} for session ${sessionId}`);

    try {
      const transcript = await this.transcribeAudio(audioUri);

      const enrichedTranscript = {
        ...transcript,
        sessionId,
        chunkIndex,
        timestamp: new Date(),
        source: 'google-speech'
      };

      this.setState('completed', { transcriptLength: transcript.text?.length || 0 });
      this.emit('transcriptReady', enrichedTranscript);

      return enrichedTranscript;

    } catch (error) {
      this.handleError(error, { sessionId, chunkIndex, audioUri });
      throw error;
    }
  }

  async transcribeAudio(audioPath) {
    const stats = fs.statSync(audioPath);
    console.log(`  📁 File size: ${(stats.size / 1024).toFixed(2)} KB`);

    const buffer = fs.readFileSync(audioPath);
    const audioInfo = this.detectAudioFormat(buffer);
    
    console.log(`  🎵 Detected: ${audioInfo.sampleRate}Hz, ${audioInfo.channels} channel(s)`);

    const audioBytes = buffer.toString('base64');

    const audio = {
      content: audioBytes,
    };

    // Configure for the actual audio format
    const config = {
      encoding: 'LINEAR16',
      sampleRateHertz: audioInfo.sampleRate,
      audioChannelCount: audioInfo.channels,
      languageCode: 'en-US',
      enableSpeakerDiarization: audioInfo.channels === 1, // Only works with mono
      diarizationSpeakerCount: audioInfo.channels === 1 ? 6 : undefined,
      enableWordTimeOffsets: true,
      model: 'latest_long',
      useEnhanced: true,
      enableAutomaticPunctuation: true
    };

    if (audioInfo.channels > 1) {
      console.log('  ⚠️  Stereo audio detected - speaker diarization disabled');
      console.log('     For best results, convert to mono');
    }

    const request = {
      audio: audio,
      config: config,
    };

    console.log('  🎤 Sending to Google Speech-to-Text...');
    
    try {
      const [response] = await this.speechClient.recognize(request);
      
      console.log('  ✅ Response received');

      if (!response.results || response.results.length === 0) {
        console.log('  ⚠️  No speech detected');
        return {
          text: '',
          segments: [],
          fullTranscript: '',
          confidence: 0,
          wordCount: 0
        };
      }

      return this.processDiarizedTranscript(response);
    } catch (error) {
      console.error('  ❌ Google API Error:', error.message);
      throw error;
    }
  }

  detectAudioFormat(buffer) {
    let sampleRate = 16000;
    let channels = 1;

    if (buffer.toString('ascii', 0, 4) === 'RIFF') {
      sampleRate = buffer.readUInt32LE(24);
      channels = buffer.readUInt16LE(22);
    }

    return { sampleRate, channels };
  }

  processDiarizedTranscript(response) {
    if (!response.results || response.results.length === 0) {
      return {
        text: '',
        segments: [],
        fullTranscript: '',
        confidence: 0,
        wordCount: 0
      };
    }

    // Combine all results
    let fullText = '';
    let totalWords = 0;
    const segments = [];

    response.results.forEach((result, idx) => {
      const alternative = result.alternatives[0];
      if (!alternative) return;

      fullText += (fullText ? ' ' : '') + alternative.transcript;
      totalWords += alternative.words?.length || 0;

      // Create segment
      if (alternative.words && alternative.words.length > 0) {
        const firstWord = alternative.words[0];
        const lastWord = alternative.words[alternative.words.length - 1];
        
        segments.push({
          speaker: `Speaker ${idx + 1}`,
          text: alternative.transcript,
          startTime: this.convertTimeToSeconds(firstWord.startTime),
          endTime: this.convertTimeToSeconds(lastWord.endTime),
          confidence: alternative.confidence || 0
        });
      }
    });

    return {
      text: fullText,
      segments,
      fullTranscript: fullText,
      confidence: segments[0]?.confidence || 0,
      wordCount: totalWords
    };
  }

  convertTimeToSeconds(time) {
    if (!time) return 0;
    return (time.seconds || 0) + (time.nanos || 0) / 1e9;
  }
}
'@ | Out-File -Encoding UTF8 backend/agents/transcription-agent.js