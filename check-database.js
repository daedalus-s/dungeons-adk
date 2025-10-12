// check-database.js - Inspect MongoDB data without mongosh
import mongoose from 'mongoose';
import { config } from './config.js';

async function checkDatabase() {
  console.log('🔍 Checking Dungeons ADK Database...\n');

  try {
    // Connect to MongoDB
    await mongoose.connect(config.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    // Define schemas (same as in state-manager-agent.js)
    const sessionSchema = new mongoose.Schema({
      id: String,
      start_ts: Date,
      end_ts: Date,
      status: String,
      audio_locations: [String],
      transcripts: [mongoose.Schema.Types.Mixed],
      event_list: [mongoose.Schema.Types.Mixed],
      summaries: mongoose.Schema.Types.Mixed,
      summary_sent: Boolean
    });

    const playerSchema = new mongoose.Schema({
      id: String,
      real_name: String,
      in_game_name: String,
      race: String,
      role_type: String,
      level: Number,
      group: String
    });

    const writeRequestSchema = new mongoose.Schema({
      id: String,
      target_sheet: String,
      payload: mongoose.Schema.Types.Mixed,
      created_by: String,
      created_ts: Date,
      status: String,
      approved_by_dm: String,
      approval_ts: Date
    });

    // Get or create models
    const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
    const Player = mongoose.models.Player || mongoose.model('Player', playerSchema);
    const WriteRequest = mongoose.models.WriteRequest || mongoose.model('WriteRequest', writeRequestSchema);

    // Count documents
    const sessionCount = await Session.countDocuments();
    const playerCount = await Player.countDocuments();
    const writeRequestCount = await WriteRequest.countDocuments();

    console.log('📊 Collection Counts:');
    console.log(`   Sessions: ${sessionCount}`);
    console.log(`   Players: ${playerCount}`);
    console.log(`   Write Requests: ${writeRequestCount}`);
    console.log();

    // Show players
    if (playerCount > 0) {
      console.log('👥 Players:');
      const players = await Player.find().limit(10);
      players.forEach(p => {
        console.log(`   - ${p.in_game_name} (${p.real_name}) - L${p.level} ${p.role_type} [${p.group}]`);
      });
      console.log();
    }

    // Show sessions
    if (sessionCount > 0) {
      console.log('📝 Recent Sessions:');
      const sessions = await Session.find().sort({ start_ts: -1 }).limit(5);
      
      for (const session of sessions) {
        console.log(`\n   Session: ${session.id}`);
        console.log(`   Status: ${session.status}`);
        console.log(`   Started: ${session.start_ts?.toLocaleString() || 'N/A'}`);
        console.log(`   Ended: ${session.end_ts?.toLocaleString() || 'N/A'}`);
        console.log(`   Events: ${session.event_list?.length || 0}`);
        console.log(`   Has Summaries: ${!!session.summaries ? 'YES' : 'NO'}`);
        
        if (session.summaries) {
          console.log(`   ├─ Group Summary: ${session.summaries.groupSummary?.tldr?.substring(0, 60) || 'N/A'}...`);
          console.log(`   ├─ Player Summaries: ${session.summaries.playerSummaries?.length || 0}`);
          console.log(`   └─ Sheets Data: ${session.summaries.sheetsData ? 'YES' : 'NO'}`);
          
          if (session.summaries.sheetsData) {
            console.log(`      Sheet Name: ${session.summaries.sheetsData.sheetName}`);
            console.log(`      Rows: ${session.summaries.sheetsData.rows?.length || 0}`);
          }
        }
        
        if (session.event_list?.length > 0) {
          console.log(`\n   Sample Events:`);
          session.event_list.slice(0, 3).forEach((event, i) => {
            console.log(`   ${i + 1}. ${event.type.toUpperCase()}: ${event.action}`);
            if (event.metadata) {
              const meta = Object.entries(event.metadata)
                .filter(([k, v]) => v != null)
                .map(([k, v]) => `${k}=${v}`)
                .join(', ');
              if (meta) console.log(`      (${meta})`);
            }
          });
        }
      }
      console.log();
    }

    // Show write requests
    if (writeRequestCount > 0) {
      console.log('✍️  Write Requests:');
      const writeRequests = await WriteRequest.find().sort({ created_ts: -1 }).limit(5);
      
      writeRequests.forEach(wr => {
        console.log(`\n   Request: ${wr.id}`);
        console.log(`   Sheet: ${wr.target_sheet}`);
        console.log(`   Status: ${wr.status}`);
        console.log(`   Created: ${wr.created_ts?.toLocaleString() || 'N/A'}`);
        console.log(`   Session: ${wr.created_by}`);
        
        if (wr.payload?.rows) {
          console.log(`   Rows: ${wr.payload.rows.length}`);
        }
      });
      console.log();
    } else {
      console.log('⚠️  No Write Requests Found!');
      console.log('   Possible reasons:');
      console.log('   1. Session not ended yet (click "End Session" button)');
      console.log('   2. Summaries failed to generate');
      console.log('   3. Sheets agent not creating write requests');
      console.log();
    }

    // Summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 Summary:');
    if (sessionCount === 0) {
      console.log('   ❌ No sessions found - start a recording!');
    } else if (writeRequestCount === 0) {
      console.log('   ⚠️  Sessions exist but no write requests');
      console.log('   → Make sure to click "End Session" button');
      console.log('   → Check backend logs for errors');
    } else {
      console.log('   ✅ System working - data is flowing!');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Database check failed:', error.message);
  } finally {
    await mongoose.connection.close();
    console.log('\n✅ Database connection closed');
  }
}

checkDatabase();