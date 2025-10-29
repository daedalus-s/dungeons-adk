import { BaseAgent } from './base-agent.js';
import axios from 'axios';

/**
 * GroupMeAgent - Sends DM-style summaries to group chat and personal DMs
 */
export class GroupMeAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'groupme-agent',
      name: 'GroupMe Agent',
      role: 'messaging',
      ...config
    });

    this.accessToken = config.groupmeAccessToken;
    this.botId = config.groupmeBotId;
    this.groupId = config.groupmeGroupId;
    this.apiBase = 'https://api.groupme.com/v3';
  }

  /**
   * Main execution: send epic session summaries
   */
  async execute(input) {
    const { sessionId, groupSummary, playerSummaries, appDeepLink } = input;

    this.setState('running', { sessionId });
    this.log('info', `Sending epic summaries for session ${sessionId}`);

    try {
      const results = {
        groupMessage: null,
        personalMessages: [],
        errors: []
      };

      // Send group summary
      if (groupSummary) {
        try {
          results.groupMessage = await this.sendGroupMessage(groupSummary, appDeepLink);
          this.log('info', 'Group message sent successfully');
        } catch (error) {
          this.log('error', 'Failed to send group message', error);
          results.errors.push({ type: 'group', error: error.message });
        }
      }

      // Send personal DMs
      if (playerSummaries && playerSummaries.length > 0) {
        for (const playerSummary of playerSummaries) {
          try {
            const result = await this.sendPersonalDM(playerSummary);
            results.personalMessages.push(result);
            
            if (result.status === 'delivered') {
              this.log('info', `Personal message sent to player ${playerSummary.player_id}`);
            } else {
              this.log('warn', `Personal message skipped for player ${playerSummary.player_id}: ${result.reason}`);
            }
          } catch (error) {
            this.log('error', `Failed to send DM to player ${playerSummary.player_id}`, error);
            results.errors.push({ 
              type: 'personal', 
              playerId: playerSummary.player_id, 
              error: error.message 
            });
          }
        }
      }

      this.setState('completed', {
        groupSent: !!results.groupMessage,
        personalSent: results.personalMessages.filter(m => m.status === 'delivered').length,
        errors: results.errors.length
      });

      this.emit('messagesDelivered', results);
      return results;

    } catch (error) {
      this.handleError(error, { sessionId });
      throw error;
    }
  }

  /**
   * Send epic group message via bot
   */
  async sendGroupMessage(groupSummary, appDeepLink) {
    const messageText = this.formatGroupMessage(groupSummary, appDeepLink);

    const response = await axios.post(
      `${this.apiBase}/bots/post`,
      {
        bot_id: this.botId,
        text: messageText
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.status === 202) {
      return {
        message_id: response.data.message?.id || 'sent',
        status: 'delivered',
        timestamp: new Date(),
        preview: messageText.substring(0, 100) + '...'
      };
    }

    throw new Error(`GroupMe API error: ${response.status}`);
  }

  /**
   * Format epic group message with DM flair
   */
  formatGroupMessage(groupSummary, appDeepLink) {
    let message = `🎲✨ SESSION RECAP ✨🎲\n\n`;
    
    // Epic TL;DR
    message += `📜 ${groupSummary.tldr}\n\n`;
    
    // Main narrative
    message += `═══════════════════════════\n`;
    message += `📖 THE TALE UNFOLDS\n`;
    message += `═══════════════════════════\n\n`;
    
    // Split message text into paragraphs for better formatting
    const paragraphs = groupSummary.message_text.split('\n\n');
    message += paragraphs.slice(0, 2).join('\n\n') + '\n\n';
    
    // Key events with dramatic icons
    if (groupSummary.key_events?.length > 0) {
      message += `⚔️ EPIC MOMENTS:\n`;
      groupSummary.key_events.slice(0, 4).forEach(event => {
        message += `  ⚡ ${event}\n`;
      });
      message += `\n`;
    }

    // Loot with treasure icons
    if (groupSummary.top_loot?.length > 0) {
      message += `💰 SPOILS OF VICTORY:\n`;
      groupSummary.top_loot.slice(0, 5).forEach(item => {
        message += `  💎 ${item}\n`;
      });
      message += `\n`;
    }

    // Decisions with consequence hints
    if (groupSummary.decisions?.length > 0) {
      message += `🔮 PIVOTAL CHOICES:\n`;
      groupSummary.decisions.slice(0, 3).forEach(decision => {
        message += `  🎯 ${decision}\n`;
      });
      message += `\n`;
    }

    // Memorable moments
    if (groupSummary.highlights?.length > 0) {
      message += `✨ LEGENDARY MOMENTS:\n`;
      groupSummary.highlights.slice(0, 3).forEach(highlight => {
        message += `  🌟 ${highlight}\n`;
      });
      message += `\n`;
    }

    // Cliffhanger
    if (groupSummary.cliffhanger) {
      message += `═══════════════════════════\n`;
      message += `🌙 WHAT LIES AHEAD...\n`;
      message += `${groupSummary.cliffhanger}\n`;
      message += `═══════════════════════════\n\n`;
    }

    // Footer
    message += `🎲 Roll on, brave adventurers! Until next we meet!\n`;
    
    if (appDeepLink) {
      message += `\n📱 Full session details: ${appDeepLink}`;
    }

    return message;
  }

  /**
   * Send heroic personal DM to a player
   */
  async sendPersonalDM(playerSummary) {
    try {
      const userId = await this.getUserIdForPlayer(playerSummary.player_id);

      if (!userId) {
        this.log('warn', `No GroupMe user ID for player ${playerSummary.player_id}`);
        return {
          player_id: playerSummary.player_id,
          status: 'skipped',
          reason: 'no_user_id',
          hint: 'Player needs to link their GroupMe account'
        };
      }

      const messageText = this.formatPersonalMessage(playerSummary);

      const response = await axios.post(
        `${this.apiBase}/direct_messages`,
        {
          direct_message: {
            source_guid: `${Date.now()}-${playerSummary.player_id}`,
            recipient_id: userId,
            text: messageText
          }
        },
        {
          headers: {
            'X-Access-Token': this.accessToken,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status === 201) {
        return {
          player_id: playerSummary.player_id,
          message_id: response.data.message.id,
          status: 'delivered',
          timestamp: new Date(),
          preview: messageText.substring(0, 100) + '...'
        };
      }

    } catch (error) {
      this.log('error', `Failed to send DM to player ${playerSummary.player_id}`, error);
      return {
        player_id: playerSummary.player_id,
        status: 'failed',
        error: error.message
      };
    }
  }

  /**
   * Format heroic personal message
   */
  formatPersonalMessage(playerSummary) {
    let message = `🗡️ YOUR PERSONAL SESSION RECAP 🛡️\n\n`;
    
    // Main narrative
    message += playerSummary.message_text + `\n\n`;

    // Accomplishments with heroic flair
    if (playerSummary.accomplishments?.length > 0) {
      message += `⚔️ YOUR VALOROUS DEEDS:\n`;
      playerSummary.accomplishments.forEach(deed => {
        message += `  🏆 ${deed}\n`;
      });
      message += `\n`;
    }

    // Stat changes with growth emphasis
    if (playerSummary.stat_changes?.length > 0) {
      message += `📊 CHARACTER GROWTH:\n`;
      playerSummary.stat_changes.forEach(change => {
        message += `  ⬆️ ${change.stat}: ${change.change}`;
        if (change.description) {
          message += ` (${change.description})`;
        }
        message += `\n`;
      });
      message += `\n`;
    }

    // Loot with treasure emphasis
    if (playerSummary.loot?.length > 0) {
      message += `💰 YOUR HARD-EARNED SPOILS:\n`;
      playerSummary.loot.forEach(item => {
        message += `  💎 ${item}\n`;
      });
      message += `\n`;
    }

    // Special notes
    if (playerSummary.notes?.length > 0) {
      message += `📝 DEEDS OF NOTE:\n`;
      playerSummary.notes.forEach(note => {
        message += `  ⭐ ${note}\n`;
      });
      message += `\n`;
    }

    message += `🎲 May the dice favor you in sessions to come!`;

    return message;
  }

  /**
   * Get GroupMe user ID for a player
   */
  async getUserIdForPlayer(playerId) {
    const mapping = this.getContext('groupme-user-mappings') || {};
    return mapping[playerId] || null;
  }

  /**
   * Link player to GroupMe user
   */
  async linkPlayerToGroupMe(playerId, groupmeUserId) {
    const mappings = this.getContext('groupme-user-mappings') || {};
    mappings[playerId] = groupmeUserId;
    this.setContext('groupme-user-mappings', mappings);

    this.emit('playerLinked', { playerId, groupmeUserId });
    this.log('info', `Linked player ${playerId} to GroupMe user ${groupmeUserId}`);
    return true;
  }

  /**
   * Get group members for linking UI
   */
  async getGroupMembers() {
    try {
      const response = await axios.get(
        `${this.apiBase}/groups/${this.groupId}`,
        {
          headers: {
            'X-Access-Token': this.accessToken
          }
        }
      );

      return response.data.response.members.map(member => ({
        id: member.user_id,
        name: member.name,
        nickname: member.nickname,
        avatar_url: member.image_url
      }));

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Test bot connection with epic greeting
   */
  async testBotConnection() {
    try {
      const response = await axios.post(
        `${this.apiBase}/bots/post`,
        {
          bot_id: this.botId,
          text: '🎲 Hark! The D&D Session Manager awakens! Greetings, brave adventurers! 🗡️'
        }
      );

      return response.status === 202;
    } catch (error) {
      this.log('error', 'Bot connection test failed', error);
      return false;
    }
  }

  /**
   * Preview message formatting (for approval screen)
   */
  previewGroupMessage(groupSummary) {
    return this.formatGroupMessage(groupSummary, null);
  }

  /**
   * Preview personal message formatting
   */
  previewPersonalMessage(playerSummary) {
    return this.formatPersonalMessage(playerSummary);
  }
}