// test-sheets-direct.js - Test direct write to sheets
import { config } from './config.js';

const API_URL = `http://localhost:${config.port}`;

async function testSheetsWrite() {
  console.log('ðŸ§ª Testing Direct Sheets Write\n');

  try {
    // Create player
    console.log('1ï¸âƒ£ Creating player...');
    const playerRes = await fetch(`${API_URL}/api/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        real_name: 'Dave',
        in_game_name: 'Boromir',
        race: 'Human',
        role_type: 'Warrior',
        level: 8,
        group: 'Paul',
        date_joined: '2025-10-08'
      })
    });
    const player = await playerRes.json();
    console.log('âœ… Player created:', player.in_game_name);

    // Create write request
    console.log('\n2ï¸âƒ£ Creating write request for "Full group details"...');
    const writeReqRes = await fetch(`${API_URL}/api/write-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_sheet: 'Full group details',
        payload: {
          real_name: player.real_name,
          in_game_name: player.in_game_name,
          race: player.race,
          role_type: player.role_type,
          level: player.level,
          date_joined: player.date_joined || new Date().toISOString().split('T')[0]
        },
        session_id: 'test-sheets-write'
      })
    });
    const writeRequest = await writeReqRes.json();
    console.log('âœ… Write request created:', writeRequest.id);

    // Approve immediately
    console.log('\n3ï¸âƒ£ Approving...');
    const approvalRes = await fetch(`${API_URL}/api/approvals/${writeRequest.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dm_id: 'dm_1',
        decision: 'approve',
        comment: 'Test write'
      })
    });
    const approval = await approvalRes.json();
    
    if (approval.writeResult) {
      console.log('âœ… Successfully wrote to Google Sheets!');
      console.log('   Range:', approval.writeResult.range);
      console.log('\nðŸ“Š Check your Google Sheet "Full group details" tab');
    } else {
      console.log('âš ï¸  Approval succeeded but no write result');
      console.log('   Response:', JSON.stringify(approval, null, 2));
    }

  } catch (error) {
    console.error('\nâŒ Test failed:', error.message);
  }
}

testSheetsWrite();
