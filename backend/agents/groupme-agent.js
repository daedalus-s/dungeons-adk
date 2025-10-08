import { BaseAgent } from './base-agent.js';
import axios from 'axios';

/**
 * GroupMeAgent - Sends group summaries and personal DMs
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
   * Main execution: send session summaries
   */
  async execute(input) {
    const { sessionId, groupSummary, playerSummaries, appDeepLink } = input;

    this.setState('running', { sessionId });
    this.log('info', `Sending summaries for session ${sessionId}`);

    try {
      const results = {
        groupMessage: null,
        personalMessages: []
      };

      // Send group summary
      if (groupSummary) {
        results.groupMessage = await this.sendGroupMessage(groupSummary, appDeepLink);
      }

      // Send personal DMs
      if (playerSummaries && playerSummaries.length > 0) {
        for (const playerSummary of playerSummaries) {
          const result = await this.sendPersonalDM(playerSummary);
          results.personalMessages.push(result);
        }
      }

      this.setState('completed', {
        groupSent: !!results.groupMessage,
        personalSent: results.personalMessages.length
      });

      this.emit('messagesDelivered', results);
      return results;

    } catch (error) {
      this.handleError(error, { sessionId });
      throw error;
    }
  }

  /**
   * Send group message via bot
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
      this.log('info', 'Group message sent successfully');
      return {
        message_id: response.data.message?.id || 'sent',
        status: 'delivered',
        timestamp: new Date()
      };
    }

    throw new Error(`GroupMe API error: ${response.status}`);
  }

  /**
   * Format group message
   */
  formatGroupMessage(groupSummary, appDeepLink) {
    let message = `🎲 D&D Session Summary 🎲\n\n`;
    message += `${groupSummary.tldr}\n\n`;
    message += `📜 Key Events:\n`;
    groupSummary.key_events?.forEach(event => {
      message += `• ${event}\n`;
    });

    if (groupSummary.top_loot?.length > 0) {
      message += `\n💰 Loot Acquired:\n`;
      groupSummary.top_loot.forEach(item => {
        message += `• ${item}\n`;
      });
    }

    if (groupSummary.decisions?.length > 0) {
      message += `\n⚔️ Major Decisions:\n`;
      groupSummary.decisions.forEach(decision => {
        message += `• ${decision}\n`;
      });
    }

    if (groupSummary.highlights?.length > 0) {
      message += `\n✨ Memorable Moments:\n`;
      groupSummary.highlights.forEach(highlight => {
        message += `• ${highlight}\n`;
      });
    }

    if (appDeepLink) {
      message += `\n📱 View full details: ${appDeepLink}`;
    }

    return message;
  }

  /**
   * Send personal DM to a player
   * Note: GroupMe requires user ID for DMs, may need user linking
   */
  async sendPersonalDM(playerSummary) {
    try {
      // Get user ID from GroupMe (requires linking)
      const userId = await this.getUserIdForPlayer(playerSummary.player_id);

      if (!userId) {
        this.log('warn', `No GroupMe user ID for player ${playerSummary.player_id}`);
        return {
          player_id: playerSummary.player_id,
          status: 'skipped',
          reason: 'no_user_id'
        };
      }

      const messageText = this.formatPersonalMessage(playerSummary);

      // Create direct message
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
          timestamp: new Date()
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
   * Format personal message
   */
  formatPersonalMessage(playerSummary) {
    let message = `🎲 Your D&D Session Summary\n\n`;
    message += playerSummary.message_text + `\n\n`;

    if (playerSummary.stat_changes?.length > 0) {
      message += `📊 Stat Changes:\n`;
      playerSummary.stat_changes.forEach(change => {
        message += `• ${change.stat}: ${change.change}\n`;
      });
      message += `\n`;
    }

    if (playerSummary.loot?.length > 0) {
      message += `🎒 Your Loot:\n`;
      playerSummary.loot.forEach(item => {
        message += `• ${item}\n`;
      });
      message += `\n`;
    }

    if (playerSummary.notes?.length > 0) {
      message += `📝 Notes:\n`;
      playerSummary.notes.forEach(note => {
        message += `• ${note}\n`;
      });
    }

    return message;
  }

  /**
   * Get GroupMe user ID for a player
   * This requires a mapping between app user IDs and GroupMe user IDs
   */
  async getUserIdForPlayer(playerId) {
    // This would query your database for the mapping
    // For now, return null (implementation needed)
    // You'd store this mapping when users link their GroupMe account in the app

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
    return true;
  }

  /**
   * Get group members (for linking UI)
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
        nickname: member.nickname
      }));

    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }

  /**
   * Test bot connection
   */
  async testBotConnection() {
    try {
      const response = await axios.post(
        `${this.apiBase}/bots/post`,
        {
          bot_id: this.botId,
          text: '🤖 D&D Session Manager is connected and ready!'
        }
      );

      return response.status === 202;
    } catch (error) {
      this.log('error', 'Bot connection test failed', error);
      return false;
    }
  }
}
