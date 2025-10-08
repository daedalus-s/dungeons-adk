// test-approval-workflow.js
import { config } from './config.js';

const API_URL = `http://localhost:${config.port}`;

async function testApprovalWorkflow() {
  console.log('ðŸ§ª Testing Approval Workflow\n');

  try {
    // 1. Create a player
    console.log('1ï¸âƒ£ Creating player...');
    const playerRes = await fetch(`${API_URL}/api/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        real_name: 'Charlie',
        in_game_name: 'Legolas',
        race: 'Elf',
        role_type: 'Archer',
        level: 7,
        group: 'Paul'
      })
    });
    const player = await playerRes.json();
    console.log('âœ… Player created:', player.in_game_name);

    // 2. Create write request manually
    console.log('\n2ï¸âƒ£ Creating write request...');
    const writeReqRes = await fetch(`${API_URL}/api/write-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        target_sheet: 'Full group details',
        payload: player,
        session_id: 'test-session-approval'
      })
    });
    const writeRequest = await writeReqRes.json();
    console.log('âœ… Write request created:', writeRequest.id);
    console.log('   Status:', writeRequest.status);

    // 3. Check pending approvals
    console.log('\n3ï¸âƒ£ Checking pending approvals...');
    const pendingRes = await fetch(`${API_URL}/api/approvals/pending`);
    const pending = await pendingRes.json();
    console.log(`âœ… Found ${pending.length} pending approval(s)`);

    // 4. Approve the request
    console.log('\n4ï¸âƒ£ Approving write request...');
    const approvalRes = await fetch(`${API_URL}/api/approvals/${writeRequest.id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        dm_id: 'dm_1',
        decision: 'approve',
        comment: 'Looks good!'
      })
    });
    const approval = await approvalRes.json();
    console.log('âœ… Request approved!');
    if (approval.writeResult) {
      console.log('   Wrote to sheet:', approval.writeResult.range);
    }

    console.log('\nðŸŽ‰ Approval workflow test complete!');

  } catch (error) {
    console.error('\nâŒ Test failed:', error.message);
  }
}

testApprovalWorkflow();
