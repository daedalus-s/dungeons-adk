import Anthropic from '@anthropic-ai/sdk';
import { EventEmitter } from 'events';

/**
 * BaseAgent - Foundation for all ADK agents
 * Implements core agent lifecycle and communication patterns
 */
export class BaseAgent extends EventEmitter {
  constructor(config) {
    super();
    this.id = config.id;
    this.name = config.name;
    this.role = config.role;
    this.tools = config.tools || [];
    this.state = 'idle'; // idle | running | paused | completed | failed
    this.context = {};

    // Initialize Anthropic client if API key provided
    if (config.anthropicApiKey) {
      this.claude = new Anthropic({
        apiKey: config.anthropicApiKey,
      });
    }
  }

  /**
   * Execute agent's primary task
   * Override in subclasses
   */
  async execute(input) {
    throw new Error(`Agent ${this.name} must implement execute() method`);
  }

  /**
   * Update agent state and emit event
   */
  setState(newState, metadata = {}) {
    const previousState = this.state;
    this.state = newState;
    this.emit('stateChange', {
      agent: this.id,
      previousState,
      newState,
      timestamp: new Date(),
      metadata
    });
  }

  /**
   * Store data in agent context
   */
  setContext(key, value) {
    this.context[key] = value;
    this.emit('contextUpdate', { agent: this.id, key, value });
  }

  /**
   * Retrieve data from agent context
   */
  getContext(key) {
    return this.context[key];
  }

  /**
   * Call Claude API with streaming support
   */
  async callClaude(messages, options = {}) {
    const response = await this.claude.messages.create({
      model: options.model || 'claude-sonnet-4-5-20250929',
      max_tokens: options.max_tokens || 4096,
      messages,
      ...options
    });
    return response;
  }

  /**
   * Stream Claude responses
   */
  async streamClaude(messages, options = {}) {
    const stream = await this.claude.messages.stream({
      model: options.model || 'claude-sonnet-4-5-20250929',
      max_tokens: options.max_tokens || 4096,
      messages,
      ...options
    });

    return stream;
  }

  /**
   * Log agent activity
   */
  log(level, message, data = {}) {
    this.emit('log', {
      agent: this.id,
      level,
      message,
      data,
      timestamp: new Date()
    });
  }

  /**
   * Error handling
   */
  handleError(error, context = {}) {
    this.setState('failed', { error: error.message, context });
    this.emit('error', {
      agent: this.id,
      error,
      context,
      timestamp: new Date()
    });
  }

  /**
   * Cleanup resources
   */
  async cleanup() {
    this.setState('idle');
    this.context = {};
  }
}
