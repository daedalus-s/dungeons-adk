import { AgentOrchestrator } from './backend/agents/orchestrator.js';
import { config } from './config.js';

async function testFullWorkflow() {
  console.log('=== Testing Multi-Agent Workflow ===\n');

  const orchestrator = new AgentOrchestrator({
    anthropicApiKey: config.anthropicApiKey,
    mongoUri: config.mongodbUri
  });

  // Wait for MongoDB connection
  await new Promise(resolve => setTimeout(resolve, 2000));

  try {
    // Create test session
    console.log('Creating test session...');
    const stateManager = orchestrator.getAgent('state-manager');
    
    await stateManager.saveSession({
      id: 'session-workflow-test',
      start_ts: new Date(),
      status: 'recording',
      audio_locations: [],
      transcripts: [],
      event_list: []
    });

    // Create test players
    const players = [
      {
        id: 'player-001',
        real_name: 'Alice',
        in_game_name: 'Aragorn',
        race: 'Human',
        role_type: 'Ranger',
        level: 5
      },
      {
        id: 'player-002',
        real_name: 'Bob',
        in_game_name: 'Gandalf',
        race: 'Wizard',
        role_type: 'Mage',
        level: 10
      }
    ];

    for (const player of players) {
      await stateManager.savePlayer(player);
    }

    // Update event extraction agent with players
    const eventAgent = orchestrator.getAgent('event-extraction');
    eventAgent.updatePlayers(players);

    // Simulate transcript
    const transcript = "Aragorn attacks the goblin with his sword, dealing 15 damage! The goblin falls. The party finds 50 gold pieces and a magic healing potion in the goblin's pouch.";

    // Process the session
    const results = await orchestrator.processSessionEnd(
      'session-workflow-test',
      transcript,
      players
    );

    console.log('\n=== Results ===');
    console.log('Events found:', results.events.length);
    console.log('\nEvent details:');
    results.events.forEach((event, i) => {
      console.log(`  ${i+1}. ${event.type}: ${event.action}`);
    });
    
    console.log('\nGroup summary:');
    console.log('  TL;DR:', results.summaries.groupSummary.tldr);
    console.log('  Message:', results.summaries.groupSummary.message_text?.substring(0, 100) + '...');
    
    console.log('\nPlayer summaries:', results.summaries.playerSummaries.length);
    results.summaries.playerSummaries.forEach((summary, i) => {
      console.log(`  ${i+1}. Player ${summary.player_id}:`, summary.message_text?.substring(0, 80) + '...');
    });

    console.log('\nâœ¨ Full workflow test passed!');
    process.exit(0);
  } catch (error) {
    console.log('\nâŒ Workflow test failed:', error.message);
    console.log(error.stack);
    process.exit(1);
  }
}

testFullWorkflow();
