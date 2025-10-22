// debug-approvals.js - Comprehensive approval system debugging
import mongoose from 'mongoose';
import { config } from './config.js';

const API_URL = `http://localhost:${config.port}`;

async function debugApprovals() {
  console.log('🔍 Debugging Approval System\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  try {
    // Step 1: Check MongoDB directly
    console.log('1️⃣ Checking MongoDB WriteRequests Collection...\n');
    
    await mongoose.connect(config.mongodbUri);
    
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

    const WriteRequest = mongoose.models.WriteRequest || 
                        mongoose.model('WriteRequest', writeRequestSchema);

    // Count all write requests
    const totalCount = await WriteRequest.countDocuments();
    const pendingCount = await WriteRequest.countDocuments({ status: 'pending' });
    
    console.log(`   Total Write Requests: ${totalCount}`);
    console.log(`   Pending Write Requests: ${pendingCount}`);
    console.log();

    if (totalCount === 0) {
      console.log('   ❌ NO WRITE REQUESTS IN DATABASE!');
      console.log('   This means write requests are not being saved.');
      console.log();
      console.log('   🔍 Checking why...');
      
      // Check sessions
      const sessionSchema = new mongoose.Schema({
        id: String,
        status: String,
        summaries: mongoose.Schema.Types.Mixed
      });
      const Session = mongoose.models.Session || mongoose.model('Session', sessionSchema);
      
      const completedSessions = await Session.find({ status: 'completed' }).limit(3);
      
      console.log(`\n   Found ${completedSessions.length} completed sessions:`);
      completedSessions.forEach(s => {
        console.log(`\n      Session: ${s.id}`);
        console.log(`      Has Summaries: ${!!s.summaries}`);
        if (s.summaries?.sheetsData) {
          console.log(`      Sheet Name: ${s.summaries.sheetsData.sheetName}`);
          console.log(`      Sheet Rows: ${s.summaries.sheetsData.rows?.length || 0}`);
        } else {
          console.log(`      ⚠️  No sheetsData in summaries!`);
        }
      });
      
      console.log('\n   💡 Fix: Run "node fix-existing-sessions.js"');
      await mongoose.connection.close();
      return;
    }

    // Show all write requests
    const allRequests = await WriteRequest.find().sort({ created_ts: -1 });
    
    console.log('   📝 All Write Requests in Database:\n');
    allRequests.forEach((wr, i) => {
      console.log(`   ${i + 1}. ID: ${wr.id}`);
      console.log(`      Sheet: ${wr.target_sheet}`);
      console.log(`      Status: ${wr.status}`);
      console.log(`      Created: ${wr.created_ts?.toISOString()}`);
      console.log(`      Session: ${wr.created_by}`);
      console.log(`      Rows: ${wr.payload?.rows?.length || 0}`);
      console.log();
    });

    await mongoose.connection.close();

    // Step 2: Test API endpoint directly
    console.log('\n2️⃣ Testing API Endpoint...\n');
    
    const apiRes = await fetch(`${API_URL}/api/approvals/pending`);
    console.log(`   Status: ${apiRes.status} ${apiRes.statusText}`);
    
    if (!apiRes.ok) {
      console.log('   ❌ API ERROR!');
      const text = await apiRes.text();
      console.log('   Response:', text);
      return;
    }

    const apiData = await apiRes.json();
    console.log(`   ✅ API returned ${Array.isArray(apiData) ? apiData.length : 'unknown'} items`);
    
    if (Array.isArray(apiData) && apiData.length > 0) {
      console.log('\n   📄 API Response Data:\n');
      apiData.forEach((item, i) => {
        console.log(`   ${i + 1}. ${JSON.stringify(item, null, 6).split('\n').join('\n      ')}`);
      });
    } else if (Array.isArray(apiData) && apiData.length === 0) {
      console.log('   ⚠️  API returned empty array!');
      console.log('   But database has pending items...');
      console.log('   This is a query issue!');
    } else {
      console.log('   ⚠️  API response is not an array:', apiData);
    }

    // Step 3: Test from browser console
    console.log('\n\n3️⃣ Browser Console Test\n');
    console.log('   Open browser console and run:\n');
    console.log('   fetch("http://localhost:3000/api/approvals/pending")');
    console.log('     .then(r => r.json())');
    console.log('     .then(d => console.log("Approvals:", d))');
    console.log();

    // Step 4: Check if sheets agent exists
    console.log('\n4️⃣ Checking Sheets Agent...\n');
    
    const agentRes = await fetch(`${API_URL}/api/agents/health`);
    if (agentRes.ok) {
      const agents = await agentRes.json();
      
      if (agents.sheets) {
        console.log('   ✅ Sheets agent is initialized');
        console.log(`      State: ${agents.sheets.state}`);
      } else {
        console.log('   ❌ Sheets agent NOT initialized!');
        console.log('   Write requests will not be created.');
        console.log();
        console.log('   💡 Fix: Check your .env file:');
        console.log('      GOOGLE_APPLICATION_CREDENTIALS=./config/service-account.json');
        console.log('      GOOGLE_SHEETS_ID=your_sheet_id_here');
      }
    }

    // Step 5: Summary
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📋 SUMMARY\n');
    
    if (totalCount === 0) {
      console.log('❌ Problem: No write requests in database');
      console.log('   → Write requests are not being created');
      console.log('   → Check if sheets agent is initialized');
      console.log('   → Run: node fix-existing-sessions.js');
    } else if (pendingCount === 0) {
      console.log('⚠️  Problem: Write requests exist but none are pending');
      console.log('   → All requests may already be approved/rejected');
      console.log('   → Check request statuses in database');
    } else if (apiData.length === 0) {
      console.log('❌ Problem: Database has pending items but API returns empty');
      console.log('   → Query issue in getPendingWriteRequests()');
      console.log('   → Check state-manager-agent.js');
    } else {
      console.log('✅ Backend is working correctly!');
      console.log(`   → ${apiData.length} pending approval(s)`);
      console.log('   → Frontend issue - check browser console');
      console.log();
      console.log('   💡 Next step:');
      console.log('   1. Open http://localhost:5173/approvals');
      console.log('   2. Open browser DevTools (F12)');
      console.log('   3. Check Console tab for errors');
      console.log('   4. Check Network tab for API calls');
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('\n❌ Debug script failed:', error.message);
    console.error(error.stack);
  }
}

debugApprovals();