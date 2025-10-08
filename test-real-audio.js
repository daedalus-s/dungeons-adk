// test-real-audio.js - Test with actual speech
import { config } from './config.js';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = `http://localhost:${config.port}`;

async function testRealAudio() {
  console.log('ðŸŽ™ï¸ Testing Real Audio Transcription\n');

  try {
    // Check if file exists
    const audioPath = './uploads/aragorn-goblin.wav';
    if (!fs.existsSync(audioPath)) {
      console.error('âŒ Audio file not found:', audioPath);
      console.log('   Please ensure aragorn-goblin.wav is in the uploads/ folder');
      return;
    }

    const fileSize = fs.statSync(audioPath).size;
    console.log('ðŸ“ Audio file found:', audioPath);
    console.log('   Size:', (fileSize / 1024).toFixed(2), 'KB');

    // 1. Create player
    console.log('\n1ï¸âƒ£ Creating player...');
    const playerRes = await fetch(`${API_URL}/api/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        real_name: 'TestPlayer',
        in_game_name: 'Aragorn',
        race: 'Human',
        role_type: 'Ranger',
        level: 5,
        group: 'Paul'
      })
    });
    const player = await playerRes.json();
    console.log('âœ… Player created:', player.in_game_name);

    // 2. Create session
    console.log('\n2ï¸âƒ£ Creating session...');
    const sessionRes = await fetch(`${API_URL}/api/sessions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        players: [player.id],
        dm_id: 'dm_1'
      })
    });
    const session = await sessionRes.json();
    console.log('âœ… Session created:', session.sessionId);

    // 3. Upload audio file
    console.log('\n3ï¸âƒ£ Uploading and transcribing audio...');
    console.log('   â³ This may take 10-30 seconds...');
    
    const form = new FormData();
    form.append('audio', fs.createReadStream(audioPath));
    form.append('chunkIndex', '0');

    const startTime = Date.now();
    const audioRes = await fetch(`${API_URL}/api/sessions/${session.sessionId}/audio`, {
      method: 'POST',
      body: form
    });

    const result = await audioRes.json();
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`âœ… Completed in ${duration} seconds\n`);

    if (result.error) {
      console.error('âŒ Error:', result.error);
      return;
    }

    // Display results
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸ“ TRANSCRIPTION RESULT');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('Text:', result.transcript?.text || '(no text)');
    console.log('Word count:', result.transcript?.wordCount || 0);
    console.log('Speakers detected:', result.transcript?.speakerCount || 0);
    
    console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('âš”ï¸  EVENTS EXTRACTED');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    
    if (result.events && result.events.length > 0) {
      result.events.forEach((event, i) => {
        console.log(`\n${i + 1}. ${event.type.toUpperCase()}`);
        console.log('   Actor:', event.actor);
        console.log('   Action:', event.action);
        if (event.metadata) {
          console.log('   Metadata:', JSON.stringify(event.metadata, null, 2));
        }
        if (event.isPersonal) {
          console.log('   ðŸŽ¯ Personal event for:', event.personalFor);
        }
      });
    } else {
      console.log('No events detected');
    }

    // 4. End session and get summary
    console.log('\n\n4ï¸âƒ£ Ending session and generating summary...');
    const endRes = await fetch(`${API_URL}/api/sessions/${session.sessionId}/end`, {
      method: 'POST'
    });
    const endResult = await endRes.json();

    console.log('\nâ•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('ðŸ“Š SESSION SUMMARY');
    console.log('â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•');
    console.log('TL;DR:', endResult.summaries?.groupSummary?.tldr);
    console.log('\nFull Summary:');
    console.log(endResult.summaries?.groupSummary?.message_text?.substring(0, 300) + '...');

    console.log('\nâœ¨ Real audio transcription test complete!');

  } catch (error) {
    console.error('\nâŒ Test failed:', error.message);
    console.error(error.stack);
  }
}

testRealAudio();
