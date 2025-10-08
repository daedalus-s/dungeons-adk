import { BaseAgent } from './backend/agents/base-agent.js';
import dotenv from 'dotenv';

dotenv.config();

// Create a simple test agent
class TestAgent extends BaseAgent {
  constructor(config) {
    super({
      id: 'test-agent',
      name: 'Test Agent',
      role: 'testing',
      ...config
    });
  }

  async execute(input) {
    this.setState('running');
    this.log('info', 'Testing base agent functionality');

    try {
      // Test Claude API call
      const response = await this.callClaude([
        { role: 'user', content: 'Say "Hello from base agent!" and nothing else.' }
      ], { max_tokens: 50 });

      this.setState('completed');
      return response.content[0].text;
    } catch (error) {
      this.handleError(error);
      throw error;
    }
  }
}

// Test it
async function testBaseAgent() {
  console.log('Testing Base Agent...\n');

  const agent = new TestAgent({
    anthropicApiKey: process.env.ANTHROPIC_API_KEY
  });

  // Listen to events
  agent.on('stateChange', (data) => {
    console.log(`State: ${data.previousState} -> ${data.newState}`);
  });

  agent.on('log', (data) => {
    console.log(`Log: [${data.level}] ${data.message}`);
  });

  agent.on('error', (data) => {
    console.log(`Error: ${data.error.message}`);
  });

  try {
    const result = await agent.execute({ test: true });
    console.log('\nâœ… Result:', result);
    console.log('\nâœ¨ Base Agent test passed!');
  } catch (error) {
    console.log('\nâŒ Test failed:', error.message);
  }
}

testBaseAgent();
