// create-test-approval.js - Manually create a test write request
import mongoose from 'mongoose';
import { config } from './config.js';

async function createTestApproval() {
  console.log('🧪 Creating Test Write Request\n');

  try {
    await mongoose.connect(config.mongodbUri);
    console.log('✅ Connected to MongoDB\n');

    // Define schema
    const writeRequestSchema = new mongoose.Schema({
      id: String,
      target_sheet: String,
      payload: mongoose.Schema.Types.Mixed,
      created_by: String,
      created_ts: Date,
      status: String,
      approved_by_dm: String,
      approval_ts: Date,
      rejection_reason: String
    });

    const WriteRequest = mongoose.models.WriteRequest || 
                        mongoose.model('WriteRequest', writeRequestSchema);

    // Create test write request
    const testRequest = {
      id: `wr_test_${Date.now()}`,
      target_sheet: '2025-10-12 Gameplay - TEST',
      payload: {
        sheetName: '2025-10-12 Gameplay - TEST',
        rows: [
          {
            Group: 'Paul',
            Quantity: 100,
            Item: 'Test Gold Pieces',
            'Gold Value': 1,
            'Total Value': 100,
            'Distributed To': 'Test Party',
            'Sold To': '',
            'Lesson Learns': 'This is a test entry',
            Player: '',
            Character: 'Test Character',
            'Group (Paul\'s group or Jonathan\'s group)': 'Paul'
          },
          {
            Group: 'Paul',
            Quantity: 1,
            Item: 'Test Magic Sword',
            'Gold Value': 500,
            'Total Value': 500,
            'Distributed To': 'Test Party',
            'Sold To': '',
            'Lesson Learns': 'Found in test dungeon',
            Player: '',
            Character: 'Test Character',
            'Group (Paul\'s group or Jonathan\'s group)': 'Paul'
          }
        ]
      },
      created_by: 'test_session',
      created_ts: new Date(),
      status: 'pending',
      approved_by_dm: null,
      approval_ts: null,
      rejection_reason: null
    };

    console.log('Creating write request:');
    console.log(`   ID: ${testRequest.id}`);
    console.log(`   Sheet: ${testRequest.target_sheet}`);
    console.log(`   Rows: ${testRequest.payload.rows.length}`);
    console.log(`   Status: ${testRequest.status}`);
    console.log();

    const doc = new WriteRequest(testRequest);
    await doc.save();

    console.log('✅ Test write request created!\n');

    // Verify it was saved
    const count = await WriteRequest.countDocuments({ status: 'pending' });
    console.log(`📊 Total pending write requests: ${count}\n`);

    // Show all pending
    const pending = await WriteRequest.find({ status: 'pending' });
    console.log('📝 All Pending Write Requests:\n');
    pending.forEach((req, i) => {
      console.log(`   ${i + 1}. ${req.id}`);
      console.log(`      Sheet: ${req.target_sheet}`);
      console.log(`      Created: ${req.created_ts?.toISOString()}`);
      console.log(`      Rows: ${req.payload?.rows?.length || 0}`);
      console.log();
    });

    await mongoose.connection.close();

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎯 NEXT STEPS:\n');
    console.log('1. Restart backend: npm run dev');
    console.log('2. Open: http://localhost:5173/approvals');
    console.log('3. You should see the test write request!');
    console.log('4. If not, run: node debug-approvals.js');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  } catch (error) {
    console.error('❌ Failed:', error.message);
    console.error(error.stack);
  }
}

createTestApproval();