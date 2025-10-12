// fix-existing-sessions.js - Reprocess sessions that have summaries but no write requests
import { config } from './config.js';

const API_URL = `http://localhost:${config.port}`;

async function fixExistingSessions() {
  console.log('🔧 Fixing Existing Sessions...\n');

  try {
    // Get all sessions
    const response = await fetch(`${API_URL}/api/sessions`);
    const sessions = await response.json();

    console.log(`Found ${sessions.length} total sessions\n`);

    // Filter sessions that need fixing:
    // - Status is "recording" with events (need to be ended)
    // - Status is "completed" but no write request created
    
    const needsEnding = sessions.filter(s => s.status === 'recording' && s.event_count > 0);
    const needsWriteRequest = sessions.filter(s => s.status === 'completed' && s.has_summaries);

    console.log('📊 Sessions needing attention:');
    console.log(`   🔄 Need to be ended: ${needsEnding.length}`);
    console.log(`   📝 Need write requests: ${needsWriteRequest.length}`);
    console.log();

    // Fix sessions that need ending
    for (const session of needsEnding) {
      console.log(`\n🔄 Ending session: ${session.id}`);
      console.log(`   Events: ${session.event_count}`);
      
      try {
        const endRes = await fetch(`${API_URL}/api/sessions/${session.id}/end`, {
          method: 'POST'
        });

        if (endRes.ok) {
          const result = await endRes.json();
          console.log('   ✅ Session ended successfully');
          
          if (result.summaries?.sheetsData?.rows?.length > 0) {
            console.log(`   ✅ Generated ${result.summaries.sheetsData.rows.length} sheet rows`);
          } else {
            console.log('   ⚠️  No sheet rows generated');
          }
        } else {
          console.log(`   ❌ Failed: ${endRes.status}`);
        }

        // Wait a bit between requests
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.log(`   ❌ Error: ${error.message}`);
      }
    }

    // Check approval queue
    console.log('\n\n📋 Checking approval queue...');
    const approvalsRes = await fetch(`${API_URL}/api/approvals/pending`);
    const approvals = await approvalsRes.json();
    
    console.log(`✅ Pending approvals: ${approvals.length}`);
    
    if (approvals.length > 0) {
      console.log('\n📝 Pending Write Requests:');
      approvals.forEach((approval, i) => {
        console.log(`\n   ${i + 1}. Request ID: ${approval.id.slice(-8)}`);
        console.log(`      Sheet: ${approval.target_sheet}`);
        console.log(`      Session: ${approval.created_by}`);
        console.log(`      Rows: ${approval.payload?.rows?.length || 0}`);
        
        if (approval.payload?.rows?.length > 0) {
          console.log(`      Sample items:`);
          approval.payload.rows.slice(0, 2).forEach(row => {
            console.log(`         - ${row.Item} (${row.Quantity}x @ ${row['Gold Value']}gp)`);
          });
        }
      });
      
      console.log('\n\n🎯 Next step: Go to http://localhost:5173/approvals to review and approve!');
    } else {
      console.log('\n⚠️  Still no write requests. Checking why...\n');
      
      // Diagnose the issue
      const diagRes = await fetch(`${API_URL}/api/stats`);
      const stats = await diagRes.json();
      
      console.log('📊 System Stats:');
      console.log(`   Completed Sessions: ${stats.completedSessions}`);
      console.log(`   Total Events: ${stats.totalEvents}`);
      
      if (stats.completedSessions > 0 && stats.totalEvents > 0) {
        console.log('\n🔍 Possible issues:');
        console.log('   1. Sheets agent not initialized (check .env)');
        console.log('   2. Summaries generated but no sheetsData');
        console.log('   3. sheetsData.rows is empty array');
        
        console.log('\n💡 Debug commands:');
        console.log('   node check-agents.js    # Check if sheets agent exists');
        console.log('   node check-database.js  # See full session details');
      }
    }

    console.log('\n✅ Fix script complete!');

  } catch (error) {
    console.error('❌ Script failed:', error.message);
    console.error(error.stack);
  }
}

fixExistingSessions();