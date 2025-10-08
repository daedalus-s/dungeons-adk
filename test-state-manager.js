import { StateManagerAgent } from './backend/agents/state-manager-agent.js';
import dotenv from 'dotenv';

dotenv.config();

async function testStateManager() {
  console.log('Testing State Manager Agent...\n');

  const agent = new StateManagerAgent({
    mongoUri: process.env.MONGODB_URI
  });

  // Wait for connection
  await new Promise(resolve => setTimeout(resolve, 1000));

  try {
    // Test 1: Create a session
    console.log('Test 1: Creating session...');
    const session = await agent.saveSession({
      id: 'test-session-001',
      start_ts: new Date(),
      status: 'recording',
      audio_locations: [],
      transcripts: [],
      event_list: []
    });
    console.log(' Session created:', session.id);

    // Test 2: Retrieve session
    console.log('\nTest 2: Retrieving session...');
    const retrieved = await agent.getSession('test-session-001');
    console.log(' Session retrieved:', retrieved.id, '- Status:', retrieved.status);

    // Test 3: Create a player
    console.log('\nTest 3: Creating player...');
    const player = await agent.savePlayer({
      id: 'player-001',
      real_name: 'Alice',
      in_game_name: 'Aragorn',
      race: 'Human',
      role_type: 'Ranger',
      level: 5,
      group: 'Paul'
    });
    console.log(' Player created:', player.in_game_name);

    // Test 4: Retrieve player
    console.log('\nTest 4: Retrieving player...');
    const retrievedPlayer = await agent.getPlayer('player-001');
    console.log(' Player retrieved:', retrievedPlayer.in_game_name, 'Level', retrievedPlayer.level);

    console.log('\n All State Manager tests passed!');
    process.exit(0);
  } catch (error) {
    console.log('\n Test failed:', error.message);
    process.exit(1);
  }
}

testStateManager();
