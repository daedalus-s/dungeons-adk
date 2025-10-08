import { BaseAgent } from './base-agent.js';
import mongoose from 'mongoose';

/**
 * StateManagerAgent - Durable session state and data persistence
 */
export class StateManagerAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'state-manager-agent',
      name: 'State Manager Agent',
      role: 'state-persistence',
      ...config
    });

    this.initializeDatabase(config.mongoUri || process.env.MONGODB_URI);
    this.defineSchemas();
  }

  /**
   * Initialize MongoDB connection
   */
  async initializeDatabase(uri) {
    try {
      await mongoose.connect(uri);
      console.log('Connected to MongoDB');
    } catch (error) {
      console.error('MongoDB connection error:', error);
    }
  }

  /**
   * Define Mongoose schemas
   */
  defineSchemas() {
    // Session Schema
    const sessionSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      start_ts: Date,
      end_ts: Date,
      status: { type: String, enum: ['recording', 'processing', 'completed', 'failed'] },
      audio_locations: [String],
      transcripts: [mongoose.Schema.Types.Mixed],
      event_list: [mongoose.Schema.Types.Mixed],
      per_player_events: mongoose.Schema.Types.Mixed,
      summaries: mongoose.Schema.Types.Mixed,
      summary_sent: { type: Boolean, default: false },
      metadata: mongoose.Schema.Types.Mixed
    }, { timestamps: true });

    // Player Schema
    const playerSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      real_name: String,
      in_game_name: String,
      race: String,
      role_type: String,
      level: Number,
      date_joined: Date,
      persona_image_id: String,
      persona_data: mongoose.Schema.Types.Mixed,
      stat_sheet_data: mongoose.Schema.Types.Mixed,
      inventory: [mongoose.Schema.Types.Mixed],
      group: { type: String, enum: ['Paul', 'Jonathan'] },
      groupme_user_id: String
    }, { timestamps: true });

    // Write Request Schema
    const writeRequestSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      target_sheet: String,
      payload: mongoose.Schema.Types.Mixed,
      created_by: String,
      created_ts: Date,
      approved_by_dm: String,
      approval_ts: Date,
      status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      rejection_reason: String
    }, { timestamps: true });

    // Approval Schema
    const approvalSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      request_id: String,
      dm_id: String,
      decision: { type: String, enum: ['approve', 'reject'] },
      comment: String,
      ts: Date
    }, { timestamps: true });

    // Event Queue Schema (for retries and async processing)
    const eventQueueSchema = new mongoose.Schema({
      id: { type: String, required: true, unique: true },
      event_type: String,
      payload: mongoose.Schema.Types.Mixed,
      status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'] },
      retry_count: { type: Number, default: 0 },
      max_retries: { type: Number, default: 3 },
      error_message: String,
      scheduled_at: Date,
      processed_at: Date
    }, { timestamps: true });

    // Create models
    this.Session = mongoose.model('Session', sessionSchema);
    this.Player = mongoose.model('Player', playerSchema);
    this.WriteRequest = mongoose.model('WriteRequest', writeRequestSchema);
    this.Approval = mongoose.model('Approval', approvalSchema);
    this.EventQueue = mongoose.model('EventQueue', eventQueueSchema);
  }

  /**
   * Main execution: state operations
   */
  async execute(input) {
    const { operation, ...data } = input;

    switch (operation) {
      case 'save-session':
        return await this.saveSession(data);
      case 'get-session':
        return await this.getSession(data.sessionId);
      case 'update-session':
        return await this.updateSession(data.sessionId, data.updates);
      case 'save-player':
        return await this.savePlayer(data);
      case 'get-player':
        return await this.getPlayer(data.playerId);
      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  }

  /**
   * Save or update session
   */
  async saveSession(sessionData) {
    try {
      const session = await this.Session.findOneAndUpdate(
        { id: sessionData.id },
        sessionData,
        { upsert: true, new: true }
      );

      this.log('info', `Session saved: ${sessionData.id}`);
      return session;
    } catch (error) {
      this.handleError(error, { sessionId: sessionData.id });
      throw error;
    }
  }

  /**
   * Get session
   */
  async getSession(sessionId) {
    try {
      const session = await this.Session.findOne({ id: sessionId });
      if (!session) {
        throw new Error(`Session not found: ${sessionId}`);
      }
      return session;
    } catch (error) {
      this.handleError(error, { sessionId });
      throw error;
    }
  }

  /**
   * Update session
   */
  async updateSession(sessionId, updates) {
    try {
      const session = await this.Session.findOneAndUpdate(
        { id: sessionId },
        { $set: updates },
        { new: true }
      );

      this.log('info', `Session updated: ${sessionId}`);
      this.emit('sessionUpdated', { sessionId, updates });
      return session;
    } catch (error) {
      this.handleError(error, { sessionId });
      throw error;
    }
  }

  /**
   * Save or update player
   */
  async savePlayer(playerData) {
    try {
      const player = await this.Player.findOneAndUpdate(
        { id: playerData.id },
        playerData,
        { upsert: true, new: true }
      );

      this.log('info', `Player saved: ${playerData.id}`);
      return player;
    } catch (error) {
      this.handleError(error, { playerId: playerData.id });
      throw error;
    }
  }

  /**
   * Get player
   */
  async getPlayer(playerId) {
    try {
      const player = await this.Player.findOne({ id: playerId });
      if (!player) {
        throw new Error(`Player not found: ${playerId}`);
      }
      return player;
    } catch (error) {
      this.handleError(error, { playerId });
      throw error;
    }
  }

  /**
   * Get all players
   */
  async getAllPlayers() {
    return await this.Player.find({});
  }

  /**
   * Save write request
   */
  async saveWriteRequest(writeRequestData) {
    try {
      const writeRequest = new this.WriteRequest(writeRequestData);
      await writeRequest.save();

      this.log('info', `Write request saved: ${writeRequestData.id}`);
      this.emit('writeRequestSaved', writeRequestData);
      return writeRequest;
    } catch (error) {
      this.handleError(error, { requestId: writeRequestData.id });
      throw error;
    }
  }

  /**
   * Get pending write requests
   */
  async getPendingWriteRequests() {
    return await this.WriteRequest.find({ status: 'pending' }).sort({ created_ts: 1 });
  }

  /**
   * Save approval
   */
  async saveApproval(approvalData) {
    try {
      const approval = new this.Approval(approvalData);
      await approval.save();

      // Update write request
      await this.WriteRequest.findOneAndUpdate(
        { id: approvalData.request_id },
        {
          status: approvalData.decision === 'approve' ? 'approved' : 'rejected',
          approved_by_dm: approvalData.dm_id,
          approval_ts: approvalData.ts,
          rejection_reason: approvalData.comment
        }
      );

      this.log('info', `Approval saved: ${approvalData.id}`);
      this.emit('approvalSaved', approvalData);
      return approval;
    } catch (error) {
      this.handleError(error, { approvalId: approvalData.id });
      throw error;
    }
  }

  /**
   * Queue event for async processing
   */
  async queueEvent(eventType, payload, scheduledAt = new Date()) {
    const event = new this.EventQueue({
      id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      event_type: eventType,
      payload,
      status: 'pending',
      scheduled_at: scheduledAt
    });

    await event.save();
    this.emit('eventQueued', event);
    return event;
  }

  /**
   * Process queued events
   */
  async processQueuedEvents() {
    const events = await this.EventQueue.find({
      status: 'pending',
      scheduled_at: { $lte: new Date() },
      retry_count: { $lt: mongoose.Schema.Types.Mixed.max_retries }
    }).limit(10);

    for (const event of events) {
      try {
        await this.EventQueue.findByIdAndUpdate(event._id, {
          status: 'processing'
        });

        // Emit for external processing
        this.emit('processEvent', event);

      } catch (error) {
        await this.EventQueue.findByIdAndUpdate(event._id, {
          status: 'failed',
          error_message: error.message,
          retry_count: event.retry_count + 1
        });
      }
    }
  }

  /**
   * Mark event as completed
   */
  async completeEvent(eventId) {
    await this.EventQueue.findOneAndUpdate(
      { id: eventId },
      { status: 'completed', processed_at: new Date() }
    );
  }

  /**
   * Get session statistics
   */
  async getSessionStats() {
    const totalSessions = await this.Session.countDocuments();
    const completedSessions = await this.Session.countDocuments({ status: 'completed' });
    const totalPlayers = await this.Player.countDocuments();
    const pendingApprovals = await this.WriteRequest.countDocuments({ status: 'pending' });

    return {
      totalSessions,
      completedSessions,
      totalPlayers,
      pendingApprovals
    };
  }
}
