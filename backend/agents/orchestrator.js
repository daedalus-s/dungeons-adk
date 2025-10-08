import { EventEmitter } from 'events';
import { TranscriptionAgent } from './transcription-agent.js';
import { EventExtractionAgent } from './event-extraction-agent.js';
import { SummarizerAgent } from './summarizer-agent.js';
import { OCRAgent } from './ocr-agent.js';
import { PersonaAgent } from './persona-agent.js';
import { GoogleSheetsAgent } from './sheets-agent.js';
import { GroupMeAgent } from './groupme-agent.js';
import { StateManagerAgent } from './state-manager-agent.js';
import { GuardrailsAgent } from './guardrails-agent.js';
import dotenv from 'dotenv';

dotenv.config();

/**
 * AgentOrchestrator - Central coordinator for multi-agent workflows
 * Implements Google ADK-style agent orchestration patterns
 */
export class AgentOrchestrator extends EventEmitter {
  constructor() {
    super();

    this.agents = new Map();
    this.workflows = new Map();
    this.activeWorkflows = new Map();

    this.initializeAgents();
    this.defineWorkflows();
  }

  /**
   * Initialize all agents
   */
  initializeAgents() {
    const config = {
      anthropicApiKey: process.env.ANTHROPIC_API_KEY,
      googleCredentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      sheetsId: process.env.GOOGLE_SHEETS_ID,
      groupmeAccessToken: process.env.GROUPME_ACCESS_TOKEN,
      groupmeBotId: process.env.GROUPME_BOT_ID,
      groupmeGroupId: process.env.GROUPME_GROUP_ID,
      mcpTranscriptionServer: process.env.MCP_TRANSCRIPTION_SERVER,
      mcpVisionServer: process.env.MCP_VISION_SERVER,
      mcpOcrServer: process.env.MCP_OCR_SERVER
    };

    // Initialize each agent
    this.agents.set('transcription', new TranscriptionAgent(config));
    this.agents.set('event-extraction', new EventExtractionAgent(config));
    this.agents.set('summarizer', new SummarizerAgent(config));
    this.agents.set('ocr', new OCRAgent(config));
    this.agents.set('persona', new PersonaAgent(config));
    this.agents.set('sheets', new GoogleSheetsAgent(config));
    this.agents.set('groupme', new GroupMeAgent(config));
    this.agents.set('state-manager', new StateManagerAgent(config));
    this.agents.set('guardrails', new GuardrailsAgent(config));

    // Set up event listeners
    this.agents.forEach((agent, name) => {
      agent.on('log', (log) => this.emit('agentLog', { agent: name, ...log }));
      agent.on('error', (error) => this.emit('agentError', { agent: name, ...error }));
      agent.on('stateChange', (state) => this.emit('agentStateChange', { agent: name, ...state }));
    });

    console.log(`Initialized ${this.agents.size} agents`);
  }

  /**
   * Define multi-agent workflows
   */
  defineWorkflows() {
    // Session Processing Workflow
    this.workflows.set('session-processing', {
      name: 'Session Processing',
      steps: [
        { agent: 'transcription', parallel: false },
        { agent: 'event-extraction', parallel: false },
        { agent: 'summarizer', parallel: false },
        {
          parallel: true,
          agents: [
            { agent: 'sheets', requiresApproval: true },
            { agent: 'groupme', requiresApproval: false }
          ]
        }
      ]
    });

    // Character Setup Workflow
    this.workflows.set('character-setup', {
      name: 'Character Setup',
      steps: [
        {
          parallel: true,
          agents: [
            { agent: 'persona' },
            { agent: 'ocr' }
          ]
        },
        { agent: 'sheets', requiresApproval: true }
      ]
    });

    // Real-time Transcription Workflow
    this.workflows.set('realtime-transcription', {
      name: 'Real-time Transcription',
      streaming: true,
      steps: [
        { agent: 'transcription', streaming: true },
        { agent: 'event-extraction', streaming: true },
        { agent: 'guardrails', streaming: true }
      ]
    });
  }

