import { BaseAgent } from './base-agent.js';

/**
 * SummarizerAgent - Creates group summaries, personal summaries, and sheets data
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
   * Main execution: generate all summaries
   */
  async execute(input) {
    const { sessionId, events, transcripts, players } = input;

    this.setState('running', { sessionId });
    this.log('info', `Generating summaries for session ${sessionId}`);

    try {
      // Generate group summary
      const groupSummary = await this.generateGroupSummary(events, transcripts);

      // Generate per-player summaries
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
   * Generate group summary with key events and TL;DR
   */
  async generateGroupSummary(events, transcripts) {
    const prompt = this.buildGroupSummaryPrompt(events, transcripts);

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 3000,
      temperature: 0.5
    });

    const summary = this.parseClaudeResponse(response.content[0].text);

    return {
      message_text: summary.message_text,
      tldr: summary.tldr,
      key_events: summary.key_events || [],
      top_loot: summary.top_loot || [],
      decisions: summary.decisions || [],
      highlights: summary.highlights || []
    };
  }

  /**
   * Build group summary prompt
   */
  buildGroupSummaryPrompt(events, transcripts) {
    const eventsSummary = this.categorizeEvents(events);

    return `You are summarizing a D&D game session for the entire party. Create an engaging group summary.

Session Events (${events.length} total):
Combat Events: ${eventsSummary.combat.length}
${eventsSummary.combat.slice(0, 5).map(e => `- ${e.action} (${e.actor})`).join('\n')}

Loot & Rewards: ${eventsSummary.loot.length}
${eventsSummary.loot.slice(0, 5).map(e => `- ${e.metadata?.item_name || e.action} (${e.metadata?.gold_value || 0} gp)`).join('\n')}

Key Decisions: ${eventsSummary.decision.length}
${eventsSummary.decision.map(e => `- ${e.action}`).join('\n')}

Exploration: ${eventsSummary.exploration.length}
${eventsSummary.exploration.map(e => `- ${e.action}`).join('\n')}

Create a summary with:
1. A catchy TL;DR (1-2 sentences)
2. Key story beats (3-5 bullet points)
3. Top loot/rewards
4. Major decisions made
5. Memorable moments/highlights

Return JSON:
{
  "message_text": "Full summary for GroupMe (engaging, 3-4 paragraphs)",
  "tldr": "One-sentence hook",
  "key_events": ["event 1", "event 2", ...],
  "top_loot": ["item (value)", ...],
  "decisions": ["decision 1", ...],
  "highlights": ["memorable moment 1", ...]
}`;
  }

  /**
   * Generate personalized summaries for each player
   */
  async generatePlayerSummaries(events, players) {
    const summaries = [];

    for (const player of players) {
      const playerEvents = events.filter(e =>
        e.personalFor?.includes(player.id)
      );

      if (playerEvents.length === 0) {
        // Player was inactive or observing
        summaries.push({
          player_id: player.id,
          message_text: `Hey ${player.real_name}! You were part of this session, but no specific events were tagged to ${player.in_game_name} this time. Check the group summary for the full story!`,
          stat_changes: [],
          loot: [],
          notes: []
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
   * Generate summary for a single player
   */
  async generateSinglePlayerSummary(player, events) {
    const prompt = `Create a personalized D&D session summary for ${player.in_game_name} (played by ${player.real_name}).

Their events:
${events.map(e => `- ${e.type}: ${e.action} ${e.metadata ? JSON.stringify(e.metadata) : ''}`).join('\n')}

Create a personalized message including:
- What ${player.in_game_name} accomplished
- Items acquired/used
- Stat changes (XP, HP, etc.)
- Personal highlights

Return JSON:
{
  "message_text": "Personal summary for DM (2-3 paragraphs, enthusiastic tone)",
  "stat_changes": [{"stat": "XP", "change": "+500"}],
  "loot": ["item name (value)"],
  "notes": ["special note 1", ...]
}`;

    const response = await this.callClaude([
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 2000,
      temperature: 0.6
    });

    return this.parseClaudeResponse(response.content[0].text);
  }

  /**
   * Generate Google Sheets row data
   */
  async generateSheetsData(events, players) {
    const date = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
    const sessionId = Math.random().toString(36).substring(7);

    const rows = [];

    // Default group if no players
    const defaultGroup = players[0]?.group || 'Unknown';

    // Group loot/transactions by item
    const itemMap = new Map();

    events.forEach(event => {
      // Handle loot events
      if (event.type === 'loot') {
        // Try to get item name from metadata or action
        let itemName = event.metadata?.item_name || event.metadata?.items?.[0]?.item;
        
        // If no item_name in metadata, try to extract from action
        if (!itemName && event.action) {
          // Look for patterns like "finds X" or "discovers X"
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
      
      // Handle transaction events (buying/selling)
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
      
      // Handle combat events with valuable drops
      if (event.type === 'combat' && event.metadata?.damage) {
        // Create a combat summary row
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

    // Convert itemMap to rows
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

    // If no rows generated but we have events, create summary row
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
      other: []
    };

    events.forEach(event => {
      const category = event.type in categorized ? event.type : 'other';
      categorized[category].push(event);
    });

    return categorized;
  }

  /**
   * Get player's group (Paul's or Jonathan's)
   */
  getPlayerGroup(playerId, players) {
    const player = players.find(p => p.id === playerId);
    // This would be stored in player metadata
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
