import { EventEmitter } from 'events';
import { StateManagerAgent } from './state-manager-agent.js';
import { EventExtractionAgent } from './event-extraction-agent.js';
import { SummarizerAgent } from './summarizer-agent.js';
import { GoogleSheetsAgent } from './sheets-agent.js';
import { TranscriptionAgent } from './transcription-agent.js';

/**
 * AgentOrchestrator - Central coordinator for multi-agent workflows
 */
export class AgentOrchestrator extends EventEmitter {
  constructor(config = {}) {
    super();

    this.agents = new Map();
    this.initializeAgents(config);
  }

  /**
   * Initialize all agents
   */
  initializeAgents(config) {
    const agentConfig = {
      anthropicApiKey: config.anthropicApiKey || process.env.ANTHROPIC_API_KEY,
      mongoUri: config.mongoUri || process.env.MONGODB_URI,
      googleCredentials: config.googleCredentials || process.env.GOOGLE_APPLICATION_CREDENTIALS,
      sheetsId: config.sheetsId || process.env.GOOGLE_SHEETS_ID
    };

    // Initialize agents
    this.agents.set('state-manager', new StateManagerAgent(agentConfig));
    this.agents.set('event-extraction', new EventExtractionAgent(agentConfig));
    this.agents.set('summarizer', new SummarizerAgent(agentConfig));
    this.agents.set('transcription', new TranscriptionAgent(agentConfig));
    
    // Only initialize sheets agent if credentials are available
    if (agentConfig.googleCredentials && agentConfig.sheetsId) {
      this.agents.set('sheets', new GoogleSheetsAgent(agentConfig));
    }

    // Set up event listeners
    this.agents.forEach((agent, name) => {
      agent.on('log', (log) => this.emit('agentLog', { agent: name, ...log }));
      agent.on('error', (error) => this.emit('agentError', { agent: name, ...error }));
      agent.on('stateChange', (state) => this.emit('agentStateChange', { agent: name, ...state }));
    });

    console.log(`âœ… Orchestrator: Initialized ${this.agents.size} agents`);
  }

  /**
   * Execute single agent
   */
  async executeAgent(agentName, input) {
    const agent = this.agents.get(agentName);
    if (!agent) {
      throw new Error(`Agent not found: ${agentName}`);
    }

    console.log(`Executing agent: ${agentName}`);
    const result = await agent.execute(input);
    return result;
  }

  /**
   * Get agent
   */
  getAgent(name) {
    return this.agents.get(name);
  }

  /**
   * Simple session processing workflow
   */
  async processSessionEnd(sessionId, transcript, players) {
    console.log(`\nðŸ“Š Processing session: ${sessionId}\n`);

    // Step 1: Extract events
    console.log('Step 1: Extracting events...');
    const eventData = await this.executeAgent('event-extraction', {
      transcript,
      sessionId,
      chunkIndex: 0
    });
    console.log(`âœ… Extracted ${eventData.events.length} events`);

    // Step 2: Generate summaries
    console.log('\nStep 2: Generating summaries...');
    const summaries = await this.executeAgent('summarizer', {
      sessionId,
      events: eventData.events,
      players
    });
    console.log('âœ… Summaries generated');

    // Step 3: Save to database
    console.log('\nStep 3: Saving to database...');
    const stateManager = this.getAgent('state-manager');
    await stateManager.updateSession(sessionId, {
      event_list: eventData.events,
      summaries: summaries,
      status: 'completed',
      end_ts: new Date()
    });
    console.log('âœ… Session updated');

    // Step 4: Create write request for sheets (if sheets agent exists)
    const sheetsAgent = this.getAgent('sheets');
    if (sheetsAgent && summaries.sheetsData) {
      console.log('\nStep 4: Creating write request...');
      const writeRequest = await sheetsAgent.createWriteRequest(
        summaries.sheetsData.sheetName,
        summaries.sheetsData,
        sessionId
      );
      await stateManager.saveWriteRequest(writeRequest);
      console.log('âœ… Write request created (pending approval)');
    }

    return {
      sessionId,
      events: eventData.events,
      summaries
    };
  }

  /**
   * Health check for all agents
   */
  async healthCheck() {
    const status = {};

    for (const [name, agent] of this.agents.entries()) {
      status[name] = {
        state: agent.state,
        id: agent.id
      };
    }

    return status;
  }
}