  /**
   * Execute a workflow
   */
  async executeWorkflow(workflowName, input) {
    const workflow = this.workflows.get(workflowName);
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowName}`);
    }

    const workflowId = `${workflowName}-${Date.now()}`;
    this.activeWorkflows.set(workflowId, {
      name: workflowName,
      status: 'running',
      currentStep: 0,
      results: {},
      startTime: new Date()
    });

    console.log(`Starting workflow: ${workflow.name} (${workflowId})`);
    this.emit('workflowStarted', { workflowId, name: workflow.name });

    try {
      let context = { ...input };

      for (let i = 0; i < workflow.steps.length; i++) {
        const step = workflow.steps[i];
        this.updateWorkflowStatus(workflowId, { currentStep: i });

        if (step.parallel) {
          // Execute agents in parallel
          const results = await this.executeParallelStep(step.agents, context);
          context = { ...context, ...results };
        } else {
          // Execute single agent
          const result = await this.executeAgent(step.agent, context);
          context = { ...context, [step.agent]: result };
        }
      }

      this.updateWorkflowStatus(workflowId, {
        status: 'completed',
        results: context,
        endTime: new Date()
      });

      this.emit('workflowCompleted', { workflowId, results: context });
      return context;

    } catch (error) {
      this.updateWorkflowStatus(workflowId, {
        status: 'failed',
        error: error.message,
        endTime: new Date()
      });

      this.emit('workflowFailed', { workflowId, error });
      throw error;
    }
  }

  /**
   * Execute parallel step
   */
  async executeParallelStep(agentConfigs, context) {
    const promises = agentConfigs.map(async (config) => {
      const agentName = config.agent;
      const result = await this.executeAgent(agentName, context);
      return { [agentName]: result };
    });

    const results = await Promise.all(promises);
    return Object.assign({}, ...results);
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
   * Process session workflow
   */
  async processSession(sessionData) {
    const { sessionId, audioChunks, players } = sessionData;

    console.log(`Processing session ${sessionId} with ${audioChunks.length} chunks`);

    // Update event extraction agent with current players
    this.agents.get('event-extraction').updatePlayers(players);

    const allEvents = [];
    const allTranscripts = [];

    // Process each audio chunk
    for (let i = 0; i < audioChunks.length; i++) {
      const chunk = audioChunks[i];

      // Transcribe
      const transcript = await this.executeAgent('transcription', {
        audioUri: chunk.uri,
        sessionId,
        chunkIndex: i
      });

      allTranscripts.push(transcript);

      // Extract events
      const events = await this.executeAgent('event-extraction', {
        transcript,
        sessionId,
        chunkIndex: i
      });

      allEvents.push(...events.events);

      // Run guardrails
      await this.executeAgent('guardrails', {
        transcript,
        events: events.events
      });
    }

    // Generate summaries
    const summaries = await this.executeAgent('summarizer', {
      sessionId,
      events: allEvents,
      transcripts: allTranscripts,
      players
    });

    // Create write requests
    const stateManager = this.agents.get('state-manager');
    const sheetsAgent = this.agents.get('sheets');

    const writeRequests = [];

    // Gameplay log write request
    if (summaries.sheetsData) {
      const writeRequest = await sheetsAgent.createWriteRequest(
        summaries.sheetsData.sheetName,
        summaries.sheetsData,
        sessionId
      );
      writeRequests.push(writeRequest);
      await stateManager.saveWriteRequest(writeRequest);
    }

    // Return results (messaging happens after DM approval)
    return {
      sessionId,
      summaries,
      writeRequests,
      events: allEvents,
      transcripts: allTranscripts
    };
  }

  /**
   * Process approved write and send messages
   */
  async processApprovedWrite(writeRequest, approval) {
    // Execute write
    const writeResult = await this.executeAgent('sheets', {
      writeRequest,
      approval
    });

    // Fetch session data
    const stateManager = this.agents.get('state-manager');
    const sessionData = await stateManager.getSession(writeRequest.created_by);

    // Send messages
    const messagingResult = await this.executeAgent('groupme', {
      sessionId: writeRequest.created_by,
      groupSummary: sessionData.summaries.groupSummary,
      playerSummaries: sessionData.summaries.playerSummaries,
      appDeepLink: `dndapp://session/${writeRequest.created_by}`
    });

    return {
      writeResult,
      messagingResult
    };
  }

  /**
   * Update workflow status
   */
  updateWorkflowStatus(workflowId, updates) {
    const workflow = this.activeWorkflows.get(workflowId);
    if (workflow) {
      Object.assign(workflow, updates);
      this.activeWorkflows.set(workflowId, workflow);
    }
  }

  /**
   * Get workflow status
   */
  getWorkflowStatus(workflowId) {
    return this.activeWorkflows.get(workflowId);
  }

  /**
   * Get agent
   */
  getAgent(name) {
    return this.agents.get(name);
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

// Export singleton instance
export const orchestrator = new AgentOrchestrator();
