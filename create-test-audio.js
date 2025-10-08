// create-test-audio.js - Generate a test audio file
import fs from 'fs';

// Create a simple WAV header for a 1-second silent audio file
function createTestWAV() {
  const sampleRate = 16000;
  const numChannels = 1;
  const bitsPerSample = 16;
  const duration = 1; // 1 second
  const numSamples = sampleRate * duration;
  const dataSize = numSamples * numChannels * (bitsPerSample / 8);
  
  const buffer = Buffer.alloc(44 + dataSize);
  
  // WAV header
  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(numChannels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
  buffer.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  
  // Silent audio data (all zeros)
  for (let i = 0; i < dataSize; i++) {
    buffer[44 + i] = 0;
  }
  
  return buffer;
}

// Create uploads directory if it doesn't exist
if (!fs.existsSync('./uploads')) {
  fs.mkdirSync('./uploads');
}

// Create test audio file
const testAudio = createTestWAV();
fs.writeFileSync('./uploads/test-audio.wav', testAudio);

console.log('âœ… Created test audio file: uploads/test-audio.wav');
console.log('   Format: 16kHz, 16-bit, mono, 1 second');
console.log('\nâš ï¸  Note: This is a silent audio file for testing.');
console.log('   For real transcription, use actual speech audio.');
