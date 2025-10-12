@'
import { BaseAgent } from './base-agent.js';

export class TranscriptionAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'transcription-agent',
      name: 'Transcription Agent (Mock)',
      role: 'audio-to-text',
      ...config
    });
    console.log('✅ Transcription Agent: MOCK MODE (bypassing Google API)');
  }

  async execute(input) {
    const { audioUri, sessionId, chunkIndex } = input;
    this.setState('running', { sessionId, chunkIndex });
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const mockTranscripts = [
      "Aragorn attacks the goblin with his longsword, rolling a natural 20 for critical hit!",
      "The party finds a treasure chest containing 50 gold pieces and a magic healing potion.",
      "Legolas shoots arrows at the orc, dealing 15 damage. The orc falls dead.",
      "Everyone gains 100 experience points for defeating the enemies.",
      "Gandalf casts fireball at the troll, dealing 30 fire damage!",
    ];
    
    const text = mockTranscripts[chunkIndex % mockTranscripts.length];
    const words = text.split(' ');
    
    const enrichedTranscript = {
      text,
      segments: [{ speaker: 'Speaker 1', text, startTime: 0, endTime: 5, confidence: 0.95 }],
      fullTranscript: text,
      confidence: 0.95,
      wordCount: words.length,
      sessionId,
      chunkIndex,
      timestamp: new Date(),
      source: 'mock'
    };
    
    this.setState('completed', { transcriptLength: text.length });
    this.emit('transcriptReady', enrichedTranscript);
    
    return enrichedTranscript;
  }
}
'@ | Out-File -Encoding UTF8 backend\agents\transcription-agent.js