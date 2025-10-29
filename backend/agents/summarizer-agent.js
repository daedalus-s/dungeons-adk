import { BaseAgent } from './base-agent.js';

/**
 * SummarizerAgent - Creates DM-style narrative summaries for sessions
 * Enhanced with dramatic storytelling and immersive language
 */
export class SummarizerAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'summarizer-agent',
      name: 'Summarizer Agent',
      role: 'content-summarization',
      ...config
    });
  }

  /**
   * Main execution: generate all summaries with DM flair
   */
  async execute(input) {
    const { sessionId, events, transcripts, players } = input;

    this.setState('running', { sessionId });
    this.log('info', `Generating summaries for session ${sessionId}`);

    try {
      // Generate epic group summary with DM narration
      const groupSummary = await this.generateGroupSummary(events, transcripts);

      // Generate personalized player summaries
      const playerSummaries = await this.generatePlayerSummaries(events, players);

      // Generate Google Sheets row data
      const sheetsData = await this.generateSheetsData(events, players);

      const result = {
        sessionId,
        groupSummary,
        playerSummaries,
        sheetsData,
        timestamp: new Date()
      };

      this.setState('completed');
      this.emit('summariesReady', result);

      return result;

    } catch (error) {
      this.handleError(error, { sessionId });
      throw error;
    }
  }

  /**
   * Generate epic DM-style group summary
   */
  async generateGroupSummary(events, transcripts) {
    const prompt = this.buildGroupSummaryPrompt(events, transcripts);

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 4000,
      temperature: 0.7 // Higher temperature for more creative narration
    });

    const summary = this.parseClaudeResponse(response.content[0].text);

    return {
      message_text: summary.message_text,
      tldr: summary.tldr,
      key_events: summary.key_events || [],
      top_loot: summary.top_loot || [],
      decisions: summary.decisions || [],
      highlights: summary.highlights || [],
      cliffhanger: summary.cliffhanger || ''
    };
  }

  /**
   * Build DM-style narrative prompt
   */
  buildGroupSummaryPrompt(events, transcripts) {
    const eventsSummary = this.categorizeEvents(events);

    return `You are an experienced Dungeon Master narrating a recap of tonight's D&D session. Your tone should be:
- Dramatic and evocative, like a storyteller around a campfire
- Use vivid imagery and D&D terminology
- Celebratory of victories, respectful of challenges
- Create anticipation for the next session
- Use phrases like "The party," "Our heroes," "The brave adventurers"

Session Events (${events.length} total):
Combat Events: ${eventsSummary.combat.length}
${eventsSummary.combat.slice(0, 5).map(e => `- ${e.action} (${e.actor})`).join('\n')}

Loot & Rewards: ${eventsSummary.loot.length}
${eventsSummary.loot.slice(0, 5).map(e => `- ${e.metadata?.item_name || e.action} (${e.metadata?.gold_value || 0} gp)`).join('\n')}

Key Decisions: ${eventsSummary.decision.length}
${eventsSummary.decision.map(e => `- ${e.action}`).join('\n')}

Exploration: ${eventsSummary.exploration.length}
${eventsSummary.exploration.map(e => `- ${e.action}`).join('\n')}

Important Dialogue: ${eventsSummary.dialogue.length}
${eventsSummary.dialogue.slice(0, 3).map(e => `- ${e.action}`).join('\n')}

Create an immersive DM-style summary with:
1. **Epic Opening Hook** - A dramatic 1-2 sentence TL;DR that captures the session's essence
2. **The Tale Unfolds** - A 3-4 paragraph narrative that weaves together the key events like a story
3. **Spoils of Victory** - List treasure and rewards with flair
4. **Pivotal Moments** - Highlight critical decisions and their potential consequences
5. **Session Highlights** - The most memorable or hilarious moments
6. **Cliffhanger** - End with anticipation for next session

Writing style examples:
- Instead of "The party fought enemies": "Steel clashed against claw as our heroes stood united against the goblin horde"
- Instead of "They found gold": "Amidst the rubble, the glint of gold caught their eyes - 50 pieces, hard-earned spoils of their victory"
- Instead of "They decided to go north": "After much deliberation, the party chose the northern passage, unaware of what lurked in the shadows ahead"

Return JSON:
{
  "message_text": "Full DM-style narrative summary (4-6 paragraphs, dramatic and engaging)",
  "tldr": "Epic one-sentence hook with dramatic flair",
  "key_events": ["Dramatic event 1", "Dramatic event 2", ...],
  "top_loot": ["Treasure 1 with description", "Treasure 2 with description", ...],
  "decisions": ["Decision 1 with consequences hinted", ...],
  "highlights": ["Memorable moment 1 narrated dramatically", ...],
  "cliffhanger": "A teasing hint about what's to come next session"
}`;
  }

  /**
   * Generate personalized player summaries with heroic language
   */
  async generatePlayerSummaries(events, players) {
    const summaries = [];

    for (const player of players) {
      const playerEvents = events.filter(e =>
        e.personalFor?.includes(player.id)
      );

      if (playerEvents.length === 0) {
        summaries.push({
          player_id: player.id,
          message_text: `Greetings, ${player.real_name}! While ${player.in_game_name} witnessed the unfolding events alongside the party, no specific deeds were recorded in the annals for this session. Fear not, brave adventurer - your presence was felt, and greater glory awaits in sessions to come!`,
          stat_changes: [],
          loot: [],
          notes: [],
          accomplishments: []
        });
        continue;
      }

      const summary = await this.generateSinglePlayerSummary(player, playerEvents);
      summaries.push({
        player_id: player.id,
        ...summary
      });
    }

    return summaries;
  }

  /**
   * Generate epic personal summary for a single player
   */
  async generateSinglePlayerSummary(player, events) {
    const prompt = `You are a Dungeon Master writing a personal session recap for ${player.in_game_name} (played by ${player.real_name}). Write in second person ("You did...") with dramatic flair.

Character: ${player.in_game_name}
Race: ${player.race}
Class: ${player.role_type}
Level: ${player.level}

Their Epic Deeds This Session:
${events.map(e => `- ${e.type}: ${e.action} ${e.metadata ? JSON.stringify(e.metadata) : ''}`).join('\n')}

Create a personalized heroic narrative including:
1. **Opening Address** - "Hail, brave ${player.role_type}!" or similar
2. **Your Valor** - Their accomplishments told dramatically in 2-3 paragraphs
3. **Spoils Claimed** - Items/gold acquired with description
4. **Growth & Power** - Stat changes (XP, level ups, etc.)
5. **Deeds of Note** - Personal highlights and memorable moments
6. **The Road Ahead** - Teaser for their character's future

Use evocative language like:
- "Your blade sang through the air"
- "With cunning and wit, you unraveled the mystery"
- "The spoils of your victory include..."
- "Your legend grows, ${player.in_game_name}"

Return JSON:
{
  "message_text": "Personalized DM narration (3-4 paragraphs, heroic tone, second person)",
  "stat_changes": [{"stat": "Experience Points", "change": "+500", "description": "Hard-won through valorous combat"}],
  "loot": ["Item name (value) - brief dramatic description"],
  "notes": ["Special note about character moment 1", ...],
  "accomplishments": ["Defeated the goblin chieftain", "Discovered the hidden chamber", ...]
}`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 2500,
      temperature: 0.7
    });

    return this.parseClaudeResponse(response.content[0].text);
  }

  /**
   * Generate Google Sheets row data (unchanged)
   */
  async generateSheetsData(events, players) {
    const date = new Date().toISOString().split('T')[0];
    const sessionId = Math.random().toString(36).substring(7);

    const rows = [];
    const defaultGroup = players[0]?.group || 'Unknown';
    const itemMap = new Map();

    events.forEach(event => {
      if (event.type === 'loot') {
        let itemName = event.metadata?.item_name || event.metadata?.items?.[0]?.item;
        
        if (!itemName && event.action) {
          const match = event.action.match(/finds?\s+(.+?)(?:\s+and|\s*$)/i) ||
                       event.action.match(/discovers?\s+(.+?)(?:\s+and|\s*$)/i);
          if (match) {
            itemName = match[1].trim();
          }
        }
        
        if (!itemName) {
          itemName = 'Unspecified Loot';
        }

        const goldValue = event.metadata?.gold_value || 
                         event.metadata?.value || 
                         0;
        const quantity = event.metadata?.quantity || 1;
        
        const key = `${itemName}-${event.personalFor?.[0] || 'group'}`;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key);
          existing.quantity += quantity;
          existing.totalValue += goldValue * quantity;
        } else {
          const playerGroup = event.personalFor?.length === 1
            ? this.getPlayerGroup(event.personalFor[0], players)
            : defaultGroup;

          itemMap.set(key, {
            group: playerGroup,
            quantity: quantity,
            item: itemName,
            goldValue: goldValue,
            totalValue: goldValue * quantity,
            distributedTo: event.personalFor?.map(id =>
              players.find(p => p.id === id)?.in_game_name
            ).filter(Boolean).join(', ') || 'Party',
            soldTo: '',
            player: event.personalFor?.[0] || '',
            character: event.actor || '',
            lessonLearns: `From ${event.type} event`
          });
        }
      }
      
      if (event.type === 'transaction') {
        const itemName = event.metadata?.item_name || 'Transaction';
        const goldValue = event.metadata?.gold_value || event.metadata?.cost || 0;
        const quantity = event.metadata?.quantity || event.metadata?.amount || 1;
        
        const key = `${itemName}-transaction-${event.personalFor?.[0] || 'group'}`;
        
        const playerGroup = event.personalFor?.length === 1
          ? this.getPlayerGroup(event.personalFor[0], players)
          : defaultGroup;

        itemMap.set(key, {
          group: playerGroup,
          quantity: quantity,
          item: itemName,
          goldValue: goldValue,
          totalValue: goldValue * quantity,
          distributedTo: event.personalFor?.map(id =>
            players.find(p => p.id === id)?.in_game_name
          ).filter(Boolean).join(', ') || event.actor || 'Party',
          soldTo: event.action.includes('buy') ? event.entities?.[0] || 'Merchant' : '',
          player: event.personalFor?.[0] || '',
          character: event.actor || '',
          lessonLearns: event.action
        });
      }
      
      if (event.type === 'combat' && event.metadata?.damage) {
        rows.push({
          Group: defaultGroup,
          Quantity: 1,
          Item: `Combat: ${event.action}`,
          'Gold Value': 0,
          'Total Value': 0,
          'Distributed To': event.actor || 'Party',
          'Sold To': '',
          'Lesson Learns': `${event.metadata.damage} damage dealt`,
          Player: event.personalFor?.[0] || '',
          Character: event.actor || '',
          'Group (Paul\'s group or Jonathan\'s group)': defaultGroup
        });
      }
    });

    itemMap.forEach(item => {
      rows.push({
        Group: item.group,
        Quantity: item.quantity,
        Item: item.item,
        'Gold Value': item.goldValue,
        'Total Value': item.totalValue,
        'Distributed To': item.distributedTo,
        'Sold To': item.soldTo,
        'Lesson Learns': item.lessonLearns || '',
        Player: item.player,
        Character: item.character,
        'Group (Paul\'s group or Jonathan\'s group)': item.group
      });
    });

    if (rows.length === 0 && events.length > 0) {
      rows.push({
        Group: defaultGroup,
        Quantity: events.length,
        Item: 'Session Events',
        'Gold Value': 0,
        'Total Value': 0,
        'Distributed To': 'Party',
        'Sold To': '',
        'Lesson Learns': `${events.length} events recorded`,
        Player: '',
        Character: '',
        'Group (Paul\'s group or Jonathan\'s group)': defaultGroup
      });
    }

    return {
      sheetName: `${date} Gameplay - ${sessionId}`,
      rows
    };
  }

  /**
   * Categorize events by type
   */
  categorizeEvents(events) {
    const categorized = {
      combat: [],
      loot: [],
      decision: [],
      exploration: [],
      dialogue: [],
      transaction: [],
      levelup: [],
      skill_check: [],
      rest: [],
      shopping: [],
      other: []
    };

    events.forEach(event => {
      const category = event.type in categorized ? event.type : 'other';
      categorized[category].push(event);
    });

    return categorized;
  }

  /**
   * Get player's group
   */
  getPlayerGroup(playerId, players) {
    const player = players.find(p => p.id === playerId);
    return player?.group || 'Unknown';
  }

  /**
   * Parse Claude JSON response
   */
  parseClaudeResponse(text) {
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return {};
    } catch (error) {
      this.log('warn', 'Failed to parse response', { text, error: error.message });
      return {};
    }
  }
}