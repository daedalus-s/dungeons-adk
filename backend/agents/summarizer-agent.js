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

    // Group loot/transactions by item
    const itemMap = new Map();

    events.forEach(event => {
      if (event.type === 'loot' || event.type === 'transaction') {
        const itemName = event.metadata?.item_name;
        if (!itemName) return;

        const key = `${itemName}-${event.personalFor?.[0] || 'group'}`;

        if (itemMap.has(key)) {
          const existing = itemMap.get(key);
          existing.quantity += event.metadata?.quantity || 1;
          existing.totalValue += event.metadata?.gold_value || 0;
        } else {
          itemMap.set(key, {
            group: event.personalFor?.length === 1
              ? this.getPlayerGroup(event.personalFor[0], players)
              : 'Unknown',
            quantity: event.metadata?.quantity || 1,
            item: itemName,
            goldValue: event.metadata?.gold_value || 0,
            totalValue: (event.metadata?.quantity || 1) * (event.metadata?.gold_value || 0),
            distributedTo: event.personalFor?.map(id =>
              players.find(p => p.id === id)?.in_game_name
            ).join(', ') || 'Party',
            soldTo: event.type === 'transaction' ? event.actor : '',
            player: event.personalFor?.[0] || '',
            character: event.actor || ''
          });
        }
      }
    });

    // Convert to rows
    itemMap.forEach(item => {
      rows.push({
        Group: item.group,
        Quantity: item.quantity,
        Item: item.item,
        'Gold Value': item.goldValue,
        'Total Value': item.totalValue,
        'Distributed To': item.distributedTo,
        'Sold To': item.soldTo,
        'Lesson Learns': '', // DM fills this in
        Player: item.player,
        Character: item.character,
        'Group (Paul\'s group or Jonathan\'s group)': item.group
      });
    });

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
