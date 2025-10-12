// Temporary mock transcription agent for testing without Google Cloud
import { BaseAgent } from './base-agent.js';

export class TranscriptionAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'transcription-agent',
      name: 'Transcription Agent (Mock)',
      role: 'audio-to-text',
      ...config
    });

    console.log('✅ Transcription Agent: Using MOCK mode (no Google API calls)');
  }

  async execute(input) {
    const { audioUri, sessionId, chunkIndex } = input;

    this.setState('running', { sessionId, chunkIndex });
    this.log('info', `Mock transcribing chunk ${chunkIndex}`);

    try {
      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 1000));

      // Return mock transcript
      const mockTranscript = this.generateMockTranscript(chunkIndex);

      const enrichedTranscript = {
        ...mockTranscript,
        sessionId,
        chunkIndex,
        timestamp: new Date(),
        source: 'mock'
      };

      this.setState('completed', { transcriptLength: mockTranscript.text?.length || 0 });
      this.emit('transcriptReady', enrichedTranscript);

      console.log(`  ✅ Mock transcript generated: ${mockTranscript.wordCount} words`);

      return enrichedTranscript;

    } catch (error) {
      this.handleError(error, { sessionId, chunkIndex, audioUri });
      throw error;
    }
  }

  generateMockTranscript(chunkIndex) {
    const mockTranscripts = [
      "Aragorn attacks the goblin with his longsword, rolling a natural 20 for critical hit!",
      "The party finds a treasure chest containing 50 gold pieces and a magic healing potion.",
      "Legolas shoots two arrows at the orc, dealing 15 damage total. The orc falls dead.",
      "The DM announces that everyone gains 100 experience points for defeating the enemies.",
      "Gandalf casts fireball at the troll, dealing 30 fire damage. The troll roars in pain!",
      "We should split the gold evenly among the party members.",
      "I search the room for traps. The DM asks me to roll a perception check.",
      "The merchant offers to sell us healing potions for 25 gold each.",
    ];

    const text = mockTranscripts[chunkIndex % mockTranscripts.length];
    const words = text.split(' ');

    return {
      text,
      segments: [{
        speaker: 'Speaker 1',
        text,
        startTime: 0,
        endTime: words.length * 0.5,
        confidence: 0.95
      }],
      fullTranscript: text,
      confidence: 0.95,
      wordCount: words.length
    };
  }
}