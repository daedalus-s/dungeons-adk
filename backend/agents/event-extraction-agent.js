import { BaseAgent } from './base-agent.js';

/**
 * EventExtractionAgent - NLU-based game event detection and tagging
 * Identifies combat, loot, XP, purchases, decisions, etc.
 */
export class EventExtractionAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'event-extraction-agent',
      name: 'Event Extraction Agent',
      role: 'nlu-event-detection',
      ...config
    });

    this.eventTypes = [
      'combat',
      'loot',
      'dialogue',
      'transaction',
      'levelup',
      'death',
      'decision',
      'exploration',
      'skill_check',
      'rest',
      'shopping'
    ];

    this.players = config.players || [];
  }

  /**
   * Main execution: extract events from transcript
   */
  async execute(input) {
    const { transcript, sessionId, chunkIndex } = input;

    this.setState('running', { sessionId, chunkIndex });
    this.log('info', `Extracting events from chunk ${chunkIndex}`);

    try {
      const events = [];

      // Handle both string and object transcript formats
      let transcriptText = '';
      if (typeof transcript === 'string') {
        transcriptText = transcript;
      } else if (transcript.text) {
        transcriptText = transcript.text;
      } else if (transcript.segments && Array.isArray(transcript.segments)) {
        transcriptText = transcript.segments.map(s => s.text).join(' ');
      } else {
        throw new Error('Invalid transcript format');
      }

      // Extract events from text
      const extractedEvents = await this.extractEventsFromText(transcriptText, sessionId);
      events.push(...extractedEvents);

      // Tag personal events
      const taggedEvents = this.tagPersonalEvents(events);

      const result = {
        sessionId,
        chunkIndex,
        events: taggedEvents,
        timestamp: new Date()
      };

      this.setState('completed', { eventCount: events.length });
      this.emit('eventsExtracted', result);

      return result;

    } catch (error) {
      this.handleError(error, { sessionId, chunkIndex });
      throw error;
    }
  }

  /**
   * Extract events from transcript text using Claude
   */
  async extractEventsFromText(transcriptText, sessionId) {
    const prompt = this.buildExtractionPrompt(transcriptText);

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 2048,
      temperature: 0.3
    });

    const extractedData = this.parseClaudeResponse(response.content[0].text);

    return extractedData.events.map(event => ({
      ...event,
      sessionId,
      timestamp: new Date(),
      sourceText: transcriptText.substring(0, 200), // First 200 chars for reference
      id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    }));
  }

  /**
   * Build extraction prompt for Claude
   */
  buildExtractionPrompt(transcriptText) {
    return `You are analyzing a D&D game session transcript. Extract all game-relevant events.

Transcript: "${transcriptText}"

Event Types to detect:
- combat (attacks, damage, initiative, etc.)
- loot (items found, treasure acquired)
- dialogue (important NPC conversations, story reveals)
- transaction (buying, selling, trading items)
- levelup (character advancement, XP gains)
- death (character or NPC deaths)
- decision (major party decisions, moral choices)
- exploration (discovering new areas, secrets)
- skill_check (dice rolls, ability checks, saving throws)
- rest (short rest, long rest)
- shopping (visiting merchants, browsing items)

Known Players:
${this.players.map(p => `- ${p.in_game_name} (player: ${p.real_name})`).join('\n') || '- No players registered yet'}

Return a JSON object with this structure:
{
  "events": [
    {
      "type": "event_type",
      "actor": "character or NPC name",
      "action": "brief description",
      "entities": ["item", "location", "NPC names"],
      "metadata": {
        "damage": number (if combat),
        "gold_value": number (if loot/transaction),
        "item_name": string (if item-related),
        "quantity": number (if applicable)
      }
    }
  ]
}

If no events are detected, return {"events": []}.
Only return the JSON, no other text.`;
  }

  /**
   * Parse Claude's JSON response
   */
  parseClaudeResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { events: [] };
    } catch (error) {
      this.log('warn', 'Failed to parse Claude response', { text, error: error.message });
      return { events: [] };
    }
  }

  /**
   * Tag events as personal if they involve a specific player
   */
  tagPersonalEvents(events) {
    return events.map(event => {
      const personalFor = [];

      // Check if actor matches a player
      const actorPlayer = this.players.find(p =>
        p.in_game_name.toLowerCase() === event.actor?.toLowerCase()
      );
      if (actorPlayer) {
        personalFor.push(actorPlayer.id);
      }

      // Check entities for player mentions
      if (event.entities && Array.isArray(event.entities)) {
        event.entities.forEach(entity => {
          const mentionedPlayer = this.players.find(p =>
            p.in_game_name.toLowerCase() === entity.toLowerCase()
          );
          if (mentionedPlayer && !personalFor.includes(mentionedPlayer.id)) {
            personalFor.push(mentionedPlayer.id);
          }
        });
      }

      return {
        ...event,
        isPersonal: personalFor.length > 0,
        personalFor,
        isGroup: personalFor.length === 0 || personalFor.length > 1
      };
    });
  }

  /**
   * Update player list for entity recognition
   */
  updatePlayers(players) {
    this.players = players;
    this.log('info', `Updated player list: ${players.length} players`);
  }
}
