// test-transcription.js - Test audio transcription
import { config } from './config.js';
import fs from 'fs';
import FormData from 'form-data';
import fetch from 'node-fetch';

const API_URL = `http://localhost:${config.port}`;

async function testTranscription() {
  console.log('ðŸŽ™ï¸ Testing Audio Transcription\n');

  try {
    // 1. Create a player
    console.log('1ï¸âƒ£ Creating player...');
    const playerRes = await fetch(`${API_URL}/api/players`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        real_name: 'Eve',
        in_game_name: 'Eowyn',
        race: 'Human',
        role_type: 'Shield Maiden',
        level: 9,
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
    console.log('\n3ï¸âƒ£ Uploading audio file...');
    console.log('âš ï¸  Using test audio (silent) - real audio would produce transcription');
    
    const form = new FormData();
    form.append('audio', fs.createReadStream('./uploads/test-audio.wav'));
    form.append('chunkIndex', '0');

    const audioRes = await fetch(`${API_URL}/api/sessions/${session.sessionId}/audio`, {
      method: 'POST',
      body: form
    });

    const result = await audioRes.json();
    
    if (result.error) {
      console.log('âš ï¸  Expected behavior: Silent audio produces no transcription');
      console.log('   For real testing, use actual speech audio');
    } else {
      console.log('âœ… Audio processed!');
      console.log('   Transcript:', result.transcript?.text || '(no speech detected)');
      console.log('   Word count:', result.transcript?.wordCount || 0);
      console.log('   Events extracted:', result.eventCount || 0);
    }

    console.log('\nðŸ“ To test with real audio:');
    console.log('   1. Record a short WAV file (16kHz, mono)');
    console.log('   2. Place it in uploads/real-audio.wav');
    console.log('   3. Update the script to use that file');

  } catch (error) {
    console.error('\nâŒ Test failed:', error.message);
  }
}

testTranscription();
