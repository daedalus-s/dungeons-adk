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

    this.players = config.players || []; // {id, real_name, in_game_name}
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

      // Process each transcript segment
      for (const segment of transcript.segments) {
        const extractedEvents = await this.extractEventsFromSegment(segment, sessionId);
        events.push(...extractedEvents);
      }

      // Tag personal events
      const taggedEvents = this.tagPersonalEvents(events);

      // Infer inventory changes
      const inventoryChanges = this.inferInventoryChanges(events);

      const result = {
        sessionId,
        chunkIndex,
        events: taggedEvents,
        inventoryChanges,
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
   * Extract events from a single transcript segment using Claude
   */
  async extractEventsFromSegment(segment, sessionId) {
    const prompt = this.buildExtractionPrompt(segment);

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
      speaker: segment.speaker,
      timestamp: segment.startTime,
      sourceText: segment.text,
      confidence: segment.confidence
    }));
  }

  /**
   * Build extraction prompt for Claude
   */
  buildExtractionPrompt(segment) {
    return `You are analyzing a D&D game session transcript. Extract all game-relevant events from the following segment.

Speaker: ${segment.speaker}
Text: "${segment.text}"

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
${this.players.map(p => `- ${p.in_game_name} (player: ${p.real_name})`).join('\n')}

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
        "quantity": number (if applicable),
        "skill": string (if skill check),
        "dc": number (if skill check),
        "result": string (success/failure if applicable)
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
      // Extract JSON from response (handle markdown code blocks)
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
      event.entities?.forEach(entity => {
        const mentionedPlayer = this.players.find(p =>
          p.in_game_name.toLowerCase() === entity.toLowerCase()
        );
        if (mentionedPlayer && !personalFor.includes(mentionedPlayer.id)) {
          personalFor.push(mentionedPlayer.id);
        }
      });

      return {
        ...event,
        isPersonal: personalFor.length > 0,
        personalFor,
        isGroup: personalFor.length === 0 || personalFor.length > 1
      };
    });
  }

  /**
   * Infer inventory changes from transaction/loot events
   */
  inferInventoryChanges(events) {
    const inventoryChanges = [];

    events.forEach(event => {
      if (event.type === 'transaction' || event.type === 'loot' || event.type === 'shopping') {
        const change = {
          eventId: event.id,
          playerId: event.personalFor?.[0] || 'group',
          itemName: event.metadata?.item_name,
          quantity: event.metadata?.quantity || 1,
          cost: event.metadata?.gold_value || 0,
          type: event.type === 'transaction' ? 'purchase' : 'acquired',
          timestamp: event.timestamp
        };

        if (change.itemName) {
          inventoryChanges.push(change);
        }
      }
    });

    return inventoryChanges;
  }

  /**
   * Update player list for entity recognition
   */
  updatePlayers(players) {
    this.players = players;
    this.log('info', `Updated player list: ${players.length} players`);
  }

  /**
   * Real-time event streaming for ongoing sessions
   */
  async streamEvents(transcriptStream) {
    transcriptStream.on('data', async (segment) => {
      try {
        const events = await this.extractEventsFromSegment(segment, segment.sessionId);
        const taggedEvents = this.tagPersonalEvents(events);

        this.emit('realtimeEvents', {
          events: taggedEvents,
          timestamp: new Date()
        });
      } catch (error) {
        this.handleError(error);
      }
    });
  }
}
